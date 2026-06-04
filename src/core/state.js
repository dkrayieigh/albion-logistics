import { QUAL_GROUPS } from '../data/constants.js';
import { ALBION_DB } from '../data/albion_db.js';

export const state = { 
  assets: { cash: 0 }, 
  customLocations: [], 
  inventory: {}, 
  laborerInventory: { '鋼條': {}, '布料': {}, '板材': {}, '滿日記本': {} }, 
  laborerLogs: [], 
  transactions: [] 
};

export const craftingQueue = [];
export let currentCraftQuality = '4.0';
export let currentBuyQuality = '4.0';

export function setCurrentCraftQuality(val) { currentCraftQuality = val; }
export function setCurrentBuyQuality(val) { currentBuyQuality = val; }

// 不再依賴 window 全域變數，改用 CustomEvent 發送廣播
function callUIUpdate() {
  document.dispatchEvent(new Event('stateUpdated'));
}

export function initDefaultState() {
  // 取得所有配方名稱
  let allRecipeNames = [];
  for (let cat in ALBION_DB) {
    for (let branch in ALBION_DB[cat]) {
      if (ALBION_DB[cat][branch] && ALBION_DB[cat][branch].items) {
        allRecipeNames = allRecipeNames.concat(ALBION_DB[cat][branch].items.map(i => i.name));
      }
    }
  }

  const materials = ['鋼條', '布料', '板材', '皮革'];
  const allItems = new Set([...materials, '滿日記本', ...allRecipeNames]);
  const QUALITIES = QUAL_GROUPS.flatMap(g => g.items);
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
      if (materials.includes(item) || item === '滿日記本') { 
        if (!state.laborerInventory[item]) state.laborerInventory[item] = {}; 
        if (!state.laborerInventory[item][q]) state.laborerInventory[item][q] = 0; 
      }
    });
  });
}

export function loadState() {
  const stocks = localStorage.getItem('albion_crafting_stocks'); if (stocks) state.inventory = JSON.parse(stocks);
  const assets = localStorage.getItem('albion_crafting_assets'); if (assets) state.assets = JSON.parse(assets);
  const trans = localStorage.getItem('albion_crafting_transactions'); if (trans) state.transactions = JSON.parse(trans);
  const laborStock = localStorage.getItem('albion_crafting_laborer_stocks'); if (laborStock) state.laborerInventory = JSON.parse(laborStock);
  const laborLogs = localStorage.getItem('albion_crafting_laborer_logs'); if (laborLogs) state.laborerLogs = JSON.parse(laborLogs);
  const cLoc = localStorage.getItem('albion_crafting_custom_locs'); 
  if (cLoc) { state.customLocations = JSON.parse(cLoc); } else { state.customLocations = []; }
  
  // 舊地堡過渡邏輯
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
  callUIUpdate();
}

export function saveState() {
  if (state.transactions.length > 100) state.transactions.splice(100);
  if (state.laborerLogs.length > 100) state.laborerLogs.splice(100);
  
  localStorage.setItem('albion_crafting_stocks', JSON.stringify(state.inventory));
  localStorage.setItem('albion_crafting_assets', JSON.stringify(state.assets));
  localStorage.setItem('albion_crafting_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('albion_crafting_laborer_stocks', JSON.stringify(state.laborerInventory));
  localStorage.setItem('albion_crafting_laborer_logs', JSON.stringify(state.laborerLogs));
  localStorage.setItem('albion_crafting_custom_locs', JSON.stringify(state.customLocations));
  callUIUpdate();
}