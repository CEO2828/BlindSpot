import json
import os
from pathlib import Path
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from app.services.evidence import reviewed_relationships

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'data' / 'reviewed_seed.json'


class EvidenceStore:
    def __init__(self):
        self.client = None
        self.db = None
        self.configuration_error = False
        uri = os.getenv('MONGODB_URI')
        if uri:
            try:
                self.client = MongoClient(uri, serverSelectionTimeoutMS=2000, connectTimeoutMS=2000, socketTimeoutMS=3000)
                self.db = self.client[os.getenv('MONGODB_DB', 'blindspot')]
            except (PyMongoError, ValueError):
                self.configuration_error = True
        self.cached = json.loads(SEED.read_text())
        reviewed_relationships(self.cached)

    def read(self):
        warning = 'Local source-checked cache. Live Atlas reads are not active.'
        if self.configuration_error:
            warning = 'Atlas configuration is invalid. Showing the local source-checked cache.'
        if self.db is not None:
            try:
                self.client.admin.command('ping')
                bundle = {c: list(self.db[c].find({}, {'_id': 0}).limit(1000)) for c in ('entities', 'documents', 'relationships')}
                if not bundle['documents'] or not bundle['entities']:
                    raise ValueError('Atlas has no indexed documents.')
                reviewed_relationships(bundle)
                bundle['dataset_provenance'] = 'atlas_indexed'
                self.cached = bundle
                return bundle, 'atlas', []
            except (PyMongoError, ValueError, KeyError):
                warning = 'Atlas is unavailable or its index is invalid. Showing the last valid local cache.'
        return self.cached, 'local_cache', [warning]

    def close(self):
        if self.client:
            self.client.close()
