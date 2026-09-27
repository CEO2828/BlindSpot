'use strict';
const $ = id => document.getElementById(id);
const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0}).format(cents/100);
const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let queue={candidates:[]}, compareSequence=0;
const coverageLabels={reviewed:'Source-checked',pending_review:'Pending review',reviewed_no_match:'Not found in reviewed scope',unsupported:'Not assessed',no_supported_relationship:'Not found in reviewed scope'};
let companies=[], result=null, selected=null, activeSupplier=null, revealed=false, sequence=0, evidenceSequence=0, debounce;
let positions=[{ticker:'NVDA',amount:'2500.00'},{ticker:'AMD',amount:'2000.00'},{ticker:'AVGO',amount:'1500.00'}];

function toCents(value){
  const clean=value.trim();
  if(!/^\d+(\.\d{1,2})?$/.test(clean)) throw Error('Use a nonnegative dollar amount with at most two decimal places.');
  const [whole,fraction='']=clean.split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents>100000000000) throw Error('Amounts must be at most $1 billion.');
  return cents;
}
async function api(path,options={}){
  const response=await fetch(path,{...options,signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw Error(response.status===422?'Please check the amounts and total (maximum $1 billion).':'Could not load data. Your inputs are preserved; try Reveal again.');
  return response.json();
}
function renderInputs(){
  $('positions').innerHTML=positions.map((p,i)=>{
    const company=companies.find(c=>c.ticker===p.ticker);
    return `<div class="position"><div class="position-top"><span class="ticker-icon ${esc(p.ticker.toLowerCase())}" aria-hidden="true">${esc(p.ticker==='NVDA'?'N':p.ticker==='AVGO'?'B':p.ticker[0])}</span><label for="amount-${i}">${esc(p.ticker)}<span class="position-name">${esc(company?.name||p.ticker)}</span></label><button class="remove" type="button" data-remove="${i}" aria-label="Remove ${esc(p.ticker)}">×</button></div><div class="money-input"><span>$</span><input id="amount-${i}" data-position="${i}" type="text" inputmode="decimal" value="${esc(p.amount)}" autocomplete="off"></div><span class="holding-status">${esc(coverageLabels[company?.coverage_status]||'Not assessed')}</span></div>`;
  }).join('');
  $('position-count').textContent=positions.length;
  $('company-options').innerHTML=companies.map(c=>`<option value="${esc(c.ticker)}">${esc(c.name)}</option>`).join('');
  $('add').disabled=positions.length>=30;
}
function payload(){const value={positions:positions.map(p=>({ticker:p.ticker,amount_cents:toCents(p.amount)})),unassessed_amount_cents:toCents($('unassessed').value)};if(value.positions.reduce((n,p)=>n+p.amount_cents,0)+value.unassessed_amount_cents>100000000000)throw Error('Total must be at most $1 billion.');return value;}
function showError(message){$('form-error').textContent=message;$('form-error').hidden=!message;}
function invalidate(){
  sequence++; evidenceSequence++; clearTimeout(debounce); showError('');
  $('reveal').disabled=false; $('reveal').innerHTML='Reveal connections <span aria-hidden="true">↗</span>';
  if(revealed){$('graph').classList.add('updating');$('connected').textContent='—';$('connected-percent').textContent='Updating';$('coverage').textContent='—';}
  debounce=setTimeout(()=>{if(revealed)runAnalysis();else{try{$('total').textContent=dollars(payload().positions.reduce((n,p)=>n+p.amount_cents,0)+toCents($('unassessed').value));}catch(e){showError(e.message)}}},350);
}
async function runAnalysis(){
  clearTimeout(debounce); const version=++sequence;
  $('reveal').disabled=true;$('reveal').textContent='Checking connections…';showError('');
  try{
    const input=payload();
    const data=await api('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    if(version!==sequence)return;
    result=data;revealed=true;
    if(!data.suppliers.some(s=>s.supplier_id===activeSupplier)) activeSupplier=data.suppliers[0]?.supplier_id||null;
    if(!data.relationships.some(r=>r.relationship_id===selected&&r.supplier_id===activeSupplier)) selected=null;
    renderResult();$('graph').classList.remove('reveal-enter');void $('graph').offsetWidth;$('graph').classList.add('reveal-enter');loadQuotes();
    if(selected)await inspect(selected);
    else{$('evidence').innerHTML='<div class="evidence-empty"><span class="empty-symbol">⌁</span><h3>Trust starts with a source.</h3><p>Select a connection to inspect its evidence.</p></div>';}
  }catch(error){if(version===sequence){showError(error.name==='TimeoutError'?'The request timed out. Your inputs are preserved; try again.':error.message);$('connected-percent').textContent='Needs refresh';}}
  finally{if(version===sequence){$('reveal').disabled=false;$('reveal').innerHTML='Reveal connections <span aria-hidden="true">↗</span>';$('graph').classList.remove('updating');}}
}
function renderResult(){
  const s=result.suppliers.find(s=>s.supplier_id===activeSupplier);
  $('total').textContent=dollars(result.total_cents);
  $('connected').textContent=dollars(s?.connected_value_cents||0);
  $('connected-percent').textContent=(s?.connected_percentage||0)+'% of total';
  $('linked-label').textContent=s?`Allocation connected to ${s.name}`:'Allocation connected to selected supplier';
  $('coverage').textContent=result.total_cents?Math.round(result.assessed_cents/result.total_cents*100)+'%':'No value';
  $('coverage-note').textContent=`${dollars(result.unassessed_cents)} unassessed`;
  $('data-status').innerHTML='<span class="status-dot"></span>'+ (result.data_mode==='atlas'?'Atlas · indexed evidence':'Local cache · source-checked evidence');
  $('warnings').textContent=result.warnings.join(' ');
  if(result.filing_dates.length)$('date-range').textContent=`Filed ${result.filing_dates[0]} to ${result.filing_dates.at(-1)}`;
  $('graph-count').textContent=`${result.suppliers.length} supplier${result.suppliers.length===1?'':'s'} · ${result.relationships.length} disclosures`;
  $('supplier-control').hidden=result.suppliers.length<2;
  $('supplier-select').innerHTML=result.suppliers.map(x=>`<option value="${esc(x.supplier_id)}" ${x.supplier_id===activeSupplier?'selected':''}>${esc(x.name)}</option>`).join('');
  renderGraph();
  $('finding').innerHTML='<span class="finding-icon">i</span><p>'+(s?`<strong>${s.connected_tickers.length} held ${s.connected_tickers.length===1?'company has':'companies have'} a disclosed relationship with ${esc(s.name)}.</strong> That connects ${dollars(s.connected_value_cents)} of this portfolio. Select a company or a numbered line to inspect the source.`:'No reviewed supplier connections for these amounts in the indexed sources. This does not establish an absence of relationships.')+'</p>';
}
function renderGraph(){
  const supplier=result.suppliers.find(s=>s.supplier_id===activeSupplier);
  if(!supplier){$('graph').innerHTML='<div class="graph-empty"><span class="empty-symbol">◎</span><h3>'+(!result.total_cents?'Start with an amount.':'No indexed connections.')+'</h3><p>'+(!result.total_cents?'Enter a positive amount, then reveal.':'These holdings have no reviewed supplier links in this index.')+'</p></div>';return;}
  const edges=result.relationships.filter(r=>r.supplier_id===activeSupplier);
  const nodes=edges.map(e=>({...result.holdings.find(h=>h.entity_id===e.issuer_id),evidence:e}));
  const height=Math.max(330,nodes.length*86+30);$('graph').style.height=height+'px';
  let svg='<svg aria-label="Disclosed supplier relationships"></svg>';
  let html='';
  nodes.forEach((h,i)=>{
    const y=nodes.length===1?height/2:42+i*(height-84)/(nodes.length-1);
    const edge=h.evidence;
    const id=edge.relationship_id;
    html+=`<button class="node company-node ${selected===id?'selected':''}" style="top:${y/height*100}%" data-evidence="${esc(id)}" aria-label="Inspect ${esc(h.name)} evidence"><span class="ticker-icon ${esc(h.ticker.toLowerCase())}" aria-hidden="true">${esc(h.ticker==='NVDA'?'N':h.ticker==='AVGO'?'B':h.ticker[0])}</span><span><span class="node-name">${esc(h.name)}</span><span class="node-money">${dollars(h.amount_cents)}</span></span></button>`;
  });
  html+=`<button class="node supplier-node" id="supplier-node" aria-label="Inspect connections to ${esc(supplier.name)}"><span class="node-caption">SHARED SUPPLIER</span><span class="supplier-name">${esc(supplier.name)}</span><span class="supplier-subtitle">Disclosed supplier</span><span class="supplier-amount">${supplier.connected_percentage}% connected allocation</span></button>`;
  $('graph').innerHTML=svg+html;
  drawEdges();
}
function drawEdges(){
  const graph=$('graph'),svg=graph.querySelector('svg'),supplier=graph.querySelector('.supplier-node');
  if(!svg||!supplier)return;
  const box=graph.getBoundingClientRect(),target=supplier.getBoundingClientRect();
  svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
  let paths='';
  graph.querySelectorAll('.company-node').forEach((node,i)=>{
    const n=node.getBoundingClientRect(),id=node.dataset.evidence;
    const x1=n.right-box.left,y1=n.top+n.height/2-box.top,x2=target.left-box.left,y2=target.top+target.height/2-box.top;
    const c1=x1+(x2-x1)*.42,c2=x1+(x2-x1)*.58;
    const t=.42,u=1-t,cx=u*u*u*x1+3*u*u*t*c1+3*u*t*t*c2+t*t*t*x2,cy=u*u*u*y1+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y2;
    const d=`M ${x1} ${y1} C ${c1} ${y1} ${c2} ${y2} ${x2} ${y2}`;
    paths+=`<path class="edge ${selected===id?'selected':''}" d="${d}"/><path class="edge-hit" d="${d}" role="button" tabindex="0" data-evidence="${esc(id)}" aria-label="${esc(node.getAttribute('aria-label').replace(' evidence',' to '+activeSupplier+' evidence'))}"/><circle class="edge-dot" cx="${cx}" cy="${cy}" r="10" data-evidence="${esc(id)}"/><text class="edge-number" x="${cx}" y="${cy}">${i+1}</text>`;
  });
  svg.innerHTML=paths;
}
new ResizeObserver(drawEdges).observe($('graph'));
async function inspect(id){
  const version=++evidenceSequence;selected=id;renderGraph();
  $('evidence').innerHTML='<p class="panel-description">Loading evidence…</p>';
  try{
    const e=await api('/api/evidence/'+encodeURIComponent(id));if(version!==evidenceSequence)return;
    const source=new URL(e.source_url);if(source.protocol!=='https:')throw Error('Source link is unavailable.');
    $('evidence').innerHTML=`<h3 class="evidence-title">${esc(e.company_name)} <span aria-hidden="true">→</span> ${esc(e.supplier_name)}</h3><p class="evidence-subtitle">${esc(e.product_scope)}</p><span class="review-badge">✓ Source matched · reviewed</span><p class="quote-label">FROM THE FILING</p><blockquote><mark>${esc(e.quote)}</mark></blockquote>${e.disclosed_percentage!==null?`<div class="evidence-fact"><strong>≈ ${e.disclosed_percentage}%</strong><p>${esc(e.percentage_denominator)} · ${esc(e.percentage_period)}.</p><p>This describes manufacturing volume, not investment value.</p></div>`:''}<dl class="metadata"><div><dt>Relationship</dt><dd>${esc(e.relationship_type.replaceAll('_',' '))}</dd></div><div><dt>Document</dt><dd>${esc(e.form)} · annual report</dd></div><div><dt>Period end</dt><dd>${esc(e.fiscal_period_end)}</dd></div><div><dt>Filed</dt><dd>${esc(e.filing_date)}</dd></div><div><dt>Section</dt><dd>${esc(e.section)}</dd></div></dl><a class="source-link" href="${esc(source.href)}" target="_blank" rel="noopener noreferrer">Read original filing <span aria-hidden="true">↗</span></a><button class="copy-source" id="copy-source">Copy source link</button><p class="provenance">${esc(e.reviewer)}. ${e.extraction_model?'Extracted with '+esc(e.extraction_model)+'.':'Source-checked seed; no Gemini extraction claimed.'} ${e.data_mode==='atlas'?'Retrieved from Atlas.':'Retrieved from local cache.'}</p>`;
    $('copy-source').onclick=async()=>{try{await navigator.clipboard.writeText(source.href);$('copy-source').textContent='Copied';}catch{$('copy-source').textContent='Open the filing above to copy its address';}};
  }catch(error){if(version===evidenceSequence){$('evidence').innerHTML='<p class="error">'+esc(error.message)+'</p><button id="retry-evidence" class="quiet">Retry evidence</button>';$('retry-evidence').onclick=()=>inspect(id);}}
}
$('portfolio-form').addEventListener('submit',e=>{e.preventDefault();runAnalysis();});
$('positions').addEventListener('input',e=>{if(e.target.dataset.position!==undefined){positions[Number(e.target.dataset.position)].amount=e.target.value;invalidate();}});
$('positions').addEventListener('click',e=>{const button=e.target.closest('[data-remove]');if(button){positions.splice(Number(button.dataset.remove),1);renderInputs();invalidate();}});
$('unassessed').addEventListener('input',invalidate);
function addHolding(value){
  const raw=value.trim();const found=companies.find(c=>c.ticker.toLowerCase()===raw.toLowerCase()||c.name.toLowerCase()===raw.toLowerCase());const ticker=found?.ticker||raw.toUpperCase();
  if(!/^[A-Z0-9.\-]{1,12}$/.test(ticker)){showError('Select a company or enter a ticker of up to 12 letters, numbers, dots or hyphens.');return;}
  if(positions.length>=30){showError('The portfolio supports up to 30 entries.');return;}
  const existing=positions.findIndex(p=>p.ticker===ticker);
  if(existing>=0){$('amount-'+existing).focus();showError(ticker+' is already in your portfolio. Edit its amount above.');return;}
  positions.push({ticker,amount:'0.00'});$('add-ticker').value='';renderInputs();invalidate();
}
$('add').addEventListener('click',()=>addHolding($('add-ticker').value));
$('add-ticker').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addHolding(e.target.value);}});
$('graph').addEventListener('click',e=>{const edge=e.target.closest('[data-evidence]');if(edge)inspect(edge.dataset.evidence);else if(e.target.closest('#supplier-node')){const first=result.relationships.find(r=>r.supplier_id===activeSupplier);if(first)inspect(first.relationship_id);}});
$('graph').addEventListener('keydown',e=>{if(e.target.classList.contains('edge-hit')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();inspect(e.target.dataset.evidence);}});
$('reset').addEventListener('click',()=>{positions=[{ticker:'NVDA',amount:'2500.00'},{ticker:'AMD',amount:'2000.00'},{ticker:'AVGO',amount:'1500.00'}];$('unassessed').value='4000.00';selected=null;evidenceSequence++;renderInputs();runAnalysis();});
async function init(){
  renderInputs();
  try{companies=await api('/api/companies');renderInputs();renderCatalog();initCompare();queue=await api('/api/review-queue');renderReview();const status=await api('/health');$('data-status').innerHTML='<span class="status-dot"></span>'+(status.data_mode==='atlas'?'Atlas · indexed evidence':'Local cache · source-checked evidence');}
  catch{$('data-status').textContent='Data service unavailable';showError('Could not load coverage. Try Reveal to reconnect.');}
}
function showView(name){
  document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!=='view-'+name);
  document.querySelectorAll('[data-view]').forEach(e=>{e.classList.toggle('active',e.dataset.view===name);if(e.dataset.view===name)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});
  if(name==='workspace')drawEdges();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('reveal-shortcut').onclick=runAnalysis;
