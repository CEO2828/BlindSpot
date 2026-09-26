# BLINDSPOT

**Different investments can share the same supplier. BLINDSPOT makes those connections visible and lets you inspect the evidence.**

A small, source-backed research workspace built for the ShellHacks handoff. Python/FastAPI serves one HTML/CSS/JavaScript interface. No Node build is required.

## Current build status

- **Working and tested locally:** example portfolio, three disclosed TSMC relationships, fixed diagram, evidence selection, editable amounts, add/remove supported companies, reset, deterministic cents arithmetic, explicit unassessed value, keyboard access, responsive layout, and error recovery.
- **Actual public evidence:** short passages checked against downloaded NVIDIA FY2026, AMD FY2025, and Broadcom FY2025 filing bytes. The dataset is an AI-assisted, source-checked seed, not output from a Gemini API call and not a claim of human review.
- **Atlas:** read/write and read-back verification code implemented. No live connection or write has been verified. The UI visibly says local cache until actual Atlas reads succeed.
- **Hosting:** DigitalOcean was dropped at the user's request because setup requires a billing method. A no-payment replacement is pending. The portable Dockerfile remains; no public deployment is verified.
- **Gemini:** CLI extraction is implemented using Google GenAI with bounded input/output, structured JSON and exact quote checks. Set `GEMINI_API_KEY` and optional `GEMINI_MODEL` (default `gemini-3.8-flash`). Candidates remain pending review. Live authentication currently fails; no successful extraction is claimed.
- **Not included:** voice, custom domain, full-document upload, live prices, brokerage access, trading, predictions, authentication, or additional companies.

## Run the working local demo

Use Python 3.12 (the tested version). In a terminal, enter this project's `blindspot` folder, then run:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** on the same computer. No keys are needed for the local demo.

On Windows, activate with `.venv\Scripts\activate` instead. The application does not open a browser by itself.

1. Click **Reveal connections**. The $10,000 example has $6,000 (60%) in companies with a disclosed TSMC relationship.
2. Click NVIDIA, AMD, Broadcom, or a numbered line. Check the quote, source date, scope, and original filing.
3. Remove AVGO. The denominator becomes $8,500 and connected value becomes $4,500 (52.94%).
4. Edit an amount. The browser requests a fresh backend calculation after a brief input pause.
5. Reset the example. The $4,000 unassessed allocation is included in the total throughout.

## How the parts connect

**Interaction:** browser editor → `POST /api/analyze` → validated indexed relationships → integer-cent aggregation → browser diagram. Selecting a line calls `GET /api/evidence/{relationship_id}`. No model or source download occurs on the reveal path.

**Evidence:** immutable, bounded text snapshot → exact quote matching and code-generated offsets → semantic review → Atlas persistence → read-back verification. A matching quote alone never proves that a supplier interpretation is correct.

The source-backed seed is shipped locally. If `MONGODB_URI` is configured, reads use Atlas. If Atlas is empty, unavailable, or has invalid reviewed evidence, the app uses its last valid in-memory cache (the packaged seed after a restart) and labels the fallback. Do not claim that fallback as a live database read.

## File ownership and contracts

This is a solo project; logical ownership below keeps edits contained.

| Component | Files | Responsibility |
|---|---|---|
| Input/API | `app/models.py`, `app/main.py` | Validation, routes, HTTP error states |
| Math | `app/services/analysis.py` | Aggregation, coverage, deduplication |
| Evidence | `app/services/evidence.py`, `data/` | Quotes, hashes, dates, review state |
| Storage | `app/services/store.py`, `scripts/publish_atlas.py` | Atlas reads/writes, explicit fallback |
| Extraction/review | `app/services/ingest.py`, `scripts/review_evidence.py` | Offline contracts; live extraction pending |
| UI | `app/templates/`, `app/static/` | Inputs, selection, SVG, responsive layout |
| Hosting | `Dockerfile` | Portable Python service; no-payment host pending |

`POST /api/analyze` accepts:

```json
{"positions":[{"ticker":"NVDA","amount_cents":250000}],"unassessed_amount_cents":400000}
```

The response includes total, assessed and unassessed cents, holdings and coverage states, supplier allocations and connected tickers, stable relationship IDs, source mode and warnings. Duplicate tickers are combined; duplicate evidence never doubles an allocation. Unknown tickers remain unassessed and in the denominator. Non-integer, negative, nonfinite and oversized cents are rejected. A zero total returns an explicit empty state. Total input is limited to $1 billion and 30 position entries.

`GET /api/companies` reports actual indexed coverage. `GET /api/evidence/{id}` serves only reviewed, validated records. `GET /health` reports service status, database status, and data mode without secrets. `GET /docs` is the generated API specification; the production Content Security Policy does not allow its external Swagger assets, so use `/openapi.json` for a machine-readable contract.

## Evidence provenance and scope

The file `data/source_manifest.json` records source URLs, filing dates, period ends and SHA-256 hashes of downloaded source bytes. `data/reviewed_seed.json` contains short immutable snapshots; its snapshot hash covers exactly `extracted_text`. The full annual reports are not bundled. Quote offsets refer to the bounded normalized snapshot, not to a PDF page or raw HTML character offset.

