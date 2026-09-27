# Deployment handoff

No public deployment exists. Safari was opened to Render and reached its sign-in screen on 2026-09-26. No payment method, resource or account was created.

Render's current [free-service documentation](https://render.com/docs/free) explicitly describes workspaces without payment methods: limits suspend services/builds rather than charge those workspaces. Individual signup/verification requirements still depend on the account. Do not add a card or upgrade.

1. Sign into an existing eligible Render account (or personally complete signup/terms). Use a workspace without a payment method.
2. Connect only CEO2828/BlindSpot if repository permission is requested. Keep the repository private. Review the proposed access before granting it.
3. Create a Web Service from branch `codex/premium-workspace` (or main after merging), runtime Docker, Free instance, health path `/health`. The included render.yaml specifies Free and disables automatic deploys. No disk or database add-on is needed.
4. Initially deploy without secrets: the bundled source-checked cache is a working demo and visibly labeled. For Atlas, set server-side MONGODB_URI and MONGODB_DB=blindspot with a database read-only user; allow only the host's required outbound addresses in Atlas. Never paste secrets into GitHub. Credentials exposed in earlier chat must be rotated before public deployment. The existing local account's least-privilege status is not certified.
5. Open the assigned HTTPS URL from a fresh session. Verify Reveal $6,000/60%, all three source cards, removal 52.94%, coverage, comparison and mobile. Check /health and actual evidence data_mode before claiming Atlas.

Free services sleep after 15 minutes of inactivity and can take about a minute to wake. They share 750 monthly free hours per workspace; build/bandwidth/outbound limits apply. A custom domain is unnecessary. Docker itself was not available locally, so the image build has not been executed here. The same FastAPI entry point was executed locally.

Local: double-click start.command, or `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`. The current redesigned preview runs separately on port 8001; it is not persistent public hosting.
