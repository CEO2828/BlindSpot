'use strict';
const $ = id => document.getElementById(id);
const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0}).format(cents/100);
const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let companies=[],queue={candidates:[]},result=null,positions=[{ticker:'NVDA',amount:'2500.00'},{ticker:'AMD',amount:'2000.00'},{ticker:'AVGO',amount:'1500.00'}];
let selected=null,activeSupplier=null,sequence=0,evidenceSequence=0,compareSequence=0,peerSequence=0,modalSequence=0,savedDraft=null,manual=false;
const labels={reviewed:'Published · source-checked',pending_review:'Pending review',reviewed_no_match:'No match in reviewed scope',unsupported:'Not published'};
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
    return `<div class="position"><div class="position-top"><span class="ticker-icon ${esc(p.ticker.toLowerCase())}" aria-hidden="true">${esc(p.ticker==='NVDA'?'N':p.ticker==='AVGO'?'B':p.ticker[0])}</span><label for="amount-${i}">${esc(p.ticker)}<span class="position-name">${esc(company?.name||p.ticker)}</span></label><button class="remove" type="button" data-remove="${i}" aria-label="Remove ${esc(p.ticker)}">×</button></div><div class="money-input"><span>$</span><input id="amount-${i}" data-position="${i}" type="text" inputmode="decimal" value="${esc(p.amount)}" autocomplete="off"></div><span class="holding-status">${esc(labels[company?.coverage_status]||'Not assessed')}</span></div>`;
  }).join('');

  $('company-options').innerHTML=companies.map(c=>`<option value="${esc(c.ticker)}">${esc(c.name)}</option>`).join('');
  $('add').disabled=positions.length>=30;
}
function payload(){const value={positions:positions.map(p=>({ticker:p.ticker,amount_cents:toCents(p.amount)})),unassessed_amount_cents:toCents($('unassessed').value)};if(value.positions.reduce((n,p)=>n+p.amount_cents,0)+value.unassessed_amount_cents>100000000000)throw Error('Total must be at most $1 billion.');return value;}

