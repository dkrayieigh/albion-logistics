import { TAX_RATE, BASE_RRR, FOCUS_RRR_BONUS, SYSTEM_CITIES, BONUSES, EN_MAT, QUAL_GROUPS } from './data/constants.js';
import { ALBION_DB } from './data/albion_db.js';
import { escapeHTML, parseNum, formatMillions, formatSilver } from './utils/formatters.js';
import { state, initDefaultState, loadState, saveState } from './core/state.js';

// 請把 app.js 裡面重複宣告的常數 (TAX_RATE, BASE_RRR...) 以及 formatSilver 等函式刪除。
let queueEditTargetId = null;
function openEditQueueQtyModal(id) {
  const q = craftingQueue.find(x => x.id === id); if(!q) return;
  queueEditTargetId = id;
  document.getElementById('edit-queue-item-name').innerText = `${q.recipe.name} (${q.quality})`;
  document.getElementById('edit-queue-qty-input').value = q.qty;
  document.getElementById('edit-queue-qty-modal').style.display = 'block';
}
function closeEditQueueQtyModal() {
  document.getElementById('edit-queue-qty-modal').style.display = 'none';
  queueEditTargetId = null;
}
function submitEditQueueQty() {
  if (!queueEditTargetId) return;
  const q = craftingQueue.find(x => x.id === queueEditTargetId);
  const nq = parseInt(document.getElementById('edit-queue-qty-input').value);
  if(!isNaN(nq) && nq > 0) {
    q.qty = nq;
    const rra = getRRA(q.recipe.category, q.city, q.focus);
    let returnQty = Math.floor(q.recipe.mainBaseQty * nq * rra); q.mainQty = q.recipe.mainBaseQty * nq - returnQty;
    let returnSubQty = Math.floor(q.recipe.subBaseQty * nq * rra); q.subQty = q.recipe.subBaseQty * nq - returnSubQty;
    renderCraftingQueue(); updateShoppingListTotal(); showToast('數量已更新', 'success');
  }
  closeEditQueueQtyModal();
}

let queueDeleteTargetId = null;
function openDeleteConfirmModal(id) {
  queueDeleteTargetId = id;
  document.getElementById('delete-confirm-modal').style.display = 'block';
}
function closeDeleteConfirmModal() {
  document.getElementById('delete-confirm-modal').style.display = 'none';
  queueDeleteTargetId = null;
}
function submitDeleteQueue() {
  if (!queueDeleteTargetId) return;
  craftingQueue = craftingQueue.filter(x => x.id !== queueDeleteTargetId); 
  renderCraftingQueue(); updateShoppingListTotal();
  closeDeleteConfirmModal();
}

function getAlchemyRequirement(tier) {
  const t = parseInt(tier);
  if (t === 4) return { tier: 'T3', qty: 1 };
  if (t === 5) return { tier: 'T5', qty: 1 };
  if (t === 6) return { tier: 'T5', qty: 2 };
  if (t === 7) return { tier: 'T7', qty: 1 };
  if (t === 8) return { tier: 'T7', qty: 2 };
  return { tier: 'T3', qty: 1 };
}

function updateQueueAlcPrice(id, val) {
  const q = craftingQueue.find(x => x.id === id); if(!q) return;
  q.alchemyPrice = parseNum(val);
  updateShoppingListTotal();
}

let customLocCallbackConfirm = null;
let customLocCallbackCancel = null;

function openCustomLocationModal(mode, defaultName, onConfirm, onCancel) {
  customLocCallbackConfirm = onConfirm;
  customLocCallbackCancel = onCancel;
  document.getElementById('custom-location-input').value = defaultName || '';
  document.getElementById('custom-location-modal').style.display = 'block';
  setTimeout(() => document.getElementById('custom-location-input').focus(), 100);
}

function closeCustomLocationModal() {
  document.getElementById('custom-location-modal').style.display = 'none';
  if (customLocCallbackCancel) customLocCallbackCancel();
  customLocCallbackConfirm = null;
  customLocCallbackCancel = null;
}

function submitCustomLocation() {
  const val = document.getElementById('custom-location-input').value;
  document.getElementById('custom-location-modal').style.display = 'none';
  if (customLocCallbackConfirm) customLocCallbackConfirm(val);
  customLocCallbackConfirm = null;
  customLocCallbackCancel = null;
}

// Albion Crafting & Inventory App - Core Engine Option B (v3.8)

const TAX_RATE = 0.1125 / 100;
const BASE_RRR = 0.152;
const FOCUS_RRR_BONUS = 0.435;

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag]));
}

const SYSTEM_CITIES = { 'Thetford': { name: 'Thetford (紫城)' }, 'Martlock': { name: 'Martlock (藍城)' }, 'Bridgewatch': { name: 'Bridgewatch (沙城)' }, 'Lymhurst': { name: 'Lymhurst (綠城)' }, 'Fort Sterling': { name: 'Fort Sterling (白城)' }, 'Hideout': { name: '黑區地堡' }, 'LaborerIsland': { name: '工人島倉庫' } };
const BONUSES = { '錘矛': 'Thetford', '金屬長靴': 'Martlock', '副手武器': 'Martlock', '金屬護甲': 'Bridgewatch', '鋼條': 'Thetford', '布料': 'Lymhurst', '板材': 'Fort Sterling', '金屬頭盔': 'Fort Sterling', '鎚子': 'Fort Sterling' };

let RECIPES = [];
function getAllRecipes() {
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
RECIPES = getAllRecipes();

const EN_MAT = {'鋼條': 'Bars', '板材': 'Planks', '布料': 'Cloth', '皮革': 'Leather'};

const QUAL_GROUPS = [
  { label: 'T7', items: ['4.3', '5.2', '6.1', '7.0'] },
  { label: 'T8', items: ['4.4', '5.3', '6.2', '7.1', '8.0'] },
  { label: 'T9', items: ['5.4', '6.3', '7.2', '8.1'] },
  { label: 'Other', items: ['6.4', '7.3', '8.2', '7.4', '8.3', '8.4'] }
];
let currentCraftQuality = '7.0';
let currentBuyQuality = '7.0';

let state = { assets: { cash: 0 }, customLocations: [], inventory: {}, laborerInventory: { '鋼條': {}, '布料': {}, '板材': {}, '滿日記本': {} }, laborerLogs: [], transactions: [] };
let currentLedgerPage = 1; const LEDGER_ITEMS_PER_PAGE = 10; let filteredLedger = [];
let currentLaborLogsPage = 1; const LABOR_ITEMS_PER_PAGE = 10; let filteredLaborLogs = [];
let craftingQueue = [];

function resetSystemData() {
  if (confirm('⚠️ 警告：這將會清除您所有的庫存、流水帳與設定資料，且無法復原！\n確定要清空嗎？')) {
    localStorage.clear(); location.reload();
  }
}

function parseNum(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/,/g, '')) || 0;
}

function formatMillions(val) {
  if (val >= 1000000 || val <= -1000000) return (val / 1000000).toFixed(1) + 'M';
  return formatSilver(val);
}

document.addEventListener('input', function(e) {
  if (e.target.classList.contains('format-num')) {
    let rawVal = e.target.value.replace(/[^\d-]/g, '');
    if (rawVal === '' || rawVal === '-') return;
    let parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed)) e.target.value = parsed.toLocaleString();
  }
});

function renderQualityPillsGroup(containerId, activeQuality, callback) {
  const ctn = document.getElementById(containerId); ctn.innerHTML = '';
  QUAL_GROUPS.forEach(g => {
    const d = document.createElement('div'); d.style.marginBottom = '10px';
    const title = document.createElement('div'); title.innerText = g.label; title.style.fontSize = '0.85rem'; title.style.color = 'var(--accent-cyan)'; title.style.marginBottom = '4px';
    const pg = document.createElement('div'); pg.className = 'pill-group';
    g.items.forEach(q => {
      const btn = document.createElement('button');
      btn.className = `pill-btn ${q === activeQuality ? 'active' : ''}`;
      btn.innerHTML = q === '6.0' ? `6.0 <span class="pill-hint">(工人島)</span>` : q;
      btn.onclick = () => { callback(q); if (containerId === "craft-quality-pill-group") runCraftingCalculator(); };
      pg.appendChild(btn);
    });
    d.appendChild(title); d.appendChild(pg);
    ctn.appendChild(d);
  });
}

function updateCraftQualityPills() { renderQualityPillsGroup('craft-quality-pill-group', currentCraftQuality, q => { currentCraftQuality = q; updateCraftQualityPills(); runCraftingCalculator(); }); }
function updateBuyQualityPills() { renderQualityPillsGroup('buy-quality-pill-group', currentBuyQuality, q => { currentBuyQuality = q; updateBuyQualityPills(); }); }

function initDefaultState() {
  const materials = ['鋼條', '布料', '板材', '皮革'];
  const allItems = new Set([...materials, '滿日記本']); RECIPES.forEach(r => allItems.add(r.name));
  const QUALITIES = QUAL_GROUPS.flatMap(g => g.items);
  // Also need base qualities for journals
  const ALL_QUALS = new Set([...QUALITIES, '4.0', '5.0', '6.0', '7.0', '8.0']);
  
  allItems.forEach(item => {
    ALL_QUALS.forEach(q => {
      const key = `${item}_${q}`;
      if (!state.inventory[key]) {
         let initialQty = { 'LaborerIsland': 0, 'Fort Sterling': 0, 'Bridgewatch': 0, 'Lymhurst': 0, 'Martlock': 0, 'Thetford': 0 };
         state.customLocations.forEach(c => initialQty[c] = 0);
         state.inventory[key] = { qtyByCity: initialQty, globalAvgCost: 0 };
      } else {
         state.customLocations.forEach(c => {
             if(state.inventory[key].qtyByCity[c] === undefined) state.inventory[key].qtyByCity[c] = 0;
         });
      }
      if (materials.includes(item) || item === '滿日記本') { if (!state.laborerInventory[item]) state.laborerInventory[item] = {}; if (!state.laborerInventory[item][q]) state.laborerInventory[item][q] = 0; }
    });
  });
}

