# Build checkpoint — September 26, 2026

## Verified in this session

- Supplied dependencies installed in an isolated Python 3.13.1 environment.
- All 21 backend/API/evidence tests passed; one upstream Starlette test-client deprecation warning.
- All 10 browser check groups passed, with no JavaScript errors.
- Fresh desktop, 1280px and 390px screenshots; desktop inspected.
- Three supplier interpretations reconfirmed against live SEC text. See submission/SOURCE_REVIEW.md.
- Added macOS launcher and GitHub Actions workflow. GitHub Actions run 36253839073 passed on Python 3.12/Linux.
- Prepared Devpost copy and a three-minute presentation script.

## External access and remaining work

- User selected GitHub account CEO2828. Repository URL is confirmed; 35 source/configuration/documentation files published to main at bf72ce03bc3f765107374d026acf432446f8b4cd.
- User reports Atlas is set up in Safari. Safari control is working; existing Atlas database user is visible. Corrected credentials verified; three relationships written and read back, and app reads from Atlas.
- DigitalOcean was dropped at the user's request on September 26 because it requires a billing method. Its deployment template and prize target are removed. No paid hosting is authorized; a no-payment replacement remains unconfirmed. Use the local demo in the meantime.
- User confirmed 18+ API eligibility. Gemini CLI extraction implemented; 25 local tests pass. Corrected key works; competitor-only live smoke test passed. Broader evaluation remains limited.
- Human semantic sign-off, event URL, team details, category eligibility and final submission remain pending.
- Docker is unavailable on this machine; container build is untested.

The local app is verified. Public hosting, live Atlas, live extraction, and event submission are not complete.

## Verified live integration update — September 26, 2026

- Corrected credentials successfully authenticated to Atlas and Gemini.
- Atlas publisher wrote and read back all three source-checked relationships.
- Restarted local server; `/health` reports `database: connected`, `data_mode: atlas`.
- Gemini live competitor-only smoke test passed with zero relationships.
- Credentials remain in ignored local `.env`; no secrets added to source or proof reports.

- Live browser smoke passed: Atlas footer, $6,000 connected allocation, NVIDIA evidence.
- Supplier extraction requests exceeded the smoke-test window and were stopped; no Gemini candidates were published. Added explicit 45-second request timeout and disabled retries to bound future calls.
