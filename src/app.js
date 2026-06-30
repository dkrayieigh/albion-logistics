import { escapeHTML, formatSilver, parseNum } from './utils/formatters.js';
import {
  state,
  enableNewSchemaRuntime,
  initializeNewSchemaRuntime,
  loadState,
  currentCraftQuality,
  setCurrentCraftQuality,
  currentBuyQuality,
  setCurrentBuyQuality,
  addCustomLocation,
  saveState
} from './core/state.js';

import * as Crafting from './components/crafting.js';
import * as Inventory from './components/inventory.js';
import * as Laborer from './components/laborer.js';
import * as Ledger from './components/ledger.js';
import * as Quotation from './components/quotation.js';
import * as WindowControls from './components/window-controls.js';
import { createBrowserNewSchemaRepository } from './adapters/browserNewSchemaRepository.js';
import { createBrowserStorageBackend } from './adapters/browserStorageBackend.js';
import { parseBackup } from './adapters/newSchemaBackupCodec.js';
import { restoreBackup } from './services/newSchemaBackupImportService.js';
import { createBackupFromRepository } from './services/newSchemaBackupExportService.js';

// ==========================================
// 全域共用 UI 函式
// ==========================================
const QUALITY_MATRIX_ROWS = [
  ['4.0', '4.1', '4.2', '4.3', '4.4'],
  ['5.0', '5.1', '5.2', '5.3', '5.4'],
  ['6.0', '6.1', '6.2', '6.3', '6.4'],
  ['7.0', '7.1', '7.2', '7.3', '7.4'],
  ['8.0', '8.1', '8.2', '8.3', '8.4']
];
let productionStorageMode = 'uninitialized';

function showToast(m, t='success') {
  const nt=document.getElementById('toast-notification'); const ic=document.getElementById('toast-icon');
  document.getElementById('toast-text').innerText=m; ic.className=`toast-icon ${t}`; ic.innerHTML=t==='success'?'✅':'❌'; nt.classList.add('active'); setTimeout(()=>nt.classList.remove('active'),3000);
}
window.showToast = showToast;

function switchTab(tId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(tId).classList.add('active');
  const n = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick').includes(tId));
  if(n) n.classList.add('active');
}

function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }

function resetSystemData() {
  if (confirm('⚠️ 警告：這將會清除您所有的庫存、流水帳與設定資料，且無法復原！\n確定要清空嗎？')) {
    localStorage.clear(); location.reload();
  }
}

// 供 Crafting 與 App 共用的品質藥丸渲染
function setTierHintVisibility(elementId, visible) {
  const hint = document.getElementById(elementId);
  if (hint) hint.style.display = visible ? '' : 'none';
}

export function renderQualityPillsGroup(containerId, activeQuality, callback) {
  const ctn = document.getElementById(containerId); ctn.innerHTML = '';
  const matrix = document.createElement('div');
  matrix.className = 'quality-matrix';
  QUALITY_MATRIX_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'quality-matrix-row';
    row.forEach(q => {
      const btn = document.createElement('button');
      btn.className = `pill-btn ${q === activeQuality ? 'active' : ''}`;
      btn.textContent = q;
      btn.onclick = () => { callback(q); if (containerId === "craft-quality-pill-group") Crafting.runCraftingCalculator(); };
      rowEl.appendChild(btn);
    });
    matrix.appendChild(rowEl);
  });
  ctn.appendChild(matrix);
}

// 修正：使用 Setter 函式更新狀態，而不是直接綁在 window 上
function updateCraftQualityPills() { setTierHintVisibility('craft-tier-hint', !currentCraftQuality); renderQualityPillsGroup('craft-quality-pill-group', currentCraftQuality, q => { setCurrentCraftQuality(q); updateCraftQualityPills(); Crafting.runCraftingCalculator(); }); }
function updateBuyQualityPills() { setTierHintVisibility('buy-tier-hint', !currentBuyQuality); renderQualityPillsGroup('buy-quality-pill-group', currentBuyQuality, q => { setCurrentBuyQuality(q); updateBuyQualityPills(); }); }
// 共用城市下拉選單邏輯
const SYSTEM_CITIES_ARR = [
  {id: 'Thetford', name: 'Thetford 紫城'}, {id: 'Martlock', name: 'Martlock 藍城'}, {id: 'Bridgewatch', name: 'Bridgewatch 黃城'}, {id: 'Lymhurst', name: 'Lymhurst 綠城'}, {id: 'Fort Sterling', name: 'Fort Sterling 白城'}
];

