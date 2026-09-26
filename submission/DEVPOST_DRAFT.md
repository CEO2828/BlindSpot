# BLINDSPOT

## Tagline
Different investments can share the same supplier. See the connections and inspect the evidence.

## Inspiration
A portfolio can contain several company names while sharing a supplier underneath. We wanted to make those disclosed connections easier to explore without turning them into unsupported predictions.

## What it does
BLINDSPOT maps an example portfolio of NVIDIA, AMD, and Broadcom to their disclosed TSMC manufacturing relationships. Users can inspect filing excerpts, see source dates and product scope, edit allocations, and remove or restore holdings. The default example shows $6,000 of a $10,000 portfolio in companies with an indexed TSMC relationship. The remaining $4,000 stays visibly unassessed and remains in the denominator.

The connected amount describes holdings in linked companies. It is not an estimate of money at risk, expected loss, or the portion of a company's revenue attributable to that supplier.

## How we built it
Python and FastAPI serve a responsive HTML/CSS/JavaScript interface. The backend validates inputs and calculates allocations in integer cents. Relationships link to bounded source excerpts with hashes and exact quote offsets. The current dataset is an AI-assisted, source-checked seed based on SEC filings. A MongoDB Atlas storage adapter and DigitalOcean deployment template are included; live use must be verified before claiming those integrations.

## Challenges
The most important challenge was preserving the meaning of the evidence. A manufacturing percentage has its own denominator and period. We keep it separate from portfolio arithmetic. Missing coverage remains unassessed, duplicated relationships do not double-count an allocation, and model candidates remain pending semantic review.

## Accomplishments
The local application passes 21 backend tests and 10 browser check groups. Those checks cover portfolio arithmetic, evidence integrity, input validation, outage labeling, keyboard interaction, mobile layout, and recovery after failed requests.

## What we learned
Traceability matters as much as a compelling visualization. Showing source context, coverage limits, and the actual storage mode makes the result easier to inspect and explain.

## What's next
Expand reviewed company and supplier coverage, verify live Atlas and hosting, evaluate an eligible extraction provider on held-out passages, and improve the review workflow.

## Built with
Python, FastAPI, Pydantic, HTML, CSS, JavaScript, PyMongo, pytest, Playwright.

## Contribution disclosure
AI assisted with implementation, architecture, testing, documentation, and source inspection. Filing passages belong to the linked issuers' public SEC reports. Gemini extraction has not run. No live Atlas or DigitalOcean deployment claim is made in this draft.

## Required before submission
- Team member names and the intended event/Devpost project URL.
- Repository URL and public app URL after publishing.
- Demo video upload URL.
- Confirm category eligibility and actual deadline on the event page.
- Update integration claims only after live execution is verified.

This is prepared copy, not a submitted entry.
