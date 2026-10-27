import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import importlib.util
from pathlib import Path
import threading
import unittest
from unittest.mock import MagicMock, patch


spec = importlib.util.spec_from_file_location("dashboard_proxy", Path(__file__).parents[1] / "proxy_server_render.py")
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)

INITIAL = copy.deepcopy(proxy.latest_data)
NOW = 1_800_000_000


def payloads():
    return {
        "fiat": {key: {"price": 1000, "variation": 0} for key in ("ccl", "mep", "blue", "oficial", "mayorista")},
        "exchanges": {"fiwind": {"totalAsk": 1010, "totalBid": 1000}},
        "p2p": {"totalAsk": 1005, "totalBid": 995},
        "inflation": [{"fecha": "2026-09-30", "valor": 2.1}],
    }


class ProxyTests(unittest.TestCase):
    def setUp(self):
        proxy.latest_data = copy.deepcopy(INITIAL)
        self.clock = patch.object(proxy.time, "time", return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.logger = patch.object(proxy.logger, "warning")
        self.logger.start()
        self.addCleanup(self.logger.stop)

    def refresh(self, values, failures=()):
        def fetch(source, url):
            if source in failures:
                raise RuntimeError(f"{source} unavailable")
            return values[source]
        with patch.object(proxy, "_fetch_payload", side_effect=fetch), ThreadPoolExecutor(max_workers=4) as executor:
            proxy.refresh_data(executor)

    def test_successful_batch_has_utc_timestamp_and_complete_data(self):
        self.refresh(payloads())
        result = proxy.snapshot_data()
        self.assertEqual(result["status"], "ok")
        self.assertFalse(result["stale"])
        self.assertEqual(result["age_seconds"], 0)
        self.assertEqual(set(result["source_updated_at"]), set(proxy.UPSTREAMS))
        self.assertEqual(result["last_updated"], datetime.fromtimestamp(NOW, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"))

    def test_partial_failure_preserves_failed_source_and_marks_data_degraded(self):
        self.refresh(payloads())
        first_updated = proxy.latest_data["last_updated"]
        changed = payloads()
        changed["p2p"]["totalAsk"] = 1200
        with patch.object(proxy.time, "time", return_value=NOW + 10):
            self.refresh(changed, failures=("exchanges",))
            result = proxy.snapshot_data()
        self.assertEqual(result["usdt_raw"]["exchanges"], payloads()["exchanges"])
        self.assertEqual(result["usdt_raw"]["p2p"]["totalAsk"], 1200)
        self.assertEqual(result["last_updated"], first_updated)
        self.assertEqual(result["status"], "degraded")
        self.assertTrue(result["stale"])
        self.assertIn("exchanges", result["errors"])
        self.assertNotEqual(result["source_updated_at"]["p2p"], result["source_updated_at"]["exchanges"])

    def test_all_upstream_failures_do_not_fabricate_a_success(self):
        self.refresh(payloads(), failures=proxy.UPSTREAMS)
        result = proxy.snapshot_data()
        self.assertEqual(result["status"], "initializing")
        self.assertTrue(result["stale"])
        self.assertIsNone(result["last_updated"])
        self.assertEqual(set(result["errors"]), set(proxy.UPSTREAMS))

    def test_previous_success_expires_even_if_the_polling_thread_stops(self):
        self.refresh(payloads())
        with patch.object(proxy.time, "time", return_value=NOW + proxy.STALE_AFTER_SECONDS + 1):
            result = proxy.snapshot_data()
        self.assertTrue(result["stale"])
        self.assertEqual(result["status"], "degraded")

    def test_recovery_clears_previous_errors(self):
        self.refresh(payloads(), failures=("inflation",))
        self.refresh(payloads())
        result = proxy.snapshot_data()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["errors"], {})

    def test_snapshots_are_detached_from_shared_storage(self):
        self.refresh(payloads())
        result = proxy.snapshot_data()
        result["fiat"]["ccl"]["price"] = 0
        self.assertEqual(proxy.latest_data["fiat"]["ccl"]["price"], 1000)

    def test_upstream_status_is_checked_before_json_and_has_bounded_timeout(self):
        session = MagicMock()
        response = session.get.return_value
        response.raise_for_status.side_effect = RuntimeError("HTTP 503")
        with patch.object(proxy, "_sessions", threading.local()) as sessions:
            sessions.http = session
            with self.assertRaisesRegex(RuntimeError, "HTTP 503"):
                proxy._fetch_payload("p2p", "https://example.invalid/p2p")
        response.json.assert_not_called()
        session.get.assert_called_once_with("https://example.invalid/p2p", timeout=(3.05, 10))

    def test_invalid_upstream_schemas_are_rejected(self):
        malformed = {
            "fiat": {"blue": {"price": "not a number"}},
            "exchanges": {"provider": {"totalAsk": -1, "totalBid": 0}},
            "p2p": {"totalAsk": float("inf"), "totalBid": 900},
            "inflation": [{"fecha": "2026-09-30", "valor": True}],
        }
        for source, value in malformed.items():
            with self.subTest(source=source), self.assertRaises(ValueError):
                proxy._validate_payload(source, value)

    def test_valid_upstream_schemas_are_accepted_including_nested_fiat(self):
        values = payloads()
        values["fiat"]["ccl"] = {"al30": {"24hs": {"price": 1200}}}
        for source, value in values.items():
            with self.subTest(source=source):
                self.assertIs(proxy._validate_payload(source, value), value)

    def test_wsgi_updater_is_started_only_once(self):
        with patch.object(proxy, "_worker_thread", None), patch.object(proxy.threading, "Thread") as thread:
            thread.return_value.is_alive.return_value = True
            proxy.ensure_updater()
            proxy.ensure_updater()
            thread.assert_called_once()
            thread.return_value.start.assert_called_once()

    def test_routes_expose_liveness_readiness_and_no_store_headers(self):
        with patch.object(proxy, "ensure_updater") as ensure:
            client = proxy.app.test_client()
            self.assertEqual(client.get("/").status_code, 200)
            self.assertEqual(client.get("/ready").status_code, 503)
            result = client.get("/data")
            self.assertEqual(result.status_code, 200)
            self.assertTrue(result.json["stale"])
            self.assertEqual(result.headers["Cache-Control"], "no-store")
            self.assertEqual(result.headers["Access-Control-Allow-Origin"], proxy.ALLOWED_ORIGIN)
            self.assertEqual(ensure.call_count, 3)
            client.options("/data")
            self.assertEqual(ensure.call_count, 3)
            self.refresh(payloads())
            self.assertEqual(client.get("/ready").status_code, 200)


if __name__ == "__main__":
    unittest.main()
