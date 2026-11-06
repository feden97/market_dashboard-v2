"""Collect the same Fiwind USDT/USD bid/ask used by the Telegram bot.

Run independently of the daily macro snapshot. A failed/stale API response
never overwrites history, and reruns in the same 15-minute bucket are idempotent.
"""
import argparse
import json
import math
import time
from pathlib import Path

import requests

API_URL = "https://criptoya.com/api/fiwind/usdt/usd"
INTERVAL_SECONDS = 900


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError("Invalid numeric value")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite value")
    return result


def normalize_quote(payload, now, fresh=True):
    if not isinstance(payload, dict):
        raise ValueError("Invalid quote")
    bid, ask, timestamp = (number(payload.get(key)) for key in ("bid", "ask", "time"))
    if not (0.5 < bid <= ask < 2):
        raise ValueError("Invalid Fiwind USDT/USD prices")
    age = now - timestamp
    if timestamp < 1577836800 or age < -60 or (fresh and age > 180):
        raise ValueError("Stale or invalid quote timestamp")
    return {"time": int(timestamp), "bid": bid, "ask": ask}


def append_quote(history, payload, now):
    quote = normalize_quote(payload, now)
    if history is None:
        history = {"version": 1, "source": API_URL, "interval_seconds": INTERVAL_SECONDS, "quotes": []}
    if not isinstance(history, dict) or history.get("version") != 1 or history.get("source") != API_URL:
        raise ValueError("Unrecognized history; refusing to replace it")
    rows = history.get("quotes")
    if not isinstance(rows, list):
        raise ValueError("Invalid history; refusing to replace it")
    rows = [normalize_quote(row, now, fresh=False) for row in rows]
    buckets = {}
    for row in sorted(rows, key=lambda row: row["time"]):
        buckets.setdefault(row["time"] // INTERVAL_SECONDS, row)
    bucket = quote["time"] // INTERVAL_SECONDS
    if rows and quote["time"] < max(row["time"] for row in rows):
        raise ValueError("Quote precedes the last stored observation")
    # Keep the first actual observation in each bucket; never backfill missed runs.
    buckets.setdefault(bucket, quote)
    quotes = [buckets[key] for key in sorted(buckets)]
    return {**history, "updated_at": quotes[-1]["time"], "quotes": quotes}


def collect(output, now=None, request=requests.get):
    now = time.time() if now is None else now
    history = json.loads(output.read_text(encoding="utf-8")) if output.exists() else None
    response = request(API_URL, timeout=12, headers={"Accept": "application/json", "User-Agent": "MarketDashboard/2.0"})
    response.raise_for_status()
    updated = append_quote(history, response.json(), now)
    if updated == history:
        return False
    output.parent.mkdir(parents=True, exist_ok=True)
    # One observation per line keeps the dedicated data branch's diffs small.
    metadata = {key: value for key, value in updated.items() if key != "quotes"}
    content = json.dumps(metadata, ensure_ascii=False)[:-1] + ', "quotes": [\n'
    content += ',\n'.join(json.dumps(row, separators=(',', ':')) for row in updated["quotes"])
    content += '\n]}\n'
    temporary = output.with_suffix(".tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(output)
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("public/data/fiwind.json"))
    args = parser.parse_args()
    changed = collect(args.output)
    print("Fiwind: observation saved." if changed else "Fiwind: bucket already recorded.")
