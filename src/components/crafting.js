import { TAX_RATE, BASE_RRR, FOCUS_RRR_BONUS, SYSTEM_CITIES, BONUSES, EN_MAT, QUAL_GROUPS } from '../data/constants.js';
import { ALBION_DB } from '../data/albion_db.js';
import { escapeHTML, parseNum, formatSilver } from '../utils/formatters.js';
import { state, craftingQueue, currentCraftQuality, saveState, initDefaultState } from '../core/state.js';

export function getAllRecipes() {
  let list = [];
  for (let cat in ALBION_DB) {
    for (let branch in ALBION_DB[cat]) {
      if (ALBION_DB[cat][branch] && ALBION_DB[cat][branch].items) {
        list = list.concat(ALBION_DB[cat][branch].items);
      }
    }
  }
  return list;
}
export const RECIPES = getAllRecipes();

export function getEnchantAndTier(q) { 
  const p = q.split('.'); 
  return { tier: parseInt(p[0]) || 4, enchant: parseInt(p[1]) || 0 }; 
}

export function getRRA(c, city, f) {
  if (state.customLocations.includes(city)) {
    if (f) return parseNum(document.getElementById('hideout-focus-rrr').value) / 100.0;
    else { const b = parseNum(document.getElementById('hideout-map-bonus').value); return (18 + b) / (100 + 18 + b); }
  }
  const b = BONUSES[c];
  const r = (c === '鋼條' && city === 'Thetford') || (c === '布料' && city === 'Lymhurst') || (c === '板材' && city === 'Fort Sterling');
  const cb = (b === city && !r);
  if (f) return (cb || r) ? 0.479 : FOCUS_RRR_BONUS;
  else { if (cb || r) return (18 + 15) / (100 + 18 + 15); else return BASE_RRR; }
}

export function calculateCraftingFee(r, q, qual, sf) { 
  const { tier, enchant } = getEnchantAndTier(qual); 
  const mv = Math.pow(2, tier+enchant); 
  const sv = r.subBaseQty > 0 ? Math.pow(2, tier+enchant) : 0; 
  const iv = (r.mainBaseQty*mv + r.subBaseQty*sv)*q; 
  const av = r.artifactVal > 0 ? (r.artifactVal * Math.pow(2, tier-4) * q) : 0;
  return Math.round((iv + av) * TAX_RATE * sf); 
}

export function calculateMaterialConsumption(baseQty, qty, rra) {
  const grossQty = baseQty * qty;
  const expectedReturn = Math.floor(grossQty * rra);
  const expectedNetConsumption = grossQty - expectedReturn;
  const perCraftMinReturn = Math.floor(baseQty * rra);
  const perCraftMaxNetConsumption = baseQty - perCraftMinReturn;
  const conservativeNetConsumption = perCraftMaxNetConsumption * qty;
  const safeStartStock = qty > 0 ? baseQty + perCraftMaxNetConsumption * (qty - 1) : 0;

  return {
    expectedNetConsumption,
    conservativeNetConsumption,
    safeStartStock
  };
}

export function calculateAggregatedMaterialPlanning(queueRows, getRRAForRow) {
  const groups = {};

  const addMaterial = (row, materialKey, baseQty, rra) => {
    const qty = Number(row.qty);
    if (!row.checked || !Number.isFinite(qty) || qty <= 0 || !materialKey || baseQty <= 0) return;

    const perCraftMinReturn = Math.floor(baseQty * rra);
    const perCraftMaxConsumption = baseQty - perCraftMinReturn;
    const rowExpected = baseQty * qty - Math.floor(baseQty * qty * rra);
    const rowConservative = perCraftMaxConsumption * qty;
    const groupKey = `${row.city}|${materialKey}`;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        expected: 0,
        conservative: 0,
        maxPerCraftMinReturn: 0
      };
    }

    groups[groupKey].expected += rowExpected;
    groups[groupKey].conservative += rowConservative;
    groups[groupKey].maxPerCraftMinReturn = Math.max(groups[groupKey].maxPerCraftMinReturn, perCraftMinReturn);
  };

  queueRows.forEach(row => {
    const qty = Number(row.qty);
    if (!row.checked || !Number.isFinite(qty) || qty <= 0) return;
    const rra = getRRAForRow(row);
    addMaterial(row, row.mainKey, row.recipe?.mainBaseQty || 0, rra);
    if (row.recipe?.subBaseQty > 0) addMaterial(row, row.subKey, row.recipe.subBaseQty, rra);
  });

  return Object.fromEntries(Object.entries(groups).map(([key, value]) => [
    key,
    {
      expected: value.expected,
      conservative: value.conservative,
      safeStart: value.conservative + value.maxPerCraftMinReturn
    }
  ]));
}

