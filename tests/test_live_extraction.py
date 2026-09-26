from types import SimpleNamespace
import pytest
from app.services.ingest import extract, configured_client

class FakeInteractions:
    def __init__(self, output):
        self.output = output
        self.calls = []
    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output_text=self.output)

def test_empty_excerpt_does_not_call_provider():
    calls = FakeInteractions('{}')
    with pytest.raises(ValueError):
        extract(' ', 'Issuer', 'test', SimpleNamespace(interactions=calls))
    assert not calls.calls

def test_no_match_is_valid_and_source_is_delimited():
    calls = FakeInteractions('{"relationships":[],"no_match_reason":"Competitor only"}')
    result = extract('We compete with TSMC.', 'Issuer', 'test', SimpleNamespace(interactions=calls))
    assert not result.relationships
    assert 'Source data (JSON):' in calls.calls[0]['input']
    assert calls.calls[0]['response_format']['mime_type'] == 'application/json'

def test_fabricated_quote_is_rejected():
    calls = FakeInteractions('{"relationships":[{"supplier_name":"TSMC","relationship_type":"manufacturing_supplier","product_scope":"Wafers","verbatim_quote":"TSMC supplies us"}]}')
    with pytest.raises(ValueError, match='not present'):
        extract('We compete with TSMC.', 'Issuer', 'test', SimpleNamespace(interactions=calls))

def test_missing_key_is_explicit(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    with pytest.raises(ValueError, match='not configured'):
        configured_client()
