import { QUAL_GROUPS } from './data/constants.js';
import { escapeHTML } from './utils/formatters.js';
import { state, loadState, currentCraftQuality, setCurrentCraftQuality, currentBuyQuality, setCurrentBuyQuality } from './core/state.js';

import * as Crafting from './components/crafting.js';
import * as Inventory from './components/inventory.js';
import * as Laborer from './components/laborer.js';
import * as Ledger from './components/ledger.js';

// ==========================================
// 全域共用 UI 函式
// ==========================================
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
      btn.onclick = () => { callback(q); if (containerId === "craft-quality-pill-group") Crafting.runCraftingCalculator(); };
      pg.appendChild(btn);
    });
    d.appendChild(title); d.appendChild(pg);
    ctn.appendChild(d);
  });
}

// 修正：使用 Setter 函式更新狀態，而不是直接綁在 window 上
function updateCraftQualityPills() { renderQualityPillsGroup('craft-quality-pill-group', currentCraftQuality, q => { setCurrentCraftQuality(q); updateCraftQualityPills(); Crafting.runCraftingCalculator(); }); }
function updateBuyQualityPills() { renderQualityPillsGroup('buy-quality-pill-group', currentBuyQuality, q => { setCurrentBuyQuality(q); updateBuyQualityPills(); }); }
// 共用城市下拉選單邏輯
const SYSTEM_CITIES_ARR = [
  {id: 'Thetford', name: 'Thetford 紫城'}, {id: 'Martlock', name: 'Martlock 藍城'}, {id: 'Bridgewatch', name: 'Bridgewatch 黃城'}, {id: 'Lymhurst', name: 'Lymhurst 綠城'}, {id: 'Fort Sterling', name: 'Fort Sterling 白城'}
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
  
  const cCraft = document.getElementById('craft-city').value; const cBuy = document.getElementById('buy-city').value;
  const cFrom = document.getElementById('trans-from').value; const cTo = document.getElementById('trans-to').value; const cImport = document.getElementById('import-city').value;

  document.getElementById('craft-city').innerHTML = generateOptions(false, false, true); document.getElementById('buy-city').innerHTML = generateOptions(false, false, true); document.getElementById('trans-from').innerHTML = generateOptions(true, true, false); document.getElementById('trans-to').innerHTML = generateOptions(false, true, true); document.getElementById('import-city').innerHTML = generateOptions(false, false, true);
  
  if(cCraft) document.getElementById('craft-city').value = cCraft; if(cBuy) document.getElementById('buy-city').value = cBuy; if(cFrom) document.getElementById('trans-from').value = cFrom; if(cTo) document.getElementById('trans-to').value = cTo; if(cImport) document.getElementById('import-city').value = cImport;
}

function onCityChange() {
  const city = document.getElementById('craft-city').value;
  document.getElementById('hideout-group').style.display = state.customLocations.includes(city) ? 'flex' : 'none';
  Crafting.runCraftingCalculator();
}

function handleCityDropdownChange(event) {
  const targetId = event.target.id;
  if (event.target.value === '__ADD_CUSTOM__') {
    Inventory.openCustomLocationModal('add', '', function(newName) {
      if (!newName || newName.trim() === '') { document.getElementById(targetId).selectedIndex = 0; if (targetId === 'craft-city') onCityChange(); return; }
      const name = newName.trim();
      if (!state.customLocations.includes(name)) {
        state.customLocations.push(name);
        for (let key in state.inventory) { if(!state.inventory[key].qtyByCity) state.inventory[key].qtyByCity = {}; state.inventory[key].qtyByCity[name] = 0; }
        renderCityDropdowns(); document.getElementById(targetId).value = name;
        if (targetId === 'craft-city') onCityChange();
        if (targetId === 'trans-to' || targetId === 'trans-from') Inventory.updateTransItemOptions();
        showToast('新增自訂倉庫成功', 'success');
      } else {
        showToast('倉庫名稱已存在', 'error'); document.getElementById(targetId).selectedIndex = 0; if (targetId === 'craft-city') onCityChange();
      }
    }, function() { document.getElementById(targetId).selectedIndex = 0; if (targetId === 'craft-city') onCityChange(); });
  } else {
    if (targetId === 'craft-city') onCityChange();
    if (targetId === 'trans-from' || targetId === 'trans-to') if (targetId === 'trans-from') Inventory.updateTransItemOptions();
  }
}