function renderCityDropdowns() {
  const allCities = [...SYSTEM_CITIES_ARR, ...state.customLocations.map(c => ({id: c, name: c + ' (黑區自訂)'}))];
  const generateOptions = (withEmpty, withLaborer) => {
    let html = '';
    if (withEmpty) html += `<option value="">請選擇...</option>`;
    if (withLaborer) html += `<option value="LaborerIsland">工人島倉庫</option>`;
    html += allCities.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
    return html;
  };
  
  const cCraft = document.getElementById('craft-city').value; const cQuote = document.getElementById('quote-city')?.value; const cBuy = document.getElementById('buy-city').value;
  const cFrom = document.getElementById('trans-from').value; const cTo = document.getElementById('trans-to').value; const cImport = document.getElementById('import-city').value;

  document.getElementById('craft-city').innerHTML = generateOptions(false, false); if (document.getElementById('quote-city')) document.getElementById('quote-city').innerHTML = generateOptions(false, false); document.getElementById('buy-city').innerHTML = generateOptions(false, false); document.getElementById('trans-from').innerHTML = generateOptions(true, true); document.getElementById('trans-to').innerHTML = generateOptions(false, true); document.getElementById('import-city').innerHTML = generateOptions(false, false);
  
  if(cCraft) document.getElementById('craft-city').value = cCraft; if(cQuote) document.getElementById('quote-city').value = cQuote; if(cBuy) document.getElementById('buy-city').value = cBuy; if(cFrom) document.getElementById('trans-from').value = cFrom; if(cTo) document.getElementById('trans-to').value = cTo; if(cImport) document.getElementById('import-city').value = cImport;
}

function onCityChange() {
  const city = document.getElementById('craft-city').value;
  document.getElementById('hideout-group').style.display = state.customLocations.includes(city) ? 'flex' : 'none';
  Crafting.runCraftingCalculator();
}

function formatCustomLocationError(result) {
  if (result.errors.includes('DUPLICATE_CUSTOM_LOCATION_NAME')) return '倉庫名稱已存在';
  if (result.errors.includes('SYSTEM_LOCATION_NAME_CONFLICT')) return '倉庫名稱不可與系統城市重複';
  if (result.errors.includes('INVALID_CUSTOM_LOCATION_NAME')) return '倉庫名稱不可空白';
  if (result.errors.includes('CUSTOM_LOCATION_ID_GENERATION_FAILED')) return '自訂倉庫 ID 產生失敗';
  if (result.status === 'save-failed') return '自訂倉庫儲存失敗';
  return '新增自訂倉庫失敗';
}

function addLegacyCustomLocation(name) {
  if (state.customLocations.includes(name)) {
    return { ok: false, status: 'invalid-location', errors: ['DUPLICATE_CUSTOM_LOCATION_NAME'] };
  }

  state.customLocations.push(name);
  for (let key in state.inventory) {
    if(!state.inventory[key].qtyByCity) state.inventory[key].qtyByCity = {};
    state.inventory[key].qtyByCity[name] = 0;
  }

  const saved = saveState();
  if (!saved.ok) return { ok: false, status: 'save-failed', errors: saved.errors };
  return { ok: true, status: 'location-added', errors: [] };
}

function handleCityDropdownChange(event) {
  const targetId = event.target.id;
  if (event.target.value === '__ADD_CUSTOM__') {
    Inventory.openCustomLocationModal('add', '', function(newName) {
      if (!newName || newName.trim() === '') { document.getElementById(targetId).selectedIndex = 0; if (targetId === 'craft-city') onCityChange(); return; }
      const name = newName.trim();
      const result = state.locationRegistry ? addCustomLocation(name) : addLegacyCustomLocation(name);
      if (result.ok) {
        renderCityDropdowns(); document.getElementById(targetId).value = name;
        if (targetId === 'craft-city') onCityChange();
        if (targetId === 'trans-to' || targetId === 'trans-from') Inventory.updateTransItemOptions();
        showToast('新增自訂倉庫成功', 'success');
      } else {
        showToast(formatCustomLocationError(result), 'error'); document.getElementById(targetId).selectedIndex = 0; if (targetId === 'craft-city') onCityChange();
      }
    }, function() { document.getElementById(targetId).selectedIndex = 0; if (targetId === 'craft-city') onCityChange(); });
  } else {
    if (targetId === 'craft-city') onCityChange();
    if (targetId === 'trans-from' || targetId === 'trans-to') if (targetId === 'trans-from') Inventory.updateTransItemOptions();
  }
}

