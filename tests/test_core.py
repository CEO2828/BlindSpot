from copy import deepcopy
import json
from types import SimpleNamespace
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from app.main import app
from app.models import AnalysisInput
from app.services.analysis import analyze
from app.services.evidence import quote_offsets, validate_relationship
from app.services.ingest import Extraction, Candidate, build_candidates, extract
from app.services.store import EvidenceStore, SEED

@pytest.fixture
def bundle():
    return json.loads(SEED.read_text())

@pytest.fixture
def example():
    return {'positions':[{'ticker':'NVDA','amount_cents':250000},{'ticker':'AMD','amount_cents':200000},{'ticker':'AVGO','amount_cents':150000}],'unassessed_amount_cents':400000}

def run(payload,bundle):return analyze(AnalysisInput.model_validate(payload),bundle,'local_cache')

def test_example_and_removal_denominator(bundle,example):
    r=run(example,bundle)
    assert (r['total_cents'],r['assessed_cents'],r['unassessed_cents'])==(1000000,600000,400000)
    assert r['suppliers'][0]['connected_percentage']==60
    example['positions'].pop()
    r=run(example,bundle)
    assert r['total_cents']==850000
    assert r['suppliers'][0]['connected_value_cents']==450000
    assert r['suppliers'][0]['connected_percentage']==52.94

def test_duplicates_count_company_once(bundle,example):
    bundle['relationships'].append(deepcopy(bundle['relationships'][0]))
    example['positions'].append({'ticker':'nvda','amount_cents':10000})
    r=run(example,bundle)
    assert r['suppliers'][0]['connected_value_cents']==610000
    assert len(r['holdings'])==3

def test_unknown_and_pending_remain_unassessed(bundle):
    bundle['relationships'][0]['semantic_review_status']='pending_review'
    bundle['documents'][0]['coverage_status']='pending_review'
    r=run({'positions':[{'ticker':'NVDA','amount_cents':100},{'ticker':'UNKNOWN','amount_cents':200}]},bundle)
    assert r['unassessed_cents']==300 and r['assessed_cents']==0
    assert [h['coverage_status'] for h in r['holdings']]==['pending_review','unsupported']
    assert not r['suppliers']

def test_zero_total_is_explicit(bundle):
    r=run({'positions':[]},bundle)
    assert r['total_cents']==0 and r['suppliers']==[] and r['warnings']

@pytest.mark.parametrize('amount',[-1,True,1.5,'100',float('nan'),float('inf'),100_000_000_001])
def test_bad_amounts_rejected(amount):
    with pytest.raises(ValidationError):AnalysisInput.model_validate({'positions':[{'ticker':'NVDA','amount_cents':amount}]})

def test_total_limit():
    with pytest.raises(ValidationError):AnalysisInput.model_validate({'positions':[{'ticker':'NVDA','amount_cents':100_000_000_000}],'unassessed_amount_cents':1})

def test_quote_absence_and_snapshot_mutation_rejected(bundle):
    with pytest.raises(ValueError):quote_offsets('NVIDIA competes with AMD.','NVIDIA buys from AMD.')
    doc=bundle['documents'][0];row=bundle['relationships'][0]
    validate_relationship(row,doc)
    doc['extracted_text']+=' changed'
    with pytest.raises(ValueError):validate_relationship(row,doc)

def test_percentage_requires_denominator(bundle):
    row=bundle['relationships'][2];row['percentage_denominator']=None
    with pytest.raises(ValueError):validate_relationship(row,bundle['documents'][2])

def test_overlapping_suppliers_are_not_added_to_risk(bundle,example):
    extra=deepcopy(bundle['relationships'][0]);extra['supplier_id']='OTHER';extra['relationship_id']='other'
    bundle['relationships'].append(extra)
    bundle['entities'].append({'entity_id':'OTHER','canonical_name':'Other supplier','ticker':None})
    r=run(example,bundle)
    assert len(r['suppliers'])==2
    assert r['assessed_cents']==600000
    assert not any('risk' in key or 'loss' in key for key in r)

def test_api_health_evidence_and_validation():
    with TestClient(app) as c:
        assert c.get('/').status_code==200
        health=c.get('/health').json(); assert health['data_mode']=='local_cache' and health['database']=='unavailable'
        companies=c.get('/api/companies').json();assert len(companies)==3
        r=c.get('/api/evidence/avgo-tsmc-2025-11-02');assert r.status_code==200
        e=r.json(); assert e['disclosed_percentage']==95 and 'contract manufacturers' in e['percentage_denominator']
        assert c.get('/api/evidence/missing').status_code==404
        assert c.post('/api/analyze',json={'positions':[{'ticker':'NVDA','amount_cents':-1}]}).status_code==422
        assert c.post('/api/analyze',content='x'*17000).status_code==413

def test_atlas_outage_is_labelled(bundle):
    from pymongo.errors import ConnectionFailure
    class Broken:
        def command(self,*a):raise ConnectionFailure('private connection data')
    store=EvidenceStore();store.db=object();store.client=SimpleNamespace(admin=Broken())
    b,mode,warnings=store.read()
    assert mode=='local_cache' and 'Atlas is unavailable' in warnings[0]
    assert 'private' not in str(warnings)

def test_ingestion_is_pending_and_offsets_are_code_generated(bundle):
    row=bundle['relationships'][0]
    extraction=Extraction(relationships=[Candidate(supplier_name='TSMC',relationship_type='manufacturing_supplier',product_scope='Semiconductor wafers',verbatim_quote=row['verbatim_quote'])])
    output=build_candidates(extraction,bundle['documents'][0],bundle['entities'][0],'test-model')
    candidate=output['relationships'][0]
    assert candidate['semantic_review_status']=='pending_review'
    assert candidate['quote_start']==0 and candidate['quote_end']==len(row['verbatim_quote'])
    assert output['documents'][0]['extraction_model']=='test-model'
    assert candidate['disclosed_percentage'] is None

def test_ambiguous_percentage_is_unresolved(bundle):
    extraction=Extraction(relationships=[Candidate(supplier_name='TSMC',relationship_type='manufacturing_supplier',product_scope='Wafers',verbatim_quote=bundle['relationships'][2]['verbatim_quote'],disclosed_percentage=95)])
    candidate=build_candidates(extraction,bundle['documents'][2],bundle['entities'][2],'test-model')['relationships'][0]
    assert candidate['disclosed_percentage'] is None
    assert candidate['percentage_review_status']=='unresolved'

def test_competitor_only_no_match_contract(bundle):
    # Offline contract test, not proof of real model performance.
    extraction=Extraction(relationships=[],no_match_reason='Competitor mention only')
    output=build_candidates(extraction,bundle['documents'][0],bundle['entities'][0],'offline-contract-test')
    assert output['relationships']==[]
    assert output['documents'][0]['coverage_status']=='pending_review'
    assert output['documents'][0]['no_match_reason']=='Competitor mention only'

def test_reviewed_no_match_is_distinct(bundle):
    bundle['relationships']=[]
    for d in bundle['documents']:d['coverage_status']='reviewed_no_match'
    r=run({'positions':[{'ticker':'NVDA','amount_cents':100}]},bundle)
    assert r['assessed_cents']==100
    assert r['holdings'][0]['coverage_status']=='no_supported_relationship'
    assert not r['suppliers']
