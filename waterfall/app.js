// app.js
// Minimal stub for your existing state; wire these to your real inputs
const $ = (id) => document.getElementById(id);
const fmtUSD = (n, d=0) => (n||0).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:d,maximumFractionDigits:d}); // :contentReference[oaicite:3]{index=3}

/* 2025 constants (already in your previous build) */
const STD_DED = { single: 14600, marriedFilingJointly: 29200, headOfHousehold: 21900 }; // update if your 2025 sheet changed
const K401_LIMIT = { single: 23000, marriedFilingJointly: 46000, headOfHousehold: 23000 };
const HSA_LIMIT   = { single:  4450, marriedFilingJointly:  8900, headOfHousehold: 4450 }; // 2025 baseline you used earlier

// hook these to your real inputs; examples:
const model = {
  filingStatus: 'marriedFilingJointly',
  state: 'CA',
  earner1Salary: 120000,
  earner1Bonus: 15000,
  earner2Salary: 0,
  earner2Bonus: 0,
  otherIncome: 5000,
  itemized: 0,
  deductionType: 'standard',
  tradK: 0,
  rothK: 0,
  hsa: 0
};

// enforce caps
function clampContribs(){
  const kmax = K401_LIMIT[model.filingStatus] || 0;
  const total = model.tradK + model.rothK;
  if (total > kmax){
    // trim the one that was changed last; simplest is trim Roth
    model.rothK = Math.max(0, kmax - model.tradK);
  }
  model.hsa = Math.min(model.hsa, HSA_LIMIT[model.filingStatus] || 0);
  $('tradK').max = kmax; $('rothK').max = kmax; $('hsa').max = HSA_LIMIT[model.filingStatus] || 0;
  $('tradKDisplay').textContent = fmtUSD(model.tradK);
  $('rothKDisplay').textContent = fmtUSD(model.rothK);
  $('hsaDisplay').textContent = fmtUSD(model.hsa);
}

/* Brackets: use your existing 2025 federal/state objects */
function taxFromBrackets(taxable, brackets){
  if(!brackets || !brackets.length) return 0;
  let tax = 0, left = taxable, prev = 0;
  for(const b of brackets){
    if(left <= 0) break;
    const band = (isFinite(b.threshold) ? b.threshold : Infinity) - prev;
    const take = Math.min(left, band);
    tax += take * b.rate;
    left -= take;
    prev = b.threshold;
  }
  return Math.max(0, tax);
}

// supply your real objects:
const FED = window.taxAndDeductionData?.federal?.brackets || {/*...*/};
const STATES = window.taxAndDeductionData?.states || {/*...*/};

let locked = null;

function computeTotals(){
  clampContribs();

  const totalIncome =
    model.earner1Salary + model.earner1Bonus +
    model.earner2Salary + model.earner2Bonus +
    model.otherIncome;

  const stdOrItem = model.deductionType === 'standard'
    ? STD_DED[model.filingStatus] || 0
    : Math.max(0, model.itemized || 0);

  // pretax lowers taxable income: Trad 401k + HSA
  const pretax = (model.tradK||0) + (model.hsa||0);
  const agi = Math.max(0, totalIncome - pretax);
  const taxable = Math.max(0, agi - stdOrItem);

  const fedBr = FED[model.filingStatus] || [];
  const stateBr = (STATES[model.state]?.brackets?.[model.filingStatus]) || [];

  const fedTax = taxFromBrackets(taxable, fedBr);
  const stateTax = taxFromBrackets(taxable, stateBr);
  const totalTax = fedTax + stateTax;

  // Baseline: no pretax, same gross, Roth unchanged (since Roth doesn’t reduce taxable)
  const baselineTaxable = Math.max(0, (totalIncome) - stdOrItem);
  const baselineFed = taxFromBrackets(baselineTaxable, fedBr);
  const baselineState = taxFromBrackets(baselineTaxable, stateBr);
  const baselineTotal = baselineFed + baselineState;

  const pretaxSaved = Math.max(0, baselineTotal - totalTax);
  const eff = totalIncome > 0 ? totalTax / totalIncome : 0;
  const effBaseline = totalIncome > 0 ? baselineTotal / totalIncome : 0;

  // KPIs
  $('totalIncome').textContent = fmtUSD(totalIncome);
  $('taxableIncome').textContent = fmtUSD(taxable);
  $('totalTax').textContent = fmtUSD(totalTax);
  $('effRate').textContent = (eff*100).toFixed(1) + '%';
  $('pretaxSave').textContent = 'Tax saved by pretax: ' + fmtUSD(pretaxSaved);
  $('deltaEff').textContent = 'Δ effective: ' + ((effBaseline - eff)*100).toFixed(1) + ' pp';

  // Lock delta
  if(locked){
    $('lockDeltaTax').textContent = 'Δ vs lock: ' + fmtUSD(totalTax - locked.totalTax);
    $('lockDeltaTI').textContent = 'Δ TI vs lock: ' + fmtUSD(taxable - locked.taxable);
  } else {
    $('lockDeltaTax').textContent = 'Δ vs lock: —';
    $('lockDeltaTI').textContent = 'Δ TI vs lock: —';
  }

  // Marginal info
  const active = (window.currentView==='state'?stateBr:fedBr);
  const info = marginalInfo(taxable, active);
  $('currentMarginal').textContent = info ? `Marginal ${Math.round(info.rate*100)}%` : 'Marginal —';
  $('toNext').textContent = info && isFinite(info.room) ? ('To next: ' + fmtUSD(info.room)) : 'To next: —';

  drawWaterfall(taxable, active);

  return { totalIncome, taxable, fedTax, stateTax, totalTax, eff, pretaxSaved };
}

