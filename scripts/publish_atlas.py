"""Write a reviewed bundle, then verify real Atlas retrieval. Requires .env."""
import argparse
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from app.services.evidence import reviewed_relationships


def publish(bundle, db):
    reviewed = reviewed_relationships(bundle)
    if any(r.get('semantic_review_status') == 'pending_review' for r in bundle['relationships']):
        raise ValueError('Pending evidence must be reviewed or rejected before publishing.')
    if any(d.get('coverage_status') == 'pending_review' for d in bundle['documents']):
        raise ValueError('Source assessment is pending review.')
    for collection, key in (('entities', 'entity_id'), ('documents', 'document_id'), ('relationships', 'relationship_id')):
        db[collection].create_index(key, unique=True)
    db.relationships.create_index([('issuer_id', 1), ('semantic_review_status', 1)])
    for entity in bundle['entities']:
        db.entities.replace_one({'entity_id': entity['entity_id']}, entity, upsert=True)
    for doc in bundle['documents']:
        existing = db.documents.find_one({'document_id': doc['document_id']})
        if existing and existing.get('snapshot_hash') != doc['snapshot_hash']:
            raise ValueError('Cannot replace an immutable source snapshot. Use a new document ID.')
        db.documents.replace_one({'document_id': doc['document_id']}, doc, upsert=True)
    for row in reviewed:
        db.relationships.replace_one({'relationship_id': row['relationship_id']}, row, upsert=True)
    for row in reviewed:
        saved = db.relationships.find_one({'relationship_id': row['relationship_id']}, {'_id': 0})
        if saved != row:
            raise ValueError('Atlas read-back does not match the written evidence.')
    return {'checked_at': datetime.now(timezone.utc).isoformat(), 'ping': 'ok', 'written_and_read_relationships': len(reviewed),
            'document_ids': [d['document_id'] for d in bundle['documents']],
            'extraction_models': sorted({d['extraction_model'] for d in bundle['documents'] if d.get('extraction_model')})}


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    args = parser.parse_args()
    uri = os.getenv('MONGODB_URI')
    if not uri:
        raise ValueError('MONGODB_URI is not configured.')
    bundle = json.loads(args.file.read_text())
    with MongoClient(uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, socketTimeoutMS=10000) as client:
        client.admin.command('ping')
        proof = publish(bundle, client[os.getenv('MONGODB_DB', 'blindspot')])
    Path('data/atlas-proof.json').write_text(json.dumps(proof, indent=2))
    print(json.dumps(proof, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Atlas publish failed ({type(exc).__name__}). Check configuration, review status and database permissions; connection details were not logged.')
        raise SystemExit(1)
