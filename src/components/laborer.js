import { parseNum, formatSilver } from '../utils/formatters.js';
import { state, saveState } from '../core/state.js';

let currentLaborHarvestQual = '8.0';
let currentLaborAddQual = '8.0';
export let currentLaborLogsPage = 1; 
export const LABOR_ITEMS_PER_PAGE = 10; 
let filteredLaborLogs = [];

export function addLaborItemRow() {
  const list = document.getElementById('labor-dynamic-list'); const rId = 'lr-'+Date.now();
  const d = document.createElement('div'); d.className='form-row'; d.id=rId; d.style.marginBottom='10px';
  const tier = currentLaborHarvestQual.split('.')[0];
  d.innerHTML = `<div class="form-group" style="flex:2;"><select class="li-type"><option value="鋼條">鋼條</option><option value="布料">布料</option><option value="板材">板材</option><option value="皮革">皮革</option></select></div><div class="form-group" style="flex:2;"><select class="li-qual"><option value="${tier}.0">${tier}.0</option><option value="${tier}.1">${tier}.1</option><option value="${tier}.2">${tier}.2</option><option value="${tier}.3">${tier}.3</option></select></div><div class="form-group" style="flex:2;"><div style="display:flex; gap:5px;"><button class="btn btn-secondary" data-action="adj-li-qty" data-val="-1" style="padding:2px 8px;">-</button><input type="text" class="format-num li-qty" placeholder="數量" value="0" style="flex:1; min-width:40px; text-align:center;"><button class="btn btn-secondary" data-action="adj-li-qty" data-val="1" style="padding:2px 8px;">+</button></div></div><div class="form-group" style="flex:1;"><button class="btn btn-danger" data-action="remove-labor-row" data-id="${rId}">✕</button></div>`;
  list.appendChild(d);
}

export function renderLaborerTable() {
  const tbg = document.getElementById('labor-tbody'); tbg.innerHTML='';
  const tbj = document.getElementById('labor-journal-tbody'); tbj.innerHTML='';
  
  // Render Journals
  ['6.0', '7.0', '8.0'].forEach(q => {
    const qty = state.laborerInventory['滿日記本']?.[q] || 0;
    if(qty > 0) {
      const bc = `quality-badge quality-${parseInt(q.split('.')[0])||4}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="${bc}">T${q.split('.')[0]} 日記本</span></td><td style="font-weight:600; color:var(--accent-cyan); font-size:1.1rem;">${qty}</td><td><button class="btn btn-warning" style="padding:4px 8px; font-size:0.75rem;" data-action="edit-labor" data-item="滿日記本" data-q="${q}" data-qty="${qty}">✏️ 編輯</button> <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" data-action="sell-labor" data-item="滿日記本" data-q="${q}" data-qty="${qty}">套現</button></td>`;
      tbj.appendChild(tr);
    }
  });

  // Render General Goods
  const ALL_QUALS = ['4.0', '4.1', '4.2', '4.3', '4.4', '5.0', '5.1', '5.2', '5.3', '5.4', '6.0', '6.1', '6.2', '6.3', '6.4', '7.0', '7.1', '7.2', '7.3', '7.4', '8.0', '8.1', '8.2', '8.3', '8.4'];
  ['鋼條','布料','板材'].forEach(it => { 
    ALL_QUALS.forEach(q => { 
      const qty = state.laborerInventory[it]?.[q]||0; 
      if(qty===0) return; 
      const bc = `quality-badge quality-${parseInt(q.split('.')[0])||4}`;
      const tr = document.createElement('tr'); 
      tr.innerHTML=`<td><strong>${it}</strong></td><td><span class="${bc}">${q}</span></td><td style="font-weight:600; color:var(--accent-purple);">${qty}</td><td><button class="btn btn-warning" style="padding:4px 8px; font-size:0.75rem;" data-action="edit-labor" data-item="${it}" data-q="${q}" data-qty="${qty}">✏️ 編輯</button> <button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" data-action="import-labor" data-item="${it}" data-q="${q}" data-qty="${qty}">匯入</button> <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" data-action="sell-labor" data-item="${it}" data-q="${q}" data-qty="${qty}">套現</button></td>`; 
      tbg.appendChild(tr); 
    }); 
  });
}