function parseActualConsumed(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || !/^[\d,]+$/.test(raw)) return null;
  const parsed = parseNum(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function getAlchemyRequirement(tier) {
  const t = parseInt(tier);
  if (t === 4) return { tier: 'T3', qty: 1 };
  if (t === 5) return { tier: 'T5', qty: 1 };
  if (t === 6) return { tier: 'T5', qty: 2 };
  if (t === 7) return { tier: 'T7', qty: 1 };
  if (t === 8) return { tier: 'T7', qty: 2 };
  return { tier: 'T3', qty: 1 };
}

export function estimateFocusRRR(b) {
  const baseRF = (18 + b) * 100;
  const focusRF = baseRF + 10000;
  const focusRRR = (focusRF / (10000 + focusRF)) * 100;
  return parseFloat(focusRRR.toFixed(1));
}

export function onMapBonusInput() {
  const b = parseNum(document.getElementById('hideout-map-bonus').value);
  document.getElementById('hideout-focus-rrr').value = estimateFocusRRR(b);
  runCraftingCalculator();
}

export function adjCraftQty(d) { 
  let el = document.getElementById('craft-qty'); 
  let v = parseInt(el.value) + d; 
  if(v < 1) v = 1; 
  el.value = v; 
  runCraftingCalculator(); 
}

export function onRecipeChange() {
  const rn = document.getElementById('craft-recipe').value; const r = RECIPES.find(x => x.name === rn); if (!r) return;
  document.getElementById('main-material-label').innerHTML = `主料需求: ${r.main}<br><span style="font-size:0.8em;opacity:0.7;">Main Material: ${EN_MAT[r.main]||''}</span>`;
  
  if (r.subBaseQty > 0) { 
      document.getElementById('sub-material-label').innerHTML = `副料需求: ${r.sub}<br><span style="font-size:0.8em;opacity:0.7;">Sub Material: ${EN_MAT[r.sub]||''}</span>`; 
      document.getElementById('sub-material-group').style.display = 'block'; 
  } else { 
      document.getElementById('sub-material-label').innerHTML = `副料需求: 無<br><span style="font-size:0.8em;opacity:0.7;">Sub Material: None</span>`; 
      document.getElementById('sub-material-group').style.display = 'block'; 
  }
  // === 自動連動最高加成城市 ===
  if (BONUSES[r.category]) {
      const craftCityEl = document.getElementById('craft-city');
      if (craftCityEl) {
          craftCityEl.value = BONUSES[r.category];
          // 如果切換到了黑區地堡，隱藏的加成選單要跟著顯示
          const hideoutGroup = document.getElementById('hideout-group');
          if (hideoutGroup) hideoutGroup.style.display = state.customLocations.includes(craftCityEl.value) ? 'flex' : 'none';
      }
  }
  // =====================================

  runCraftingCalculator();
}

export function runCraftingCalculator() {
  const rn = document.getElementById('craft-recipe').value; const r = RECIPES.find(x => x.name === rn); if (!r) return;
  const q = parseNum(document.getElementById('craft-qty').value); const qual = currentCraftQuality; const city = document.getElementById('craft-city').value;
  if (!qual) {
    const rraBadge = document.getElementById('rra-badge');
    if (rraBadge) rraBadge.innerText = '請選擇品質';
    const alcGroup = document.getElementById('alchemy-group');
    if (alcGroup) alcGroup.style.display = 'none';
    return;
  }
  const foc = document.getElementById('craft-focus').checked;
  const rra = getRRA(r.category, city, foc); document.getElementById('rra-badge').innerText = `返還率: ${(rra*100).toFixed(1)}%`;
  const mainConsumption = calculateMaterialConsumption(r.mainBaseQty, q, rra); const amc = mainConsumption.expectedNetConsumption;
  const subConsumption = calculateMaterialConsumption(r.subBaseQty, q, rra); const asc = subConsumption.expectedNetConsumption;
  document.getElementById('out-main-qty').innerText = `${amc} / ${r.mainBaseQty*q}`; document.getElementById('out-sub-qty').innerText = r.subBaseQty>0 ? `${asc} / ${r.subBaseQty*q}` : '0';
  
  const oml = document.getElementById('out-main-label'); if(oml) oml.innerHTML = `預估消耗 ${r.main}<br><span style="font-size:0.8em; opacity:0.7;">Est. ${EN_MAT[r.main]||''} Consumption</span>`;
  const osl = document.getElementById('out-sub-label'); if(osl) osl.innerHTML = r.subBaseQty > 0 ? `預估消耗 ${r.sub}<br><span style="font-size:0.8em; opacity:0.7;">Est. ${EN_MAT[r.sub]||''} Consumption</span>` : `預估消耗 無<br><span style="font-size:0.8em; opacity:0.7;">Est. None</span>`;
  
  const alcGroup = document.getElementById('alchemy-group');
  if (r.alchemyName) {
      alcGroup.style.display = 'block';
      let tier = '4';
      if (qual && qual.includes('.')) { tier = qual.split('.')[0]; }
      const req = getAlchemyRequirement(tier);
      document.getElementById('alchemy-label').innerHTML = `鍊金材料<br><span style="font-size:0.8em; opacity:0.7;">${req.tier} ${r.alchemyName} (需求: ${req.qty})</span>`;
  } else {
      alcGroup.style.display = 'none';
  }
}

export function addToCraftingQueue() {
  const rn = document.getElementById('craft-recipe').value;
  const q = parseNum(document.getElementById('craft-qty').value);
  const qual = currentCraftQuality;
  const city = document.getElementById('craft-city').value;
  const foc = document.getElementById('craft-focus').checked;
  let alcPrice = 0;
  const alcEl = document.getElementById('craft-alchemy-cost');
  if (alcEl) alcPrice = parseNum(alcEl.value);

  const result = enqueueCraftingPlan({ recipeName: rn, quality: qual, quantity: q, city, focus: foc, alchemyPrice: alcPrice });
  if (!result.ok) return window.showToast(result.errors.join(', '), 'error');
  renderCraftingQueue(); updateShoppingListTotal(); window.showToast('已加入佇列', 'success');
}

export function enqueueCraftingPlan(input) {
  const errors = [];
  const recipeName = input?.recipeName;
  const r = RECIPES.find(x => x.name === recipeName);
  const qual = input?.quality;
  const q = Number(input?.quantity);
  const city = typeof input?.city === 'string' ? input.city.trim() : '';
  const foc = Boolean(input?.focus);

  if (!r) errors.push('INVALID_RECIPE');
  if (typeof qual !== 'string' || !/^[4-8]\.[0-4]$/.test(qual)) errors.push('INVALID_QUALITY');
  if (!Number.isInteger(q) || q <= 0) errors.push('INVALID_QUANTITY');
  if (!city) errors.push('INVALID_CITY');
  if (input?.focus !== undefined && typeof input.focus !== 'boolean') errors.push('INVALID_FOCUS');

  if (errors.length > 0) {
    return { ok: false, status: 'invalid-plan', row: null, errors };
  }

  const mk = `${r.main}_${qual}`;
  const sk = `${r.sub}_${qual}`;
  const rra = input?.customLocationSettings?.active
    ? (foc ? input.customLocationSettings.focusReturnRate : (18 + input.customLocationSettings.mapBonus) / (100 + 18 + input.customLocationSettings.mapBonus))
    : getRRA(r.category, city, foc);
  const mainConsumption = calculateMaterialConsumption(r.mainBaseQty, q, rra);
  const subConsumption = calculateMaterialConsumption(r.subBaseQty, q, rra);
  let alcTier = null;
  let alcQty = 0;
  if (r.alchemyName) {
    const req = getAlchemyRequirement(qual.split('.')[0]);
    alcTier = req.tier;
    alcQty = req.qty;
  }

  const row = {
    id: Math.floor(Date.now() + Math.random() * 1000),
    checked: true,
    recipe: r,
    qty: q,
    quality: qual,
    city,
    focus: foc,
    mainKey: mk,
    mainQty: mainConsumption.expectedNetConsumption,
    actualMainQty: '',
    subKey: sk,
    subQty: subConsumption.expectedNetConsumption,
    actualSubQty: r.subBaseQty > 0 ? '' : 0,
    tax: 0,
    artifactPrice: 0,
    artifactName: r.artifactVal > 0 || r.artifactName ? r.artifactName : null,
    artifactQty: r.artifactQty || 1,
    alchemyName: r.alchemyName,
    alchemyTier: alcTier,
    alchemyBaseQty: alcQty,
    alchemyPrice: Number.isFinite(input?.alchemyPrice) && input.alchemyPrice >= 0 ? input.alchemyPrice : 0
  };

  craftingQueue.push(row);
  return { ok: true, status: 'queued', row, errors: [] };
}
export function renderCraftingQueue() {
  const tb = document.getElementById('crafting-queue-tbody'); tb.innerHTML='';
  craftingQueue.forEach(q => {
    const tr = document.createElement('tr'); const bc = `quality-badge quality-${parseInt(q.quality.split('.')[0])||4}`;
    const rra = getRRA(q.recipe.category, q.city, q.focus);
    const mainConsumption = calculateMaterialConsumption(q.recipe.mainBaseQty, q.qty, rra);
    const subConsumption = calculateMaterialConsumption(q.recipe.subBaseQty, q.qty, rra);
    tr.innerHTML = `
    <td><input type="checkbox" ${q.checked ? 'checked' : ''} class="queue-check" data-id="${q.id}"></td>
    <td style="white-space:nowrap;"><strong>T${parseInt(q.quality.split(".")[0])||4} ${q.recipe.name}</strong> ${q.focus?"✨":""}<br><span style="font-size:0.8em; opacity:0.7; color:var(--text-secondary);">${q.recipe.id}</span></td>
    <td><span class="${bc}">${q.quality}</span></td>
    <td style="color:var(--accent-cyan); font-weight:bold;">${q.qty}</td>
    <td>${SYSTEM_CITIES[q.city]?.name||q.city}</td>
    <td style="white-space:nowrap; font-size:0.8rem; line-height:1.4;">${q.recipe.main}<br><span style="color:var(--text-secondary);">預估消耗：${mainConsumption.expectedNetConsumption}</span><br><span style="color:var(--text-secondary);">保守備料：${mainConsumption.safeStartStock}</span>${q.recipe.subBaseQty>0?`<br>${q.recipe.sub}<br><span style="color:var(--text-secondary);">預估消耗：${subConsumption.expectedNetConsumption}</span><br><span style="color:var(--text-secondary);">保守備料：${subConsumption.safeStartStock}</span>`:''}</td>
    <td style="display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; gap:5px; align-items:center;">
        <button class="btn btn-warning" style="padding:4px 8px; font-size:0.7rem; flex:1; line-height: 1.2;" data-action="edit-queue" data-id="${q.id}">✏️ 編輯<br><span style="font-size:0.8em;opacity:0.7;">Edit</span></button>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:0.7rem; flex:1; line-height: 1.2;" data-action="delete-queue" data-id="${q.id}">🗑️ 刪除<br><span style="font-size:0.8em;opacity:0.7;">Delete</span></button>
      </div>
      <div><div style="font-size:0.7rem; color:var(--accent-cyan);">${q.recipe.main} 實際消耗</div><input type="text" class="format-num queue-actual-main-qty" style="width:100%; padding:4px 6px; font-size:0.75rem;" placeholder="實際消耗（必填）" value="${q.actualMainQty ?? ''}" data-id="${q.id}"></div>
      ${q.recipe.subBaseQty > 0 ? `<div><div style="font-size:0.7rem; color:var(--accent-cyan);">${q.recipe.sub} 實際消耗</div><input type="text" class="format-num queue-actual-sub-qty" style="width:100%; padding:4px 6px; font-size:0.75rem;" placeholder="實際消耗（必填）" value="${q.actualSubQty ?? ''}" data-id="${q.id}"></div>` : ''}
      ${q.artifactName ? `<div><div style="font-size:0.7rem; color:var(--accent-cyan);">${q.artifactName}${q.artifactQty > 1 ? ` (需: ${q.artifactQty})` : ''}</div><input type="text" class="format-num queue-art-price" style="width:100%; padding:4px 6px; font-size:0.75rem;" placeholder="單件神器成本" value="${q.artifactPrice ? q.artifactPrice : ''}" data-id="${q.id}"></div>` : ''}
      ${q.alchemyName ? `<div><div style="font-size:0.7rem; color:var(--accent-yellow);">${q.alchemyTier} ${q.alchemyName} (需: ${q.alchemyBaseQty})</div><input type="text" class="format-num queue-alc-price" style="width:100%; padding:4px 6px; font-size:0.75rem;" placeholder="單件鍊金成本" value="${q.alchemyPrice ? q.alchemyPrice : ''}" data-id="${q.id}"></div>` : ''}
    </td>`;
    tb.appendChild(tr);
  });
}

export function updateShoppingListTotal() {
  const sf = parseNum(document.getElementById('global-shopfee').value);
  let aggregated = calculateAggregatedMaterialPlanning(craftingQueue, q => getRRA(q.recipe.category, q.city, q.focus));
  let shopFeeTotal = 0;
  let artifactCostTotal = 0;
  let alchemyCostTotal = 0;
  craftingQueue.forEach(q => {
    if(!q.checked) return;
    q.tax = calculateCraftingFee(q.recipe, q.qty, q.quality, sf);
    shopFeeTotal += q.tax;
    artifactCostTotal += (q.artifactPrice || 0) * (q.artifactQty || 1) * q.qty;
    if (q.alchemyName) {
        alchemyCostTotal += (q.alchemyPrice || 0) * (q.alchemyBaseQty || 0) * q.qty;
        const ak = `${q.city}|${q.alchemyTier} ${q.alchemyName}`;
        if (!aggregated[ak]) aggregated[ak] = { expected: 0, safeStart: 0 };
        aggregated[ak].expected += q.alchemyBaseQty * q.qty;
        aggregated[ak].safeStart += q.alchemyBaseQty * q.qty;
    }
  });
  
  const sc = document.getElementById('shopping-list-content');
  if(Object.keys(aggregated).length === 0) { sc.innerHTML = '<span style="color:var(--text-muted)">無勾選裝備...</span>'; }
  else {
    let listHTML = '<ul style="list-style:none; padding:0; margin:0; display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
    for(let k in aggregated) {
      const [city, mat] = k.split('|');
      let matDisplay = mat.replace('_', ' ');
      if (mat.includes(' ') && !mat.match(/^\d\./)) { 
          const parts = mat.split(' ');
          matDisplay = `${parts[0]}<br><span style="font-size:0.8em;opacity:0.7;font-weight:normal;">${parts.slice(1).join(' ')}</span>`;
      }
      listHTML += `<li style="display:flex; align-items:center; gap:5px; margin-bottom:5px; line-height:1.2;">
        <span style="color:var(--text-secondary); white-space:nowrap;">[${SYSTEM_CITIES[city]?.name||city}]</span> 
        <strong style="flex:1; ${mat.includes(' ') ? 'color:var(--accent-yellow);' : ''}">${matDisplay}</strong> 
        <span style="color:var(--accent-cyan); font-weight:bold;">預估消耗：${aggregated[k].expected}<br>保守備料：${aggregated[k].safeStart}</span>
      </li>`;
    }
    listHTML += '</ul>'; sc.innerHTML = listHTML;
  }
  const cashCostTotal = shopFeeTotal + artifactCostTotal + alchemyCostTotal;
  document.getElementById('queue-total-cost').innerHTML = `
    <div style="display:grid; gap:4px; min-width:260px;">
      <div style="display:flex; justify-content:space-between; gap:12px; font-size:0.85rem; font-weight:400;"><span style="color:var(--text-secondary);">店鋪使用費 / Shop Fee</span><span>${formatSilver(shopFeeTotal)}</span></div>
      <div style="display:flex; justify-content:space-between; gap:12px; font-size:0.85rem; font-weight:400;"><span style="color:var(--text-secondary);">神器成本 / Artifact Cost</span><span>${formatSilver(artifactCostTotal)}</span></div>
      <div style="display:flex; justify-content:space-between; gap:12px; font-size:0.85rem; font-weight:400;"><span style="color:var(--text-secondary);">鍊金成本 / Alchemy Cost</span><span>${formatSilver(alchemyCostTotal)}</span></div>
      <div style="display:flex; justify-content:space-between; gap:12px; margin-top:4px; padding-top:4px; border-top:1px solid var(--border-glass); color:var(--accent-cyan); font-size:1rem; font-weight:700;"><span>本次製作現金支出 / Craft Cash Cost</span><span>${formatSilver(cashCostTotal)}</span></div>
    </div>`;
}

export function submitCraftAll() {
  const toCraft = craftingQueue.filter(x => x.checked);
  if (toCraft.length === 0) return window.showToast('沒有勾選任何項目！', 'error');
  let needed = {}; let totalCashNeeded = 0;
  const sf = parseNum(document.getElementById('global-shopfee').value);
  const freshTaxes = new Map();
  const actualConsumed = new Map();
  toCraft.forEach(q => {
    const freshTax = calculateCraftingFee(q.recipe, q.qty, q.quality, sf);
    freshTaxes.set(q.id, freshTax);
    totalCashNeeded += (freshTax + (q.artifactPrice||0) * (q.artifactQty || 1) * q.qty);
    if (q.alchemyName) totalCashNeeded += (q.alchemyPrice || 0) * (q.alchemyBaseQty || 0) * q.qty;
    const mainActual = parseActualConsumed(q.actualMainQty);
    const subActual = q.recipe.subBaseQty > 0 ? parseActualConsumed(q.actualSubQty) : 0;
    actualConsumed.set(q.id, { main: mainActual, sub: subActual });
    if (mainActual === null) return;
    if (q.recipe.subBaseQty > 0 && subActual === null) return;
    const mk = `${q.city}|${q.mainKey}`; needed[mk] = (needed[mk]||0) + mainActual;
    if(q.recipe.subBaseQty>0) { const sk = `${q.city}|${q.subKey}`; needed[sk] = (needed[sk]||0) + subActual; }
  });

  for (const q of toCraft) {
    const actual = actualConsumed.get(q.id);
    if (!actual || actual.main === null) return window.showToast(`${q.mainKey.replace('_',' ')} 實際消耗必須是非負整數！`, 'error');
    if (q.recipe.subBaseQty > 0 && actual.sub === null) return window.showToast(`${q.subKey.replace('_',' ')} 實際消耗必須是非負整數！`, 'error');
  }
  
  for(let k in needed) {
    const [city, mat] = k.split('|'); const av = state.inventory[mat]?.qtyByCity[city] || 0;
    if (av < needed[k]) return window.showToast(`短缺警告：${SYSTEM_CITIES[city]?.name||city} 的 ${mat.replace('_',' ')} 實際消耗 ${needed[k]}，但庫存僅有 ${av}！`, 'error');
  }

  for (const q of toCraft) {
    const mainCost = state.inventory[q.mainKey]?.globalAvgCost;
    if (typeof mainCost !== 'number' || Number.isNaN(mainCost)) return window.showToast(`${q.mainKey.replace('_',' ')} 缺少成本基準，無法製作！`, 'error');
    if (q.recipe.subBaseQty > 0) {
      const subCost = state.inventory[q.subKey]?.globalAvgCost;
      if (typeof subCost !== 'number' || Number.isNaN(subCost)) return window.showToast(`${q.subKey.replace('_',' ')} 缺少成本基準，無法製作！`, 'error');
    }
  }
  
  toCraft.forEach(q => {
    q.tax = freshTaxes.get(q.id);
    const actual = actualConsumed.get(q.id);
    q.actualMainQty = actual.main;
    q.actualSubQty = actual.sub;
    state.inventory[q.mainKey].qtyByCity[q.city] -= actual.main;
    if(q.recipe.subBaseQty>0) state.inventory[q.subKey].qtyByCity[q.city] -= actual.sub;
    state.assets.cash -= (q.tax + (q.artifactPrice||0) * (q.artifactQty || 1) * q.qty);
    if (q.alchemyName) state.assets.cash -= (q.alchemyPrice || 0) * (q.alchemyBaseQty || 0) * q.qty;
    
    const mkCost = actual.main * (state.inventory[q.mainKey]?.globalAvgCost||0);
    const skCost = q.recipe.subBaseQty>0 ? (actual.sub * (state.inventory[q.subKey]?.globalAvgCost||0)) : 0;
    const tCost = mkCost + skCost + q.tax + (q.artifactPrice||0) * (q.artifactQty || 1) * q.qty + (q.alchemyName ? (q.alchemyPrice || 0) * (q.alchemyBaseQty || 0) * q.qty : 0);
    
    const ok = `${q.recipe.name}_${q.quality}`; if(!state.inventory[ok]) initDefaultState();
    
    const it = state.inventory[ok];
    let oldGlobalQty = 0; for(let c in it.qtyByCity) oldGlobalQty += it.qtyByCity[c];
    const oldTotalCost = oldGlobalQty * (it.globalAvgCost || 0);
    const newTotalCost = oldTotalCost + tCost;
    const newGlobalQty = oldGlobalQty + q.qty;
    if (newGlobalQty > 0) it.globalAvgCost = Math.round(newTotalCost / newGlobalQty);

    it.qtyByCity[q.city] += q.qty;
    state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '製作入庫', item: q.recipe.name, quality: q.quality, qty: q.qty, total: tCost, unitPrice: Math.round(tCost/q.qty), location: q.city });
  });
  
  // Update craftingQueue
  for (let i = craftingQueue.length - 1; i >= 0; i--) {
      if (craftingQueue[i].checked) craftingQueue.splice(i, 1);
  }
  renderCraftingQueue(); updateShoppingListTotal(); saveState(); window.updateDashboardUI();
  window.showToast('🎉 製造成功！已勾選裝備入庫，成本與流水帳已更新。', 'success');
}

