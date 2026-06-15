import { SYSTEM_CITIES } from '../data/constants.js';
import { escapeHTML, parseNum, formatSilver } from '../utils/formatters.js';
import { state, saveState, currentBuyQuality, initDefaultState } from '../core/state.js';

export function renderInventoryTable() {
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
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" data-action="sell-crafted" data-item="${item}" data-q="${q}" data-city="${city}">💸 出售</button>
              <button class="btn btn-warning" style="padding:4px 8px; font-size:0.8rem;" data-action="edit-inv" data-item="${item}" data-q="${q}" data-city="${city}">✏️ 編輯</button>
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

// ==== TRANSPORT LOGIC ====
export function updateTransItemOptions() {
  const fc = document.getElementById('trans-from').value; const sel = document.getElementById('trans-item'); sel.innerHTML = '<option value="">請選擇...</option>';
  if(!fc) return;
  for(let key in state.inventory) { if(state.inventory[key].qtyByCity[fc] > 0) { const opt = document.createElement('option'); opt.value = key; opt.innerText = `${key.replace('_', ' (')}) - 庫存: ${state.inventory[key].qtyByCity[fc]}`; sel.appendChild(opt); } }
  updateTransMax();
}
export function updateTransMax() {
  const fc = document.getElementById('trans-from').value; const key = document.getElementById('trans-item').value;
  const max = key ? state.inventory[key].qtyByCity[fc] : 0; const sl = document.getElementById('trans-qty-slider');
  sl.max = max || 1; sl.value = 1; document.getElementById('trans-qty').value = '1';
}
export function adjustTransQty(d) {
  const sl = document.getElementById('trans-qty-slider'); let v = parseInt(sl.value) + d;
  if(v<1) v=1; if(v>parseInt(sl.max)) v=parseInt(sl.max); sl.value = v; document.getElementById('trans-qty').value = v.toLocaleString();
}
export function setTransQtyMax() { const sl = document.getElementById('trans-qty-slider'); sl.value = sl.max; document.getElementById('trans-qty').value = parseInt(sl.max).toLocaleString(); }

export function submitTransport() {
  const key = document.getElementById('trans-item').value; if(!key) return window.showToast('請選擇物品！', 'error');
  const qty = parseNum(document.getElementById('trans-qty').value); const fc = document.getElementById('trans-from').value; const tc = document.getElementById('trans-to').value;
  if(qty<=0) return window.showToast('請輸入數量', 'error'); if(fc===tc) return window.showToast('起終點相同', 'error');
  if(!state.inventory[key] || state.inventory[key].qtyByCity[fc] < qty) return window.showToast('庫存不足', 'error');
  state.inventory[key].qtyByCity[fc] -= qty; state.inventory[key].qtyByCity[tc] += qty;
  saveState(); window.showToast(`貨運成功`, 'success'); updateTransItemOptions();
}

// ==== BUY MATERIALS ====
export function submitPurchase() {
  const item = document.getElementById('buy-item').value; const qual = currentBuyQuality;
  const qty = parseNum(document.getElementById('buy-qty').value); const tc = parseNum(document.getElementById('buy-total-price').value); const city = document.getElementById('buy-city').value;
  if(qty<=0||tc<=0) return window.showToast('數量總價錯誤', 'error');
  state.assets.cash -= tc; const key = `${item}_${qual}`; if(!state.inventory[key]) initDefaultState(); 
  
  const it = state.inventory[key];
  let oldGlobalQty = 0; for(let c in it.qtyByCity) oldGlobalQty += it.qtyByCity[c];
  const oldTotalCost = oldGlobalQty * (it.globalAvgCost || 0);
  const newTotalCost = oldTotalCost + tc;
  const newGlobalQty = oldGlobalQty + qty;
  if (newGlobalQty > 0) it.globalAvgCost = Math.round(newTotalCost / newGlobalQty);

  it.qtyByCity[city] += qty;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '買材料', item: item, quality: qual, qty: qty, total: tc, unitPrice: Math.round(tc/qty), location: city });
  saveState(); window.showToast(`採購成功！`, 'success');
}
export function adjBuyQty(d) { let el=document.getElementById('buy-qty'); let v = parseInt(parseNum(el.value)) + d; if(v<1) v=1; el.value = v; }
export function onBuyItemChange() {
  const item = document.getElementById('buy-item').value;
  const map = {'鋼條': 'Thetford', '布料': 'Lymhurst', '板材': 'Fort Sterling', '皮革': 'Martlock'};
  if (map[item]) { document.getElementById('buy-city').value = map[item]; }
}

