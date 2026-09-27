"""Catalog identity is separate from reviewed supplier coverage."""
import json
from pathlib import Path
from app.services.evidence import reviewed_relationships
ROOT = Path(__file__).resolve().parents[2]

def review_queue():
    return json.loads((ROOT / 'data/review_queue.json').read_text())

def catalog(bundle):
    base = json.loads((ROOT / 'data/company_catalog.json').read_text())['companies']
    records = reviewed_relationships(bundle)
    docs = {d['issuer_id']: d for d in bundle['documents']}
    candidates = review_queue()['candidates']
    pending = {r['issuer_id'] for r in candidates}
    assessments = {a['ticker']: a for a in json.loads((ROOT / 'data/assessments.json').read_text())['assessments']}
    by_id = {c['entity_id']: c for c in base}
    for e in bundle['entities']:
        if e.get('ticker') and e['entity_id'] not in by_id:
            by_id[e['entity_id']] = {'entity_id': e['entity_id'], 'ticker': e['ticker'], 'name': e['canonical_name']}
    result = []
    for company in by_id.values():
        eid = company['entity_id']; doc = docs.get(eid, {})
        count = len({r['supplier_id'] for r in records if r['issuer_id'] == eid})
        status = 'reviewed' if count else ('reviewed_no_match' if doc.get('coverage_status') == 'reviewed_no_match' else ('pending_review' if eid in pending or doc.get('coverage_status') == 'pending_review' else 'unsupported'))
        assessment = assessments.get(company['ticker'], {})
        result.append({**company, **{k: assessment.get(k) for k in ('source_url', 'filing_date', 'form')},
                       'assessment_outcome': assessment.get('assessment_outcome', 'not_yet_assessed'),
                       'assessment_reason': assessment.get('reason', 'No bounded source assessment completed.'),
                       'publication_state': 'approved' if count else ('pending_review' if eid in pending else 'unpublished'),
                       'pending_count': sum(r['issuer_id'] == eid for r in candidates),
                       'evidence_ids': [r['relationship_id'] for r in records if r['issuer_id'] == eid],
                       'coverage_status': status, 'supplier_count': count,
                       'document_id': doc.get('document_id'), 'fiscal_period_end': doc.get('fiscal_period_end')})
    return result

def compare(left, right, bundle, mode):
    companies = {c['ticker']: c for c in catalog(bundle)}
    records = reviewed_relationships(bundle)
    docs = {d['document_id']: d for d in bundle['documents']}
    names = {e['entity_id']: e['canonical_name'] for e in bundle['entities']}
    output = []
    for ticker in (left, right):
        company = companies.get(ticker, {'ticker': ticker, 'entity_id': ticker, 'name': ticker, 'coverage_status': 'unsupported'})
        links = []
        for row in records:
            if row['issuer_id'] != company['entity_id']: continue
            doc = docs[row['source_document_id']]
            links.append({'relationship_id': row['relationship_id'], 'supplier_id': row['supplier_id'],
                          'supplier_name': names[row['supplier_id']], 'product_scope': row['product_scope'],
                          'filing_date': doc['filing_date'], 'period_end': doc['fiscal_period_end'],
                          'source_url': doc['source_url']})
        output.append({**company, 'relationships': links, 'manufacturing_model': None})
    shared = sorted(set(r['supplier_id'] for r in output[0]['relationships']) & set(r['supplier_id'] for r in output[1]['relationships']))
    return {'companies': output, 'shared_supplier_ids': shared, 'data_mode': mode,
            'note': 'Compared only within indexed disclosures. Missing evidence does not establish independence or investment substitutability.'}


def peers(ticker, bundle, mode):
    pairs = json.loads((ROOT / 'data/peer_mapping.json').read_text())['pairs']
    rows = []
    for pair in pairs:
        if ticker not in (pair['left'], pair['right']):
            continue
        other = pair['right'] if ticker == pair['left'] else pair['left']
        comparison = compare(ticker, other, bundle, mode)
        left, right = comparison['companies']
        own = {r['supplier_id'] for r in left['relationships']}
        theirs = {r['supplier_id'] for r in right['relationships']}
        shared = sorted(own & theirs)
        different = sorted(theirs - own)
        complete = bool(own and theirs)
        status = ('Insufficient coverage to compare' if not complete else
                  'Different disclosed supplier identified' if different else
                  'Also shares the selected supplier' if shared else 'Insufficient coverage to compare')
        dates = sorted({r['filing_date'] for c in (left, right) for r in c['relationships']})
        rows.append({'ticker': other, 'name': right['name'], 'reason': pair['reason'],
                     'peer_source': pair['source_url'], 'shared': shared, 'different': different if complete else [],
                     'status': status, 'scope_note': 'Published manufacturing disclosures; filed '+', '.join(dates)+'.',
                     'unknown': 'Additional supplier candidates await review. Supplier sets are partial; no independence established.',
                     'pending_leads': [{'supplier': c['supplier_name'], 'candidate_id': c['candidate_id']} for c in review_queue()['candidates'] if c['issuer_id'] == right['entity_id'] and c['supplier_name'] not in theirs],
                     'comparison': comparison})
    return {'ticker': ticker, 'candidates': rows, 'data_mode': mode,
            'note': 'Only published relationships enter supplier comparisons. No approved supplier difference is established when all published peers share the same supplier.'}