// === Item Selector Logic ===
let currentSelectorTab = '戰士 Warrior';
export function openItemSelector() {
  document.getElementById('item-search').value = '';
  document.getElementById('item-selector-modal').style.display = 'block';
  renderItemSelectorTabs();
  renderItemSelectorGrid(currentSelectorTab);
}
export function closeItemSelector() { document.getElementById('item-selector-modal').style.display = 'none'; }
export function renderItemSelectorTabs() {
  const tabs = document.getElementById('item-selector-tabs'); tabs.innerHTML = '';
  const tabOrder = ['戰士 Warrior', '獵人 Hunter', '法師 Mage', '身體護甲 Body Armor', '頭部護甲 Head Armor', '足部護甲 Foot Armor', '副手武器 Off-Hand'];
  for (let cat of tabOrder) {
    if (!ALBION_DB[cat]) continue;
    const btn = document.createElement('div');
    const parts = cat.split(' ');
    btn.innerHTML = `${parts[0]}<br><span style="font-size: 0.8em; opacity: 0.7;">${parts.slice(1).join(' ')}</span>`;
    btn.style.padding = '10px 15px'; btn.style.cursor = 'pointer'; btn.style.borderBottom = '1px solid var(--border-glass)';
    btn.style.color = cat === currentSelectorTab ? 'var(--accent-cyan)' : 'var(--text-secondary)';
    btn.style.fontWeight = cat === currentSelectorTab ? 'bold' : 'normal'; btn.style.lineHeight = '1.3'; btn.style.textAlign = 'center';
    btn.setAttribute('data-action', 'select-tab'); btn.setAttribute('data-tab', cat);
        tabs.appendChild(btn);
      }
    }
