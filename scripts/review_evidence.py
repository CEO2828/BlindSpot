"""Interactive local semantic review; never exposed on the public website."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from app.services.evidence import validate_relationship


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--reviewer', required=True)
    args = parser.parse_args()
    bundle = json.loads(args.file.read_text())
    docs = {d['document_id']: d for d in bundle['documents']}
    for row in bundle['relationships']:
        doc = docs[row['source_document_id']]
        validate_relationship(row, doc)
        print('\nSource:', doc['source_url'], '\nIssuer:', row['issuer_id'], '\nSupplier:', row['supplier_id'])
        print('Scope:', row['product_scope'], '\nQuote:', row['verbatim_quote'])
        print('Percentage:', row.get('disclosed_percentage'), '\nDenominator:', row.get('percentage_denominator'), '\nPeriod:', row.get('percentage_period'))
        print('Open the source. Check actual supplier direction, product scope, exact quote, filing date, and percentage denominator. A name match alone is insufficient.')
        answer = input('Type APPROVE after those checks, REJECT to exclude, or Enter to leave pending: ')
        if answer in ('APPROVE', 'REJECT'):
            row.update(semantic_review_status='reviewed' if answer == 'APPROVE' else 'rejected',
                       reviewer=args.reviewer, reviewed_at=datetime.now(timezone.utc).isoformat(),
                       percentage_review_status='reviewed' if answer == 'APPROVE' else 'rejected')
    for doc in bundle['documents']:
        rows = [r for r in bundle['relationships'] if r['source_document_id'] == doc['document_id']]
        if any(r['semantic_review_status'] == 'reviewed' for r in rows):
            doc['coverage_status'] = 'reviewed'
        elif not rows or all(r['semantic_review_status'] == 'rejected' for r in rows):
            print('No supported relationship for', doc['document_id'], '\n', doc['extracted_text'])
            if input('Type NO_MATCH after reviewing absence of a supported link in this excerpt: ') == 'NO_MATCH':
                doc.update(coverage_status='reviewed_no_match', reviewer=args.reviewer)
    output = args.file.with_name(args.file.stem+'-reviewed.json')
    output.write_text(json.dumps(bundle, indent=2, ensure_ascii=False))
    print('Saved', output, '— nothing has been published to Atlas yet.')


if __name__ == '__main__':
    main()