function marginalInfo(taxable, brackets){
  let prev = 0, acc = taxable;
  for(const [i,b] of brackets.entries()){
    const span = (isFinite(b.threshold)?b.threshold:Infinity) - prev;
    const filled = Math.min(acc, span);
    const room = span - filled;
    const isThis = acc > 0 && filled > 0 && (room > 0 || !isFinite(b.threshold));
    if(isThis) return { index:i, rate:b.rate, prev, threshold:b.threshold, room };
    acc -= filled; prev = b.threshold;
  }
  return null;
}

function drawWaterfall(taxable, brackets){
  const host = $('waterfall');
  host.innerHTML = '';
  let prev = 0, left = taxable;

  brackets.forEach((b, idx) => {
    const span = (isFinite(b.threshold)?b.threshold:Infinity) - prev;
    const fill = Math.max(0, Math.min(left, span));
    const pct = !isFinite(span) ? (fill>0?100:0) : (fill/span)*100;

    const tier = document.createElement('div');
    tier.className = 'tier' + (fill>0 && fill<span ? ' is-marginal':'');
    tier.dataset.tier = String((idx%9)+1);

    const fillDiv = document.createElement('div');
    fillDiv.className = 'fill';
    fillDiv.style.width = pct.toFixed(2) + '%';
    tier.appendChild(fillDiv);

    const label = isFinite(b.threshold)
      ? `${fmtUSD(prev+1)} – ${fmtUSD(b.threshold)}`
      : `Over ${fmtUSD(prev)}`;

    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = `
      <div>
        <div style="font-weight:800">${(b.rate*100).toFixed(0)}% rate</div>
        <div class="meta">${label}</div>
      </div>
      <div style="text-align:right">
        <div class="value">${fmtUSD(fill)}</div>
        <div class="meta">Tax: ${fmtUSD(fill*b.rate)}</div>
      </div>
    `;
    // delta hints for the marginal tier
    if(fill>0 && fill<span && isFinite(b.threshold)){
      const room = span - fill;
      const hint = document.createElement('div');
      hint.className = 'meta';
      hint.style.marginTop = '6px';
      hint.textContent = `Room to next: ${fmtUSD(room)} | $1,000 pretax saves ${fmtUSD(1000*b.rate)}`;
      content.appendChild(hint);
    }

    tier.appendChild(content);
    host.appendChild(tier);

    left -= fill; prev = b.threshold;
  });
}

/* View & theme toggles */
window.currentView = 'federal';
$('federalBtn').onclick = () => {
  window.currentView='federal';
  $('federalBtn').classList.add('active');
  $('stateBtn').classList.remove('active');
  computeTotals();
};
$('stateBtn').onclick = () => {
  window.currentView='state';
  $('stateBtn').classList.add('active');
  $('federalBtn').classList.remove('active');
  computeTotals();
};
$('themeToggle').addEventListener('click', (e)=>{
  const t = e.target?.dataset?.theme;
  if(!t) return;
  document.documentElement.setAttribute('data-theme', t);
});

/* Lock compare */
$('lockBtn').onclick = () => { locked = computeTotals(); };
$('resetLockBtn').onclick = () => { locked = null; computeTotals(); };

/* Wire sliders (replace with your existing listeners) */
function linkRange(id, getter, setter){
  const el = $(id);
  const disp = $(id+'Display');
  if(!el) return;
  el.addEventListener('input', ()=>{
    setter(+el.value||0);
    disp && (disp.textContent = fmtUSD(+el.value||0));
    computeTotals();
  });
}
linkRange('tradK', ()=>model.tradK, v=>{model.tradK=v; clampContribs();});
linkRange('rothK', ()=>model.rothK, v=>{model.rothK=v; clampContribs();});
linkRange('hsa', ()=>model.hsa, v=>{model.hsa=v; clampContribs();});

/* Initial */
clampContribs();
computeTotals();