export function renderItemSelectorGrid(catOrItems) {
  const grid = document.getElementById('item-selector-grid'); grid.innerHTML = '';
  if (Array.isArray(catOrItems)) {
    const div = document.createElement('div'); div.style.display = 'grid'; div.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))'; div.style.gap = '10px';
    catOrItems.forEach(item => {
      const btn = document.createElement('button'); btn.className = 'btn btn-secondary';
      btn.style.padding = '10px'; btn.style.display = 'flex'; btn.style.flexDirection = 'column'; btn.style.alignItems = 'center'; btn.style.gap = '5px';
      btn.innerHTML = `<span style="color:var(--accent-cyan); font-weight:bold;">${item.name}</span><br><span style="font-size:0.8em; opacity:0.7; color:var(--text-secondary);">${item.id}</span>`;
      btn.setAttribute('data-action', 'select-recipe'); btn.setAttribute('data-item', item.name); div.appendChild(btn);
    });
    grid.appendChild(div);
  } else {
    const catObj = ALBION_DB[catOrItems]; if (!catObj) return;
    for (let branch in catObj) {
      if (!catObj[branch] || !catObj[branch].items) continue;
      const bHead = document.createElement('div'); const parts = branch.split(' ');
      bHead.innerHTML = `${parts[0]} <span style="font-size:0.8em; opacity:0.7;">${parts.slice(1).join(' ')}</span>`;
      bHead.style.color = 'var(--accent-purple)'; bHead.style.marginTop = '15px'; bHead.style.marginBottom = '10px'; bHead.style.fontWeight = 'bold';
      grid.appendChild(bHead);
      const div = document.createElement('div'); div.style.display = 'grid'; div.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))'; div.style.gap = '10px'; div.style.marginBottom = '15px';
      catObj[branch].items.forEach(item => {
        const btn = document.createElement('button'); btn.className = 'btn btn-secondary'; btn.style.padding = '10px'; btn.style.display = 'flex'; btn.style.flexDirection = 'column'; btn.style.alignItems = 'center'; btn.style.gap = '5px';
        btn.innerHTML = `<span style="color:var(--accent-cyan); font-weight:bold;">${item.name}</span><br><span style="font-size:0.8em; opacity:0.7; color:var(--text-secondary);">${item.id}</span>`;
        btn.setAttribute('data-action', 'select-recipe'); btn.setAttribute('data-item', item.name); div.appendChild(btn);
      });
      grid.appendChild(div);
    }
  }
}
export function searchItems(q) {
  if (!q) { renderItemSelectorTabs(); renderItemSelectorGrid(currentSelectorTab); return; }
  const lowQ = q.toLowerCase(); const all = getAllRecipes();
  const matches = all.filter(item => {
    if (item.name.toLowerCase().includes(lowQ)) return true;
    if (item.aliases && item.aliases.some(a => a.toLowerCase().includes(lowQ))) return true;
    return false;
  });
  renderItemSelectorGrid(matches);
}
export function selectCraftingRecipe(item) {
  document.getElementById('craft-recipe').value = item.name;
  document.getElementById('craft-recipe-display').innerText = item.name;
  closeItemSelector(); onRecipeChange();
  if (item.artifactVal > 0) window.showToast(`提示：【${item.name}】需要神器材料，請注意估算成本！`, 'success');
}