$('supplier-select').onchange=e=>{activeSupplier=e.target.value;selected=null;evidenceSequence++;renderResult();$('evidence').innerHTML='<div class="evidence-empty"><h3>Inspect this supplier.</h3><p>Select a connection to see its source.</p></div>';};
function renderCatalog(){
  const q=$('catalog-search').value.trim().toLowerCase();const list=companies.filter(c=>(c.ticker+' '+c.name).toLowerCase().includes(q));
  $('catalog-summary').textContent=`${companies.length} searchable companies · ${companies.filter(c=>c.coverage_status==='reviewed').length} source-checked · ${companies.filter(c=>c.coverage_status==='pending_review').length} pending review`;
  $('catalog-list').innerHTML=list.length?list.map(c=>`<article class="catalog-card"><div><h3>${esc(c.name)}</h3><p>${esc(c.ticker)} · ${esc(c.exchange||'Exchange not indexed')}</p><span class="coverage-badge ${esc(c.coverage_status)}">${esc(coverageLabels[c.coverage_status]||'Not assessed')}</span></div><button data-add-catalog="${esc(c.ticker)}" aria-label="Add ${esc(c.name)} to portfolio">Add +</button></article>`).join(''):'<p class="panel-description">No catalog matches. You can still add an unknown ticker in the portfolio editor.</p>';
}
$('catalog-search').oninput=renderCatalog;
$('catalog-list').onclick=e=>{const b=e.target.closest('[data-add-catalog]');if(b){showView('workspace');addHolding(b.dataset.addCatalog);$('portfolio-title').scrollIntoView({block:'start'});}};
function safeSource(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}}
function renderReview(){
  $('review-count').textContent=queue.candidates.length+' candidates';
  $('review-list').innerHTML=queue.candidates.map(r=>`<article class="review-card"><h3>${esc(r.issuer_id)} → ${esc(r.supplier_name)}</h3><span class="coverage-badge pending_review">Pending semantic review</span><blockquote>${esc(r.verbatim_quote)}</blockquote><p>${esc(r.product_scope)} · ${esc(r.filing_date)} · Period ${esc(r.fiscal_period_end)}</p><a href="${esc(safeSource(r.source_url))}" target="_blank" rel="noopener noreferrer">Inspect original filing ↗</a></article>`).join('')||'<p>No source candidates have been prepared.</p>';
}
function initCompare(){for(const id of ['compare-left','compare-right'])$(id).innerHTML=companies.map(c=>`<option value="${esc(c.ticker)}">${esc(c.name)} · ${esc(c.ticker)}</option>`).join('');$('compare-left').value='NVDA';$('compare-right').value='AMD';}
$('compare-form').onsubmit=async e=>{e.preventDefault();const seq=++compareSequence;$('comparison').textContent='Loading disclosures…';try{const d=await api('/api/compare?left='+encodeURIComponent($('compare-left').value)+'&right='+encodeURIComponent($('compare-right').value));if(seq!==compareSequence)return;$('comparison').innerHTML='<div class="compare-grid">'+d.companies.map(c=>`<article class="compare-card"><p class="eyebrow">${esc(c.ticker)}</p><h3>${esc(c.name)}</h3><span class="coverage-badge ${esc(c.coverage_status)}">${esc(coverageLabels[c.coverage_status]||'Not assessed')}</span><p class="compare-note">Manufacturing model: ${esc(c.manufacturing_model||'not indexed')}</p>${c.relationships.length?c.relationships.map(r=>`<div class="compare-link"><h4>${esc(r.supplier_name)}</h4><p>${esc(r.product_scope)}</p><p>Filed ${esc(r.filing_date)} · Period ${esc(r.period_end)}</p><a href="${esc(safeSource(r.source_url))}" target="_blank" rel="noopener noreferrer">Read disclosure ↗</a></div>`).join(''):'<p class="compare-note">No reviewed supplier evidence in this index. This does not mean no dependencies.</p>'}</article>`).join('')+'</div>'+`<p class="compare-note">Shared suppliers in reviewed evidence: ${esc(d.shared_supplier_ids.join(', ')||'none established')}. ${esc(d.note)}</p>`;}catch(error){if(seq===compareSequence)$('comparison').textContent=error.message;}};
$('save-portfolio').onclick=()=>{try{payload();localStorage.setItem('blindspot-portfolio-v1',JSON.stringify({positions,unassessed:$('unassessed').value}));$('save-status').textContent='Saved in this browser. Use Restore to load it.';}catch(e){$('save-status').textContent='Could not save. Check amounts and browser storage permissions.';}};
$('restore-portfolio').onclick=()=>{try{const raw=localStorage.getItem('blindspot-portfolio-v1');if(!raw)throw Error('No saved portfolio in this browser.');const saved=JSON.parse(raw);if(!Array.isArray(saved.positions)||saved.positions.length>30||typeof saved.unassessed!=='string')throw Error('Saved portfolio is invalid.');let sum=toCents(saved.unassessed);for(const p of saved.positions){if(typeof p.ticker!=='string'||!/^[A-Z0-9.\-]{1,12}$/.test(p.ticker)||typeof p.amount!=='string')throw Error('Saved portfolio is invalid.');sum+=toCents(p.amount);}if(sum>100000000000)throw Error('Saved total exceeds $1 billion.');positions=saved.positions;$('unassessed').value=saved.unassessed;renderInputs();invalidate();$('save-status').textContent='Restored your saved portfolio.';}catch(e){$('save-status').textContent=e.message;}};
async function loadQuotes(){try{const d=await api('/api/quotes?tickers='+positions.map(p=>encodeURIComponent(p.ticker)).join(','));$('quotes').textContent=d.quotes.map(q=>q.ticker+': '+(q.status==='unavailable'?'unavailable':q.status)).join(' · ')+'. '+d.reason;}catch{$('quotes').textContent='Quotes unavailable. Portfolio calculations still use your manual amounts.';}}
init();