function loadState() {
  const stocks = localStorage.getItem('albion_crafting_stocks'); if (stocks) state.inventory = JSON.parse(stocks);
  const assets = localStorage.getItem('albion_crafting_assets'); if (assets) state.assets = JSON.parse(assets);
  const trans = localStorage.getItem('albion_crafting_transactions'); if (trans) state.transactions = JSON.parse(trans);
  const laborStock = localStorage.getItem('albion_crafting_laborer_stocks'); if (laborStock) state.laborerInventory = JSON.parse(laborStock);
  const laborLogs = localStorage.getItem('albion_crafting_laborer_logs'); if (laborLogs) state.laborerLogs = JSON.parse(laborLogs);
  const cLoc = localStorage.getItem('albion_crafting_custom_locs'); 
  if (cLoc) { state.customLocations = JSON.parse(cLoc); } else { state.customLocations = []; }
  
  // Migration for old Hideout
  let hasOldHideout = false;
  for(let k in state.inventory) {
    if (state.inventory[k].qtyByCity['Hideout'] !== undefined) {
      if(state.inventory[k].qtyByCity['Hideout'] > 0) hasOldHideout = true;
    }
  }
  if(hasOldHideout && !state.customLocations.includes('舊黑區地堡')) {
    state.customLocations.push('舊黑區地堡');
    for(let k in state.inventory) {
      if(state.inventory[k].qtyByCity['Hideout'] !== undefined) {
        state.inventory[k].qtyByCity['舊黑區地堡'] = state.inventory[k].qtyByCity['Hideout'];
        delete state.inventory[k].qtyByCity['Hideout'];
      }
    }
    state.transactions.forEach(t => { if(t.location === 'Hideout') t.location = '舊黑區地堡'; });
  } else {
    for(let k in state.inventory) delete state.inventory[k].qtyByCity['Hideout'];
  }

  initDefaultState();
  renderCityDropdowns();
}