| Issuer | Filing date | Fiscal period end | Scope represented |
|---|---|---|---|
| NVIDIA | 2026-02-25 | 2026-01-25 | Named wafer foundries, including TSMC |
| AMD | 2026-02-04 | 2025-12-27 | TSMC wafer production for HPC, FPGA and adaptive SoC products |
| Broadcom | 2025-12-18 | 2025-11-02 | Approximately 95% of wafers produced by its contract manufacturers in FY2025 |

Broadcom's manufacturing percentage is **not** a revenue, profit, investment-value, or loss percentage. It is never multiplied by portfolio amounts. TSMC is a company, not one factory. These are selected historical filings, not a latest-market coverage claim. Other suppliers named in the reports are outside this initial TSMC-focused index; missing alternatives are not a claim that none exist.

The seed reviewer is explicitly `AI-assisted source review; human confirmation recommended`. Human review is still recommended before judging. Use the review utility to independently check direction, product scope, dates and any percentage denominator. It writes a separate reviewed output and does not change the immutable snapshot.

```bash
python -m scripts.review_evidence data/reviewed_seed.json --reviewer "Your name"
```

Fresh model candidates, once an eligible extraction provider is available, must remain pending until semantic review. No-match, pending, unsupported and fetch failure must not be collapsed into a safety conclusion. The offline tests validate the no-match contract, **not actual Gemini accuracy**. A live held-out source test and real competitor-only test remain outstanding.

## Atlas connection and proof

Use the official Atlas connection guide: https://www.mongodb.com/docs/atlas/connect-to-database-deployment/

Place configuration in a local ignored `.env` copied from `.env.example`. Never put a connection string in chat, screenshots, frontend code, README, or Git. Give the app only the needed database permissions and configure Atlas network access for the deployment's outbound connection. Prefer a read-only runtime user and a separate local ingestion user with write permission.

After independent source review and valid Atlas access are ready, the local publisher stores the reviewed bundle and verifies retrieval of each written relationship. It does not delete other datasets. It refuses an attempt to change a snapshot under the same document ID. Use a separate demo database to avoid mixing this prototype with unrelated records.

```bash
python -m scripts.publish_atlas data/reviewed_seed-reviewed.json
```

Successful verification creates a sanitized `data/atlas-proof.json`. Restart the app with its runtime Atlas settings and check that `/health` and the visible footer both report Atlas. Publishing the seed is genuine database use, but does **not** prove Gemini use.

## Hosting plan

DigitalOcean is no longer a deployment target or intended prize entry. Do not follow its setup instructions in older handoffs or PDFs. No paid resource is authorized. The current demo runs locally; a replacement host that meets the no-payment requirement has not been confirmed.

The portable Dockerfile runs the Python service as a non-root user on port 8080, overridable with `PORT`. Any future host must support this service, keep `MONGODB_URI` in secret runtime settings, and allow the appropriate Atlas outbound connections. Set `MONGODB_DB=blindspot`. An extraction API key is not needed by the read-only runtime.

Before claiming deployment, verify the public URL from a second device: reveal, every evidence card, amount edit, refresh, and actual source mode. Keep the local demo as backup.

## Verification

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m playwright install chromium
python tests/browser_check.py
```

The browser check starts and stops its own local server. It checks reveal, all evidence cards, AVGO removal, cent-precision edits, invalid input, keyboard selection, zero totals, network failure/retry, reset, and widths of 1280 and 390 pixels. It writes screenshots and a result report under `artifacts/`.

Tests include source tampering, absent quotes, unresolved denominators, duplicate relationships/tickers, unsupported and pending holdings, zero totals, invalid values, API contracts, overlapping suppliers, and explicit Atlas fallback. Test result counts and outstanding live checks are recorded in `BUILD_STATUS.md`.

## Demo and submission

1. **0:00–0:30:** Three cafés can share a bakery; different investments can similarly share a supplier.
2. **0:30–1:00:** Reveal NVIDIA, AMD and Broadcom connected to TSMC.
3. **1:00–1:45:** Open evidence. Show different product scopes and explain Broadcom's wafer denominator.
4. **1:45–2:15:** Remove or edit a holding. Show that the math recalculates.
5. **2:15–2:45:** Explain the real architecture and only integrations actually demonstrated.
6. **2:45–3:00:** Explain the benefit and limited indexed coverage.

Before submission: obtain the GitHub URL, actual hosting URL if deployed, correct name/email/Discord tag, choose only eligible categories, and record a backup demo. The supplied handoff's target is Sunday September 27 at 10:30 AM Miami time, ahead of its stated 11 AM deadline. Event details are taken from the user-provided handoff, not newly verified here.

Intended categories remain conditional: Best Overall and Blackstone depend on the completed entry; Atlas requires real execution; DigitalOcean has been dropped; Gemini is pending successful authentication and genuine extraction; first-time eligibility requires organizer confirmation. Voice and domain extras are not built.

## AI and external contributions

AI assisted with architecture, Python/JavaScript/CSS implementation, source checks, tests, documentation and debugging. Financial passages originate from the linked company SEC filings. Framework and library dependencies are listed in `requirements.txt`. There are no generated returns, synthetic risk scores or invented supplier quotes.