export function adjHarvestQty(d) {
  const el = document.getElementById('labor-filled-qty');
  let v = parseInt(el.value) + d;
  if(v < 0) v = 0; el.value = v;
}

export function submitLaborHarvest() {
  const f = parseNum(document.getElementById('labor-filled-qty').value); if(f<=0) return window.showToast('數量錯誤','error');
  const hq = currentLaborHarvestQual;
  
  const curJ = state.laborerInventory['滿日記本']?.[hq] || 0;
  if (curJ < f) {
    if(!confirm(`警告：滿日記本 (${hq}) 庫存不足 (僅剩 ${curJ})！\n這將導致庫存變成負數，確定要繼續收成嗎？`)) return;
  }
  
  if(!state.laborerInventory['滿日記本']) state.laborerInventory['滿日記本'] = {};
  state.laborerInventory['滿日記本'][hq] = (state.laborerInventory['滿日記本'][hq] || 0) - f;
  
  const list = document.getElementById('labor-dynamic-list').children; let ls = [];
  for(let i=0; i<list.length; i++) {
    const tp=list[i].querySelector('.li-type').value; const ql=list[i].querySelector('.li-qual').value; const qt=parseNum(list[i].querySelector('.li-qty').value);
    if(qt>0) { if(!state.laborerInventory[tp])state.laborerInventory[tp]={}; state.laborerInventory[tp][ql]=(state.laborerInventory[tp][ql]||0)+qt; ls.push(`${tp}(${ql})x${qt}`); }
  }
  state.laborerLogs.unshift({ date: new Date().toISOString().split('T')[0], filled: f, details: ls.join(', ')||'無資源產出' });
  saveState(); window.showToast('收成成功並已扣除滿日記本庫存','success');
}

export function submitAddFilledJournals() {
  const q = currentLaborAddQual; const qty = parseNum(document.getElementById('labor-add-filled-qty').value);
  if(qty<=0) return window.showToast('數量錯誤','error');
  if(!state.laborerInventory['滿日記本']) state.laborerInventory['滿日記本'] = {};
  state.laborerInventory['滿日記本'][q] = (state.laborerInventory['滿日記本'][q]||0) + qty;
  saveState(); window.showToast('滿日記本入庫成功', 'success');
}

export function filterLaborLogs() {
  filteredLaborLogs = state.laborerLogs;
  currentLaborLogsPage = 1;
  renderLaborerLogsTable();
}

export function renderLaborerLogsTable() {
  const tb = document.getElementById('labor-logs-tbody'); tb.innerHTML='';
  const totalPages = Math.ceil(filteredLaborLogs.length / LABOR_ITEMS_PER_PAGE) || 1;
  if (currentLaborLogsPage > totalPages) currentLaborLogsPage = totalPages;
  document.getElementById('labor-logs-page-info').innerText = `${currentLaborLogsPage} / ${totalPages}`;
  
  const start = (currentLaborLogsPage - 1) * LABOR_ITEMS_PER_PAGE;
  const pageItems = filteredLaborLogs.slice(start, start + LABOR_ITEMS_PER_PAGE);

  pageItems.forEach(l => { 
    const tr=document.createElement('tr'); 
    tr.innerHTML=`<td>${l.date}</td><td>-${l.filled}</td><td colspan="2" style="font-size:0.85rem;">${l.details||''}</td>`; 
    tb.appendChild(tr); 
  });
}

export function prevLaborLogsPage() { if (currentLaborLogsPage > 1) { currentLaborLogsPage--; renderLaborerLogsTable(); } }
export function nextLaborLogsPage() { const tp = Math.ceil(filteredLaborLogs.length / LABOR_ITEMS_PER_PAGE); if (currentLaborLogsPage < tp) { currentLaborLogsPage++; renderLaborerLogsTable(); } }

