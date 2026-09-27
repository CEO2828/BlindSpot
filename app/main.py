from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.models import AnalysisInput
from app.services.catalog import catalog, compare, review_queue
from app.services.analysis import analyze
from app.services.store import EvidenceStore
from app.services.evidence import reviewed_relationships

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT.parent / '.env')


@asynccontextmanager
async def lifespan(app):
    app.state.store = EvidenceStore()
    yield
    app.state.store.close()


app = FastAPI(title='BLINDSPOT', version='0.1.0', lifespan=lifespan)
app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')
templates = Jinja2Templates(directory=ROOT / 'templates')


@app.middleware('http')
async def security_headers(request, call_next):
    if request.method == 'POST':
        body = await request.body()
        if len(body) > 16_384:
            return JSONResponse({'detail': 'Request is too large.'}, status_code=413)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
    if request.url.path.startswith('/api'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.get('/', response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(request=request, name='index.html')


@app.get('/health')
def health(request: Request):
    _, mode, _ = request.app.state.store.read()
    return {'status': 'ok', 'database': 'connected' if mode == 'atlas' else 'unavailable', 'data_mode': mode}


@app.get('/api/companies')
def companies(request: Request):
    bundle, _, _ = request.app.state.store.read()
    return catalog(bundle)


@app.post('/api/analyze')
def analysis(payload: AnalysisInput, request: Request):
    bundle, mode, warnings = request.app.state.store.read()
    result = analyze(payload, bundle, mode, warnings)
    identities = {c["ticker"]: c for c in catalog(bundle)}
    for holding in result["holdings"]:
        identity = identities.get(holding["ticker"])
        if identity:
            holding["name"] = identity["name"]
            if holding["coverage_status"] == "unsupported":
                holding["coverage_status"] = identity["coverage_status"]
    return result


@app.get('/api/evidence/{relationship_id}')
def evidence(relationship_id: str, request: Request):
    bundle, mode, warnings = request.app.state.store.read()
    row = next((r for r in reviewed_relationships(bundle) if r['relationship_id'] == relationship_id), None)
    if not row:
        raise HTTPException(404, 'Reviewed evidence is not available for this connection.')
    doc = next(d for d in bundle['documents'] if d['document_id'] == row['source_document_id'])
    entities = {e['entity_id']: e['canonical_name'] for e in bundle['entities']}
    return {**row, **{k: doc.get(k) for k in ('form', 'filing_date', 'fiscal_period_end', 'source_url', 'source_hash', 'snapshot_hash', 'snapshot_scope', 'extracted_text', 'extraction_model', 'extraction_run_at')},
            'company_name': entities[row['issuer_id']], 'supplier_name': entities[row['supplier_id']],
            'quote': row['verbatim_quote'], 'data_mode': mode, 'warnings': warnings}


@app.get('/api/compare')
def comparison(request: Request, left: str = Query(..., pattern=r'^[A-Za-z0-9.\-]{1,12}$'), right: str = Query(..., pattern=r'^[A-Za-z0-9.\-]{1,12}$')):
    bundle, mode, _ = request.app.state.store.read()
    return compare(left.upper(), right.upper(), bundle, mode)


@app.get('/api/review-queue')
def candidates():
    return review_queue()


@app.get('/api/quotes')
def quotes(tickers: str = Query('', max_length=390, pattern=r'^[A-Za-z0-9.,\-]*$')):
    symbols = list(dict.fromkeys(t.upper() for t in tickers.split(',') if t))
    if len(symbols) > 30 or any(len(t) > 12 for t in symbols):
        raise HTTPException(422, 'At most 30 valid tickers are allowed.')
    return {'quotes': [{'ticker': t, 'price': None, 'currency': None, 'as_of': None, 'source': None, 'status': 'unavailable'} for t in symbols],
            'reason': 'No market-data provider is configured. Manual USD holdings drive calculations.'}