function saveState() {
  // AUTO-PRUNE Mechanism
  if (state.transactions.length > 100) state.transactions.splice(100);
  if (state.laborerLogs.length > 100) state.laborerLogs.splice(100);
  
  localStorage.setItem('albion_crafting_stocks', JSON.stringify(state.inventory));
  localStorage.setItem('albion_crafting_assets', JSON.stringify(state.assets));
  localStorage.setItem('albion_crafting_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('albion_crafting_laborer_stocks', JSON.stringify(state.laborerInventory));
  localStorage.setItem('albion_crafting_laborer_logs', JSON.stringify(state.laborerLogs));
  localStorage.setItem('albion_crafting_custom_locs', JSON.stringify(state.customLocations));
  updateDashboardUI();
}

function recalculateGlobalAvgCosts() {
  // 已改用移動平均成本 (Moving Average Cost)
  // 不再依賴流水帳重算，保留此空函式以兼容其他調用
}

function getEnchantAndTier(q) { const p = q.split('.'); return { tier: parseInt(p[0]) || 4, enchant: parseInt(p[1]) || 0 }; }

function getRRA(c, city, f) {
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

function calculateCraftingFee(r, q, qual, sf) { const { tier, enchant } = getEnchantAndTier(qual); const mv = Math.pow(2, tier+enchant); const sv = r.subBaseQty > 0 ? Math.pow(2, tier+enchant) : 0; const iv = (r.mainBaseQty*mv + r.subBaseQty*sv)*q; const av = r.artifactVal > 0 ? (r.artifactVal * Math.pow(2, tier-4)) : 0; return Math.round((iv + av) * TAX_RATE * sf); }
function formatSilver(val) { if (val === undefined || isNaN(val)) return '0'; return Math.round(val).toLocaleString(); }

function updateDashboardUI() {
  recalculateGlobalAvgCosts();
  let mainInvValue = 0;

  for (let key in state.inventory) {
    const it = state.inventory[key]; let tq = 0;
    for (let c in it.qtyByCity) { if (c !== 'LaborerIsland') tq += it.qtyByCity[c]; }
    mainInvValue += tq * (it.globalAvgCost || 0);
  }

  
  const cashEl = document.getElementById('summary-cash');
  cashEl.innerText = formatMillions(state.assets.cash);
  cashEl.style.color = state.assets.cash < 0 ? 'var(--accent-red)' : 'var(--accent-green)';
  
  document.getElementById('summary-inventory').innerText = formatMillions(mainInvValue);
  
  const nw = state.assets.cash + mainInvValue;
  const nwEl = document.getElementById('summary-networth');
  if(nwEl) nwEl.innerText = formatMillions(nw);
  
  renderInventoryTable(); renderLaborerTable(); filterLedger(false); filterLaborLogs(); updateLaborQualityPills();
}

function switchTab(tId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(tId).classList.add('active');
  const n = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick').includes(tId));
  if(n) n.classList.add('active');
}

function onCityChange() {
  const city = document.getElementById('craft-city').value;
  document.getElementById('hideout-group').style.display = state.customLocations.includes(city) ? 'flex' : 'none';
  runCraftingCalculator();
}

function onRecipeChange() {
  const rn = document.getElementById('craft-recipe').value; const r = RECIPES.find(x => x.name === rn); if (!r) return;
  document.getElementById('main-material-label').innerHTML = `主料需求: ${r.main}<br><span style="font-size:0.8em;opacity:0.7;">Main Material: ${EN_MAT[r.main]||''}</span>`;
  
  if (r.subBaseQty > 0) { 
      document.getElementById('sub-material-label').innerHTML = `副料需求: ${r.sub}<br><span style="font-size:0.8em;opacity:0.7;">Sub Material: ${EN_MAT[r.sub]||''}</span>`; 
      document.getElementById('sub-material-group').style.display = 'block'; 
  } else { 
      document.getElementById('sub-material-label').innerHTML = `副料需求: 無<br><span style="font-size:0.8em;opacity:0.7;">Sub Material: None</span>`; 
      document.getElementById('sub-material-group').style.display = 'block'; 
  }
  

  runCraftingCalculator();
}

function runCraftingCalculator() {
  const rn = document.getElementById('craft-recipe').value; const r = RECIPES.find(x => x.name === rn); if (!r) return;
  const q = parseNum(document.getElementById('craft-qty').value); const qual = currentCraftQuality; const city = document.getElementById('craft-city').value;
  const foc = document.getElementById('craft-focus').checked;
  const rra = getRRA(r.category, city, foc); document.getElementById('rra-badge').innerText = `返還率: ${(rra*100).toFixed(1)}%`;
  let returnQty = Math.floor(r.mainBaseQty * q * rra); const amc = r.mainBaseQty * q - returnQty;
  let returnSubQty = Math.floor(r.subBaseQty * q * rra); const asc = r.subBaseQty * q - returnSubQty;
  document.getElementById('out-main-qty').innerText = `${amc} / ${r.mainBaseQty*q}`; document.getElementById('out-sub-qty').innerText = r.subBaseQty>0 ? `${asc} / ${r.subBaseQty*q}` : '0';
  
  const oml = document.getElementById('out-main-label'); if(oml) oml.innerHTML = `預估消耗 ${r.main}<br><span style=\"font-size:0.8em; opacity:0.7;\">Est. ${EN_MAT[r.main]||''} Consumption</span>`;
  const osl = document.getElementById('out-sub-label'); if(osl) osl.innerHTML = r.subBaseQty > 0 ? `預估消耗 ${r.sub}<br><span style=\"font-size:0.8em; opacity:0.7;\">Est. ${EN_MAT[r.sub]||''} Consumption</span>` : `預估消耗 無<br><span style=\"font-size:0.8em; opacity:0.7;\">Est. None</span>`;
  
  const alcGroup = document.getElementById('alchemy-group');
  if (r.alchemyName) {
      alcGroup.style.display = 'block';
      let tier = '4';
      if (qual && qual.includes('.')) {
          tier = qual.split('.')[0];
      }
      const req = getAlchemyRequirement(tier);
      document.getElementById('alchemy-label').innerHTML = `鍊金材料<br><span style="font-size:0.8em; opacity:0.7;">${req.tier} ${r.alchemyName} (需求: ${req.qty})</span>`;
  } else {
      alcGroup.style.display = 'none';
  }
}

// ==== BATCH CRAFTING QUEUE ====
function addToCraftingQueue() {
  const rn = document.getElementById('craft-recipe').value; const r = RECIPES.find(x => x.name === rn); if (!r) return showToast('裝備錯誤', 'error');
  const q = parseNum(document.getElementById('craft-qty').value); if(q<=0) return showToast('數量必須大於0', 'error');
  const qual = currentCraftQuality; const city = document.getElementById('craft-city').value;
  const foc = document.getElementById('craft-focus').checked;
  
  const mk = `${r.main}_${qual}`; const sk = `${r.sub}_${qual}`; const rra = getRRA(r.category, city, foc);
  let returnQty = Math.floor(r.mainBaseQty * q * rra); const amc = r.mainBaseQty * q - returnQty;
  let returnSubQty = Math.floor(r.subBaseQty * q * rra); const asc = r.subBaseQty * q - returnSubQty;
  
  let artPrice = 0;
  
  let alcTier = null;
  let alcQty = 0;
  let alcPrice = 0;
  if (r.alchemyName) {
      let tier = '4';
      if (qual && qual.includes('.')) tier = qual.split('.')[0];
      const req = getAlchemyRequirement(tier);
      alcTier = req.tier;
      alcQty = req.qty;
      const alcEl = document.getElementById('craft-alchemy-cost');
      if (alcEl) alcPrice = parseNum(alcEl.value);
  }
  
  craftingQueue.push({ id: Math.floor(Date.now() + Math.random() * 1000), checked: true, recipe: r, qty: q, quality: qual, city: city, focus: foc, mainKey: mk, mainQty: amc, subKey: sk, subQty: asc, tax: 0, artifactPrice: artPrice, artifactName: r.artifactVal > 0 || r.artifactName ? r.artifactName : null, artifactQty: r.artifactQty || 1, alchemyName: r.alchemyName, alchemyTier: alcTier, alchemyBaseQty: alcQty, alchemyPrice: alcPrice });
  renderCraftingQueue(); updateShoppingListTotal(); showToast('已加入佇列', 'success');
}

function removeFromQueue(id) { openDeleteConfirmModal(id); }
function toggleQueueAll() {
  const ch = document.getElementById('queue-check-all').checked;
  craftingQueue.forEach(q => q.checked = ch); renderCraftingQueue(); updateShoppingListTotal();
}

function editQueueQty(id) { openEditQueueQtyModal(id); }

function confirmEditQueueQty() { submitEditQueueQty(); }
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
function confirmDeleteQueue() { submitDeleteQueue(); }
function toggleQueueItem(id, checked) {
  const q = craftingQueue.find(x => x.id === id); if(q) q.checked = checked;
  updateShoppingListTotal();
}

function updateQueueArtPrice(id, val) {
  const q = craftingQueue.find(x => x.id === id); if(!q) return;
  q.artifactPrice = parseNum(val);
  updateShoppingListTotal();
}

function renderCraftingQueue() {
  const tb = document.getElementById('crafting-queue-tbody'); tb.innerHTML='';
  craftingQueue.forEach(q => {
    const tr = document.createElement('tr'); const bc = `quality-badge quality-${parseInt(q.quality.split('.')[0])||4}`;
    tr.innerHTML = `
    <td><input type="checkbox" ${q.checked ? 'checked' : ''} onchange="toggleQueueItem(${q.id}, this.checked)"></td>
    <td style="white-space:nowrap;"><strong>T${parseInt(q.quality.split(".")[0])||4} ${q.recipe.name}</strong> ${q.focus?"✨":""}<br><span style="font-size:0.8em; opacity:0.7; color:var(--text-secondary);">${q.recipe.id}</span></td>
    <td><span class="${bc}">${q.quality}</span></td>
    <td style="color:var(--accent-cyan); font-weight:bold;">${q.qty}</td>
    <td>${SYSTEM_CITIES[q.city]?.name||q.city}</td>
    <td style="white-space:nowrap; font-size:0.8rem; line-height:1.4;">${q.recipe.main}: ${q.mainQty}<br>${q.recipe.subBaseQty>0?`${q.recipe.sub}: ${q.subQty}`:''}</td>
    <td style="display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; gap:5px; align-items:center;">
        <button class="btn btn-warning" style="padding:4px 8px; font-size:0.7rem; flex:1; line-height: 1.2;" onclick="editQueueQty(${q.id})">✏️ 編輯<br><span style="font-size:0.8em;opacity:0.7;">Edit</span></button>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:0.7rem; flex:1; line-height: 1.2;" onclick="removeFromQueue(${q.id})">🗑️ 刪除<br><span style="font-size:0.8em;opacity:0.7;">Delete</span></button>
      </div>
      ${q.artifactName ? `<div><div style="font-size:0.7rem; color:var(--accent-cyan);">${q.artifactName}${q.artifactQty > 1 ? ` (需: ${q.artifactQty})` : ''}</div><input type="text" class="format-num" style="width:100%; padding:4px 6px; font-size:0.75rem;" placeholder="單件神器成本" value="${q.artifactPrice ? q.artifactPrice : ''}" oninput="updateQueueArtPrice(${q.id}, this.value)"></div>` : ''}
      ${q.alchemyName ? `<div><div style="font-size:0.7rem; color:var(--accent-yellow);">${q.alchemyTier} ${q.alchemyName} (需: ${q.alchemyBaseQty})</div><input type="text" class="format-num" style="width:100%; padding:4px 6px; font-size:0.75rem;" placeholder="單件鍊金成本" value="${q.alchemyPrice ? q.alchemyPrice : ''}" oninput="updateQueueAlcPrice(${q.id}, this.value)"></div>` : ''}
    </td>`;
    tb.appendChild(tr);
  });
}

function updateShoppingListTotal() {
  const sf = parseNum(document.getElementById('global-shopfee').value);
  let aggregated = {}; let totalCash = 0;
  craftingQueue.forEach(q => {
    if(!q.checked) return;
    q.tax = calculateCraftingFee(q.recipe, q.qty, q.quality, sf);
    totalCash += (q.tax + (q.artifactPrice || 0) * (q.artifactQty || 1) * q.qty);
    if (q.alchemyName) {
        totalCash += (q.alchemyPrice || 0) * (q.alchemyBaseQty || 0) * q.qty;
        const ak = `${q.city}|${q.alchemyTier} ${q.alchemyName}`; aggregated[ak] = (aggregated[ak]||0) + (q.alchemyBaseQty * q.qty);
    }
    const k = `${q.city}|${q.mainKey}`; aggregated[k] = (aggregated[k]||0) + q.mainQty;
    if(q.recipe.subBaseQty>0) { const sk = `${q.city}|${q.subKey}`; aggregated[sk] = (aggregated[sk]||0) + q.subQty; }
  });
  
  const sc = document.getElementById('shopping-list-content');
  if(Object.keys(aggregated).length === 0) { sc.innerHTML = '<span style="color:var(--text-muted)">無勾選裝備...</span>'; }
  else {
    let listHTML = '<ul style="list-style:none; padding:0; margin:0; display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
    for(let k in aggregated) {
      const [city, mat] = k.split('|');
      let matDisplay = mat.replace('_', ' ');
      if (mat.includes(' ') && !mat.match(/^\d\./)) { // artifacts/alchemy that are bilingual
          const parts = mat.split(' ');
          const cn = parts[0];
          const en = parts.slice(1).join(' ');
          matDisplay = `${cn}<br><span style="font-size:0.8em;opacity:0.7;font-weight:normal;">${en}</span>`;
      }
      listHTML += `<li style="display:flex; align-items:center; gap:5px; margin-bottom:5px; line-height:1.2;">
        <span style="color:var(--text-secondary); white-space:nowrap;">[${SYSTEM_CITIES[city]?.name||city}]</span> 
        <strong style="flex:1; ${mat.includes(' ') ? 'color:var(--accent-yellow);' : ''}">${matDisplay}</strong> 
        <span style="color:var(--accent-cyan); font-weight:bold;"> x ${aggregated[k]}</span>
      </li>`;
    }
    listHTML += '</ul>'; sc.innerHTML = listHTML;
  }
  document.getElementById('queue-total-cost').innerText = formatSilver(totalCash);
}

function submitCraftAll() {
  const toCraft = craftingQueue.filter(x => x.checked);
  if (toCraft.length === 0) return showToast('沒有勾選任何項目！', 'error');
  let needed = {}; let totalCashNeeded = 0;
  toCraft.forEach(q => {
    totalCashNeeded += (q.tax + (q.artifactPrice||0) * (q.artifactQty || 1) * q.qty);
    if (q.alchemyName) {
        totalCashNeeded += (q.alchemyPrice || 0) * (q.alchemyBaseQty || 0) * q.qty;
    }
    const mk = `${q.city}|${q.mainKey}`; needed[mk] = (needed[mk]||0) + q.mainQty;
    if(q.recipe.subBaseQty>0) { const sk = `${q.city}|${q.subKey}`; needed[sk] = (needed[sk]||0) + q.subQty; }
  });
  
  for(let k in needed) {
    const [city, mat] = k.split('|'); const av = state.inventory[mat]?.qtyByCity[city] || 0;
    if (av < needed[k]) return showToast(`短缺警告：${SYSTEM_CITIES[city]?.name||city} 的 ${mat.replace('_',' ')} 需要 ${needed[k]}，但庫存僅有 ${av}！`, 'error');
  }
  
  toCraft.forEach(q => {
    state.inventory[q.mainKey].qtyByCity[q.city] -= q.mainQty;
    if(q.recipe.subBaseQty>0) state.inventory[q.subKey].qtyByCity[q.city] -= q.subQty;
    state.assets.cash -= (q.tax + (q.artifactPrice||0) * (q.artifactQty || 1) * q.qty);
    if (q.alchemyName) {
        state.assets.cash -= (q.alchemyPrice || 0) * (q.alchemyBaseQty || 0) * q.qty;
    }
    
    const mkCost = q.mainQty * (state.inventory[q.mainKey]?.globalAvgCost||0);
    const skCost = q.recipe.subBaseQty>0 ? (q.subQty * (state.inventory[q.subKey]?.globalAvgCost||0)) : 0;
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
  
  craftingQueue = craftingQueue.filter(x => !x.checked); renderCraftingQueue(); updateShoppingListTotal(); saveState(); updateDashboardUI();
  showToast('🎉 製造成功！已勾選裝備入庫，成本與流水帳已更新。', 'success');
}

function submitPurchase() {
  const item = document.getElementById('buy-item').value; const qual = currentBuyQuality;
  const qty = parseNum(document.getElementById('buy-qty').value); const tc = parseNum(document.getElementById('buy-total-price').value); const city = document.getElementById('buy-city').value;
  if(qty<=0||tc<=0) return showToast('數量總價錯誤', 'error');
  state.assets.cash -= tc; const key = `${item}_${qual}`; if(!state.inventory[key]) initDefaultState(); 
  
  const it = state.inventory[key];
  let oldGlobalQty = 0; for(let c in it.qtyByCity) oldGlobalQty += it.qtyByCity[c];
  const oldTotalCost = oldGlobalQty * (it.globalAvgCost || 0);
  const newTotalCost = oldTotalCost + tc;
  const newGlobalQty = oldGlobalQty + qty;
  if (newGlobalQty > 0) it.globalAvgCost = Math.round(newTotalCost / newGlobalQty);

  it.qtyByCity[city] += qty;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '買材料', item: item, quality: qual, qty: qty, total: tc, unitPrice: Math.round(tc/qty), location: city });
  saveState(); showToast(`採購成功！`, 'success');
}

function updateTransItemOptions() {
  const fc = document.getElementById('trans-from').value; const sel = document.getElementById('trans-item'); sel.innerHTML = '<option value="">請選擇...</option>';
  if(!fc) return;
  for(let key in state.inventory) { if(state.inventory[key].qtyByCity[fc] > 0) { const opt = document.createElement('option'); opt.value = key; opt.innerText = `${key.replace('_', ' (')}) - 庫存: ${state.inventory[key].qtyByCity[fc]}`; sel.appendChild(opt); } }
  updateTransMax();
}
function updateTransMax() {
  const fc = document.getElementById('trans-from').value; const key = document.getElementById('trans-item').value;
  const max = key ? state.inventory[key].qtyByCity[fc] : 0; const sl = document.getElementById('trans-qty-slider');
  sl.max = max || 1; sl.value = 1; document.getElementById('trans-qty').value = '1';
}
function adjustTransQty(d) {
  const sl = document.getElementById('trans-qty-slider'); let v = parseInt(sl.value) + d;
  if(v<1) v=1; if(v>parseInt(sl.max)) v=parseInt(sl.max); sl.value = v; document.getElementById('trans-qty').value = v.toLocaleString();
}
function setTransQtyMax() { const sl = document.getElementById('trans-qty-slider'); sl.value = sl.max; document.getElementById('trans-qty').value = parseInt(sl.max).toLocaleString(); }

function submitTransport() {
  const key = document.getElementById('trans-item').value; if(!key) return showToast('請選擇物品！', 'error');
  const qty = parseNum(document.getElementById('trans-qty').value); const fc = document.getElementById('trans-from').value; const tc = document.getElementById('trans-to').value;
  if(qty<=0) return showToast('請輸入數量', 'error'); if(fc===tc) return showToast('起終點相同', 'error');
  if(!state.inventory[key] || state.inventory[key].qtyByCity[fc] < qty) return showToast('庫存不足', 'error');
  state.inventory[key].qtyByCity[fc] -= qty; state.inventory[key].qtyByCity[tc] += qty;
  saveState(); showToast(`貨運成功`, 'success'); updateTransItemOptions();
}

// ==== LOCATION-BASED INVENTORY ====
function renderInventoryTable() {
  const ctn = document.getElementById('inventory-city-cards'); ctn.innerHTML = '';
  const qry = document.getElementById('inventory-search').value.toLowerCase();
  const cities = ['Thetford', 'Martlock', 'Bridgewatch', 'Lymhurst', 'Fort Sterling', ...state.customLocations, 'LaborerIsland'];
  
  cities.forEach(city => {
    let hasItem = false; let rows = '';
    for (let key in state.inventory) {
      const qty = state.inventory[key].qtyByCity[city];
      if (qty > 0) {
        const [item, q] = key.split('_');
        if (qry && !item.toLowerCase().includes(qry) && !q.toLowerCase().includes(qry)) continue;
        hasItem = true; const bc = `quality-badge quality-${parseInt(q.split('.')[0])||4}`;
        rows += `<tr>
          <td><strong>${item}</strong></td>
          <td><span class="${bc}">${q}</span></td>
          <td style="font-weight:600; color:var(--accent-cyan); font-size:1.1rem;">${qty}</td>
          <td style="font-weight:600;">${formatSilver(state.inventory[key].globalAvgCost)}</td>
          <td>
            <div style="display:flex;gap:5px;flex-direction:row;">
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="openSellCraftedModal('${item}', '${q}', '${city}')">💸 出售</button>
              <button class="btn btn-warning" style="padding:4px 8px; font-size:0.8rem;" onclick="openEditInventoryModal('${item}', '${q}', '${city}')">✏️ 編輯</button>
            </div>
          </td>
        </tr>`;
      }
    }
    if (hasItem) {
      const cName = SYSTEM_CITIES[city]?.name || city;
      const card = document.createElement('div'); card.className = 'card'; card.style.marginBottom = '0'; card.style.padding = '20px';
      card.innerHTML = `<h3 style="color:var(--accent-cyan); margin-bottom:12px; font-family:var(--font-title); border-bottom:1px solid var(--border-glass); padding-bottom:8px;">📍 ${escapeHTML(cName)} 倉庫</h3>
        <div class="table-wrapper">
          <table><thead><tr><th>物品</th><th>品質</th><th>該地數量</th><th>全局均價</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>
        </div>`;
      ctn.appendChild(card);
    }
  });
}

let aSellI = '', aSellQ = '';
function openSellCraftedModal(i, q, defCity) {
  aSellI = i; aSellQ = q; const obj = state.inventory[`${i}_${q}`];
  const cs = document.getElementById('sell-crafted-city'); cs.innerHTML='';
  for(let c in obj.qtyByCity) { if(obj.qtyByCity[c]>0) { const o=document.createElement('option'); o.value=c; o.innerText=`${SYSTEM_CITIES[c]?.name||c} (庫存: ${obj.qtyByCity[c]})`; cs.appendChild(o); } }
  if(cs.options.length===0) return;
  if(defCity) cs.value = defCity;
  document.getElementById('sell-crafted-title').innerText = `出售：${i} (${q})`; document.getElementById('sell-crafted-cost').innerText = formatSilver(obj.globalAvgCost); document.getElementById('sell-crafted-estimate').value=''; document.getElementById('sell-crafted-actual').value=''; document.getElementById('sell-crafted-actual-total').value=''; document.getElementById('sell-crafted-qty').value = obj.qtyByCity[cs.value] || 0; document.getElementById('sell-crafted-modal').style.display='block'; runEstimator();
}
function closeSellCraftedModal() { document.getElementById('sell-crafted-modal').style.display='none'; }
function runEstimator() {
  const c = document.getElementById('sell-crafted-city').value; const max = state.inventory[`${aSellI}_${aSellQ}`].qtyByCity[c] || 0;
  document.getElementById('sell-crafted-max').innerText = max; const qi = document.getElementById('sell-crafted-qty'); 
  let qty = parseNum(qi.value);
  if(qty === 0 && max > 0) { qty = max; qi.value = max; }
  if(qty>max) { qty=max; qi.value=max; }
  const est = parseNum(document.getElementById('sell-crafted-estimate').value);
  document.getElementById('sell-bench-90').innerText = formatSilver(est*0.9); document.getElementById('sell-bench-85').innerText = formatSilver(est*0.85);
  const act = parseNum(document.getElementById('sell-crafted-actual').value); const p = (act - (state.inventory[`${aSellI}_${aSellQ}`].globalAvgCost||0)) * qty;
  const pe = document.getElementById('sell-crafted-profit'); pe.innerText = formatSilver(p); pe.style.color = p>=0 ? 'var(--accent-green)':'var(--accent-red)';
}
function submitSellCrafted() {
  const c = document.getElementById('sell-crafted-city').value; const qty = parseNum(document.getElementById('sell-crafted-qty').value); const act = parseNum(document.getElementById('sell-crafted-actual').value); const act_total = parseNum(document.getElementById('sell-crafted-actual-total').value);
  if(qty<=0) return; if(state.inventory[`${aSellI}_${aSellQ}`].qtyByCity[c]<qty) return showToast('庫存不足', 'error');
  state.inventory[`${aSellI}_${aSellQ}`].qtyByCity[c]-=qty; state.assets.cash+=act_total;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '庫存售出', item: aSellI, quality: aSellQ, qty: qty, total: act_total, unitPrice: act, location: c });
  saveState(); closeSellCraftedModal(); showToast(`售出成功`, 'success');
}

