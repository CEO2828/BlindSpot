import hashlib


def quote_offsets(snapshot: str, quote: str):
    if not quote or not quote.strip():
        raise ValueError('Empty evidence is not allowed.')
    start = snapshot.find(quote)
    if start < 0:
        raise ValueError('Quote is not present verbatim in the stored snapshot.')
    return start, start + len(quote)


def validate_relationship(record, document):
    if record['source_document_id'] != document['document_id'] or record['issuer_id'] != document['issuer_id']:
        raise ValueError('Evidence belongs to a different document or issuer.')
    snapshot = document['extracted_text']
    if hashlib.sha256(snapshot.encode()).hexdigest() != document['snapshot_hash']:
        raise ValueError('Snapshot hash mismatch.')
    start, end = quote_offsets(snapshot, record['verbatim_quote'])
    if (start, end) != (record['quote_start'], record['quote_end']):
        raise ValueError('Quote offsets do not match the immutable snapshot.')
    pct = record.get('disclosed_percentage')
    if pct is not None:
        if isinstance(pct, bool) or not 0 <= pct <= 100:
            raise ValueError('Invalid disclosed percentage.')
        if not record.get('percentage_denominator') or not record.get('percentage_period'):
            raise ValueError('Percentage requires an explicit denominator and period.')
    return record


def reviewed_relationships(bundle):
    docs = {d['document_id']: d for d in bundle['documents']}
    result = []
    for row in bundle['relationships']:
        if row.get('semantic_review_status') != 'reviewed' or row.get('quote_match_status') != 'matched':
            continue
        validate_relationship(row, docs[row['source_document_id']])
        result.append(row)
    return result
