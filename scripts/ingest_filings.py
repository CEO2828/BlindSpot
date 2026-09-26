"""python -m scripts.ingest_filings --ticker NVDA

Uses the checked bounded excerpt by default. --excerpt accepts a local UTF-8
excerpt from the SAME filing; --section names its actual section. Does not fetch
arbitrary URLs, approve evidence, or write to Atlas.
"""
import argparse
import hashlib
import json
from pathlib import Path
from dotenv import load_dotenv
from app.services.store import SEED
from app.services.ingest import configured_client, extract, build_candidates


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ticker', required=True, choices=['NVDA', 'AMD', 'AVGO'])
    parser.add_argument('--excerpt', type=Path)
    parser.add_argument('--section', default='Manufacturing supplier excerpt')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    seed = json.loads(SEED.read_text())
    doc = next(d.copy() for d in seed['documents'] if d['issuer_id'] == args.ticker)
    entity = next(e for e in seed['entities'] if e['entity_id'] == args.ticker)
    if args.excerpt:
        if args.excerpt.stat().st_size > 100_000:
            raise ValueError('Excerpt file is too large.')
        text = args.excerpt.read_text()
        doc.update(extracted_text=text, snapshot_hash=hashlib.sha256(text.encode()).hexdigest(),
                   snapshot_scope='User-supplied bounded excerpt; source identity requires review', parser_version='utf8-excerpt-v1')
    doc['section'] = args.section
    client, model = configured_client()
    with client:
        extraction = extract(doc['extracted_text'], entity['canonical_name'], model, client)
    bundle = build_candidates(extraction, doc, entity, model)
    destination = args.output or Path('data') / (args.ticker.lower()+'-candidates.json')
    destination.write_text(json.dumps(bundle, indent=2, ensure_ascii=False))
    print(f'Saved {len(bundle["relationships"])} candidates to {destination}. Human review required. No Atlas writes yet.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Provider exception strings can include request metadata. Never print them.
        print(f'Ingestion failed ({type(exc).__name__}). Check local configuration, quota, model access and source input. No new evidence was published.')
        raise SystemExit(1)
