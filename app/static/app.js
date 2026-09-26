'use strict';
const $ = id => document.getElementById(id);
const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0}).format(cents/100);
const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    return `<div class="position"><div class="position-top"><span class="ticker-icon ${esc(p.ticker.toLowerCase())}" aria-hidden="true">${esc(p.ticker==='NVDA'?'N':p.ticker==='AVGO'?'B':'A')}</span><label for="amount-${i}">${esc(p.ticker)}<span class="position-name">${esc(company?.name||p.ticker)}</span></label><button class="remove" type="button" data-remove="${i}" aria-label="Remove ${esc(p.ticker)}">×</button></div><div class="money-input"><span>$</span><input id="amount-${i}" data-position="${i}" type="text" inputmode="decimal" value="${esc(p.amount)}" autocomplete="off"></div></div>`;
  }).join('');
  $('position-count').textContent=positions.length;
  const available=companies.filter(c=>!positions.some(p=>p.ticker===c.ticker));
  $('add-ticker').innerHTML='<option value="">Add company…</option>'+available.map(c=>`<option value="${esc(c.ticker)}">${esc(c.ticker)} · ${esc(c.name)}</option>`).join('');
  $('add').disabled=!available.length;
}
function payload(){return {positions:positions.map(p=>({ticker:p.ticker,amount_cents:toCents(p.amount)})),unassessed_amount_cents:toCents($('unassessed').value)}}
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
    renderResult();
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
  renderGraph();
  $('finding').innerHTML='<span class="finding-icon">i</span><p>'+(s?`<strong>${s.connected_tickers.length} held ${s.connected_tickers.length===1?'company has':'companies have'} a disclosed relationship with ${esc(s.name)}.</strong> That connects ${dollars(s.connected_value_cents)} of this portfolio. Select a company or a numbered line to inspect the source.`:'No reviewed supplier connections for these amounts in the indexed sources. This does not establish an absence of relationships.')+'</p>';
}
function renderGraph(){
  const supplier=result.suppliers.find(s=>s.supplier_id===activeSupplier);
  if(!supplier){$('graph').innerHTML='<div class="graph-empty"><span class="empty-symbol">◎</span><h3>'+(!result.total_cents?'Start with an amount.':'No indexed connections.')+'</h3><p>'+(!result.total_cents?'Enter a positive amount, then reveal.':'These holdings have no reviewed supplier links in this index.')+'</p></div>';return;}
  const edges=result.relationships.filter(r=>r.supplier_id===activeSupplier);
  const nodes=result.holdings.filter(h=>edges.some(e=>e.issuer_id===h.entity_id));
  let svg='<svg aria-label="Disclosed supplier relationships"></svg>';
  let html='';
  nodes.forEach((h,i)=>{
    const y=nodes.length===1?165:57+i*216/(nodes.length-1);
    const edge=edges.find(r=>r.issuer_id===h.entity_id);
    const id=edge.relationship_id;
    html+=`<button class="node company-node ${selected===id?'selected':''}" style="top:${y/330*100}%" data-evidence="${esc(id)}" aria-label="Inspect ${esc(h.name)} evidence"><span class="ticker-icon ${esc(h.ticker.toLowerCase())}" aria-hidden="true">${esc(h.ticker==='NVDA'?'N':h.ticker==='AVGO'?'B':'A')}</span><span><span class="node-name">${esc(h.name)}</span><span class="node-money">${dollars(h.amount_cents)}</span></span></button>`;
  });
  html+=`<button class="node supplier-node" id="supplier-node" aria-label="Inspect connections to ${esc(supplier.name)}"><span class="node-caption">SHARED SUPPLIER</span><span class="supplier-name">${esc(supplier.name)}</span><span class="supplier-subtitle">Semiconductor manufacturing</span><span class="supplier-amount">${supplier.connected_percentage}% connected allocation</span></button>`;
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
    $('evidence').innerHTML=`<h3 class="evidence-title">${esc(e.company_name)} <span aria-hidden="true">→</span> ${esc(e.supplier_name)}</h3><p class="evidence-subtitle">${esc(e.product_scope)}</p><span class="review-badge">✓ Source matched · reviewed</span><p class="quote-label">FROM THE FILING</p><blockquote><mark>${esc(e.quote)}</mark></blockquote>${e.disclosed_percentage!==null?`<div class="evidence-fact"><strong>≈ ${e.disclosed_percentage}%</strong><p>${esc(e.percentage_denominator)} · ${esc(e.percentage_period)}.</p><p>This describes manufacturing volume, not investment value.</p></div>`:''}<dl class="metadata"><div><dt>Document</dt><dd>${esc(e.form)} · annual report</dd></div><div><dt>Period end</dt><dd>${esc(e.fiscal_period_end)}</dd></div><div><dt>Filed</dt><dd>${esc(e.filing_date)}</dd></div><div><dt>Section</dt><dd>${esc(e.section)}</dd></div></dl><a class="source-link" href="${esc(source.href)}" target="_blank" rel="noopener noreferrer">Read original filing <span aria-hidden="true">↗</span></a><button class="copy-source" id="copy-source">Copy source link</button><p class="provenance">${esc(e.reviewer)}. ${e.extraction_model?'Extracted with '+esc(e.extraction_model)+'.':'Source-checked seed; no Gemini extraction claimed.'} ${e.data_mode==='atlas'?'Retrieved from Atlas.':'Retrieved from local cache.'}</p>`;
    $('copy-source').onclick=async()=>{try{await navigator.clipboard.writeText(source.href);$('copy-source').textContent='Copied';}catch{$('copy-source').textContent='Open the filing above to copy its address';}};
  }catch(error){if(version===evidenceSequence){$('evidence').innerHTML='<p class="error">'+esc(error.message)+'</p><button id="retry-evidence" class="quiet">Retry evidence</button>';$('retry-evidence').onclick=()=>inspect(id);}}
}
$('portfolio-form').addEventListener('submit',e=>{e.preventDefault();runAnalysis();});
$('positions').addEventListener('input',e=>{if(e.target.dataset.position!==undefined){positions[Number(e.target.dataset.position)].amount=e.target.value;invalidate();}});
$('positions').addEventListener('click',e=>{const button=e.target.closest('[data-remove]');if(button){positions.splice(Number(button.dataset.remove),1);renderInputs();invalidate();}});
$('unassessed').addEventListener('input',invalidate);
$('add').addEventListener('click',()=>{const ticker=$('add-ticker').value;if(ticker){positions.push({ticker,amount:'0.00'});renderInputs();invalidate();}});
$('graph').addEventListener('click',e=>{const edge=e.target.closest('[data-evidence]');if(edge)inspect(edge.dataset.evidence);else if(e.target.closest('#supplier-node')){const first=result.relationships.find(r=>r.supplier_id===activeSupplier);if(first)inspect(first.relationship_id);}});
$('graph').addEventListener('keydown',e=>{if(e.target.classList.contains('edge-hit')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();inspect(e.target.dataset.evidence);}});
$('reset').addEventListener('click',()=>{positions=[{ticker:'NVDA',amount:'2500.00'},{ticker:'AMD',amount:'2000.00'},{ticker:'AVGO',amount:'1500.00'}];$('unassessed').value='4000.00';selected=null;evidenceSequence++;renderInputs();runAnalysis();});
async function init(){
  renderInputs();
  try{companies=await api('/api/companies');renderInputs();const status=await api('/health');$('data-status').innerHTML='<span class="status-dot"></span>'+(status.data_mode==='atlas'?'Atlas · indexed evidence':'Local cache · source-checked evidence');}
  catch{$('data-status').textContent='Data service unavailable';showError('Could not load coverage. Try Reveal to reconnect.');}
}
init();