let aEditK = '';
function openEditInventoryModal(i, q, defCity) {
  aEditK = `${i}_${q}`; const obj = state.inventory[aEditK]; document.getElementById('edit-inv-name').innerText = `${i} (${q})`;
  const cs = document.getElementById('edit-inv-city'); cs.innerHTML=''; let hs=false;
  for(let c in obj.qtyByCity) { if(obj.qtyByCity[c]>=0) { const o=document.createElement('option'); o.value=c; o.innerText=SYSTEM_CITIES[c]?.name||c; cs.appendChild(o); if(obj.qtyByCity[c]>0) hs=true; } } // allow 0 stock if they want to add
  if(cs.options.length===0) return;
  if(defCity) cs.value = defCity;
  document.getElementById('edit-inv-cost').value = formatSilver(obj.globalAvgCost||0); onEditCityChange(); document.getElementById('edit-inventory-modal').style.display='block';
}
function onEditCityChange() { const c = document.getElementById('edit-inv-city').value; document.getElementById('edit-inv-qty').value = formatSilver(state.inventory[aEditK].qtyByCity[c]||0); }
function closeEditInventoryModal() { document.getElementById('edit-inventory-modal').style.display='none'; }
function submitEditInventory() {
  const c = document.getElementById('edit-inv-city').value; const nq = parseNum(document.getElementById('edit-inv-qty').value); const nc = parseNum(document.getElementById('edit-inv-cost').value);
  if(nq<0||nc<0) return showToast('不可為負', 'error'); const [i,q]=aEditK.split('_'); const obj=state.inventory[aEditK]; const oq=obj.qtyByCity[c];
  obj.qtyByCity[c]=nq;
  if(obj.globalAvgCost !== nc) {
    let tq=0; for(let cx in obj.qtyByCity) tq+=obj.qtyByCity[cx];
    state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '成本校正', item: i, quality: q, qty: tq, total: tq*nc, unitPrice: nc, location: 'Global' });
    obj.globalAvgCost = nc;
  }
  if(oq !== nq) state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '庫存校正', item: i, quality: q, qty: nq-oq, total: 0, unitPrice: 0, location: c });
  saveState(); closeEditInventoryModal(); showToast('校正成功', 'success');
}
function deleteEditInventory() {
  const c = document.getElementById('edit-inv-city').value; const [i,q] = aEditK.split('_'); const oq=state.inventory[aEditK].qtyByCity[c];
  state.inventory[aEditK].qtyByCity[c]=0;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '庫存刪除', item: i, quality: q, qty: -oq, total: 0, unitPrice: 0, location: c });
  saveState(); closeEditInventoryModal(); showToast('已刪除', 'success');
}

