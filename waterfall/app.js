

$('toDrop').textContent = money(s.toDrop);


const chips = $('deltaChips');
chips.innerHTML = '';
if(baseline){
addDeltaChip(chips,'Δ Income', s.totalIncome - baseline.totalIncome);
addDeltaChip(chips,'Δ Taxable', s.taxableOrd - baseline.taxableOrd);
addDeltaChip(chips,'Δ Total tax', s.totalTax - baseline.totalTax);
const effDelta = (s.eff - baseline.eff);
const c = document.createElement('span'); c.className='pill delta';
c.textContent = 'Δ Effective: ' + (effDelta>=0?'+':'') + effDelta.toFixed(1) + ' pts';
chips.appendChild(c);
}


// Savings chips: show 401k tax deferral benefit at current marginal stack
const saveEl = $('savingsChips');
saveEl.innerHTML = '';
if (s.trad > 0){
const fedSave = s.trad * s.fedMarg;
const stSave = s.trad * s.stMarg;
const total = fedSave + stSave;
const pill = document.createElement('span'); pill.className='pill';
pill.textContent = `401(k) defers ≈ ${money(total)} in taxes now (${money(fedSave)} fed + ${money(stSave)} state)`;
saveEl.appendChild(pill);


const per1k = document.createElement('span'); per1k.className='pill';
per1k.textContent = `Each $1,000 pre-tax saves ≈ ${money(1000*(s.fedMarg+s.stMarg))} at current marginal`;
saveEl.appendChild(per1k);
}


renderWaterfall(s);
}


function renderWaterfall(s){
const container = $('waterfall'); container.innerHTML='';
const breakdown = $('breakdown'); breakdown.innerHTML='';


const layers = s.layers;
if(!layers.length){
const p=document.createElement('div');
p.className='text-slate-400'; p.textContent='No taxable ordinary income.';
container.appendChild(p); return;
}


let seenMarginal=false;
layers.forEach((L)=>{
const isMarginal = !seenMarginal && (L.income>0) && (L.to===Infinity || s.taxableOrd<=L.to);
if(isMarginal) seenMarginal=true;


const size = (isFinite(L.to)?L.to:Infinity) - L.from;
const fillPct = isFinite(size)? (L.income/size*100) : 100;


const row=document.createElement('div'); row.className='bar' + (isMarginal?'':' bar-muted');
const fill=document.createElement('div'); fill.className='bar-fill'; fill.style.width = Math.min(100, Math.max(0, fillPct)) + '%';
const inner=document.createElement('div'); inner.className='bar-inner';


const left=document.createElement('div');
left.innerHTML = `<div class="font-semibold">${Math.round(L.rate*100)}% rate</div>
<div class="text-xs text-slate-400">${isFinite(L.to)? (money(L.from+1)+' – '+money(L.to)) : ('Over '+money(L.from))}</div>`;
const right=document.createElement('div');
right.innerHTML = `<div class="font-semibold">${money(L.income)}</div>
<div class="text-xs text-slate-400">Tax: ${money(L.tax)}</div>`;


inner.appendChild(left); inner.appendChild(right);
row.appendChild(fill); row.appendChild(inner);
container.appendChild(row);


if(isMarginal){
const room = isFinite(size)? (size - L.income) : 0;
const tips=document.createElement('div');
tips.className='text-xs mt-2';
const savePer1k = 1000*(s.fedMarg + s.stMarg);
tips.innerHTML = `
<div class="flex" style="flex-wrap:wrap;gap:.5rem">
<span class="pill" style="border-color:#1f5f3a;color:#86efac">Room to next: ${money(room)}</span>
<span class="pill" style="border-color:#5f1f26;color:#fecaca">Cut to drop: ${money(L.income+1)}</span>
<span class="pill">Each $1,000 pre-tax saves ≈ ${money(savePer1k)}</span>
</div>`;
container.appendChild(tips);
}


const li=document.createElement('div');
li.innerHTML = `<span class="text-slate-400">${money(L.from+1)} → ${isFinite(L.to)?money(L.to):'∞'}</span>
· <span class="font-semibold">${Math.round(L.rate*100)}%</span>
· Income ${money(L.income)} · Tax ${money(L.tax)}`;
breakdown.appendChild(li);
});
}


/* ----------------------- BOOT ----------------------- */
document.addEventListener('DOMContentLoaded', loadAll);
