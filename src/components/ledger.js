import { parseNum, formatMillions, formatSilver } from '../utils/formatters.js';
import { state, saveState } from '../core/state.js';

export let currentLedgerPage = 1; 
export const LEDGER_ITEMS_PER_PAGE = 10; 
let filteredLedger = [];
let aLedgerIdx = -1;

export function updateDashboardUI() {
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
  
  // 只保留自己的渲染，其他組件的渲染交給 app.js 統一廣播處理
  filterLedger(false);
}

export function filterLedger(resetPage = true) {
  const qry = document.getElementById('ledger-search')?.value.toLowerCase() || '';
  filteredLedger = state.transactions.map((t, index) => ({...t, originalIndex: index})).filter(t => {
    if (!qry) return true;
    return t.date.includes(qry) || t.type.toLowerCase().includes(qry) || t.item.toLowerCase().includes(qry);
  });
  if (resetPage) currentLedgerPage = 1;
  renderLedgerTable();
}

export function renderLedgerTable() {
  const tb = document.getElementById('ledger-tbody'); tb.innerHTML='';
  const totalPages = Math.ceil(filteredLedger.length / LEDGER_ITEMS_PER_PAGE) || 1;
  if (currentLedgerPage > totalPages) currentLedgerPage = totalPages;
  document.getElementById('ledger-page-info').innerText = `${currentLedgerPage} / ${totalPages}`;
  
  const start = (currentLedgerPage - 1) * LEDGER_ITEMS_PER_PAGE;
  const pageItems = filteredLedger.slice(start, start + LEDGER_ITEMS_PER_PAGE);

  pageItems.forEach(t => {
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${t.date}</td><td><span style="color:var(--accent-cyan); font-weight:bold;">${t.type}</span></td><td>${t.item} ${t.quality !== '-' ? '('+t.quality+')':''}</td><td>${t.qty}</td><td>${formatSilver(t.unitPrice)}</td><td style="font-weight:bold; color:${['買','扣','製作入庫','提領','成本校正','庫存刪除'].some(x=>t.type.includes(x))?'var(--accent-red)':'var(--accent-green)'};">${['買','扣','製作入庫','提領','成本校正','庫存刪除'].some(x=>t.type.includes(x))?'-':'+'}${formatSilver(t.total)}</td><td><button class="btn btn-warning" style="padding:4px 8px; font-size:0.8rem;" data-action="edit-ledger" data-id="${t.originalIndex}">✏️ 編輯</button></td>`;
    tb.appendChild(tr);
  });
}

export function prevLedgerPage() { if (currentLedgerPage > 1) { currentLedgerPage--; renderLedgerTable(); } }
export function nextLedgerPage() { const tp = Math.ceil(filteredLedger.length / LEDGER_ITEMS_PER_PAGE); if (currentLedgerPage < tp) { currentLedgerPage++; renderLedgerTable(); } }

export function openEditLedgerModal(idx) {
  aLedgerIdx = idx; const t = state.transactions[idx];
  document.getElementById('edit-ledger-info').innerText = `${t.date} | ${t.type}`;
  document.getElementById('edit-ledger-item').innerText = `${t.item} ${t.quality !== '-' ? '('+t.quality+')':''}`;
  document.getElementById('edit-ledger-qty').value = formatSilver(t.qty);
  document.getElementById('edit-ledger-total').value = formatSilver(t.total);
  document.getElementById('edit-ledger-modal').style.display='block';
}
export function closeEditLedgerModal() { document.getElementById('edit-ledger-modal').style.display='none'; }

export function getLedgerCashImpact(type, amt) { if (['買材料', '製作入庫', '提領利潤', '成本校正', '庫存刪除'].some(x => type.includes(x))) return -amt; return amt; }

export function applyInventoryDiff(t, qtyDiff) {
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

export function submitEditLedger() {
  const nq = parseNum(document.getElementById('edit-ledger-qty').value); const nt = parseNum(document.getElementById('edit-ledger-total').value);
  if(nq < 0 || nt < 0) return window.showToast('不可為負', 'error');
  const t = state.transactions[aLedgerIdx]; const oldTotal = t.total;
  
  applyInventoryDiff(t, nq - t.qty);
  
  state.assets.cash += (getLedgerCashImpact(t.type, nt) - getLedgerCashImpact(t.type, oldTotal));
  if (t.type === '注資本金') state.assets.debt += (nt - oldTotal);
  if (t.type === '提領利潤') state.assets.debt -= (nt - oldTotal);
  t.qty = nq; t.total = nt; t.unitPrice = nq > 0 ? Math.round(nt / nq) : 0;
  saveState(); closeEditLedgerModal(); window.showToast('修改成功！庫存均價與數量已回推對齊', 'success');
}

export function deleteEditLedger() {
  const t = state.transactions[aLedgerIdx];
  if (t.type !== '買材料') return window.showToast('目前僅支援採購紀錄刪除轉調整', 'error');
  if (!confirm('確定要將此採購紀錄轉為調整紀錄嗎？')) return;
  const itemKey = `${t.item}_${t.quality}`; const targetInventory = state.inventory[itemKey];
  const currentQty = targetInventory?.qtyByCity?.[t.location] || 0;
  if (currentQty < t.qty) return window.showToast('庫存不足，已被消耗無法調整', 'error');
  targetInventory.qtyByCity[t.location] -= t.qty;
  state.assets.cash += t.total;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: 'INVENTORY_ADJUSTMENT', item: t.item, quality: t.quality, qty: -t.qty, total: -t.total, unitPrice: t.unitPrice, location: t.location, details: `刪除轉調整；原始索引: ${aLedgerIdx}` });
  saveState(); closeEditLedgerModal(); window.showToast('已新增調整紀錄，原始紀錄已保留', 'success');
}

export function adjustWallet(a) {
  const am = parseNum(document.getElementById('wallet-adjust-amt').value) * 1000000; if(am<=0) return;
  if(a==='deposit') { state.assets.cash+=am; state.assets.debt+=am; state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type:'注資本金', item:'-', quality:'-', qty:0, total:am, unitPrice:0, location:'-' }); window.showToast('注資成功','success'); }
  else { if(state.assets.cash<am) return window.showToast('餘額不足','error'); state.assets.cash-=am; state.assets.debt-=am; state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type:'提領利潤', item:'-', quality:'-', qty:0, total:am, unitPrice:0, location:'-' }); window.showToast('提領成功','success'); }
  saveState(); window.updateDashboardUI();
}

export function adjustCashBalance() {
  const current = state.assets.cash;
  const userInput = prompt(`目前累計現金流為: ${current.toLocaleString()}\n請輸入『真實的銀幣總額』來校正：`, current);
  if (userInput !== null) {
    const newVal = parseInt(userInput.replace(/,/g, ''), 10);
    if (!isNaN(newVal)) {
      const diff = newVal - current;
      state.assets.cash = newVal;
      state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '現金流校正', item: '-', quality: '-', qty: 1, total: diff, unitPrice: diff, location: '-' });
      saveState(); window.updateDashboardUI(); window.showToast('現金流校正成功', 'success');
    }
  }
}

export function initLedgerEvents() {
  document.getElementById('ledger-search')?.addEventListener('input', () => filterLedger(true));
  document.getElementById('btn-ledger-prev-page')?.addEventListener('click', prevLedgerPage);
  document.getElementById('btn-ledger-next-page')?.addEventListener('click', nextLedgerPage);
  
  document.getElementById('btn-close-edit-ledger-modal')?.addEventListener('click', closeEditLedgerModal);
  document.getElementById('btn-submit-edit-ledger')?.addEventListener('click', submitEditLedger);
  document.getElementById('btn-delete-edit-ledger')?.addEventListener('click', deleteEditLedger);

  document.getElementById('btn-adjust-cash')?.addEventListener('click', adjustCashBalance);
  
  const tb = document.getElementById('ledger-tbody');
  if (tb) {
    tb.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        const id = parseInt(btn.getAttribute('data-id'));
        if (action === 'edit-ledger') openEditLedgerModal(id);
      }
    });
  }
}