function addLaborItemRow() {
  const list = document.getElementById('labor-dynamic-list'); const rId = 'lr-'+Date.now();
  const d = document.createElement('div'); d.className='form-row'; d.id=rId; d.style.marginBottom='10px';
  d.innerHTML = `<div class="form-group" style="flex:2;"><select class="li-type"><option value="鋼條">鋼條</option><option value="布料">布料</option><option value="板材">板材</option></select></div><div class="form-group" style="flex:2;"><select class="li-qual"><option value="6.0">6.0</option><option value="6.1">6.1</option><option value="6.2">6.2</option><option value="6.3">6.3</option></select></div><div class="form-group" style="flex:2;"><input type="text" class="format-num li-qty" placeholder="數量" value="0"></div><div class="form-group" style="flex:1;"><button class="btn btn-danger" onclick="document.getElementById('${rId}').remove()">✕</button></div>`;
  list.appendChild(d);
}

function renderLaborerTable() {
  const tbg = document.getElementById('labor-tbody'); tbg.innerHTML='';
  const tbj = document.getElementById('labor-journal-tbody'); tbj.innerHTML='';
  const ALL_QUALS = [...QUAL_GROUPS.flatMap(g => g.items), '4.0', '5.0', '6.0', '7.0', '8.0'];
  
  // Render Journals
  ['4.0', '5.0', '6.0', '7.0', '8.0'].forEach(q => {
    const qty = state.laborerInventory['滿日記本']?.[q] || 0;
    if(qty > 0) {
      const bc = `quality-badge quality-${parseInt(q.split('.')[0])||4}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="${bc}">T${q.split('.')[0]} 日記本 (${q})</span></td><td style="font-weight:600; color:var(--accent-cyan); font-size:1.1rem;">${qty}</td><td><button class="btn btn-warning" style="padding:4px 8px; font-size:0.75rem;" onclick="openEditLaborModal('滿日記本','${q}',${qty})">✏️ 編輯</button> <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="openSellLaborStockModal('滿日記本','${q}',${qty})">套現</button></td>`;
      tbj.appendChild(tr);
    }
  });

  // Render General Goods
  ['鋼條','布料','板材'].forEach(it => { ALL_QUALS.forEach(q => { const qty=state.laborerInventory[it]?.[q]||0; if(qty===0)return; const bc=`quality-badge quality-${parseInt(q.split('.')[0])||4}`;
  const tr=document.createElement('tr'); tr.innerHTML=`<td><strong>${it}</strong></td><td><span class="${bc}">${q}</span></td><td style="font-weight:600; color:var(--accent-purple);">${qty}</td><td><button class="btn btn-warning" style="padding:4px 8px; font-size:0.75rem;" onclick="openEditLaborModal('${it}','${q}',${qty})">✏️ 編輯</button> <button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" onclick="openImportModal('${it}','${q}',${qty})">匯入</button> <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="openSellLaborStockModal('${it}','${q}',${qty})">套現</button></td>`; tbg.appendChild(tr); }); });
}

function adjHarvestQty(d) {
  const el = document.getElementById('labor-filled-qty');
  let v = parseInt(el.value) + d;
  if(v < 0) v = 0;
  el.value = v;
}

function submitLaborHarvest() {
  const f = parseNum(document.getElementById('labor-filled-qty').value); if(f<=0) return showToast('數量錯誤','error');
  const hq = currentLaborHarvestQual;
  
  const curJ = state.laborerInventory['滿日記本']?.[hq] || 0;
  if (curJ < f) {
    if(!confirm(`警告：滿日記本 (${hq}) 庫存不足 (僅剩 ${curJ})！
這將導致庫存變成負數，確定要繼續收成嗎？`)) return;
  }
  
  if(!state.laborerInventory['滿日記本']) state.laborerInventory['滿日記本'] = {};
  state.laborerInventory['滿日記本'][hq] = (state.laborerInventory['滿日記本'][hq] || 0) - f;
  
  const list = document.getElementById('labor-dynamic-list').children; let ls = [];
  for(let i=0; i<list.length; i++) {
    const tp=list[i].querySelector('.li-type').value; const ql=list[i].querySelector('.li-qual').value; const qt=parseNum(list[i].querySelector('.li-qty').value);
    if(qt>0) { if(!state.laborerInventory[tp])state.laborerInventory[tp]={}; state.laborerInventory[tp][ql]=(state.laborerInventory[tp][ql]||0)+qt; ls.push(`${tp}(${ql})x${qt}`); }
  }
  state.laborerLogs.unshift({ date: new Date().toISOString().split('T')[0], filled: f, details: ls.join(', ')||'無資源產出' });
  saveState(); showToast('收成成功並已扣除滿日記本庫存','success');
}

function submitAddFilledJournals() {
  const q = currentLaborAddQual; const qty = parseNum(document.getElementById('labor-add-filled-qty').value);
  if(qty<=0) return showToast('數量錯誤','error');
  if(!state.laborerInventory['滿日記本']) state.laborerInventory['滿日記本'] = {};
  state.laborerInventory['滿日記本'][q] = (state.laborerInventory['滿日記本'][q]||0) + qty;
  saveState(); showToast('滿日記本入庫成功', 'success');
}

function filterLaborLogs() {
  filteredLaborLogs = state.laborerLogs;
  currentLaborLogsPage = 1;
  renderLaborerLogsTable();
}

function renderLaborerLogsTable() {
  const tb = document.getElementById('labor-logs-tbody'); tb.innerHTML='';
  const totalPages = Math.ceil(filteredLaborLogs.length / LABOR_ITEMS_PER_PAGE) || 1;
  if (currentLaborLogsPage > totalPages) currentLaborLogsPage = totalPages;
  document.getElementById('labor-logs-page-info').innerText = `${currentLaborLogsPage} / ${totalPages}`;
  
  const start = (currentLaborLogsPage - 1) * LABOR_ITEMS_PER_PAGE;
  const pageItems = filteredLaborLogs.slice(start, start + LABOR_ITEMS_PER_PAGE);

  pageItems.forEach(l => { const tr=document.createElement('tr'); tr.innerHTML=`<td>${l.date}</td><td>-${l.filled}</td><td colspan="2" style="font-size:0.85rem;">${l.details||''}</td>`; tb.appendChild(tr); });
}

function prevLaborLogsPage() { if (currentLaborLogsPage > 1) { currentLaborLogsPage--; renderLaborerLogsTable(); } }
function nextLaborLogsPage() { const tp = Math.ceil(filteredLaborLogs.length / LABOR_ITEMS_PER_PAGE); if (currentLaborLogsPage < tp) { currentLaborLogsPage++; renderLaborerLogsTable(); } }


let aImpI='', aImpQ='';
function openImportModal(i,q,m) { aImpI=i; aImpQ=q; document.getElementById('import-qty').value=formatSilver(m); document.getElementById('import-qty').max=m; document.getElementById('import-modal').style.display='block'; }
function closeImportModal() { document.getElementById('import-modal').style.display='none'; }
function submitImportLaborStock() {
  const q=parseNum(document.getElementById('import-qty').value); const m=parseNum(document.getElementById('import-qty').max); const c=document.getElementById('import-city').value;
  if(q<=0||q>m) return; state.laborerInventory[aImpI][aImpQ]-=q; state.inventory[`${aImpI}_${aImpQ}`].qtyByCity[c]+=q; 
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '工人島匯入', item: aImpI, quality: aImpQ, qty: q, total: 0, unitPrice: 0, location: c });
  saveState(); updateDashboardUI(); closeImportModal(); showToast('匯入成功','success');
}

let aSelI='', aSelQ='';
function openSellLaborStockModal(i,q,m) { aSelI=i; aSelQ=q; document.getElementById('sell-qty').value=formatSilver(m); document.getElementById('sell-qty').max=m; document.getElementById('sell-modal').style.display='block'; }
function closeSellLaborStockModal() { document.getElementById('sell-modal').style.display='none'; }
function submitSellLaborStock() {
  const q=parseNum(document.getElementById('sell-qty').value); const m=parseNum(document.getElementById('sell-qty').max); const p=parseNum(document.getElementById('sell-price').value);
  if(q<=0||q>m||p<=0) return; state.laborerInventory[aSelI][aSelQ]-=q; state.assets.cash+=p;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type:'工人島出售', item:aSelI, quality:aSelQ, qty:q, total:p, unitPrice:Math.round(p/q), location:'LaborerIsland' });
  saveState(); updateDashboardUI(); closeSellLaborStockModal(); showToast('套現成功','success');
}

// ==== Ledger ====
function filterLedger(resetPage = true) {
  const qry = document.getElementById('ledger-search')?.value.toLowerCase() || '';
  filteredLedger = state.transactions.map((t, index) => ({...t, originalIndex: index})).filter(t => {
    if (!qry) return true;
    return t.date.includes(qry) || t.type.toLowerCase().includes(qry) || t.item.toLowerCase().includes(qry);
  });
  if (resetPage) currentLedgerPage = 1;
  renderLedgerTable();
}

