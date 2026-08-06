from flask import Flask, jsonify, request
import requests
import threading
import time
import os

app = Flask(__name__)

# ── Configuration ────────────────────────────────────────────────────
# Set ALLOWED_ORIGIN to your deployed dashboard URL for security.
# Example: "https://feden97.github.io"
# Falls back to "*" only in development.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")

# Global storage for the latest data
latest_data = {
    "status": "initializing",
    "last_updated": None,
    "fiat": {},
    "usdt": {}
}

CRYPTO_BASE = "https://criptoya.com/api"
ARG_BASE    = "https://api.argentinadatos.com/v1"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

def fetch_data_loop():
    """Background thread that updates data every 10 seconds."""
    global latest_data
    while True:
        try:
            print(f"[{time.strftime('%H:%M:%S')}] Fetching fresh data...")
            
            # Use same endpoints as React useLiveData
            cripto_ya_dolar = session.get(f"{CRYPTO_BASE}/dolar", timeout=10).json()
            crypto_data     = session.get(f"{CRYPTO_BASE}/usdt/ars/0.1", timeout=10).json()
            p2p_data        = session.get(f"{CRYPTO_BASE}/binancep2p/usdt/ars/0.1", timeout=10).json()
            live_inflation  = session.get(f"{ARG_BASE}/finanzas/indices/inflacion", timeout=10).json()

            latest_data = {
                "status": "ok",
                "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "fiat": {
                    "ccl": cripto_ya_dolar.get("ccl", {}),
                    "mep": cripto_ya_dolar.get("mep", {}),
                    "blue": cripto_ya_dolar.get("blue", {}),
                    "oficial": cripto_ya_dolar.get("oficial", {}),
                    "mayorista": cripto_ya_dolar.get("mayorista", {}),
                },
                "usdt_raw": {
                    "exchanges": crypto_data,
                    "p2p": p2p_data
                },
                "live_inflation": live_inflation
            }
            print("  ✓ Success.")
        except Exception as e:
            print(f"  × Error in loop: {e}")
        
        time.sleep(10)

@app.route('/')
def health_check():
    """Endpoint for cron-job.org to ping every 1 minute."""
    return "Proxy is Awake", 200

@app.route('/data')
def get_data():
    """Endpoint for the React frontend to fetch data."""
    response = jsonify(latest_data)
    response.headers.add("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
    response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type")
    return response

if __name__ == '__main__':
    # Start the background thread
    threading.Thread(target=fetch_data_loop, daemon=True).start()
    
    # Run Flask (Render will pass the PORT env variable)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
