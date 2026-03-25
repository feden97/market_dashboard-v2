"""
Build dashboard data for static GitHub Pages deployment.
Run from repo root: python build_data.py [--out-dir public/data]
Outputs: public/data/snapshot.json, public/data/events.json, public/data/meta.json
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import requests

try:
    import investpy
except ImportError:
    investpy = None

CRYPTO_API_BASE = "https://criptoya.com/api"
ARG_DATOS_BASE  = "https://api.argentinadatos.com/v1"


# ─── Argentina macro ──────────────────────────────────────────────

def get_argentina_macro_data() -> dict:
    macro: dict = {"ipc_history": {}, "holidays": [], "full_holidays": []}

    # Holidays (current year)
    try:
        year = datetime.now().year
        resp = requests.get(f"{ARG_DATOS_BASE}/feriados/{year}", timeout=10)
        resp.raise_for_status()
        data      = resp.json()
        today_str = datetime.now().strftime("%Y-%m-%d")
        cur_month = datetime.now().strftime("%m")

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

    # IPC
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

    return macro


# ─── Historical fiat ──────────────────────────────────────────────

def get_historical_fiat_data() -> list[dict] | None:
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

        for col in ENDPOINTS:
            if col not in master.columns:
                master[col] = np.nan

        # USDT history
        history_file  = "public/data/usdt_history.json"
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


# ─── Main ─────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="public/data")
    args = parser.parse_args()

    out_dir = args.out_dir
    os.makedirs(out_dir, exist_ok=True)

    print("Fetching Argentina macro data...")
    macro_data = get_argentina_macro_data()

    print("Building historical fiat data...")
    fiat_data = get_historical_fiat_data()

    snapshot = {
        "built_at":        datetime.utcnow().isoformat() + "Z",
        "argentina_macro": macro_data,
        "historical_fiat": fiat_data,
    }

    for key, data in [("snapshot", snapshot), ("events", []), ("meta", {})]:
        path = os.path.join(out_dir, f"{key}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  Wrote {path}")

    print("Done.")


if __name__ == "__main__":
    main()
