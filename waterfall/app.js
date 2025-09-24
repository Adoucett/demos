



$('stdDedLabel').textContent = money(FED.standardDeduction.single);
updateKLimits();
bindUI();
recalc();
}


/* ----------------------- INPUT BINDINGS ----------------------- */
function bindUI(){
[ ['e1SalaryText','e1Salary'], ['e1BonusText','e1Bonus'], ['e2SalaryText','e2Salary'], ['e2BonusText','e2Bonus'], ['otherOrdText','otherOrd'], ['trad401kText','trad401k'], ['roth401kText','roth401k'], ['hsaText','hsa'], ['itemizedText','itemized'], ['creditsText','credits'], ].forEach(([t,r])=> syncTextAndRange(t,r, ()=>{ if(t==='trad401kText'||t==='roth401kText') syncKSliders(); recalc(); }));


on('viewFederal','click', ()=>{view='federal'; $('viewFederal').classList.add('btn-primary'); $('viewState').classList.remove('btn-primary'); recalc();});
on('viewState','click', ()=>{view='state'; $('viewState').classList.add('btn-primary'); $('viewFederal').classList.remove('btn-primary'); recalc();});


on('dedStd','click', ()=>{dedMode='standard'; $('dedStd').classList.add('btn-primary'); $('dedItem').classList.remove('btn-primary'); recalc();});
on('dedItem','click', ()=>{dedMode='itemized'; $('dedItem').classList.add('btn-primary'); $('dedStd').classList.remove('btn-primary'); recalc();});


on('filingStatus','change', ()=>{
updateKLimits();
const fs=$('filingStatus').value;
if(fs==='marriedFilingJointly'){
$('earner2Box').classList.remove('hidden'); $('kPct2Wrap').classList.remove('hidden'); $('hsa').max = 8550; $('hsaText').value = fmt(Math.min(parseMoney($('hsaText').value), 8550));
}else{
$('earner2Box').classList.add('hidden'); $('kPct2Wrap').classList.add('hidden'); ['e2Salary','e2Bonus'].forEach(id=>{$(id).value=0;}); ['e2SalaryText','e2BonusText'].forEach(id=>{$(id).value='0';}); $('hsa').max = 4300; $('hsaText').value = fmt(Math.min(parseMoney($('hsaText').value), 4300));
}
$('stdDedLabel').textContent = money(FED.standardDeduction[fs]);
syncKSliders();
recalc();
});
on('state','change', recalc);


on('lockBtn','click', ()=>{ baseline = compute(); $('lockInfo').classList.remove('hidden'); recalc(); });
on('clearLockBtn','click', ()=>{ baseline=null; $('lockInfo').classList.add('hidden'); $('deltaChips').innerHTML=''; recalc(); });


// 401k % mode toggle
on('kModePct','change', ()=>{ const pct = $('kModePct').checked; $('kAmountRow').classList.toggle('hidden', pct); $('kPctRows').classList.toggle('hidden', !pct); recalc(); });
;['trad401k','trad401kText','roth401k','roth401kText','kPct1','kPct2'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', ()=>{ syncKSliders(); recalc(); }); });
}


function updateKLimits(){ const fs=$('filingStatus').value; const per=FED.contributionLimits.k401.employeeDeferral; $('kLimitLabel').textContent=money(per)+' per earner'; $('trad401k').max = per*(fs==='marriedFilingJointly'?2:1); $('roth401k').max=$('trad401k').max; syncKSliders(); }


function syncKSliders(){
const per = FED.contributionLimits.k401.employeeDeferral; const earners = $('filingStatus').value==='marriedFilingJointly'?2:1; const cap = per*earners;
if ($('kModePct').checked){ const s1=parseMoney($('e1SalaryText').value)+parseMoney($('e1BonusText').value); const s2=$('filingStatus').value==='marriedFilingJointly' ? (parseMoney($('e2SalaryText').value)+parseMoney($('e2BonusText').value)) : 0; const p1=Number($('kPct1').value)||0; const p2=Number($('kPct2').value)||0; let planned=(s1*p1/100)+(s2*p2/100); planned=Math.max(0,Math.min(planned,cap)); $('trad401kText').value=fmt(planned); $('trad401k').value=Math.min(cap,planned); }
const t=parseMoney($('trad401kText').value); const r=parseMoney($('roth401kText').value); $('roth401k').max=Math.max(0,cap-t); if(t+r>cap){ const newR=Math.max(0,cap-t); $('roth401k').value=newR; $('roth401kText').value=fmt(newR); }
}


/* ----------------------- CORE TAX ----------------------- */
function taxFromBrackets(taxable, brackets){ if(!brackets||!brackets.length||taxable<=0) return {tax:0,layers:[]}; let tax=0,last=0,remain=taxable,layers=[]; for(const b of brackets){ const size=(isFinite(b.threshold)?b.threshold:Infinity)-last; const inBand=Math.max(0,Math.min(remain,size)); const t=inBand*b.rate; tax+=t; layers.push({rate:b.rate,from:last,to:b.threshold,income:inBand,tax:t}); remain-=inBand; last=b.threshold; if(remain<=0) break; } return {tax,layers}; }


function compute(){
const fs=$('filingStatus').value; const state=$('state')?.value || null;
const e1=parseMoney($('e1SalaryText').value)+parseMoney($('e1BonusText').value); const e2=(fs==='marriedFilingJointly')?(parseMoney($('e2SalaryText').value)+parseMoney($('e2BonusText').value)):0; const other=parseMoney($('otherOrdText').value); const totalIncome=e1+e2+other;
const trad=parseMoney($('trad401kText').value); const roth=parseMoney($('roth401kText').value); const hsa=parseMoney($('hsaText').value); const aboveLine=trad+hsa; const agi=Math.max(0,totalIncome-aboveLine);
const std=FED.standardDeduction[fs]; const item=parseMoney($('itemizedText').value); const deduction=(dedMode==='standard')?std:item; const taxableOrd=Math.max(0,agi-deduction);
const fedComp=taxFromBrackets(taxableOrd,FED.brackets[fs]); const credits=parseMoney($('creditsText').value); const fedAfterCredits=Math.max(0,fedComp.tax-credits);
const stBr=(STATES[state]?.brackets?.[fs])||[]; const stateComp=taxFromBrackets(taxableOrd,stBr); const stateTax=stateComp.tax;
const totalTax=fedAfterCredits+stateTax; const eff=totalIncome>0?(totalTax/totalIncome*100):0;
const layers=(view==='federal')?fedComp.layers:stateComp.layers; let currentLayer=layers.find(l=>l.income>0&&(l.to===Infinity||taxableOrd<=l.to)); if(!currentLayer&&layers.length) currentLayer=layers[layers.length-1]; let toNext=0,toDrop=0,marginal='—'; if(currentLayer){ const size=(isFinite(currentLayer.to)?currentLayer.to:Infinity)-currentLayer.from; const used=currentLayer.income; const room=(isFinite(size)?size:Infinity)-used; toNext=isFinite(room)?room:0; toDrop=used>0?used+1:0; marginal=Math.round(currentLayer.rate*100)+'%'; }
const fedMarg=currentMarginalRate(fedComp.layers,taxableOrd); const stMarg=currentMarginalRate(stateComp.layers,taxableOrd);
return { fs,state,totalIncome,agi,taxableOrd,deduction,std,fedTax:fedAfterCredits,stateTax,totalTax,eff,marginal,toNext,toDrop,layers,fedMarg,stMarg,trad };
}


function currentMarginalRate(layers,taxable){ let rate=0; for(const L of layers){ if(taxable>L.from && (taxable<=L.to || L.to===Infinity)){ rate=L.rate; break; } } return rate; }


/* ----------------------- RENDER ----------------------- */
function recalc(){
const s=compute();
$('mTotalIncome').textContent=money(s.totalIncome); $('mTaxable').textContent=money(s.taxableOrd); $('mFed').textContent=money(s.fedTax); $('mState').textContent=money(s.stateTax); $('mEff').textContent=(s.eff||0).toFixed(1)+'%'; $('mMarginal').textContent=s.marginal;
$('wfTitle').textContent=(view==='federal'?'Federal':'State')+' Waterfall (Ordinary Income)'; $('toNext').textContent=money(s.toNext); $('toDrop').textContent=money(s.toDrop);
const chips=$('deltaChips'); chips.innerHTML=''; if(baseline){ addDeltaChip(chips,'Δ Income', s.totalIncome-baseline.totalIncome); addDeltaChip(chips,'Δ Taxable', s.taxableOrd-baseline.taxableOrd); addDeltaChip(chips,'Δ Total tax', s.totalTax-baseline.totalTax); const effDelta=(s.eff-baseline.eff); const c=document.createElement('span'); c.className='pill delta'; c.textContent='Δ Effective: '+(effDelta>=0?'+':'')+effDelta.toFixed(1)+' pts'; chips.appendChild(c); }
const saveEl=$('savingsChips'); saveEl.innerHTML=''; if(s.trad>0){ const fedSave=s.trad*s.fedMarg; const stSave=s.trad*s.stMarg; const total=fedSave+stSave; const pill=document.createElement('span'); pill.className='pill'; pill.textContent=`401(k) defers ≈ ${money(total)} in taxes now (${money(fedSave)} fed + ${money(stSave)} state)`; saveEl.appendChild(pill); const per1k=document.createElement('span'); per1k.className='pill'; per1k.textContent=`Each $1,000 pre-tax saves ≈ ${money(1000*(s.fedMarg+s.stMarg))}`; saveEl.appendChild(per1k); }
renderWaterfall(s);
}


function renderWaterfall(s){ const container=$('waterfall'); container.innerHTML=''; const breakdown=$('breakdown'); breakdown.innerHTML=''; const layers=s.layers; if(!layers.length){ const p=document.createElement('div'); p.className='text-slate-400'; p.textContent='No taxable ordinary income.'; container.appendChild(p); return; }
let seenMarginal=false; layers.forEach(L=>{ const isMarginal=!seenMarginal && (L.income>0) && (L.to===Infinity || s.taxableOrd<=L.to); if(isMarginal) seenMarginal=true; const size=(isFinite(L.to)?L.to:Infinity)-L.from; const fillPct=isFinite(size)? (L.income/size*100) : 100; const row=document.createElement('div'); row.className='bar'+(isMarginal?'':' bar-muted'); const fill=document.createElement('div'); fill.className='bar-fill'; fill.style.width=Math.min(100,Math.max(0,fillPct))+'%'; const inner=document.createElement('div'); inner.className='bar-inner'; const left=document.createElement('div'); left.innerHTML = `<div class="font-semibold">${Math.round(L.rate*100)}% rate</div><div class="text-xs text-slate-400">${isFinite(L.to)? (money(L.from+1)+' – '+money(L.to)) : ('Over '+money(L.from))}</div>`; const right=document.createElement('div'); right.innerHTML = `<div class="font-semibold">${money(L.income)}</div><div class="text-xs text-slate-400">Tax: ${money(L.tax)}</div>`; inner.appendChild(left); inner.appendChild(right); row.appendChild(fill); row.appendChild(inner); container.appendChild(row); if(isMarginal){ const room=isFinite(size)? (size-L.income) : 0; const tips=document.createElement('div'); tips.className='text-xs mt-2'; const savePer1k=1000*(s.fedMarg+s.stMarg); tips.innerHTML = `<div class="flex" style="flex-wrap:wrap;gap:.5rem"><span class="pill" style="border-color:#1f5f3a;color:#86efac">Room to next: ${money(room)}</span><span class="pill" style="border-color:#5f1f26;color:#fecaca">Cut to drop: ${money(L.income+1)}</span><span class="pill">Each $1,000 pre-tax saves ≈ ${money(savePer1k)}</span></div>`; container.appendChild(tips); } const li=document.createElement('div'); li.innerHTML=`<span class="text-slate-400">${money(L.from+1)} → ${isFinite(L.to)?money(L.to):'∞'}</span> · <span class="font-semibold">${Math.round(L.rate*100)}%</span> · Income ${money(L.income)} · Tax ${money(L.tax)}`; breakdown.appendChild(li); }); }


/* ----------------------- BOOT ----------------------- */
document.addEventListener('DOMContentLoaded', loadAll);