// Queue Modals
let queueEditTargetId = null;
export function openEditQueueQtyModal(id) {
  const q = craftingQueue.find(x => x.id === id); if(!q) return;
  queueEditTargetId = id;
  document.getElementById('edit-queue-item-name').innerText = `${q.recipe.name} (${q.quality})`;
  document.getElementById('edit-queue-qty-input').value = q.qty;
  document.getElementById('edit-queue-qty-modal').style.display = 'block';
}
export function closeEditQueueQtyModal() { document.getElementById('edit-queue-qty-modal').style.display = 'none'; queueEditTargetId = null; }
export function submitEditQueueQty() {
  if (!queueEditTargetId) return;
  const q = craftingQueue.find(x => x.id === queueEditTargetId);
  const nq = parseInt(document.getElementById('edit-queue-qty-input').value);
  if(!isNaN(nq) && nq > 0) {
    q.qty = nq; const rra = getRRA(q.recipe.category, q.city, q.focus);
    const mainConsumption = calculateMaterialConsumption(q.recipe.mainBaseQty, nq, rra); q.mainQty = mainConsumption.expectedNetConsumption; q.actualMainQty = '';
    const subConsumption = calculateMaterialConsumption(q.recipe.subBaseQty, nq, rra); q.subQty = subConsumption.expectedNetConsumption; q.actualSubQty = q.recipe.subBaseQty > 0 ? '' : 0;
    renderCraftingQueue(); updateShoppingListTotal(); window.showToast('數量已更新', 'success');
  }
  closeEditQueueQtyModal();
}
let queueDeleteTargetId = null;
export function openDeleteConfirmModal(id) { queueDeleteTargetId = id; document.getElementById('delete-confirm-modal').style.display = 'block'; }
export function closeDeleteConfirmModal() { document.getElementById('delete-confirm-modal').style.display = 'none'; queueDeleteTargetId = null; }
export function submitDeleteQueue() {
  if (!queueDeleteTargetId) return;
  for (let i = craftingQueue.length - 1; i >= 0; i--) { if (craftingQueue[i].id === queueDeleteTargetId) craftingQueue.splice(i, 1); }
  renderCraftingQueue(); updateShoppingListTotal(); closeDeleteConfirmModal();
}

