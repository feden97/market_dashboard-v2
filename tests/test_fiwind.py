import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from scripts.collect_fiwind import API_URL, append_quote, collect, normalize_quote

NOW = 1793977200  # 2026-11-06T15:00:00Z, on a 15-minute bucket boundary


def quote(age=0, bid=1.035, ask=1.04):
    return {"time": NOW - age, "bid": bid, "ask": ask}


class FiwindCollectionTests(unittest.TestCase):
    def test_new_history_and_idempotent_bucket(self):
        first = append_quote(None, quote(), NOW)
        self.assertEqual(first["source"], API_URL)
        self.assertEqual(first["interval_seconds"], 900)
        again = append_quote(first, quote(-30, 1.036), NOW + 30)
        self.assertEqual(again, first)
        later = append_quote(first, quote(-900), NOW + 900)
        self.assertEqual(later["quotes"], [quote(), quote(-900)])

    def test_does_not_backfill_missing_buckets_or_flat_prices(self):
        first = append_quote(None, quote(), NOW)
        later = append_quote(first, quote(-3600), NOW + 3600)
        self.assertEqual(len(later["quotes"]), 2)
        self.assertEqual(later["quotes"][-1]["time"] - later["quotes"][0]["time"], 3600)

    def test_bad_and_stale_api_data_rejected(self):
        for payload in [None, {}, quote(181), quote(-61), quote(0, float("nan")),
                        quote(0, float("inf")), quote(0, True), quote(0, 1.1, 1),
                        quote(0, 0.5), {**quote(), "time": True}]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                normalize_quote(payload, NOW)

    def test_corrupt_history_and_out_of_order_quote_never_replace_storage(self):
        for history in [{}, {"version": 1, "source": API_URL, "quotes": None},
                        {"version": 1, "source": API_URL, "quotes": [{}]},
                        {"version": 1, "source": "wrong source", "quotes": []}]:
            with self.assertRaises(ValueError):
                append_quote(history, quote(), NOW)
        first = append_quote(None, quote(), NOW)
        with self.assertRaises(ValueError):
            append_quote(first, quote(30), NOW)

    def test_disk_collection_and_failed_response_preserve_existing_history(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "fiwind.json"
            response = Mock()
            response.json.return_value = quote()
            request = Mock(return_value=response)
            self.assertTrue(collect(output, NOW, request))
            saved = output.read_bytes()
            self.assertEqual(json.loads(saved)["quotes"], [quote()])
            self.assertFalse(collect(output, NOW + 30, request))
            self.assertEqual(output.read_bytes(), saved)
            response.json.return_value = quote(181)
            with self.assertRaises(ValueError):
                collect(output, NOW, request)
            self.assertEqual(output.read_bytes(), saved)
            response.raise_for_status.side_effect = RuntimeError("HTTP 503")
            with self.assertRaises(RuntimeError):
                collect(output, NOW, request)
            self.assertEqual(output.read_bytes(), saved)
            output.write_text("corrupt", encoding="utf-8")
            with self.assertRaises(json.JSONDecodeError):
                collect(output, NOW, request)
            self.assertEqual(output.read_text(encoding="utf-8"), "corrupt")


if __name__ == "__main__":
    unittest.main()