function renderLedgerTable() {
  const tb = document.getElementById('ledger-tbody'); tb.innerHTML='';
  const totalPages = Math.ceil(filteredLedger.length / LEDGER_ITEMS_PER_PAGE) || 1;
  if (currentLedgerPage > totalPages) currentLedgerPage = totalPages;
  document.getElementById('ledger-page-info').innerText = `${currentLedgerPage} / ${totalPages}`;
  
  const start = (currentLedgerPage - 1) * LEDGER_ITEMS_PER_PAGE;
  const pageItems = filteredLedger.slice(start, start + LEDGER_ITEMS_PER_PAGE);

  pageItems.forEach(t => {
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${t.date}</td><td><span style="color:var(--accent-cyan); font-weight:bold;">${t.type}</span></td><td>${t.item} ${t.quality !== '-' ? '('+t.quality+')':''}</td><td>${t.qty}</td><td>${formatSilver(t.unitPrice)}</td><td style="font-weight:bold; color:${['買','扣','製作入庫','提領','成本校正','庫存刪除'].some(x=>t.type.includes(x))?'var(--accent-red)':'var(--accent-green)'};">${['買','扣','製作入庫','提領','成本校正','庫存刪除'].some(x=>t.type.includes(x))?'-':'+'}${formatSilver(t.total)}</td><td><button class="btn btn-warning" style="padding:4px 8px; font-size:0.8rem;" onclick="openEditLedgerModal(${t.originalIndex})">✏️ 編輯</button></td>`;
    tb.appendChild(tr);
  });
}

function prevLedgerPage() { if (currentLedgerPage > 1) { currentLedgerPage--; renderLedgerTable(); } }
function nextLedgerPage() { const tp = Math.ceil(filteredLedger.length / LEDGER_ITEMS_PER_PAGE); if (currentLedgerPage < tp) { currentLedgerPage++; renderLedgerTable(); } }

let aLedgerIdx = -1;
function openEditLedgerModal(idx) {
  aLedgerIdx = idx; const t = state.transactions[idx];
  document.getElementById('edit-ledger-info').innerText = `${t.date} | ${t.type}`;
  document.getElementById('edit-ledger-item').innerText = `${t.item} ${t.quality !== '-' ? '('+t.quality+')':''}`;
  document.getElementById('edit-ledger-qty').value = formatSilver(t.qty);
  document.getElementById('edit-ledger-total').value = formatSilver(t.total);
  document.getElementById('edit-ledger-modal').style.display='block';
}
function closeEditLedgerModal() { document.getElementById('edit-ledger-modal').style.display='none'; }

function getLedgerCashImpact(type, amt) { if (['買材料', '製作入庫', '提領利潤', '成本校正', '庫存刪除'].some(x => type.includes(x))) return -amt; return amt; }

function applyInventoryDiff(t, qtyDiff) {
  if (qtyDiff === 0) return;
  const k = `${t.item}_${t.quality}`;
  if (['買材料', '庫存校正'].includes(t.type)) {
    if(state.inventory[k]) state.inventory[k].qtyByCity[t.location] += qtyDiff;
  } else if (['賣成品', '庫存刪除'].includes(t.type)) {
    if(state.inventory[k]) state.inventory[k].qtyByCity[t.location] -= qtyDiff;
  } else if (t.type === '工人島出售') {
    if(state.laborerInventory[t.item]) state.laborerInventory[t.item][t.quality] -= qtyDiff;
  } else if (t.type === '製作入庫') {
    if(state.inventory[k]) state.inventory[k].qtyByCity[t.location] += qtyDiff;
  }
}

function submitEditLedger() {
  const nq = parseNum(document.getElementById('edit-ledger-qty').value); const nt = parseNum(document.getElementById('edit-ledger-total').value);
  if(nq < 0 || nt < 0) return showToast('不可為負', 'error');
  const t = state.transactions[aLedgerIdx]; const oldTotal = t.total;
  
  applyInventoryDiff(t, nq - t.qty);
  
  state.assets.cash += (getLedgerCashImpact(t.type, nt) - getLedgerCashImpact(t.type, oldTotal));
  if (t.type === '注資本金') state.assets.debt += (nt - oldTotal);
  if (t.type === '提領利潤') state.assets.debt -= (nt - oldTotal);
  t.qty = nq; t.total = nt; t.unitPrice = nq > 0 ? Math.round(nt / nq) : 0;
  saveState(); closeEditLedgerModal(); showToast('修改成功！庫存均價與數量已回推對齊', 'success');
}

function deleteEditLedger() {
  if (!confirm('確定要刪除此筆紀錄嗎？這將會同步回推並影響您的錢包餘額與庫存數量/均價。')) return;
  const t = state.transactions[aLedgerIdx];
  applyInventoryDiff(t, -t.qty);
  state.assets.cash -= getLedgerCashImpact(t.type, t.total);
  if (t.type === '注資本金') state.assets.debt -= t.total;
  if (t.type === '提領利潤') state.assets.debt += t.total;
  state.transactions.splice(aLedgerIdx, 1);
  saveState(); closeEditLedgerModal(); showToast('已刪除該紀錄，全局資產與庫存已重算', 'success');
}

function adjustWallet(a) {
  const am = parseNum(document.getElementById('wallet-adjust-amt').value) * 1000000; if(am<=0) return;
  if(a==='deposit') { state.assets.cash+=am; state.assets.debt+=am; state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type:'注資本金', item:'-', quality:'-', qty:0, total:am, unitPrice:0, location:'-' }); showToast('注資成功','success'); }
  else { if(state.assets.cash<am) return showToast('餘額不足','error'); state.assets.cash-=am; state.assets.debt-=am; state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type:'提領利潤', item:'-', quality:'-', qty:0, total:am, unitPrice:0, location:'-' }); showToast('提領成功','success'); }
  saveState();
}

function showToast(m, t='success') {
  const nt=document.getElementById('toast-notification'); const ic=document.getElementById('toast-icon');
  document.getElementById('toast-text').innerText=m; ic.className=`toast-icon ${t}`; ic.innerHTML=t==='success'?'✅':'❌'; nt.classList.add('active'); setTimeout(()=>nt.classList.remove('active'),3000);
}

window.onload = () => {
  updateCraftQualityPills();
  updateBuyQualityPills();
  loadState();
  document.getElementById('craft-recipe').value = RECIPES[0].name;
  onRecipeChange();
  updateDashboardUI();
};

function adjCraftQty(d) { let el=document.getElementById('craft-qty'); let v = parseInt(el.value) + d; if(v<1) v=1; el.value = v; runCraftingCalculator(); }
function adjBuyQty(d) { let el=document.getElementById('buy-qty'); let v = parseInt(parseNum(el.value)) + d; if(v<1) v=1; el.value = v; }
function adjustSellCraftedQty(d) {
  let el=document.getElementById('sell-crafted-qty'); let v = parseInt(parseNum(el.value)) + d;
  const max = parseNum(document.getElementById('sell-crafted-max').innerText);
  if(v<1) v=1; if(v>max) v=max; el.value = v; runEstimator();
}

function onBuyItemChange() {
  const item = document.getElementById('buy-item').value;
  const map = {'鋼條': 'Thetford', '布料': 'Lymhurst', '板材': 'Fort Sterling', '皮革': 'Martlock'};
  if (map[item]) { document.getElementById('buy-city').value = map[item]; }
}
document.addEventListener('DOMContentLoaded', () => {
  const bi = document.getElementById('buy-item');
  if(bi) bi.addEventListener('change', onBuyItemChange);
});

// Sell Modal Two-Way Binding
function onSellPriceChange(type) {
  const qty = parseNum(document.getElementById('sell-crafted-qty').value);
  if(qty <= 0) return;
  if (type === 'unit') {
    const unit = parseNum(document.getElementById('sell-crafted-actual').value);
    document.getElementById('sell-crafted-actual-total').value = formatSilver(unit * qty);
  } else if (type === 'total') {
    const total = parseNum(document.getElementById('sell-crafted-actual-total').value);
    document.getElementById('sell-crafted-actual').value = formatSilver(total / qty);
  }
  const act = parseNum(document.getElementById('sell-crafted-actual').value);
  const p = (act - (state.inventory[`${aSellI}_${aSellQ}`].globalAvgCost||0)) * qty;
  const pe = document.getElementById('sell-crafted-profit'); 
  pe.innerText = formatSilver(p); pe.style.color = p>=0 ? 'var(--accent-green)':'var(--accent-red)';
}

function adjustQueueQty(id, delta) {
  const q = craftingQueue.find(x => x.id === id); if(!q) return;
  const nq = q.qty + delta;
  if(nq > 0) {
    q.qty = nq;
    const rra = getRRA(q.recipe.category, q.city, q.focus);
    let returnQty = Math.floor(q.recipe.mainBaseQty * nq * rra); q.mainQty = q.recipe.mainBaseQty * nq - returnQty;
    let returnSubQty = Math.floor(q.recipe.subBaseQty * nq * rra); q.subQty = q.recipe.subBaseQty * nq - returnSubQty;
    renderCraftingQueue(); updateShoppingListTotal();
  }
}

let currentLaborHarvestQual = '8.0';
let currentLaborAddQual = '8.0';

function renderLaborQualityPillsGroup(containerId, activeQuality, callback) {
  const ctn = document.getElementById(containerId); if(!ctn) return;
  ctn.innerHTML = '';
  const pg = document.createElement('div'); pg.className = 'pill-group';
  ['4.0', '5.0', '6.0', '7.0', '8.0'].forEach(q => {
    const btn = document.createElement('button');
    btn.className = `pill-btn ${q === activeQuality ? 'active' : ''}`;
    btn.innerHTML = `T${q.split('.')[0]}`;
    btn.onclick = () => { callback(q); if (containerId === "craft-quality-pill-group") runCraftingCalculator(); };
    pg.appendChild(btn);
  });
  ctn.appendChild(pg);
}

function updateLaborQualityPills() { 
  renderLaborQualityPillsGroup('labor-harvest-pill-group', currentLaborHarvestQual, q => { currentLaborHarvestQual = q; updateLaborQualityPills(); }); 
  renderLaborQualityPillsGroup('labor-add-filled-pill-group', currentLaborAddQual, q => { currentLaborAddQual = q; updateLaborQualityPills(); });
}

let editLaborItem = '';
function openEditLaborModal(item, qual, qty) {
  editLaborItem = item;
  document.getElementById('edit-labor-name').innerText = `${item} (${qual})`;
  document.getElementById('edit-labor-qty').value = qty;
  document.getElementById('edit-labor-modal').style.display='block';
}
function closeEditLaborModal() { document.getElementById('edit-labor-modal').style.display='none'; }
function submitEditLabor() {
  const q = parseNum(document.getElementById('edit-labor-qty').value);
  if(q < 0) return showToast('數量不可為負', 'error');
  const txt = document.getElementById('edit-labor-name').innerText;
  const match = txt.match(/(.+) \((.+)\)/);
  if(!match) return;
  const item = match[1]; const qual = match[2];
  if(!state.laborerInventory[item]) state.laborerInventory[item] = {};
  state.laborerInventory[item][qual] = q; // Pure silent override
  saveState();
  closeEditLaborModal();
  showToast('工人島庫存已無痕校正', 'success');
}

// ==== V3.8 NEW FUNCTIONS ====
function adjustCashBalance() {
  const current = state.assets.cash;
  const userInput = prompt(`目前累計現金流為: ${current.toLocaleString()}\n請輸入『真實的銀幣總額』來校正：`, current);
  if (userInput !== null) {
    const newVal = parseInt(userInput.replace(/,/g, ''), 10);
    if (!isNaN(newVal)) {
      const diff = newVal - current;
      state.assets.cash = newVal;
      state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '現金流校正', item: '-', quality: '-', qty: 1, total: diff, unitPrice: diff, location: '-' });
      saveState();
      showToast('現金流校正成功', 'success');
    }
  }
}

function exportData() {
  const data = {
    inventory: localStorage.getItem('albion_crafting_stocks'),
    assets: localStorage.getItem('albion_crafting_assets'),
    transactions: localStorage.getItem('albion_crafting_transactions'),
    laborerInventory: localStorage.getItem('albion_crafting_laborer_stocks'),
    laborerLogs: localStorage.getItem('albion_crafting_laborer_logs')
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d = new Date();
  a.download = `albion_data_backup_${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.inventory || !data.transactions) {
        alert("匯入失敗：JSON 格式不符或損壞，已中斷操作！");
        return;
      }
      if (confirm("⚠️ 這將會覆寫目前的所有紀錄，確定要匯入嗎？")) {
        localStorage.setItem('albion_crafting_stocks', data.inventory);
        localStorage.setItem('albion_crafting_assets', data.assets);
        localStorage.setItem('albion_crafting_transactions', data.transactions);
        if(data.laborerInventory) localStorage.setItem('albion_crafting_laborer_stocks', data.laborerInventory);
        if(data.laborerLogs) localStorage.setItem('albion_crafting_laborer_logs', data.laborerLogs);
        alert("匯入成功！系統將重新載入。");
        location.reload();
      }
    } catch(err) {
      alert("匯入失敗：JSON 解析錯誤，已中斷操作！");
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset
}

// ==== ITEM SELECTOR MODAL ====
let currentSelectorTab = '戰士 Warrior';

function openItemSelector() {
  document.getElementById('item-search').value = '';
  document.getElementById('item-selector-modal').style.display = 'block';
  renderItemSelectorTabs();
  renderItemSelectorGrid(currentSelectorTab);
}
function closeItemSelector() {
  document.getElementById('item-selector-modal').style.display = 'none';
}

function renderItemSelectorTabs() {
  const tabs = document.getElementById('item-selector-tabs');
  tabs.innerHTML = '';
  const tabOrder = ['戰士 Warrior', '獵人 Hunter', '法師 Mage', '身體護甲 Body Armor', '頭部護甲 Head Armor', '足部護甲 Foot Armor', '副手武器 Off-Hand'];
  for (let cat of tabOrder) {
    if (!ALBION_DB[cat]) continue;
    const btn = document.createElement('div');
    const parts = cat.split(' ');
    const cn = parts[0];
    const en = parts.slice(1).join(' ');
    btn.innerHTML = `${cn}<br><span style="font-size: 0.8em; opacity: 0.7;">${en}</span>`;
    btn.style.padding = '10px 15px';
    btn.style.cursor = 'pointer';
    btn.style.borderBottom = '1px solid var(--border-glass)';
    btn.style.color = cat === currentSelectorTab ? 'var(--accent-cyan)' : 'var(--text-secondary)';
    btn.style.fontWeight = cat === currentSelectorTab ? 'bold' : 'normal';
    btn.style.lineHeight = '1.3';
    btn.style.textAlign = 'center';
    btn.onclick = () => {
      currentSelectorTab = cat;
      document.getElementById('item-search').value = '';
      renderItemSelectorTabs();
      renderItemSelectorGrid(cat);
    };
    tabs.appendChild(btn);
  }
}

function renderItemSelectorGrid(catOrItems) {
  const grid = document.getElementById('item-selector-grid');
  grid.innerHTML = '';
  if (Array.isArray(catOrItems)) {
    const div = document.createElement('div');
    div.style.display = 'grid'; div.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))'; div.style.gap = '10px';
    catOrItems.forEach(item => {
      const btn = document.createElement('button'); btn.className = 'btn btn-secondary';
      btn.style.padding = '10px'; btn.style.display = 'flex'; btn.style.flexDirection = 'column'; btn.style.alignItems = 'center'; btn.style.gap = '5px';
      btn.innerHTML = `<span style="color:var(--accent-cyan); font-weight:bold;">${item.name}</span><br><span style="font-size:0.8em; opacity:0.7; color:var(--text-secondary);">${item.id}</span>`;
      btn.onclick = () => selectCraftingRecipe(item);
      div.appendChild(btn);
    });
    grid.appendChild(div);
  } else {
    const catObj = ALBION_DB[catOrItems];
    if (!catObj) return;
    
    for (let branch in catObj) {
      if (!catObj[branch] || !catObj[branch].items) continue;

      const bHead = document.createElement('div'); 
      const parts = branch.split(' ');
      const cn = parts[0];
      const en = parts.slice(1).join(' ');
      bHead.innerHTML = `${cn} <span style="font-size:0.8em; opacity:0.7;">${en}</span>`;
      bHead.style.color = 'var(--accent-purple)'; 
      bHead.style.marginTop = '15px'; 
      bHead.style.marginBottom = '10px';
      bHead.style.fontWeight = 'bold';
      grid.appendChild(bHead);
      
      const div = document.createElement('div'); 
      div.style.display = 'grid'; 
      div.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))'; 
      div.style.gap = '10px'; 
      div.style.marginBottom = '15px';
      
      catObj[branch].items.forEach(item => {
        const btn = document.createElement('button'); btn.className = 'btn btn-secondary'; btn.style.padding = '10px'; btn.style.display = 'flex'; btn.style.flexDirection = 'column'; btn.style.alignItems = 'center'; btn.style.gap = '5px';
        btn.innerHTML = `<span style="color:var(--accent-cyan); font-weight:bold;">${item.name}</span><br><span style="font-size:0.8em; opacity:0.7; color:var(--text-secondary);">${item.id}</span>`;
        btn.onclick = () => selectCraftingRecipe(item);
        div.appendChild(btn);
      });
      grid.appendChild(div);
    }
  }
}

