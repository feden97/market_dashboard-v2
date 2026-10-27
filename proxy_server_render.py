"""Small polling proxy, usable with both `python` and a WSGI server."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import datetime, timezone
import logging
import math
import os
import threading
import time

from flask import Flask, jsonify, request
import requests

app = Flask(__name__)
logger = logging.getLogger(__name__)

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
REFRESH_INTERVAL_SECONDS = 10
STALE_AFTER_SECONDS = 60
CRYPTO_BASE = "https://criptoya.com/api"
ARG_BASE = "https://api.argentinadatos.com/v1"
UPSTREAMS = {
    "fiat": f"{CRYPTO_BASE}/dolar",
    "exchanges": f"{CRYPTO_BASE}/usdt/ars/0.1",
    "p2p": f"{CRYPTO_BASE}/binancep2p/usdt/ars/0.1",
    "inflation": f"{ARG_BASE}/finanzas/indices/inflacion",
}

latest_data = {
    "status": "initializing",
    "last_updated": None,
    "last_attempted": None,
    "fiat": {},
    "usdt_raw": {"exchanges": {}, "p2p": {}},
    "live_inflation": [],
    "source_updated_at": {},
    "errors": {},
    "stale": True,
}

_data_lock = threading.Lock()
_worker_lock = threading.Lock()
_stop_event = threading.Event()
_worker_thread = None
_sessions = threading.local()


def _timestamp():
    return datetime.fromtimestamp(time.time(), timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _positive_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def _valid_quote(value):
    return isinstance(value, dict) and _positive_number(value.get("totalAsk")) and _positive_number(value.get("totalBid"))


def _valid_fiat_quote(value):
    if not isinstance(value, dict):
        return False
    if isinstance(value.get("al30"), dict):
        value = value["al30"].get("24hs") or value["al30"].get("ci") or {}
    return isinstance(value, dict) and (_positive_number(value.get("price")) or _positive_number(value.get("ask")))


def _validate_payload(source, payload):
    if source == "fiat":
        valid = isinstance(payload, dict) and all(
            _valid_fiat_quote(payload.get(key))
            for key in ("ccl", "mep", "blue", "oficial", "mayorista")
        )
    elif source == "exchanges":
        valid = isinstance(payload, dict) and any(_valid_quote(value) for value in payload.values())
    elif source == "p2p":
        valid = _valid_quote(payload)
    elif source == "inflation":
        valid = isinstance(payload, list) and bool(payload) and all(
            isinstance(row, dict) and isinstance(row.get("fecha"), str)
            and isinstance(row.get("valor"), (int, float))
            and not isinstance(row["valor"], bool) and math.isfinite(row["valor"])
            for row in payload
        )
    else:
        valid = False
    if not valid:
        raise ValueError(f"Invalid {source} response schema")
    return payload


def _fetch_payload(source, url):
    # A session per executor thread reuses connections without sharing mutable
    # requests.Session state between simultaneous upstream requests.
    if not hasattr(_sessions, "http"):
        _sessions.http = requests.Session()
        _sessions.http.headers.update({"User-Agent": "DashboardFinanciero/2.0"})
    response = _sessions.http.get(url, timeout=(3.05, 10))
    response.raise_for_status()
    return _validate_payload(source, response.json())


def refresh_data(executor):
    """Update successful sources and retain the previous values of failed ones."""
    futures = {executor.submit(_fetch_payload, source, url): source for source, url in UPSTREAMS.items()}
    values, errors = {}, {}
    for future in as_completed(futures):
        source = futures[future]
        try:
            values[source] = future.result()
        except Exception as error:
            errors[source] = str(error)
            logger.warning("Upstream %s failed: %s", source, error)

    now = _timestamp()
    with _data_lock:
        latest_data["last_attempted"] = now
        latest_data["errors"] = errors
        if "fiat" in values:
            latest_data["fiat"] = {key: values["fiat"].get(key, {}) for key in ("ccl", "mep", "blue", "oficial", "mayorista")}
        for source in ("exchanges", "p2p"):
            if source in values:
                latest_data["usdt_raw"][source] = values[source]
        if "inflation" in values:
            latest_data["live_inflation"] = values["inflation"]
        latest_data["source_updated_at"].update({source: now for source in values})
        if not errors:
            latest_data["last_updated"] = now
        latest_data["status"] = "ok" if not errors else ("degraded" if latest_data["source_updated_at"] else "initializing")
        latest_data["stale"] = bool(errors)


def fetch_data_loop():
    with ThreadPoolExecutor(max_workers=len(UPSTREAMS), thread_name_prefix="upstream") as executor:
        while not _stop_event.is_set():
            try:
                refresh_data(executor)
            except Exception:
                logger.exception("Unexpected proxy refresh failure")
            _stop_event.wait(REFRESH_INTERVAL_SECONDS)


def ensure_updater():
    """Start once per process, also when a WSGI server imports this module."""
    global _worker_thread
    with _worker_lock:
        if _worker_thread is not None and _worker_thread.is_alive():
            return
        _stop_event.clear()
        _worker_thread = threading.Thread(target=fetch_data_loop, daemon=True, name="dashboard-refresh")
        _worker_thread.start()


def snapshot_data():
    with _data_lock:
        data = deepcopy(latest_data)
    last_updated = data["last_updated"]
    age = None if last_updated is None else max(0, time.time() - datetime.fromisoformat(last_updated.replace("Z", "+00:00")).timestamp())
    data["age_seconds"] = None if age is None else int(age)
    data["stale"] = bool(data["errors"]) or age is None or age > STALE_AFTER_SECONDS
    data["status"] = ("degraded" if data["source_updated_at"] else "initializing") if data["stale"] else "ok"
    return data


@app.before_request
def start_updater_for_wsgi():
    if request.method != "OPTIONS":
        ensure_updater()


@app.after_request
def response_headers(response):
    response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.route("/")
def health_check():
    """Liveness stays independent of upstream API availability."""
    return "Proxy is Awake", 200


@app.route("/ready")
def readiness():
    data = snapshot_data()
    return jsonify({key: data[key] for key in ("status", "stale", "last_updated", "errors")}), 503 if data["stale"] else 200


@app.route("/data")
def get_data():
    return jsonify(snapshot_data())


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ensure_updater()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), use_reloader=False)