export function toggleQueueAll() { const ch = document.getElementById('queue-check-all').checked; craftingQueue.forEach(q => q.checked = ch); renderCraftingQueue(); updateShoppingListTotal(); }
export function editQueueQty(id) { openEditQueueQtyModal(id); }
export function confirmEditQueueQty() { submitEditQueueQty(); }
export function removeFromQueue(id) { openDeleteConfirmModal(id); }
export function confirmDeleteQueue() { submitDeleteQueue(); }
export function toggleQueueItem(id, checked) { const q = craftingQueue.find(x => x.id === id); if(q) q.checked = checked; updateShoppingListTotal(); }
export function updateQueueActualMainQty(id, val) { const q = craftingQueue.find(x => x.id === id); if(!q) return; q.actualMainQty = val; }
export function updateQueueActualSubQty(id, val) { const q = craftingQueue.find(x => x.id === id); if(!q) return; q.actualSubQty = val; }
export function updateQueueArtPrice(id, val) { const q = craftingQueue.find(x => x.id === id); if(!q) return; q.artifactPrice = parseNum(val); updateShoppingListTotal(); }
export function updateQueueAlcPrice(id, val) { const q = craftingQueue.find(x => x.id === id); if(!q) return; q.alchemyPrice = parseNum(val); updateShoppingListTotal(); }
export function adjustEditModalQty(amt) { const inp = document.getElementById('edit-queue-qty-input'); let val = parseInt(inp.value) || 0; val += amt; if (val < 1) val = 1; inp.value = val; }