function searchItems(q) {
  if (!q) {
    renderItemSelectorTabs();
    renderItemSelectorGrid(currentSelectorTab);
    return;
  }
  const lowQ = q.toLowerCase();
  const all = getAllRecipes();
  const matches = all.filter(item => {
    if (item.name.toLowerCase().includes(lowQ)) return true;
    if (item.aliases && item.aliases.some(a => a.toLowerCase().includes(lowQ))) return true;
    return false;
  });
  renderItemSelectorGrid(matches);
}

function selectCraftingRecipe(item) {
  document.getElementById('craft-recipe').value = item.name;
  document.getElementById('craft-recipe-display').innerText = item.name;
  closeItemSelector();
  onRecipeChange();
  
  if (item.artifactVal > 0) {
    showToast(`提示：【${item.name}】需要神器材料，請注意估算成本！`, 'success');
  }
}

// ==== V3.9 FOCUS RRR & CUSTOM LOCATIONS ====
function estimateFocusRRR(b) {
  const baseRF = (18 + b) * 100;
  const focusRF = baseRF + 10000;
  const focusRRR = (focusRF / (10000 + focusRF)) * 100;
  return parseFloat(focusRRR.toFixed(1));
}

function onMapBonusInput() {
  const b = parseNum(document.getElementById('hideout-map-bonus').value);
  document.getElementById('hideout-focus-rrr').value = estimateFocusRRR(b);
  runCraftingCalculator();
}

const SYSTEM_CITIES_ARR = [
  {id: 'Thetford', name: 'Thetford (紫城)'},
  {id: 'Martlock', name: 'Martlock (藍城)'},
  {id: 'Bridgewatch', name: 'Bridgewatch (沙城)'},
  {id: 'Lymhurst', name: 'Lymhurst (綠城)'},
  {id: 'Fort Sterling', name: 'Fort Sterling (白城)'}
];