export function renderLaborQualityPillsGroup(containerId, activeQuality, callback) {
  const ctn = document.getElementById(containerId); if(!ctn) return;
  ctn.innerHTML = '';
  const pg = document.createElement('div'); pg.className = 'pill-group';
  ['6.0', '7.0', '8.0'].forEach(q => {
    const btn = document.createElement('button');
    btn.className = `pill-btn ${q === activeQuality ? 'active' : ''}`;
    btn.innerHTML = `T${q.split('.')[0]}`;
    btn.onclick = () => { callback(q); };
    pg.appendChild(btn);
  });
  ctn.appendChild(pg);
}

export function updateLaborQualityPills() { 
  renderLaborQualityPillsGroup('labor-harvest-pill-group', currentLaborHarvestQual, q => { currentLaborHarvestQual = q; updateLaborQualityPills(); }); 
  renderLaborQualityPillsGroup('labor-add-filled-pill-group', currentLaborAddQual, q => { currentLaborAddQual = q; updateLaborQualityPills(); });
}

export function openEditLaborModal(item, qual, qty) {
  document.getElementById('edit-labor-name').innerText = `${item} (${qual})`;
  document.getElementById('edit-labor-qty').value = qty;
  document.getElementById('edit-labor-modal').style.display='block';
}
export function closeEditLaborModal() { document.getElementById('edit-labor-modal').style.display='none'; }
export function submitEditLabor() {
  const q = parseNum(document.getElementById('edit-labor-qty').value);
  if(q < 0) return window.showToast('數量不可為負', 'error');
  const txt = document.getElementById('edit-labor-name').innerText;
  const match = txt.match(/(.+) \((.+)\)/);
  if(!match) return;
  const item = match[1]; const qual = match[2];
  if(!state.laborerInventory[item]) state.laborerInventory[item] = {};
  state.laborerInventory[item][qual] = q;
  saveState(); closeEditLaborModal(); window.showToast('工人島庫存已無痕校正', 'success');
}

let aImpI='', aImpQ='';
export function openImportModal(i,q,m) { aImpI=i; aImpQ=q; document.getElementById('import-qty').value=formatSilver(m); document.getElementById('import-qty').max=m; document.getElementById('import-modal').style.display='block'; }
export function closeImportModal() { document.getElementById('import-modal').style.display='none'; }
export function submitImportLaborStock() {
  const q=parseNum(document.getElementById('import-qty').value); const c=document.getElementById('import-city').value;
  const itemKey = `${aImpI}_${aImpQ}`; const targetInventory = state.inventory[itemKey];
  const laborerItem = state.laborerInventory[aImpI]; const availableQty = laborerItem?.[aImpQ];
  if (!Number.isInteger(q) || q <= 0) return window.showToast('匯入數量必須是正整數', 'error');
  if (!targetInventory || targetInventory.globalAvgCost === null) return window.showToast('缺乏真實交易定錨。請先透過採購入庫建立成本基準。', 'error');
  if (!laborerItem || availableQty === undefined) return window.showToast('工人島暫存庫存不存在', 'error');
  if (availableQty < q) return window.showToast('工人島暫存庫存不足', 'error');
  state.laborerInventory[aImpI][aImpQ]-=q; targetInventory.qtyByCity[c]+=q;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '工人島匯入', item: aImpI, quality: aImpQ, qty: q, total: 0, unitPrice: 0, location: c });
  saveState(); closeImportModal(); window.showToast('工人島庫存已匯入','success');
}

