# Editorial release — 2026-09-27

Rollback application: 61faf7fb8800a277fbc9ec0fe4be72d0a2c3c525. Existing Render service and private repository retained; no paid APIs, models, domains, billing or infrastructure added.

Changes: warm editorial canvas with ink navigation and system serif/sans; compact formatted holdings and transactional native-dialog editor; automatic and retained evidence selection with loading/retry/stale-response protection; automatic source-supported NVDA/AMD/Intel product-peer discovery plus manual comparison; bounded assessments for all 23 catalog entries; compact coverage rows and unobtrusive data-mode/method notes. Dead quote strip removed.

Root cause reproduced on public prior build: renderResult drew three edges but selected remained null, so runAnalysis skipped inspect and left a placeholder. IDs/backend lookups worked on click. New initial/recalculated selection always picks a valid published edge when one exists. Every published edge resolves to an evidence endpoint.

Research: 23 annual filings retrieved/searched, including 20-F for foreign issuers. Cached originals reused. Assessment outcomes: 14 relationship found; 9 not found in examined scope; 0 unavailable; 0 unassessed. This is a bounded manufacturing/supplier-name assessment, not exhaustive supplier completeness. Named customer/competitor/JV/prospective partnership mentions were not turned into supply edges.

Publication: still 3 companies / 3 relationships / 1 supplier. 17 pending candidate relationships across 13 companies; 2 of those companies already have published records, leaving 11 pending-only companies. No absence findings have been approved for portfolio assessment. Actual portfolio coverage arithmetic remains unchanged. Source/snapshot hashes, dates and excerpt offsets retained. Existing interactive review workflow requires confirmation; no human sign-off invented. AMD–GlobalFoundries is a genuine researched difference candidate, displayed explicitly as unpublished. There is no approved supplier difference among the current published peer records; the matcher reports that limitation.

Atlas audit: live local Atlas and seed both have exactly the same three approved relationship IDs; no missing or extra approved records. No writes needed. Public host remains labeled bundled cache without credentials. Existing tests verify truthful Atlas outage fallback. No secret rotation/access change attempted.

Verification: 28 backend tests; focused Chromium groups cover initial/every-edge evidence, retained/replaced selection, drawer cancellation/inline validation/Enter apply, exact arithmetic, unknown/duplicates, local save/restore, evidence outage/retry/races, peer/manual comparisons, source modal, assessment counts, keyboard/320–1440px layout and zero total. Screenshot pairs recorded before and after. One upstream test-client deprecation warning only.

Demo: Open example → NVIDIA source already populated → select Broadcom and read its denominator → Edit holdings/remove AVGO/Save → 52.94% and valid replacement source → explore AMD peer → inspect its unpublished GlobalFoundries source → compare published evidence → Coverage distinguishes assessment from publication.