// ==== CUSTOM LOCATIONS ====
let customLocCallbackConfirm = null;
let customLocCallbackCancel = null;

export function openCustomLocationModal(mode, defaultName, onConfirm, onCancel) {
  customLocCallbackConfirm = onConfirm; customLocCallbackCancel = onCancel;
  document.getElementById('custom-location-input').value = defaultName || '';
  document.getElementById('custom-location-modal').style.display = 'block';
  setTimeout(() => document.getElementById('custom-location-input').focus(), 100);
}
export function closeCustomLocationModal() {
  document.getElementById('custom-location-modal').style.display = 'none';
  if (customLocCallbackCancel) customLocCallbackCancel();
  customLocCallbackConfirm = null; customLocCallbackCancel = null;
}
export function submitCustomLocation() {
  const val = document.getElementById('custom-location-input').value;
  document.getElementById('custom-location-modal').style.display = 'none';
  if (customLocCallbackConfirm) customLocCallbackConfirm(val);
  customLocCallbackConfirm = null; customLocCallbackCancel = null;
}

export function openManageLocationsModal() {
  const list = document.getElementById('manage-locations-list'); list.innerHTML = '';
  if (state.customLocations.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);">目前沒有任何自訂倉庫。</div>';
  } else {
    state.customLocations.forEach(loc => {
      const div = document.createElement('div'); div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; div.style.padding = '10px'; div.style.background = 'rgba(255,255,255,0.05)'; div.style.borderRadius = '5px';
      const span = document.createElement('span'); span.style.fontWeight = 'bold'; span.style.color = 'var(--accent-cyan)'; span.textContent = loc;
      const btnDiv = document.createElement('div'); btnDiv.style.display = 'flex'; btnDiv.style.gap = '5px';
      const btnRename = document.createElement('button'); btnRename.className = 'btn btn-warning'; btnRename.style.padding = '4px 8px'; btnRename.style.fontSize = '0.8rem'; btnRename.innerHTML = '✏️ 更名'; btnRename.setAttribute('data-action', 'rename-loc'); btnRename.setAttribute('data-loc', loc);
      const btnDelete = document.createElement('button'); btnDelete.className = 'btn btn-danger'; btnDelete.style.padding = '4px 8px'; btnDelete.style.fontSize = '0.8rem'; btnDelete.innerHTML = '🗑️ 刪除'; btnDelete.setAttribute('data-action', 'delete-loc'); btnDelete.setAttribute('data-loc', loc);
      btnDiv.appendChild(btnRename); btnDiv.appendChild(btnDelete); div.appendChild(span); div.appendChild(btnDiv); list.appendChild(div);
    });
  }
  document.getElementById('manage-locations-modal').style.display = 'block';
}
export function closeManageLocationsModal() { document.getElementById('manage-locations-modal').style.display = 'none'; }
function locationHasInventory(name) {
  return Object.values(state.inventory).some(item => Number(item?.qtyByCity?.[name] || 0) > 0);
}
export function renameLocation(oldName) {
  openCustomLocationModal('edit', oldName, function(newName) {
    if (!newName || newName.trim() === '' || newName === oldName) return;
    const name = newName.trim(); if (state.customLocations.includes(name)) return window.showToast('名稱已存在', 'error');
    const idx = state.customLocations.indexOf(oldName); if (idx > -1) state.customLocations[idx] = name;
    for (let k in state.inventory) {
      if(state.inventory[k].qtyByCity[oldName] !== undefined) { state.inventory[k].qtyByCity[name] = state.inventory[k].qtyByCity[oldName] || 0; delete state.inventory[k].qtyByCity[oldName]; }
    }
    state.transactions.forEach(t => { if (t.location === oldName) t.location = name; });
    saveState(); window.renderCityDropdowns(); openManageLocationsModal(); window.updateDashboardUI(); window.showToast('更名成功，庫存已無損轉移', 'success');
  });
}
export function deleteLocation(name) {
  if (locationHasInventory(name)) return window.showToast('此倉庫仍有庫存，請先轉移或清空後再刪除。', 'error');
  if (!confirm(`警告：確定要刪除倉庫「${name}」嗎？\n如果裡面還有庫存，該庫存將永遠遺失！`)) return;
  state.customLocations = state.customLocations.filter(c => c !== name);
  for (let k in state.inventory) { delete state.inventory[k].qtyByCity[name]; }
  saveState(); window.renderCityDropdowns(); openManageLocationsModal(); window.updateDashboardUI(); window.showToast('已刪除自訂倉庫', 'success');
}

