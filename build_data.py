"""
Convenience wrapper — the canonical build script lives in scripts/build_data.py.
This file exists so you can still run `python build_data.py` from the repo root.
"""
import subprocess
import sys

if __name__ == "__main__":
    sys.exit(subprocess.call([sys.executable, "scripts/build_data.py"] + sys.argv[1:]))