function showError(message){$('form-error').textContent=message;$('form-error').hidden=!message;}
function summary(){
 let input;try{input=payload();}catch{return;}
 const total=input.positions.reduce((a,p)=>a+p.amount_cents,0)+input.unassessed_amount_cents;
 $('total').textContent=dollars(total);$('portfolio-title').textContent=manual?'Your manual portfolio':'Example portfolio';
 $('holdings-summary').innerHTML=[...positions.map(p=>({name:companies.find(c=>c.ticker===p.ticker)?.name||p.ticker,ticker:p.ticker,cents:toCents(p.amount)})),{name:'Other / unassessed',ticker:'Included in total',cents:input.unassessed_amount_cents}].map(p=>`<div class="holding-row"><span><strong>${esc(p.name)}</strong><small>${esc(p.ticker)}</small></span><span>${dollars(p.cents)}<small>${total?(p.cents/total*100).toFixed(1):'0'}%</small></span></div>`).join('');
 $('peer-company').innerHTML=positions.map(p=>`<option value="${esc(p.ticker)}">${esc(companies.find(c=>c.ticker===p.ticker)?.name||p.ticker)}</option>`).join('');
}
function drawerError(message){$('drawer-error').textContent=message;$('drawer-error').hidden=!message;}
function draftTotal(){try{$('drawer-total').textContent=dollars(payload().positions.reduce((s,p)=>s+p.amount_cents,0)+toCents($('unassessed').value));drawerError('');}catch(e){drawerError(e.message);}}
function openDrawer(add=false){savedDraft={positions:structuredClone(positions),unassessed:$('unassessed').value};renderInputs();draftTotal();$('holdings-drawer').showModal();if(add)$('add-ticker').focus();}
function cancelDrawer(){if(savedDraft){positions=savedDraft.positions;$('unassessed').value=savedDraft.unassessed;savedDraft=null;}drawerError('');$('holdings-drawer').close();}
$('edit-holdings').onclick=()=>openDrawer();$('add-holding').onclick=()=>openDrawer(true);$('close-drawer').onclick=cancelDrawer;$('cancel-drawer').onclick=cancelDrawer;
$('holdings-drawer').addEventListener('cancel',e=>{e.preventDefault();cancelDrawer();});
$('portfolio-form').onsubmit=e=>{e.preventDefault();try{payload();manual=true;savedDraft=null;summary();$('holdings-drawer').close();runAnalysis();}catch(e){drawerError(e.message);}};
$('positions').oninput=e=>{if(e.target.dataset.position!==undefined){positions[Number(e.target.dataset.position)].amount=e.target.value;draftTotal();}};
$('positions').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){positions.splice(Number(b.dataset.remove),1);renderInputs();draftTotal();}};
$('unassessed').oninput=draftTotal;
function addHolding(value){const raw=value.trim(),company=companies.find(c=>c.ticker.toLowerCase()===raw.toLowerCase()||c.name.toLowerCase()===raw.toLowerCase()),ticker=company?.ticker||raw.toUpperCase();if(!/^[A-Z0-9.\-]{1,12}$/.test(ticker)){drawerError('Choose a company or enter a valid ticker (up to 12 characters).');return;}if(positions.some(p=>p.ticker===ticker)){drawerError(ticker+' is already listed. Edit its existing amount.');return;}if(positions.length>=30){drawerError('Maximum 30 holdings.');return;}positions.push({ticker,amount:'0.00'});renderInputs();$('add-ticker').value='';draftTotal();$('amount-'+(positions.length-1)).focus();}
$('add').onclick=()=>addHolding($('add-ticker').value);$('add-ticker').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addHolding(e.target.value);}};
async function runAnalysis(){const version=++sequence;++evidenceSequence;$('reveal').disabled=true;showError('');try{const data=await api('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});if(version!==sequence)return;result=data;const retained=data.relationships.find(r=>r.relationship_id===selected);if(retained)activeSupplier=retained.supplier_id;if(!data.suppliers.some(s=>s.supplier_id===activeSupplier))activeSupplier=data.suppliers[0]?.supplier_id||null;selected=retained?.relationship_id||data.relationships.find(r=>r.supplier_id===activeSupplier)?.relationship_id||null;renderResult();if(selected)await inspect(selected);else{$('evidence').innerHTML='<h3>No verified evidence for these holdings.</h3><p>Amounts remain in the total. Try the example portfolio or inspect Coverage.</p>';loadPeers($('peer-company').value);}}catch(e){if(version===sequence)showError(e.message+' Retry Reveal.');}finally{if(version===sequence)$('reveal').disabled=false;}}
$('reveal').onclick=runAnalysis;
function renderResult(){const s=result.suppliers.find(s=>s.supplier_id===activeSupplier);$('total').textContent=dollars(result.total_cents);$('connected').textContent=dollars(s?.connected_value_cents||0);$('connected-percent').textContent=(s?.connected_percentage||0)+'% of total';$('linked-label').textContent=s?'Holdings connected to '+s.name:'Connected holding value';$('coverage').textContent=result.total_cents?Math.round(result.assessed_cents/result.total_cents*100)+'%':'No value';$('coverage-note').textContent=dollars(result.unassessed_cents)+' unassessed';$('data-status').textContent=result.data_mode==='atlas'?'Atlas · indexed evidence':'Bundled evidence cache';$('warnings').textContent=result.warnings.join(' ');$('graph-count').textContent=result.suppliers.length+' suppliers · '+result.relationships.length+' disclosures';$('supplier-control').hidden=result.suppliers.length<2;$('supplier-select').innerHTML=result.suppliers.map(x=>`<option value="${esc(x.supplier_id)}" ${x.supplier_id===activeSupplier?'selected':''}>${esc(x.name)}</option>`).join('');$('relationship-select').innerHTML=result.relationships.map(r=>`<option value="${esc(r.relationship_id)}" ${r.relationship_id===selected?'selected':''}>${esc(r.issuer_id)} → ${esc(r.supplier_id)} · ${esc(r.product_scope)}</option>`).join('');$('relationship-select').disabled=!result.relationships.length;$('finding').textContent=s?s.connected_tickers.length+' held companies disclose a relationship with '+s.name+'. Select a company or use View evidence.':'No reviewed connections in this indexed scope.';renderGraph();}
function renderGraph(){
  const supplier=result.suppliers.find(s=>s.supplier_id===activeSupplier);
  if(!supplier){$('graph').innerHTML='<div class="graph-empty"><span class="empty-symbol">◎</span><h3>'+(!result.total_cents?'Start with an amount.':'No indexed connections.')+'</h3><p>'+(!result.total_cents?'Enter a positive amount, then reveal.':'These holdings have no reviewed supplier links in this index.')+'</p></div>';return;}
  const edges=result.relationships.filter(r=>r.supplier_id===activeSupplier);
  const nodes=edges.map(e=>({...result.holdings.find(h=>h.entity_id===e.issuer_id),evidence:e}));
  const height=Math.max(245,nodes.length*74+24);$('graph').style.height=height+'px';
  let svg='<svg aria-label="Disclosed supplier relationships"></svg>';
  let html='';
  nodes.forEach((h,i)=>{
    const y=nodes.length===1?height/2:42+i*(height-84)/(nodes.length-1);
    const edge=h.evidence;
    const id=edge.relationship_id;
    html+=`<button class="node company-node ${selected===id?'selected':''}" style="top:${y/height*100}%" data-evidence="${esc(id)}" aria-label="Inspect ${esc(h.name)} evidence"><span><span class="node-name">${esc(h.name)}</span><span class="node-money">${dollars(h.amount_cents)}</span></span></button>`;
  });
  html+=`<button class="node supplier-node" id="supplier-node" aria-label="Inspect connections to ${esc(supplier.name)}"><span class="supplier-name">${esc(supplier.name)}</span><small>Disclosed supplier<br>${supplier.connected_percentage}% of holdings</small></button>`;
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
    paths+=`<path class="edge ${selected===id?'selected':''}" d="${d}"/><path class="edge-hit" d="${d}" role="button" tabindex="0" data-evidence="${esc(id)}" aria-label="${esc(node.getAttribute('aria-label').replace(' evidence',' to '+activeSupplier+' evidence'))}"/>`;
  });
  svg.innerHTML=paths;
}
new ResizeObserver(drawEdges).observe($('graph'));
function evidenceHTML(e){const source=new URL(e.source_url);if(source.protocol!=='https:')throw Error('Source link unavailable');
  return `<h3 class="evidence-title">${esc(e.company_name)} <span aria-hidden="true">→</span> ${esc(e.supplier_name)}</h3><p class="evidence-subtitle">${esc(e.product_scope)}</p><blockquote>${esc(e.quote)}</blockquote>${e.disclosed_percentage!==null?`<div class="evidence-fact"><strong>≈ ${e.disclosed_percentage}%</strong><p>${esc(e.percentage_denominator)} · ${esc(e.percentage_period)}.</p><p>This describes manufacturing volume, not investment value.</p></div>`:''}<dl class="metadata"><div><dt>Relationship</dt><dd>${esc(e.relationship_type.replaceAll('_',' '))}</dd></div><div><dt>Document</dt><dd>${esc(e.form)} · annual report</dd></div><div><dt>Period end</dt><dd>${esc(e.fiscal_period_end)}</dd></div><div><dt>Filed</dt><dd>${esc(e.filing_date)}</dd></div><div><dt>Section</dt><dd>${esc(e.section)}</dd></div></dl><a class="source-link" href="${esc(source.href)}" target="_blank" rel="noopener noreferrer">Read original filing <span aria-hidden="true">↗</span></a><p class="provenance">${esc(e.reviewer)}. ${e.extraction_model?'Extracted with '+esc(e.extraction_model)+'.':'Source-checked seed; no Gemini extraction claimed.'} ${e.data_mode==='atlas'?'Retrieved from Atlas.':'Retrieved from local cache.'}</p>`;
}

async function inspect(id){const version=++evidenceSequence;selected=id;const row=result.relationships.find(r=>r.relationship_id===id);if(row)activeSupplier=row.supplier_id;renderResult();$('relationship-select').value=id;$('evidence').innerHTML='<p role="status">Loading source evidence…</p>';if(row){$('peer-company').value=row.issuer_id;loadPeers(row.issuer_id);}try{const e=await api('/api/evidence/'+encodeURIComponent(id));if(version!==evidenceSequence)return;if(e.relationship_id!==id||!e.quote)throw Error('Evidence response does not match this connection.');$('evidence').innerHTML=evidenceHTML(e);}catch(e){if(version===evidenceSequence){$('evidence').innerHTML='<p class="error">Evidence could not be loaded. '+esc(e.message)+'</p><button id="retry-evidence">Retry evidence</button>';$('retry-evidence').onclick=()=>inspect(id);}}}
$('graph').onclick=e=>{const b=e.target.closest('[data-evidence]');if(b)inspect(b.dataset.evidence);else if(e.target.closest('#supplier-node')){const r=result.relationships.find(r=>r.supplier_id===activeSupplier);if(r)inspect(r.relationship_id);}};
$('graph').onkeydown=e=>{if(e.target.classList.contains('edge-hit')&&['Enter',' '].includes(e.key)){e.preventDefault();inspect(e.target.dataset.evidence);}};
$('relationship-select').onchange=e=>inspect(e.target.value);$('supplier-select').onchange=e=>{const r=result.relationships.find(r=>r.supplier_id===e.target.value);if(r)inspect(r.relationship_id);};
function showView(name){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!=='view-'+name);document.querySelectorAll('[data-view]').forEach(e=>{if(e.dataset.view===name)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});if(name==='workspace')drawEdges();if(name==='compare'&&!$('comparison').textContent)runCompare();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
function safeSource(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}}
async function modalEvidence(id){const version=++modalSequence;$('source-content').textContent='Loading evidence…';if(!$('source-dialog').open)$('source-dialog').showModal();try{const e=await api('/api/evidence/'+encodeURIComponent(id));if(version===modalSequence)$('source-content').innerHTML=evidenceHTML(e);}catch{if(version!==modalSequence)return;$('source-content').innerHTML='<p>Evidence could not be loaded.</p><button id="retry-modal">Retry</button>';$('retry-modal').onclick=()=>modalEvidence(id);}}
$('close-source').onclick=()=>{$('source-dialog').close();++modalSequence;};
function renderCatalog(){const q=$('catalog-search').value.toLowerCase(),full=$('full-catalog').checked;const list=companies.filter(c=>(c.name+' '+c.ticker).toLowerCase().includes(q)).filter(c=>full||q||c.assessment_outcome==='relationship_found'||c.assessment_outcome==='not_found_in_reviewed_scope');const counts=s=>companies.filter(c=>c.assessment_outcome===s).length;$('catalog-summary').textContent=`${companies.length} companies · ${counts('relationship_found')+counts('not_found_in_reviewed_scope')} assessed · ${companies.filter(c=>c.publication_state==='approved').length} published · ${companies.filter(c=>c.pending_count>0).length} pending · ${counts('unavailable')} unavailable`;$('catalog-list').innerHTML='<div class="coverage-row coverage-head"><span>Company</span><span>Assessment / publication</span><span>Filing / scope</span><span>Evidence</span></div>'+list.map(c=>`<article class="coverage-row"><div><h3>${esc(c.name)}</h3><small>${esc(c.ticker)}</small></div><div><span class="state">${esc(c.assessment_outcome.replaceAll('_',' '))}</span><p>${esc(c.publication_state.replaceAll('_',' '))}</p></div><div><p>${esc(c.form||'Filing')} · ${esc(c.filing_date||'Date unavailable')} ${c.filing_date?'· Historical disclosure':''}</p><small>${esc(c.assessment_reason)}</small></div><button data-coverage="${esc(c.ticker)}">${c.publication_state==='approved'?'View evidence':'Review record'}</button></article>`).join('');}
$('catalog-search').oninput=renderCatalog;$('full-catalog').onchange=renderCatalog;
$('catalog-list').onclick=e=>{const b=e.target.closest('[data-coverage]');if(!b)return;const c=companies.find(c=>c.ticker===b.dataset.coverage);if(c.evidence_ids?.length){modalEvidence(c.evidence_ids[0]);return;}const rows=queue.candidates.filter(r=>r.issuer_id===c.entity_id);$('source-content').innerHTML=`<h3>${esc(c.name)} · ${esc(c.assessment_outcome.replaceAll('_',' '))}</h3><p>${esc(c.assessment_reason)}</p>`+(rows.length?rows.map(candidateHTML).join(''):(c.source_url?`<a href="${esc(safeSource(c.source_url))}" target="_blank" rel="noopener">Open attempted source</a>`:''));$('source-dialog').showModal();};
function candidateHTML(r){return `<article class="review-card"><h3>${esc(r.issuer_id)} → ${esc(r.supplier_name)}</h3><span class="state">Pending publication review</span><blockquote>${esc(r.verbatim_quote)}</blockquote><p>${esc(r.product_scope)} · Filed ${esc(r.filing_date)} · Period ${esc(r.fiscal_period_end)}</p><p>${esc(r.interpretation||'Direct wafer fabrication candidate; check the full source context before approval.')}</p><p>${esc(r.review_reason||'Human semantic confirmation required by the existing local review workflow.')}</p><a href="${esc(safeSource(r.source_url))}" target="_blank" rel="noopener">Original filing ↗</a></article>`;}
function renderReview(){$('review-count').textContent=queue.candidates.length+' candidates';$('review-list').innerHTML=queue.candidates.map(candidateHTML).join('');}
function initCompare(){for(const id of ['compare-left','compare-right'])$(id).innerHTML=companies.map(c=>`<option value="${esc(c.ticker)}">${esc(c.name)} · ${esc(c.ticker)}</option>`).join('');$('compare-left').value='NVDA';$('compare-right').value='AMD';}
async function runCompare(){const seq=++compareSequence;$('comparison').textContent='Loading disclosures…';try{const d=await api('/api/compare?left='+encodeURIComponent($('compare-left').value)+'&right='+encodeURIComponent($('compare-right').value));if(seq!==compareSequence)return;$('comparison').innerHTML='<div class="compare-grid">'+d.companies.map(c=>`<article class="compare-card"><p class="eyebrow">${esc(c.ticker)}</p><h2>${esc(c.name)}</h2><p class="state">${esc(labels[c.coverage_status]||'Not published')}</p>${c.relationships.map(r=>`<div class="compare-link"><h4>${esc(r.supplier_name)}</h4><p>${esc(r.product_scope)}</p><p>Filed ${esc(r.filing_date)} · Period ${esc(r.period_end)}</p><button data-modal-evidence="${esc(r.relationship_id)}">View evidence</button> <a href="${esc(safeSource(r.source_url))}" target="_blank" rel="noopener">Original filing ↗</a></div>`).join('')||'<p>No published supplier evidence in this index. This does not mean no dependencies.</p>'}<p class="compare-note">Manufacturing model: ${esc(c.manufacturing_model||'not indexed')}</p></article>`).join('')+'</div>'+`<p class="compare-note">Shared disclosed suppliers: ${esc(d.shared_supplier_ids.join(', ')||'none established')}. ${esc(d.note)}</p>`;}catch(e){if(seq===compareSequence)$('comparison').textContent=e.message;}}
$('compare-form').onsubmit=e=>{e.preventDefault();runCompare();};$('comparison').onclick=e=>{const b=e.target.closest('[data-modal-evidence]');if(b)modalEvidence(b.dataset.modalEvidence);};
async function loadPeers(ticker){const seq=++peerSequence;if(!ticker){$('peer-results').textContent='Add a holding to explore comparable companies.';return;}$('peer-results').textContent='Checking researched comparisons…';try{const d=await api('/api/peers?ticker='+encodeURIComponent(ticker));if(seq!==peerSequence)return;$('peer-results').innerHTML=d.candidates.map(c=>`<article class="peer-row"><div><h3>${esc(c.name)}</h3><p>${esc(c.reason)}</p><a href="${esc(safeSource(c.peer_source))}" target="_blank" rel="noopener">Product-market source ↗</a></div><div><span class="state">${esc(c.status)}</span><p>Shared: ${esc(c.shared.join(', ')||'none established')} · Different: ${esc(c.different.join(', ')||'none established')}</p><p>${esc(c.scope_note)}</p><small>${esc(c.unknown)}</small>${c.pending_leads.length?`<p>Unpublished research lead: ${esc(c.pending_leads.map(x=>x.supplier).join(', '))}. <button class="lead-button" data-candidate="${esc(c.pending_leads[0].candidate_id)}">Inspect pending source</button></p>`:''}</div><button data-compare-peer="${esc(c.ticker)}" data-origin="${esc(ticker)}">Compare evidence ↗</button></article>`).join('')||'<p class="empty">No source-supported peer mapping is indexed for this company yet.</p>';}catch{$('peer-results').textContent='Comparison discovery unavailable. Try selecting the company again.';}}
$('peer-company').onchange=e=>loadPeers(e.target.value);$('peer-results').onclick=e=>{const lead=e.target.closest('[data-candidate]');if(lead){const row=queue.candidates.find(r=>r.candidate_id===lead.dataset.candidate);$('source-content').innerHTML=candidateHTML(row);$('source-dialog').showModal();return;}const b=e.target.closest('[data-compare-peer]');if(b){$('compare-left').value=b.dataset.origin;$('compare-right').value=b.dataset.comparePeer;showView('compare');runCompare();}};
$('save-portfolio').onclick=()=>{try{payload();localStorage.setItem('blindspot-portfolio-v1',JSON.stringify({positions,unassessed:$('unassessed').value}));$('save-status').textContent='Saved in this browser.';}catch{$('save-status').textContent='Could not save portfolio.';}};
$('restore-portfolio').onclick=()=>{const previous=structuredClone(positions),other=$('unassessed').value;try{const s=JSON.parse(localStorage.getItem('blindspot-portfolio-v1'));if(!s||!Array.isArray(s.positions)||s.positions.length>30||typeof s.unassessed!=='string'||s.positions.some(p=>typeof p.ticker!=='string'||!/^[A-Z0-9.\-]{1,12}$/.test(p.ticker)||typeof p.amount!=='string'))throw Error();positions=s.positions;$('unassessed').value=s.unassessed;payload();manual=true;summary();runAnalysis();$('save-status').textContent='Saved portfolio restored.';}catch{positions=previous;$('unassessed').value=other;$('save-status').textContent='No valid saved portfolio. Current holdings preserved.';}};
$('reset').onclick=()=>{positions=[{ticker:'NVDA',amount:'2500.00'},{ticker:'AMD',amount:'2000.00'},{ticker:'AVGO',amount:'1500.00'}];$('unassessed').value='4000.00';manual=false;summary();runAnalysis();};
async function init(){try{[companies,queue]=await Promise.all([api('/api/companies'),api('/api/review-queue')]);renderInputs();summary();renderCatalog();renderReview();initCompare();await runAnalysis();}catch(e){showError('Coverage unavailable. '+e.message);summary();}}
init();
