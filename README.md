# BLINDSPOT

Different stocks. Shared suppliers. Explore the public disclosures behind portfolio connections.

FastAPI/Python serves a restrained navy/teal HTML/CSS/JavaScript workspace. Portfolio inputs use integer cents; evidence reads are independent of AI and quotes. Existing architecture and reviewed evidence are preserved.

## Run

Double-click `start.command`, or create a Python virtual environment, install `requirements.txt`, and run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`. No credentials are required for the labeled cache demo. Optional server-side `.env`: MONGODB_URI and MONGODB_DB. Never commit credentials.

## Features and real scope

- Search 23 SEC-identified companies; add/remove holdings or enter unknown tickers. Save/restore manually in this browser.
- Reveal the actual source-backed graph, focus a supplier, select each disclosure, edit amounts and recalculate.
- Source cards preserve dates, exact quote, scope, provenance and percentage denominator.
- Searchable coverage and a separate pending review queue. Three new candidate passages (Ambiq AMBQ, Allegro ALGM, Cirrus CRUS) are excluded from analysis until semantic approval.
- Side-by-side reviewed supplier comparisons. Unindexed manufacturing models and missing coverage are explicit; no alternative-stock recommendations.
- Quote status is honestly unavailable. Manual USD amounts drive all calculations.

Published coverage remains **3 companies, 3 relationships, 1 supplier (TSMC)**. The 23-company catalog is not 23-company evidence coverage. Existing records are AI-assisted source-reviewed, without invented human approval. Default: $2,500 NVDA + $2,000 AMD + $1,500 AVGO + $4,000 unassessed = $10,000; connected value $6,000 / 60%. Removing AVGO gives 52.94%. Overlapping supplier groups must not be added.

## Verification and handoff

`python -m pytest -q` and `python tests/browser_check.py` run offline validation and actual Chromium checks. Install requirements-dev.txt and Playwright Chromium for browser tests. Desktop/mobile artifacts remain in the local artifacts folder, outside Git.

See BUILD_STATUS.md, API_CONTRACTS.md, DEPLOYMENT.md, submission/DEMO_SCRIPT.md and submission/DEVPOST_DRAFT.md. No public URL or submission is claimed. DigitalOcean is dropped; no Gemini calls were made during this handoff. Existing extraction/review tooling remains local/admin-only and is not a completed live AI integration.
