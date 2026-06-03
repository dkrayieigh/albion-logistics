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
      const btnRename = document.createElement('button'); btnRename.className = 'btn btn-warning'; btnRename.style.padding = '4px 8px'; btnRename.style.fontSize = '0.8rem'; btnRename.innerHTML = '✏️ 更名'; btnRename.onclick = () => renameLocation(loc);
      const btnDelete = document.createElement('button'); btnDelete.className = 'btn btn-danger'; btnDelete.style.padding = '4px 8px'; btnDelete.style.fontSize = '0.8rem'; btnDelete.innerHTML = '🗑️ 刪除'; btnDelete.onclick = () => deleteLocation(loc);
      btnDiv.appendChild(btnRename); btnDiv.appendChild(btnDelete); div.appendChild(span); div.appendChild(btnDiv); list.appendChild(div);
    });
  }
  document.getElementById('manage-locations-modal').style.display = 'block';
}
export function closeManageLocationsModal() { document.getElementById('manage-locations-modal').style.display = 'none'; }
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