function renderCityDropdowns() {
  const allCities = [...SYSTEM_CITIES_ARR, ...state.customLocations.map(c => ({id: c, name: c + ' (黑區自訂)'}))];
  
  const generateOptions = (withEmpty, withLaborer, withAdd) => {
    let html = '';
    if (withEmpty) html += `<option value="">請選擇...</option>`;
    if (withLaborer) html += `<option value="LaborerIsland">工人島倉庫</option>`;
    html += allCities.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
    if (withAdd) html += `<option value="__ADD_CUSTOM__" style="color:var(--accent-purple); font-weight:bold;">[+] 新增自訂倉庫...</option>`;
    return html;
  };
  
  const cCraft = document.getElementById('craft-city').value;
  const cBuy = document.getElementById('buy-city').value;
  const cFrom = document.getElementById('trans-from').value;
  const cTo = document.getElementById('trans-to').value;
  const cImport = document.getElementById('import-city').value;

  document.getElementById('craft-city').innerHTML = generateOptions(false, false, true);
  document.getElementById('buy-city').innerHTML = generateOptions(false, false, true);
  document.getElementById('trans-from').innerHTML = generateOptions(true, true, false);
  document.getElementById('trans-to').innerHTML = generateOptions(false, true, true);
  document.getElementById('import-city').innerHTML = generateOptions(false, false, true);
  
  if(cCraft) document.getElementById('craft-city').value = cCraft;
  if(cBuy) document.getElementById('buy-city').value = cBuy;
  if(cFrom) document.getElementById('trans-from').value = cFrom;
  if(cTo) document.getElementById('trans-to').value = cTo;
  if(cImport) document.getElementById('import-city').value = cImport;
}

function handleCityDropdownChange(event) {
  const targetId = event.target.id;
  if (event.target.value === '__ADD_CUSTOM__') {
    openCustomLocationModal('add', '', function(newName) {
      if (!newName || newName.trim() === '') {
        document.getElementById(targetId).selectedIndex = 0;
        if (targetId === 'craft-city') onCityChange();
        return;
      }
      const name = newName.trim();
      if (!state.customLocations.includes(name)) {
        state.customLocations.push(name);
        for (let key in state.inventory) { 
           if(!state.inventory[key].qtyByCity) state.inventory[key].qtyByCity = {};
           state.inventory[key].qtyByCity[name] = 0; 
        }
        saveState();
        renderCityDropdowns();
        document.getElementById(targetId).value = name;
        if (targetId === 'craft-city') onCityChange();
        if (targetId === 'trans-to' || targetId === 'trans-from') {
           if(typeof updateTransItemOptions === 'function') updateTransItemOptions();
        }
        showToast('新增自訂倉庫成功', 'success');
      } else {
        showToast('倉庫名稱已存在', 'error');
        document.getElementById(targetId).selectedIndex = 0;
        if (targetId === 'craft-city') onCityChange();
      }
    }, function() {
        document.getElementById(targetId).selectedIndex = 0;
        if (targetId === 'craft-city') onCityChange();
    });
  } else {
    if (targetId === 'craft-city') onCityChange();
    if (targetId === 'trans-from' || targetId === 'trans-to') {
       if(typeof updateTransItemOptions === 'function' && targetId === 'trans-from') updateTransItemOptions();
    }
  }
}

function openManageLocationsModal() {
  const list = document.getElementById('manage-locations-list');
  list.innerHTML = '';
  if (state.customLocations.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);">目前沒有任何自訂倉庫。</div>';
  } else {
    state.customLocations.forEach(loc => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      div.style.padding = '10px';
      div.style.background = 'rgba(255,255,255,0.05)';
      div.style.borderRadius = '5px';
      
      const span = document.createElement('span');
      span.style.fontWeight = 'bold'; span.style.color = 'var(--accent-cyan)';
      span.textContent = loc;
      
      const btnDiv = document.createElement('div');
      btnDiv.style.display = 'flex'; btnDiv.style.gap = '5px';
      
      const btnRename = document.createElement('button');
      btnRename.className = 'btn btn-warning'; btnRename.style.padding = '4px 8px'; btnRename.style.fontSize = '0.8rem';
      btnRename.innerHTML = '✏️ 更名';
      btnRename.onclick = () => renameLocation(loc);
      
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn btn-danger'; btnDelete.style.padding = '4px 8px'; btnDelete.style.fontSize = '0.8rem';
      btnDelete.innerHTML = '🗑️ 刪除';
      btnDelete.onclick = () => deleteLocation(loc);
      
      btnDiv.appendChild(btnRename); btnDiv.appendChild(btnDelete);
      div.appendChild(span); div.appendChild(btnDiv);
      list.appendChild(div);
    });
  }
  document.getElementById('manage-locations-modal').style.display = 'block';
}

function closeManageLocationsModal() { document.getElementById('manage-locations-modal').style.display = 'none'; }

function renameLocation(oldName) {
  openCustomLocationModal('edit', oldName, function(newName) {
    if (!newName || newName.trim() === '' || newName === oldName) return;
    const name = newName.trim();
    if (state.customLocations.includes(name)) return showToast('名稱已存在', 'error');
    
    const idx = state.customLocations.indexOf(oldName);
    if (idx > -1) state.customLocations[idx] = name;
    
    for (let k in state.inventory) {
      if(state.inventory[k].qtyByCity[oldName] !== undefined) {
        state.inventory[k].qtyByCity[name] = state.inventory[k].qtyByCity[oldName] || 0;
        delete state.inventory[k].qtyByCity[oldName];
      }
    }
    state.transactions.forEach(t => { if (t.location === oldName) t.location = name; });
    
    saveState(); renderCityDropdowns(); openManageLocationsModal(); updateDashboardUI();
    showToast('更名成功，庫存已無損轉移', 'success');
  });
}

function deleteLocation(name) {
  if (!confirm(`警告：確定要刪除倉庫「${name}」嗎？\n如果裡面還有庫存，該庫存將永遠遺失！`)) return;
  state.customLocations = state.customLocations.filter(c => c !== name);
  for (let k in state.inventory) { delete state.inventory[k].qtyByCity[name]; }
  saveState(); renderCityDropdowns(); openManageLocationsModal(); updateDashboardUI();
  showToast('已刪除自訂倉庫', 'success');
}

function adjustEditModalQty(amt) {
    const inp = document.getElementById('edit-queue-qty-input');
    let val = parseInt(inp.value) || 0;
    val += amt;
    if (val < 1) val = 1;
    inp.value = val;
}
// ==== WINDOW BINDING (Phase 1 緩衝機制) ====
window.switchTab = switchTab;
window.exportData = exportData;
window.importData = importData;
window.resetSystemData = resetSystemData;
window.adjustCashBalance = adjustCashBalance;
window.openItemSelector = openItemSelector;
window.closeItemSelector = closeItemSelector;
window.searchItems = searchItems;
window.adjCraftQty = adjCraftQty;
window.handleCityDropdownChange = handleCityDropdownChange;
window.onMapBonusInput = onMapBonusInput;
window.runCraftingCalculator = runCraftingCalculator;
window.addToCraftingQueue = addToCraftingQueue;
window.toggleQueueAll = toggleQueueAll;
window.updateShoppingListTotal = updateShoppingListTotal;
window.submitCraftAll = submitCraftAll;
window.adjBuyQty = adjBuyQty;
window.submitPurchase = submitPurchase;
window.updateTransMax = updateTransMax;
window.adjustTransQty = adjustTransQty;
window.setTransQtyMax = setTransQtyMax;
window.submitTransport = submitTransport;
window.openManageLocationsModal = openManageLocationsModal;
window.closeManageLocationsModal = closeManageLocationsModal;
window.renderInventoryTable = renderInventoryTable;
window.adjHarvestQty = adjHarvestQty;
window.addLaborItemRow = addLaborItemRow;
window.submitLaborHarvest = submitLaborHarvest;
window.submitAddFilledJournals = submitAddFilledJournals;
window.prevLaborLogsPage = prevLaborLogsPage;
window.nextLaborLogsPage = nextLaborLogsPage;
window.filterLedger = filterLedger;
window.prevLedgerPage = prevLedgerPage;
window.nextLedgerPage = nextLedgerPage;
window.closeImportModal = closeImportModal;
window.submitImportLaborStock = submitImportLaborStock;
window.closeSellLaborStockModal = closeSellLaborStockModal;
window.submitSellLaborStock = submitSellLaborStock;
window.closeSellCraftedModal = closeSellCraftedModal;
window.runEstimator = runEstimator;
window.adjustSellCraftedQty = adjustSellCraftedQty;
window.onSellPriceChange = onSellPriceChange;
window.submitSellCrafted = submitSellCrafted;
window.closeEditInventoryModal = closeEditInventoryModal;
window.onEditCityChange = onEditCityChange;
window.submitEditInventory = submitEditInventory;
window.deleteEditInventory = deleteEditInventory;
window.submitCustomLocation = submitCustomLocation;
window.closeCustomLocationModal = closeCustomLocationModal;
window.closeEditLaborModal = closeEditLaborModal;
window.submitEditLabor = submitEditLabor;
window.closeEditLedgerModal = closeEditLedgerModal;
window.submitEditLedger = submitEditLedger;
window.deleteEditLedger = deleteEditLedger;
window.closeModal = closeModal;
window.adjustEditModalQty = adjustEditModalQty;
window.confirmEditQueueQty = confirmEditQueueQty;
window.confirmDeleteQueue = confirmDeleteQueue;
window.updateDashboardUI = updateDashboardUI;
window.renderCityDropdowns = renderCityDropdowns;
window.toggleQueueItem = toggleQueueItem;
window.updateQueueArtPrice = updateQueueArtPrice;
window.updateQueueAlcPrice = updateQueueAlcPrice;
window.editQueueQty = editQueueQty;
window.removeFromQueue = removeFromQueue;
window.openSellCraftedModal = openSellCraftedModal;
window.openEditInventoryModal = openEditInventoryModal;
window.openEditLaborModal = openEditLaborModal;
window.openSellLaborStockModal = openSellLaborStockModal;
window.openImportModal = openImportModal;
window.openEditLedgerModal = openEditLedgerModal;