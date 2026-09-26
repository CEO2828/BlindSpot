from collections import defaultdict
from app.services.evidence import reviewed_relationships


def analyze(request, bundle, data_mode, warnings=None):
    amounts = defaultdict(int)
    for position in request.positions:
        amounts[position.ticker] += position.amount_cents
    entities = {e['entity_id']: e for e in bundle['entities']}
    companies = {e['ticker']: e for e in bundle['entities'] if e.get('ticker')}
    docs = {d['issuer_id']: d for d in bundle['documents']}
    relationships = reviewed_relationships(bundle)
    reviewed_issuers = {r['issuer_id'] for r in relationships}
    # A reviewed no-match is covered within this document scope, not declared safe.
    assessed_ids = reviewed_issuers | {d['issuer_id'] for d in bundle['documents'] if d.get('coverage_status') == 'reviewed_no_match'}
    total = sum(amounts.values()) + request.unassessed_amount_cents
    assessed = 0
    holdings = []
    for ticker, amount in amounts.items():
        company = companies.get(ticker)
        eid = company['entity_id'] if company else ticker
        doc = docs.get(eid)
        status = ('reviewed' if eid in reviewed_issuers else 'no_supported_relationship') if eid in assessed_ids else (
            'pending_review' if doc and doc.get('coverage_status') == 'pending_review' else 'unsupported')
        if eid in assessed_ids:
            assessed += amount
        holdings.append({'ticker': ticker, 'entity_id': eid, 'name': company['canonical_name'] if company else ticker,
                         'amount_cents': amount, 'coverage_status': status})
    held = {h['entity_id']: h for h in holdings if h['amount_cents'] > 0}
    included = [r for r in relationships if r['issuer_id'] in held]
    suppliers = []
    for sid in sorted({r['supplier_id'] for r in included}):
        ids = {r['issuer_id'] for r in included if r['supplier_id'] == sid}
        connected = sum(held[i]['amount_cents'] for i in ids)
        suppliers.append({'supplier_id': sid, 'name': entities[sid]['canonical_name'],
                          'connected_value_cents': connected, 'connected_percentage': round(connected * 100 / total, 2) if total else 0,
                          'connected_tickers': sorted(held[i]['ticker'] for i in ids)})
    notes = list(warnings or [])
    if not total:
        notes.append('Enter a positive amount to reveal connections.')
    if total > assessed:
        notes.append('Unassessed value remains in the total. Missing coverage does not mean there are no supplier links.')
    return {'total_cents': total, 'assessed_cents': assessed, 'unassessed_cents': total-assessed,
            'holdings': holdings, 'suppliers': suppliers,
            'relationships': [{**r, 'evidence_id': r['relationship_id']} for r in included],
            'data_mode': data_mode, 'dataset_provenance': bundle.get('dataset_provenance', 'indexed'),
            'filing_dates': sorted({d['filing_date'] for d in bundle['documents']}), 'warnings': notes}