// ==== EDIT INVENTORY MODAL ====
let aEditK = '';
export function openEditInventoryModal(i, q, defCity) {
  aEditK = `${i}_${q}`; const obj = state.inventory[aEditK]; document.getElementById('edit-inv-name').innerText = `${i} (${q})`;
  const cs = document.getElementById('edit-inv-city'); cs.innerHTML=''; let hs=false;
  for(let c in obj.qtyByCity) { if(obj.qtyByCity[c]>=0) { const o=document.createElement('option'); o.value=c; o.innerText=SYSTEM_CITIES[c]?.name||c; cs.appendChild(o); if(obj.qtyByCity[c]>0) hs=true; } }
  if(cs.options.length===0) return; if(defCity) cs.value = defCity;
  document.getElementById('edit-inv-cost').value = formatSilver(obj.globalAvgCost||0); onEditCityChange(); document.getElementById('edit-inventory-modal').style.display='block';
}
export function onEditCityChange() { const c = document.getElementById('edit-inv-city').value; document.getElementById('edit-inv-qty').value = formatSilver(state.inventory[aEditK].qtyByCity[c]||0); }
export function closeEditInventoryModal() { document.getElementById('edit-inventory-modal').style.display='none'; }
export function adjEditInvQty(d) { const el = document.getElementById('edit-inv-qty'); if(!el) return; let v = parseInt(el.value.replace(/[^\d-]/g, '')) + d; if(v<0) v=0; el.value = v; }
export function submitEditInventory() {
  const c = document.getElementById('edit-inv-city').value; const nq = parseNum(document.getElementById('edit-inv-qty').value); const nc = parseNum(document.getElementById('edit-inv-cost').value);
  if(nq<0||nc<0) return window.showToast('不可為負', 'error'); const [i,q]=aEditK.split('_'); const obj=state.inventory[aEditK]; const oq=obj.qtyByCity[c];
  obj.qtyByCity[c]=nq;
  if(obj.globalAvgCost !== nc) {
    let tq=0; for(let cx in obj.qtyByCity) tq+=obj.qtyByCity[cx];
    state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '成本校正', item: i, quality: q, qty: tq, total: tq*nc, unitPrice: nc, location: 'Global' });
    obj.globalAvgCost = nc;
  }
  if(oq !== nq) state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '庫存校正', item: i, quality: q, qty: nq-oq, total: 0, unitPrice: 0, location: c });
  saveState(); closeEditInventoryModal(); window.showToast('校正成功', 'success'); window.updateDashboardUI();
}
export function deleteEditInventory() {
  const c = document.getElementById('edit-inv-city').value; const [i,q] = aEditK.split('_'); const oq=state.inventory[aEditK].qtyByCity[c];
  state.inventory[aEditK].qtyByCity[c]=0;
  state.transactions.unshift({ date: new Date().toISOString().split('T')[0], type: '庫存刪除', item: i, quality: q, qty: -oq, total: 0, unitPrice: 0, location: c });
  saveState(); closeEditInventoryModal(); window.showToast('已刪除', 'success'); window.updateDashboardUI();
}


let aSellItem = '', aSellQual = '', aSellCity = '';