// 資料匯出匯入
function createLegacyBackupText() {
  const data = { inventory: JSON.parse(localStorage.getItem('albion_crafting_stocks') || '{}'), assets: JSON.parse(localStorage.getItem('albion_crafting_assets') || '{}'), transactions: JSON.parse(localStorage.getItem('albion_crafting_transactions') || '[]'), laborerInventory: JSON.parse(localStorage.getItem('albion_crafting_laborer_stocks') || '{}'), laborerLogs: JSON.parse(localStorage.getItem('albion_crafting_laborer_logs') || '[]'), customLocations: JSON.parse(localStorage.getItem('albion_crafting_custom_locs') || '[]') };
  return JSON.stringify(data, null, 2);
}

function formatExportError(errors) {
  const codes = Array.isArray(errors) && errors.length > 0 ? errors.join(', ') : 'EXPORT_BLOCKED';
  return `備份匯出失敗：${codes}`;
}

function formatImportError(errors, innerErrors = []) {
  const codes = [
    ...(Array.isArray(errors) ? errors : []),
    ...(Array.isArray(innerErrors) ? innerErrors : [])
  ];
  return `匯入失敗：${codes.length > 0 ? codes.join(', ') : 'IMPORT_FAILED'}`;
}

function createV2BackupText(now) {
  const created = createBrowserNewSchemaRepository(localStorage);
  if (!created.ok) return { ok: false, errors: created.errors };

  const backup = createBackupFromRepository(created.repository, {
    exportedAt: now.toISOString()
  });
  if (!backup.ok) {
    return {
      ok: false,
      errors: [...backup.errors, ...backup.innerErrors]
    };
  }

  return { ok: true, backupText: backup.backupText, errors: [] };
}

function createBackupTextForCurrentMode(now) {
  if (productionStorageMode === 'legacy') return { ok: true, backupText: createLegacyBackupText(), errors: [] };
  if (productionStorageMode === 'v2') return createV2BackupText(now);
  return { ok: false, errors: [`EXPORT_MODE_${productionStorageMode.toUpperCase()}`] };
}

async function writeBackupText(backupText, filename) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (invoke) {
    const path = await invoke('plugin:dialog|save', { options: { defaultPath: filename, filters: [{ name: 'JSON', extensions: ['json'] }] } });
    if (!path) return false;
    await invoke('plugin:fs|write_text_file', new TextEncoder().encode(backupText), { headers: { path: encodeURIComponent(path), options: JSON.stringify(undefined) } });
    return true;
  }

  const blob = new Blob([backupText], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  return true;
}

