#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install -r requirements.txt
printf '\nBLINDSPOT: http://127.0.0.1:8000\nKeep this window open. Press Ctrl+C to stop.\n'
exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
