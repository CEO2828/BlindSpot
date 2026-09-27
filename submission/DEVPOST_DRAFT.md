# BLINDSPOT — draft, not submitted

## Inspiration
Different investments can share the same supplier. We built a way to inspect those disclosed connections instead of turning them into unsupported predictions.

## What it does
BLINDSPOT combines a portfolio editor, supplier network and source inspector. The default $10,000 portfolio has $6,000 invested in NVIDIA, AMD and Broadcom, all with indexed TSMC relationships. Users can edit allocations, inspect each filing, save locally, browse 23 company identities and compare reviewed disclosures. Three new source candidates remain visibly pending review.

## How we built it
Python/FastAPI, Pydantic, HTML/CSS/JavaScript and PyMongo. Arithmetic uses integer cents; evidence includes source hashes and bounded exact excerpts. Live Atlas reads were executed successfully in the redesigned local app. A labeled cache preserves functionality during outages. No AI or price service is required for Reveal.

## Challenges and learning
We separated searchable identities from actual evidence coverage, quote matching from semantic review, and manufacturing percentages from portfolio allocation. Missing coverage cannot be treated as independence. The new interface makes these distinctions visible while keeping the main workflow simple.

## Validation
26 backend tests and browser checks cover arithmetic, sources, validation, pending exclusion, search, comparison, save/restore, quote outages, keyboard access and responsive layouts. Current published coverage: 3 companies, 3 relationships, 1 supplier. New candidates are not included in those counts.

## Limits and disclosure
AI assisted implementation and source inspection. Existing evidence is AI-assisted source-reviewed with no invented human sign-off. No Gemini calls were made during this handoff; no completed live AI integration is claimed. Quotes are unavailable. DigitalOcean is dropped. Public hosting remains pending account access; do not describe localhost as a public site. No prize eligibility has been verified.

## Submission fields still supplied by owner
Team names, event entry URL/category eligibility/deadline, final narrated video URL, public demo URL after deployment. Repository: https://github.com/CEO2828/BlindSpot (currently private; do not change visibility without an explicit decision).