// 資料匯出匯入
function exportData() {
  const data = { inventory: localStorage.getItem('albion_crafting_stocks'), assets: localStorage.getItem('albion_crafting_assets'), transactions: localStorage.getItem('albion_crafting_transactions'), laborerInventory: localStorage.getItem('albion_crafting_laborer_stocks'), laborerLogs: localStorage.getItem('albion_crafting_laborer_logs') };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; const d = new Date(); a.download = `albion_data_backup_${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}.json`; a.click(); URL.revokeObjectURL(url);
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.inventory || !data.transactions) return alert("匯入失敗：JSON 格式不符或損壞，已中斷操作！");
      if (confirm("⚠️ 這將會覆寫目前的所有紀錄，確定要匯入嗎？")) {
        localStorage.setItem('albion_crafting_stocks', data.inventory); localStorage.setItem('albion_crafting_assets', data.assets); localStorage.setItem('albion_crafting_transactions', data.transactions);
        if(data.laborerInventory) localStorage.setItem('albion_crafting_laborer_stocks', data.laborerInventory);
        if(data.laborerLogs) localStorage.setItem('albion_crafting_laborer_logs', data.laborerLogs);
        alert("匯入成功！系統將重新載入。"); location.reload();
      }
    } catch(err) { alert("匯入失敗：JSON 解析錯誤，已中斷操作！"); }
  };
  reader.readAsText(file); e.target.value = '';
}

// === 全局事件監聽 (解決千分位游標跳動) ===
document.addEventListener('input', function(e) {
  if (e.target.classList.contains('format-num')) {
    const input = e.target;
    let cursorPos = input.selectionStart;
    const oldVal = input.value;
    
    // 若不支援 selectionStart (防呆)，則直接使用舊版邏輯
    if (cursorPos === null) {
      let rawVal = oldVal.replace(/[^\d-]/g, '');
      if (rawVal === '' || rawVal === '-') return;
      let parsed = parseInt(rawVal, 10);
      if (!isNaN(parsed)) input.value = parsed.toLocaleString();
      return;
    }

    // 計算游標前有幾個「有效字元」(數字或負號)
    let validCharsBefore = 0;
    for (let i = 0; i < cursorPos; i++) {
      if (/[0-9-]/.test(oldVal[i])) {
        validCharsBefore++;
      }
    }

    // 濾除雜訊
    let rawVal = oldVal.replace(/[^\d-]/g, '');
    if (rawVal === '' || rawVal === '-') return;

    let parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed)) {
      const newVal = parsed.toLocaleString();
      input.value = newVal;

      // 計算還原游標的新位置
      let newCursorPos = newVal.length;
      let validCharCount = 0;
      
      for (let i = 0; i < newVal.length; i++) {
        if (validCharCount === validCharsBefore) {
          newCursorPos = i;
          break;
        }
        if (/[0-9-]/.test(newVal[i])) {
          validCharCount++;
        }
      }

      input.setSelectionRange(newCursorPos, newCursorPos);
    }
  }
});

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

window.onload = () => {
  initGlobalEvents();
  Crafting.initCraftingEvents();
  Inventory.initInventoryEvents();
  Laborer.initLaborerEvents();
  Ledger.initLedgerEvents();
  
  updateCraftQualityPills();
  updateBuyQualityPills();
  loadState();
  document.getElementById('craft-recipe').value = Crafting.RECIPES[0].name;
  Crafting.onRecipeChange();
  Ledger.updateDashboardUI();
};