export function openSellCraftedModal(item, q, city) {
  aSellItem = item; aSellQual = q; aSellCity = city;
  const key = `${item}_${q}`;
  const maxQty = state.inventory[key].qtyByCity[city];
  
  const cityName = SYSTEM_CITIES[city]?.name || city;
  document.getElementById('sell-crafted-name').innerText = `${item} (${q}) - ${cityName}倉庫`;
  
  const maxEl = document.getElementById('sell-crafted-max');
  if (maxEl) maxEl.innerText = maxQty;
  
  const qtyInput = document.getElementById('sell-crafted-qty');
  if (qtyInput) { qtyInput.max = maxQty; qtyInput.value = maxQty; }
  
  const costEl = document.getElementById('sell-crafted-cost');
  if (costEl) costEl.innerText = formatSilver(state.inventory[key].globalAvgCost || 0);
  
  const priceInput = document.getElementById('sell-crafted-price');
  if (priceInput) priceInput.value = '';
  
  const totalInput = document.getElementById('sell-crafted-total');
  if (totalInput) totalInput.value = '';
  
  const estInput = document.getElementById('sell-crafted-estimate');
  if (estInput) estInput.value = '';
  
  const bench90 = document.getElementById('sell-bench-90');
  if (bench90) bench90.innerText = '0';
  
  const bench85 = document.getElementById('sell-bench-85');
  if (bench85) bench85.innerText = '0';
  
  const citySelect = document.getElementById('sell-crafted-city');
  if (citySelect) citySelect.parentElement.style.display = 'none';
  
  runEstimator();
  document.getElementById('sell-crafted-modal').style.display = 'block';
}

export function onSellEstimateChange() {
  const est = parseNum(document.getElementById('sell-crafted-estimate').value) || 0;
  document.getElementById('sell-bench-90').innerText = formatSilver(est * 0.9);
  document.getElementById('sell-bench-85').innerText = formatSilver(est * 0.85);
}

export function closeSellCraftedModal() { document.getElementById('sell-crafted-modal').style.display = 'none'; }

export function adjustSellCraftedQty(d) {
  const el = document.getElementById('sell-crafted-qty');
  if (!el) return;
  let v = parseInt(el.value) + d;
  if (v < 1) v = 1; 
  if (v > parseInt(el.max)) v = parseInt(el.max); 
  el.value = v;
  runEstimator();
}

export function runEstimator() {
  const tEl = document.getElementById('sell-crafted-total');
  const est = document.getElementById('sell-estimator-result');
  if (tEl && est) {
     const t = parseNum(tEl.value);
     est.innerText = `扣除稅額預估: ${(t * 0.935).toLocaleString()}`;
  }
}

export function onSellPriceChange(type) {
  const q = parseInt(document.getElementById('sell-crafted-qty').value) || 0;
  const pEl = document.getElementById('sell-crafted-price');
  const tEl = document.getElementById('sell-crafted-total');
  if (type === 'unit') {
    const p = parseNum(pEl.value);
    tEl.value = (p * q).toLocaleString();
  } else {
    const t = parseNum(tEl.value);
    pEl.value = q > 0 ? (t / q).toLocaleString() : '0';
  }
  runEstimator();
}

