"""
Build dashboard data for static GitHub Pages deployment.
Run from repo root: python build_data.py [--out-dir data]
Outputs: data/snapshot.json, data/events.json, data/meta.json, data/charts/*.png
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import time
from datetime import datetime, timedelta
from io import BytesIO

import numpy as np
import pandas as pd
import requests

try:
    import investpy
except ImportError:
    investpy = None

# ─── Constants ────────────────────────────────────────────────────────────────

CRYPTO_API_BASE    = "https://criptoya.com/api"
ARG_DATOS_BASE     = "https://api.argentinadatos.com/v1"

KEY_EVENTS = [
    "Fed", "Federal Reserve", "Interest Rate", "FOMC",
    "ISM Manufacturing", "ISM Non-Manufacturing", "ISM Services", "ISM",
    "CPI", "Consumer Price Index", "Nonfarm Payrolls", "NFP", "Employment",
    "PPI", "Producer Price Index", "PCE", "Core PCE", "Personal Consumption",
    "Retail Sales", "GDP", "Gross Domestic Product", "Unemployment",
    "Jobless Claims", "Initial Claims", "Housing Starts", "Building Permits",
    "Durable Goods", "Factory Orders", "Consumer Confidence", "Michigan Consumer",
    "Trade Balance", "Trade Deficit", "Beige Book", "Fed Minutes",
    "JOLTS", "Job Openings",
]

# ─── Event calendar ───────────────────────────────────────────────────────────

def get_upcoming_key_events(days_ahead: int = 7) -> list[dict]:
    """Return high-importance US economic events for the next `days_ahead` days."""
    if investpy is None:
        print("investpy not installed — skipping economic calendar.")
        return []

    today    = datetime.today()
    end_date = today + timedelta(days=days_ahead)
    pattern  = '|'.join(KEY_EVENTS)

    try:
        calendar = investpy.news.economic_calendar(
            time_zone=None,
            time_filter='time_only',
            countries=['united states'],
            importances=['high'],
            from_date=today.strftime('%d/%m/%Y'),
            to_date=end_date.strftime('%d/%m/%Y'),
        )
        if calendar.empty:
            return []

        filtered = calendar[
            calendar['event'].str.contains(pattern, case=False, na=False) &
            (calendar['importance'].str.lower() == 'high')
        ].sort_values(['date', 'time'])

        return filtered[['date', 'time', 'event']].to_dict('records')

    except Exception as e:
        print(f"Economic calendar error: {e}")
        return []

# ─── Argentina macro ──────────────────────────────────────────────────────────

def get_argentina_macro_data() -> dict:
    """Fetch holidays, inflation history, and riesgo país from argentinadatos.com."""
    macro: dict = {"ipc_history": {}, "riesgo_pais": {}, "holidays": [], "full_holidays": []}

    # Holidays
    try:
        year = datetime.now().year
        resp = requests.get(f"{ARG_DATOS_BASE}/feriados/{year}", timeout=10)
        resp.raise_for_status()
        data       = resp.json()
        today_str  = datetime.now().strftime("%Y-%m-%d")
        cur_month  = datetime.now().strftime("%m")

        macro["full_holidays"] = [f["fecha"] for f in data]
        upcoming = sorted(
            [f for f in data if f.get("fecha", "") >= today_str and f["fecha"][5:7] == cur_month],
            key=lambda x: x["fecha"],
        )
        macro["holidays"] = [
            f"{datetime.strptime(h['fecha'], '%Y-%m-%d').strftime('%d-%m-%Y')} - {h.get('nombre', '')}"
            for h in upcoming
        ]
    except Exception as e:
        print(f"Error fetching holidays: {e}")

    # Inflation (IPC)
    try:
        resp = requests.get(f"{ARG_DATOS_BASE}/finanzas/indices/inflacion", timeout=10)
        resp.raise_for_status()
        items = resp.json()
        macro["ipc_history"] = {
            item["fecha"][:7]: (item["valor"] / 100 if item["valor"] > 1 else item["valor"])
            for item in items
            if item.get("fecha") and item.get("valor") is not None
        }
    except Exception as e:
        print(f"Error fetching inflation: {e}")

    # Riesgo país
    try:
        resp = requests.get(f"{ARG_DATOS_BASE}/finanzas/indices/riesgo-pais", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if len(data) >= 2:
            last, prev = data[-1], data[-2]
            var_pct = ((last["valor"] / prev["valor"]) - 1) * 100 if prev["valor"] else 0
            macro["riesgo_pais"] = {
                "valor":     int(last["valor"]),
                "fecha":     datetime.strptime(last["fecha"][:10], "%Y-%m-%d").strftime("%d-%m-%Y"),
                "variacion": round(var_pct, 2),
            }
    except Exception as e:
        print(f"Error fetching riesgo país: {e}")

    return macro

# ─── Historical fiat ──────────────────────────────────────────────────────────

def get_historical_fiat_data() -> list[dict] | None:
    """
    Build a daily time series of ARS exchange rates (CCL, MEP, Blue,
    Oficial, Mayorista, USDT) from the start of the current year.
    """
    ENDPOINTS = {
        "ccl":       "contadoconliqui",
        "mep":       "bolsa",
        "blue":      "blue",
        "oficial":   "oficial",
        "mayorista": "mayorista",
    }
    cutoff = datetime(datetime.now().year, 1, 1)

    try:
        dfs: list[pd.DataFrame] = []
        for key, path in ENDPOINTS.items():
            try:
                resp = requests.get(f"{ARG_DATOS_BASE}/cotizaciones/dolares/{path}", timeout=10)
                resp.raise_for_status()
                df = pd.DataFrame(resp.json())
                df["fecha"] = pd.to_datetime(df["fecha"])
                df = df[df["fecha"] >= cutoff][["fecha", "venta"]].rename(columns={"venta": key}).set_index("fecha")
                dfs.append(df)
            except Exception as e:
                print(f"  Warning: could not fetch {path}: {e}")

        if not dfs:
            return None

        master = dfs[0]
        for df in dfs[1:]:
            master = master.join(df, how="outer")

        # Ensure all expected columns exist
        for col in ENDPOINTS:
            if col not in master.columns:
                master[col] = np.nan

        # USDT history (persisted across builds)
        history_file  = "data/usdt_history.json"
        usdt_history: dict[str, float] = {}
        if os.path.exists(history_file):
            with open(history_file) as f:
                usdt_history = json.load(f)

        today_str = datetime.now().strftime("%Y-%m-%d")
        try:
            r_crypto = requests.get(f"{CRYPTO_API_BASE}/usdt/ars/0.1", timeout=10)
            r_p2p    = requests.get(f"{CRYPTO_API_BASE}/binancep2p/usdt/ars/0.1", timeout=10)
            max_venta = 0.0
            for ex in ['buenbit', 'fiwind', 'lemoncash', 'tiendacrypto']:
                bid = r_crypto.json().get(ex, {}).get('totalBid', 0)
                if bid > max_venta:
                    max_venta = bid
            p2p_bid = r_p2p.json().get('totalBid', 0)
            if p2p_bid > max_venta:
                max_venta = p2p_bid
            if max_venta > 0:
                usdt_history[today_str] = round(max_venta, 2)
                os.makedirs(os.path.dirname(history_file), exist_ok=True)
                with open(history_file, "w") as f:
                    json.dump(usdt_history, f, indent=2)
        except Exception as e:
            print(f"  Warning: could not update USDT history: {e}")

        df_usdt = (
            pd.DataFrame(list(usdt_history.items()), columns=["fecha", "usdt"])
            .assign(fecha=lambda d: pd.to_datetime(d["fecha"]))
            .pipe(lambda d: d[d["fecha"] >= cutoff])
            .set_index("fecha")
            .resample("D")
            .ffill()
        )

        master = master.join(df_usdt, how="outer").ffill().dropna(subset=["ccl"])

        def _safe(val: object) -> float:
            return round(float(val), 2) if pd.notna(val) else 0.0

        return [
            {
                "date":      date.strftime("%d-%m-%Y"),
                "ccl":       _safe(row.get("ccl")),
                "mep":       _safe(row.get("mep")),
                "blue":      _safe(row.get("blue")),
                "oficial":   _safe(row.get("oficial")),
                "usdt":      _safe(row.get("usdt")),
                "mayorista": _safe(row.get("mayorista")),
            }
            for date, row in master.iterrows()
        ]

    except Exception as e:
        print(f"Error building fiat history: {e}")
        return None

# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Build dashboard snapshot data.")
    parser.add_argument("--out-dir", default="data", help="Output directory (default: data)")
    args = parser.parse_args()

    out_dir    = args.out_dir
    charts_dir = os.path.join(out_dir, "charts")
    os.makedirs(charts_dir, exist_ok=True)

    print("Fetching economic events...")
    events = get_upcoming_key_events()

    print("Fetching Argentina macro data and fiat history...")
    macro_data = get_argentina_macro_data()
    fiat_data  = get_historical_fiat_data()

    snapshot = {
        "built_at":        datetime.utcnow().isoformat() + "Z",
        "argentina_macro": macro_data,
        "historical_fiat": fiat_data,
    }

    meta = {}

    paths = {
        "snapshot": os.path.join(out_dir, "snapshot.json"),
        "events":   os.path.join(out_dir, "events.json"),
        "meta":     os.path.join(out_dir, "meta.json"),
    }
    data_to_write = {"snapshot": snapshot, "events": events, "meta": meta}

    for key, path in paths.items():
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data_to_write[key], f, ensure_ascii=False, indent=2)
        print(f"  Wrote {path}")

    print(f"Done. Charts saved to {charts_dir}")


if __name__ == "__main__":
    main()