async function exportData() {
  if (!confirm('確定要匯出目前的系統資料嗎？')) return;
  const d = new Date(); const pad = value => value.toString().padStart(2, '0'); const filename = `albion_data_backup_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
  const backup = createBackupTextForCurrentMode(d);
  if (!backup.ok) return window.showToast(formatExportError(backup.errors), 'error');
  try {
    const wrote = await writeBackupText(backup.backupText, filename);
    if (!wrote) return;
  } catch (err) {
    return window.showToast(`備份匯出失敗：${err}`, 'error');
  }
  window.showToast('資料匯出成功！', 'success');
}

function importLegacyBackupText(text) {
  const classified = parseBackup(text);
  if (!classified.ok) return alert(formatImportError(classified.errors, classified.innerErrors));
  if (classified.status === 'v2') return alert("匯入失敗：JSON 格式不符或損壞，已中斷操作！");

  try {
    const data = classified.legacyPayload;
    const parseBackupField = value => typeof value === 'string' ? JSON.parse(value) : value;
    const inventory = parseBackupField(data.inventory); const assets = parseBackupField(data.assets); const transactions = parseBackupField(data.transactions);
    const laborerInventory = Object.hasOwn(data, 'laborerInventory') ? parseBackupField(data.laborerInventory) : undefined; const laborerLogs = Object.hasOwn(data, 'laborerLogs') ? parseBackupField(data.laborerLogs) : undefined; const customLocations = Object.hasOwn(data, 'customLocations') ? parseBackupField(data.customLocations) : undefined;
    if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory) || !assets || typeof assets !== 'object' || Array.isArray(assets) || !Array.isArray(transactions)) return alert("匯入失敗：JSON 格式不符或損壞，已中斷操作！");
    if ((laborerInventory !== undefined && (!laborerInventory || typeof laborerInventory !== 'object' || Array.isArray(laborerInventory))) || (laborerLogs !== undefined && !Array.isArray(laborerLogs)) || (customLocations !== undefined && !Array.isArray(customLocations))) return alert("匯入失敗：JSON 格式不符或損壞，已中斷操作！");
    if (confirm("⚠️ 這將會覆寫目前的所有紀錄，確定要匯入嗎？")) {
      localStorage.setItem('albion_crafting_stocks', JSON.stringify(inventory)); localStorage.setItem('albion_crafting_assets', JSON.stringify(assets)); localStorage.setItem('albion_crafting_transactions', JSON.stringify(transactions));
      if(laborerInventory !== undefined) localStorage.setItem('albion_crafting_laborer_stocks', JSON.stringify(laborerInventory));
      if(laborerLogs !== undefined) localStorage.setItem('albion_crafting_laborer_logs', JSON.stringify(laborerLogs));
      if(customLocations !== undefined) localStorage.setItem('albion_crafting_custom_locs', JSON.stringify(customLocations));
      alert("匯入成功！系統將重新載入。"); location.reload();
    }
  } catch(err) { alert("匯入失敗：JSON 解析錯誤，已中斷操作！"); }
}

function importV2BackupText(text) {
  const parsed = parseBackup(text);
  if (!parsed.ok) return alert(formatImportError(parsed.errors, parsed.innerErrors));
  if (parsed.status === 'legacy') return alert(formatImportError(['LEGACY_BACKUP_REQUIRES_LEGACY_PATH']));
  if (!confirm("⚠️ 這將會覆寫目前的新版資料；legacy 資料不會被修改。成功後系統將重新載入。\n確定要匯入嗎？")) return;

  const binding = createBrowserStorageBackend(localStorage);
  if (!binding.ok) return alert(formatImportError(binding.errors));

  const result = restoreBackup(binding.backend, text);
  if (!result.ok || result.status !== 'committed') {
    return alert(formatImportError(result.errors, result.innerErrors));
  }

  alert("匯入成功！系統將重新載入。");
  location.reload();
}

function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  if (productionStorageMode !== 'legacy' && productionStorageMode !== 'v2') {
    alert(formatImportError([`IMPORT_MODE_${productionStorageMode.toUpperCase()}`]));
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      if (productionStorageMode === 'legacy') importLegacyBackupText(evt.target.result);
      else importV2BackupText(evt.target.result);
    } finally {
      e.target.value = '';
    }
  };
  reader.onerror = function() {
    alert(formatImportError(['IMPORT_READ_FAILED']));
    e.target.value = '';
  };
  reader.readAsText(file);
}

const DECIMAL_RATE_INPUT_IDS = new Set([
  'hideout-map-bonus',
  'hideout-focus-rrr',
  'quote-hideout-map-bonus',
  'quote-hideout-focus-rrr'
]);

function isFormatNumInput(target) {
  return target?.classList?.contains('format-num');
}

function cleanNumericInputValue(value) {
  const cleaned = String(value || '').replace(/[^\d,.-]/g, '');
  const negative = cleaned.trim().startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');
  const [integerPart, ...decimalParts] = unsigned.split('.');
  const decimal = decimalParts.length > 0 ? `.${decimalParts.join('')}` : '';
  return `${negative ? '-' : ''}${integerPart}${decimal}`;
}

function formatNumericInput(input) {
  if (!input || DECIMAL_RATE_INPUT_IDS.has(input.id)) return;
  const raw = cleanNumericInputValue(input.value);
  if (raw === '' || raw === '-') return;
  input.value = formatSilver(parseNum(raw));
}

// === 全局事件監聽：輸入時不重排千分位，blur/change 才格式化 ===
document.addEventListener('input', function(e) {
  if (isFormatNumInput(e.target)) {
    const input = e.target;
    const cleaned = cleanNumericInputValue(input.value);
    if (input.value !== cleaned) input.value = cleaned;
  }
});

document.addEventListener('change', function(e) {
  if (isFormatNumInput(e.target)) formatNumericInput(e.target);
});

document.addEventListener('blur', function(e) {
  if (isFormatNumInput(e.target)) formatNumericInput(e.target);
}, true);
export function initGlobalEvents() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const tId = e.currentTarget.getAttribute('data-target');
      if (tId) switchTab(tId);
    });
  });

  document.getElementById('btn-export-data')?.addEventListener('click', exportData);
  document.getElementById('import-file')?.addEventListener('change', importData);
  document.getElementById('btn-import-data')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });
  document.getElementById('btn-reset-system')?.addEventListener('click', resetSystemData);

  document.getElementById('craft-city')?.addEventListener('change', handleCityDropdownChange);
  document.getElementById('quote-city')?.addEventListener('change', handleCityDropdownChange);
  document.getElementById('buy-city')?.addEventListener('change', handleCityDropdownChange);
  document.getElementById('trans-from')?.addEventListener('change', handleCityDropdownChange);
  document.getElementById('trans-to')?.addEventListener('change', handleCityDropdownChange);
  document.getElementById('import-city')?.addEventListener('change', handleCityDropdownChange);

  // Catch-all for modals if not caught in components
  document.querySelectorAll('button[id^="btn-close-"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.currentTarget.closest('[id$="-modal"]');
      if (modal) modal.style.display = 'none';
    });
  });

 // 接收來自 Core 的狀態更新廣播，動態渲染下拉選單與各組件表格
  document.addEventListener('stateUpdated', () => {
    renderCityDropdowns();
    if (Ledger.updateDashboardUI) Ledger.updateDashboardUI();
    if (Inventory.renderInventoryTable) Inventory.renderInventoryTable();
    if (Laborer.renderLaborerTable) Laborer.renderLaborerTable();
    if (Laborer.filterLaborLogs) Laborer.filterLaborLogs();
    if (Laborer.updateLaborQualityPills) Laborer.updateLaborQualityPills();
  });
}

export function applyInputAutocompletePolicy() {
  document.querySelectorAll('input').forEach(input => {
    input.setAttribute('autocomplete', 'off');
    if (input.classList.contains('format-num')) input.setAttribute('inputmode', 'decimal');
    if (input.type === 'number') input.setAttribute('inputmode', 'numeric');
  });
  document.getElementById('item-search')?.setAttribute('inputmode', 'search');
}

const NEW_SCHEMA_INITIALIZATION_CONFIRM_MESSAGE = `找不到新版資料。

是否建立全新的新版資料庫？

舊版庫存、交易與設定不會自動匯入，也不會被刪除。
新版將從現金 0、空交易與空庫存開始，資料可在系統內重新輸入。`;

function formatBlockedMessage(errors) {
  return `新版資料無法安全載入。系統已停止載入資料，避免覆寫。請保留現有資料並回報錯誤代碼：${errors.join(', ')}`;
}

export function startApplicationState(storage, dialogs = {}) {
  const confirmEnableNewSchema = dialogs.confirmEnableNewSchema || (() => window.confirm(NEW_SCHEMA_INITIALIZATION_CONFIRM_MESSAGE));
  const showBlockedError = dialogs.showBlockedError || (errors => window.alert(formatBlockedMessage(errors)));
  const startup = enableNewSchemaRuntime(storage);

  if (startup.ok && startup.mode === 'ready') {
    productionStorageMode = 'v2';
    return startup;
  }

  if (startup.ok && startup.mode === 'initialize') {
    if (confirmEnableNewSchema()) {
      const initialized = initializeNewSchemaRuntime(storage);
      if (initialized.ok && initialized.mode === 'ready') {
        productionStorageMode = 'v2';
        return initialized;
      }
      productionStorageMode = 'blocked';
      showBlockedError(initialized.errors);
      return initialized;
    }

    loadState();
    productionStorageMode = 'legacy';
    return {
      ok: true,
      mode: 'legacy',
      state: null,
      sourceStatus: 'user-cancelled',
      errors: []
    };
  }

  productionStorageMode = 'blocked';
  showBlockedError(startup.errors);
  return startup;
}

window.onload = () => {
  WindowControls.initWindowControls();
  initGlobalEvents();
  Crafting.initCraftingEvents();
  Quotation.initQuotationEvents();
  Inventory.initInventoryEvents();
  Laborer.initLaborerEvents();
  Ledger.initLedgerEvents();
  applyInputAutocompletePolicy();
  
  updateCraftQualityPills();
  updateBuyQualityPills();
  const startupResult = startApplicationState(localStorage);
  if (startupResult.mode === 'blocked') return;
  Crafting.onRecipeChange();
  Ledger.updateDashboardUI();
};