export function submitSellCrafted() {
  const q = parseInt(document.getElementById('sell-crafted-qty').value);
  const p = parseNum(document.getElementById('sell-crafted-total').value);
  if (q <= 0 || p <= 0) return window.showToast('數量與總價不可為 0', 'error');
  
  const key = `${aSellItem}_${aSellQual}`;
  if (state.inventory[key].qtyByCity[aSellCity] < q) return window.showToast('庫存不足', 'error');
  
  state.inventory[key].qtyByCity[aSellCity] -= q;
  state.assets.cash += p;
  state.transactions.unshift({ 
    date: new Date().toISOString().split('T')[0], 
    type: '賣成品', 
    item: aSellItem, 
    quality: aSellQual, 
    qty: q, 
    total: p, 
    unitPrice: Math.round(p/q), 
    location: aSellCity 
  });
  
  saveState(); window.updateDashboardUI(); closeSellCraftedModal(); window.showToast('出售成功', 'success');
}
export function initInventoryEvents() {
    // 成品出售 Modal 事件綁定
    const tSlider = document.getElementById('trans-qty-slider');
  const tQty = document.getElementById('trans-qty');
  if (tSlider && tQty) {
    tSlider.addEventListener('input', (e) => {
      tQty.value = parseInt(e.target.value).toLocaleString();
    });
    tQty.addEventListener('input', (e) => {
      let v = parseInt(e.target.value.replace(/[^\d]/g, '')) || 0;
      const max = parseInt(tSlider.max) || 0;
      if (v > max) v = max;
      if (v < 1) v = 1;
      tSlider.value = v;
    });
    tQty.addEventListener('blur', (e) => {
      let v = parseInt(e.target.value.replace(/[^\d]/g, '')) || 0;
      const max = parseInt(tSlider.max) || 0;
      if (v > max) v = max;
      if (v < 1) v = 1;
      e.target.value = v.toLocaleString();
    });
  }
  
  document.getElementById('buy-item')?.addEventListener('change', onBuyItemChange);
  document.getElementById('btn-close-sell-crafted-modal')?.addEventListener('click', closeSellCraftedModal);
  document.getElementById('btn-submit-sell-crafted')?.addEventListener('click', submitSellCrafted);
  document.getElementById('btn-sell-qty-sub-10')?.addEventListener('click', () => adjustSellCraftedQty(-10));
  document.getElementById('btn-sell-qty-sub-1')?.addEventListener('click', () => adjustSellCraftedQty(-1));
  document.getElementById('btn-sell-qty-add-1')?.addEventListener('click', () => adjustSellCraftedQty(1));
  document.getElementById('btn-sell-qty-add-10')?.addEventListener('click', () => adjustSellCraftedQty(10));
  document.getElementById('sell-crafted-price')?.addEventListener('input', () => onSellPriceChange('unit'));
  document.getElementById('sell-crafted-total')?.addEventListener('input', () => onSellPriceChange('total'));
  document.getElementById('sell-crafted-estimate')?.addEventListener('input', onSellEstimateChange);
  document.getElementById('btn-buy-qty-sub-10')?.addEventListener('click', () => adjBuyQty(-10));
  document.getElementById('btn-buy-qty-sub-1')?.addEventListener('click', () => adjBuyQty(-1));
  document.getElementById('btn-buy-qty-add-1')?.addEventListener('click', () => adjBuyQty(1));
  document.getElementById('btn-buy-qty-add-10')?.addEventListener('click', () => adjBuyQty(10));
  document.getElementById('btn-submit-purchase')?.addEventListener('click', submitPurchase);
  
  document.getElementById('btn-trans-qty-sub-10')?.addEventListener('click', () => adjustTransQty(-10));
  document.getElementById('btn-trans-qty-sub-1')?.addEventListener('click', () => adjustTransQty(-1));
  document.getElementById('btn-trans-qty-add-1')?.addEventListener('click', () => adjustTransQty(1));
  document.getElementById('btn-trans-qty-add-10')?.addEventListener('click', () => adjustTransQty(10));
  document.getElementById('btn-trans-qty-max')?.addEventListener('click', setTransQtyMax);
  document.getElementById('btn-submit-transport')?.addEventListener('click', submitTransport);
  
  document.getElementById('btn-manage-locations')?.addEventListener('click', openManageLocationsModal);
  document.getElementById('inventory-search')?.addEventListener('input', renderInventoryTable);
  
  document.getElementById('btn-close-edit-inv-modal')?.addEventListener('click', closeEditInventoryModal);
  document.getElementById('edit-inv-city')?.addEventListener('change', onEditCityChange);
  document.getElementById('btn-submit-edit-inv')?.addEventListener('click', submitEditInventory);
  document.getElementById('btn-edit-inv-qty-sub-1')?.addEventListener('click', () => adjEditInvQty(-1));
  document.getElementById('btn-edit-inv-qty-add-1')?.addEventListener('click', () => adjEditInvQty(1));
  document.getElementById('btn-delete-edit-inv')?.addEventListener('click', deleteEditInventory);
  
  document.getElementById('btn-close-manage-locations-modal')?.addEventListener('click', closeManageLocationsModal);
  
  const cityCards = document.getElementById('inventory-city-cards');
  if (cityCards) {
    cityCards.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        const item = btn.getAttribute('data-item');
        const q = btn.getAttribute('data-q');
        const city = btn.getAttribute('data-city');
        if (action === 'sell-crafted') {
           // 直接呼叫同檔案內的函式，完美解耦且直觀！
           openSellCraftedModal(item, q, city);
        } else if (action === 'edit-inv') {
           openEditInventoryModal(item, q, city);
        }
      }
    });
  }

  const manageList = document.getElementById('manage-locations-list');
  if (manageList) {
    manageList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        const loc = btn.getAttribute('data-loc');
        if (action === 'rename-loc') renameLocation(loc);
        else if (action === 'delete-loc') deleteLocation(loc);
      }
    });
  }
}
