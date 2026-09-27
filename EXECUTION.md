# Execution checklist

Baseline: remote main e397ba85; 38 tracked files verified by Git blob hashes. No AGENTS.md found. Existing working directory preserved separately. Branch: codex/premium-workspace.

- [x] Redesign the editor → reveal → graph → evidence → edit flow.
- [x] Add searchable catalog, local save/restore, supplier focus, comparison and honest quote states.
- [x] Inspect a bounded batch of primary sources; prepare pending candidates without expanding approved coverage automatically.
- [x] Verify local and Atlas behavior, keyboard use, mobile layouts and source cards.
- [x] Prepare card-free hosting configuration, submission copy, recording and a reviewable PR.

# Component contracts

- Portfolio: at most 30 entries; integer cents; preserve unsupported amounts and inputs on errors. Optional browser-local save stores only manually entered holdings.
- Catalog: company identity and instrument plus dynamically derived evidence status. Catalog inclusion never implies reviewed coverage.
- Analysis: existing POST /api/analyze contract and arithmetic preserved. One holding counted once per supplier; clusters may overlap.
- Graph: deterministic rows and focused supplier selector; one edge per actual evidence record; internal scrolling for large groups.
- Evidence: existing GET /api/evidence/{id} remains the source of approved cards. Candidate evidence is a separate review view.
- Comparison: GET /api/compare?left=…&right=…; reviewed facts and explicit missing coverage, no recommendations.
- Quotes: GET /api/quotes?tickers=…; no provider configured means null price/time and unavailable status, never synthetic values. Does not affect analysis.
- Storage: Atlas first, labeled last-valid cache on failure. Catalog additions and pending candidates remain separate from approved Atlas records.
- Extraction: preserve offline contracts, make no provider calls during this handoff.
- Deployment: portable FastAPI service; no billing, paid domain, or public-repository conversion.

Public deployment remains blocked by host sign-in; configuration and local demo are complete. See DEPLOYMENT.md.