export function initCraftingEvents() {
  document.getElementById('btn-open-item-selector')?.addEventListener('click', openItemSelector);
  document.getElementById('btn-close-item-selector')?.addEventListener('click', closeItemSelector);
  
  document.getElementById('craft-qty')?.addEventListener('input', runCraftingCalculator);
  document.getElementById('btn-craft-qty-sub-10')?.addEventListener('click', () => adjCraftQty(-10));
  document.getElementById('btn-craft-qty-sub-5')?.addEventListener('click', () => adjCraftQty(-5));
  document.getElementById('btn-craft-qty-add-5')?.addEventListener('click', () => adjCraftQty(5));
  document.getElementById('btn-craft-qty-add-10')?.addEventListener('click', () => adjCraftQty(10));
  
  document.getElementById('hideout-map-bonus')?.addEventListener('input', onMapBonusInput);
  document.getElementById('hideout-focus-rrr')?.addEventListener('input', runCraftingCalculator);
  document.getElementById('craft-focus')?.addEventListener('change', runCraftingCalculator);
  document.getElementById('craft-alchemy-cost')?.addEventListener('input', runCraftingCalculator);
  
  document.getElementById('btn-add-to-queue')?.addEventListener('click', addToCraftingQueue);
  document.getElementById('queue-check-all')?.addEventListener('change', toggleQueueAll);
  document.getElementById('global-shopfee')?.addEventListener('input', updateShoppingListTotal);
  document.getElementById('btn-submit-craft-all')?.addEventListener('click', submitCraftAll);
  
  document.getElementById('item-search')?.addEventListener('input', (e) => searchItems(e.target.value));

  document.getElementById('btn-close-edit-queue-qty-modal')?.addEventListener('click', closeEditQueueQtyModal);
  document.getElementById('btn-close-edit-queue-qty-cancel')?.addEventListener('click', closeEditQueueQtyModal);
  document.getElementById('btn-edit-queue-qty-sub-1')?.addEventListener('click', () => adjustEditModalQty(-1));
  document.getElementById('btn-edit-queue-qty-add-1')?.addEventListener('click', () => adjustEditModalQty(1));
  document.getElementById('btn-confirm-edit-queue-qty')?.addEventListener('click', submitEditQueueQty);
  
  document.getElementById('btn-close-delete-confirm-modal')?.addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('btn-cancel-delete-queue')?.addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('btn-confirm-delete-queue')?.addEventListener('click', submitDeleteQueue);

  const queueTbody = document.getElementById('crafting-queue-tbody');
  if (queueTbody) {
    queueTbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        const id = parseInt(btn.getAttribute('data-id'));
        if (action === 'edit-queue') editQueueQty(id);
        else if (action === 'delete-queue') removeFromQueue(id);
      }
    });
    queueTbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('queue-check')) {
        const id = parseInt(e.target.getAttribute('data-id'));
        toggleQueueItem(id, e.target.checked);
      }
    });
    queueTbody.addEventListener('input', (e) => {
      if (e.target.classList.contains('queue-art-price')) {
        const id = parseInt(e.target.getAttribute('data-id'));
        updateQueueArtPrice(id, e.target.value);
      } else if (e.target.classList.contains('queue-alc-price')) {
        const id = parseInt(e.target.getAttribute('data-id'));
        updateQueueAlcPrice(id, e.target.value);
      } else if (e.target.classList.contains('queue-actual-main-qty')) {
        const id = parseInt(e.target.getAttribute('data-id'));
        updateQueueActualMainQty(id, e.target.value);
      } else if (e.target.classList.contains('queue-actual-sub-qty')) {
        const id = parseInt(e.target.getAttribute('data-id'));
        updateQueueActualSubQty(id, e.target.value);
      }
    });
  }

  const tabs = document.getElementById('item-selector-tabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="select-tab"]');
      if (btn) {
        // currentSelectorTab is handled by redefining how tabs switch. 
        // Wait, the original code had an onclick which we commented out.
        // It's better to just emit an event or call the internal logic.
       const cat = btn.getAttribute('data-tab');
        currentSelectorTab = cat;
        document.getElementById('item-search').value = '';
        renderItemSelectorTabs(); 
        renderItemSelectorGrid(cat);
      }
    });
  }
  
  const grid = document.getElementById('item-selector-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="select-recipe"]');
      if (btn) {
        const itemName = btn.getAttribute('data-item');
        const allRecipes = getAllRecipes();
        const item = allRecipes.find(x => x.name === itemName);
        if (item) selectCraftingRecipe(item);
      }
    });
  }
}
