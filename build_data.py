"""
Convenience wrapper — the canonical build script lives in scripts/build_data.py.
This file exists so you can still run `python build_data.py` from the repo root.
"""
import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    script = Path(__file__).resolve().parent / "scripts" / "build_data.py"
    sys.exit(subprocess.call([sys.executable, str(script)] + sys.argv[1:]))