let aSelI='', aSelQ='';
export function openSellLaborStockModal(i,q,m) { aSelI=i; aSelQ=q; document.getElementById('sell-qty').value=formatSilver(m); document.getElementById('sell-qty').max=m; document.getElementById('sell-modal').style.display='block'; }
export function closeSellLaborStockModal() { document.getElementById('sell-modal').style.display='none'; }
export function submitSellLaborStock() {
  const q=parseNum(document.getElementById('sell-qty').value); const m=parseNum(document.getElementById('sell-qty').max); const p=parseNum(document.getElementById('sell-price').value);
  if(q<=0||q>m||p<=0) return; state.laborerInventory[aSelI][aSelQ]-=q; state.assets.cash+=p;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type:'工人島出售', item:aSelI, quality:aSelQ, qty:q, total:p, unitPrice:Math.round(p/q), location:'LaborerIsland' });
  saveState(); window.updateDashboardUI(); closeSellLaborStockModal(); window.showToast('套現成功','success');
}

export function initLaborerEvents() {
  document.getElementById('btn-labor-qty-sub-15')?.addEventListener('click', () => adjHarvestQty(-15));
  document.getElementById('btn-labor-qty-sub-1')?.addEventListener('click', () => adjHarvestQty(-1));
  document.getElementById('btn-labor-qty-add-1')?.addEventListener('click', () => adjHarvestQty(1));
  document.getElementById('btn-labor-qty-add-15')?.addEventListener('click', () => adjHarvestQty(15));
  
  document.getElementById('btn-add-labor-row')?.addEventListener('click', addLaborItemRow);
  document.getElementById('btn-submit-labor-harvest')?.addEventListener('click', submitLaborHarvest);
  
  document.getElementById('btn-submit-add-journals')?.addEventListener('click', submitAddFilledJournals);
  
  document.getElementById('btn-labor-prev-page')?.addEventListener('click', prevLaborLogsPage);
  document.getElementById('btn-labor-next-page')?.addEventListener('click', nextLaborLogsPage);

  document.getElementById('btn-close-edit-labor-modal')?.addEventListener('click', closeEditLaborModal);
  document.getElementById('btn-cancel-edit-labor')?.addEventListener('click', closeEditLaborModal);
  document.getElementById('btn-submit-edit-labor')?.addEventListener('click', submitEditLabor);
  document.getElementById('btn-edit-labor-qty-sub-1')?.addEventListener('click', () => adjEditLaborQty(-1));
  document.getElementById('btn-edit-labor-qty-add-1')?.addEventListener('click', () => adjEditLaborQty(1));
  
  document.getElementById('btn-close-import-modal')?.addEventListener('click', closeImportModal);
  document.getElementById('btn-submit-import')?.addEventListener('click', submitImportLaborStock);
  
  document.getElementById('btn-close-sell-labor-modal')?.addEventListener('click', closeSellLaborStockModal);
  document.getElementById('btn-submit-sell-labor')?.addEventListener('click', submitSellLaborStock);

  const handleLaborClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.getAttribute('data-action');
      const item = btn.getAttribute('data-item');
      const q = btn.getAttribute('data-q');
      const qty = parseFloat(btn.getAttribute('data-qty'));
      if (action === 'edit-labor') openEditLaborModal(item, q, qty);
      else if (action === 'import-labor') openImportModal(item, q, qty);
      else if (action === 'sell-labor') openSellLaborStockModal(item, q, qty);
    }
  };
  
  const tbj = document.getElementById('labor-journal-tbody');
  const tbg = document.getElementById('labor-tbody');
  if (tbj) tbj.addEventListener('click', handleLaborClick);
  if (tbg) tbg.addEventListener('click', handleLaborClick);

  const dynList = document.getElementById('labor-dynamic-list');
  if (dynList) {
    dynList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        if (action === 'remove-labor-row') {
           e.target.closest('.form-row').remove();
        } else if (action === 'adj-li-qty') {
           const diff = parseInt(btn.getAttribute('data-val'));
           const input = btn.parentElement.querySelector('.li-qty');
           if (input) {
             let v = parseInt(input.value.replace(/[^\d-]/g, '')) || 0;
             v += diff;
             if (v < 0) v = 0;
             input.value = v;
           }
        }
      }
    });
  }
}
