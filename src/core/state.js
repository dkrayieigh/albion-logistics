import { createBrowserNewSchemaRuntimeController } from '../adapters/browserNewSchemaRuntimeController.js';
import { createCleanInitialState } from '../adapters/cleanInitialState.js';
import { projectNewSchemaToRuntime } from '../adapters/newSchemaRuntimeBridge.js';
import { QUAL_GROUPS } from '../data/constants.js';
import { ALBION_DB } from '../data/albion_db.js';

export const state = { 
  assets: { cash: 0, debt: 0 },
  customLocations: [], 
  inventory: {}, 
  laborerInventory: { '鋼條': {}, '布料': {}, '板材': {}, '皮革': {}, '滿日記本': {} },
  laborerLogs: [], 
  transactions: [] 
};

export const craftingQueue = [];
export let currentCraftQuality = '';
export let currentBuyQuality = '';
let activeNewSchemaRuntimeController = null;
const CURRENT_RUNTIME_LOCATION_KEYS = [
  'LaborerIsland',
  'Fort Sterling',
  'Bridgewatch',
  'Lymhurst',
  'Martlock',
  'Thetford'
];
const SYSTEM_LOCATION_DISPLAY_NAMES = [
  'Thetford',
  'Martlock',
  'Bridgewatch',
  'Lymhurst',
  'Fort Sterling',
  'Caerleon',
  'Brecilien',
  'Laborer Island',
  'LaborerIsland'
];
const DEFAULT_NEW_SCHEMA_INITIALIZATION_INPUT = {
  cash: 0,
  debt: 0,
  customLocations: [],
  inventorySeeds: []
};

export function setCurrentCraftQuality(val) { currentCraftQuality = val || ''; }
export function setCurrentBuyQuality(val) { currentBuyQuality = val || ''; }

// 不再依賴 window 全域變數，改用 CustomEvent 發送廣播
function callUIUpdate() {
  document.dispatchEvent(new Event('stateUpdated'));
}

function cloneStateValue(value) {
  if (Array.isArray(value)) return value.map(item => cloneStateValue(item));
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneStateValue(item)])
  );
}

function locationResult(ok, status, locationId, errors = []) {
  return {
    ok,
    status,
    locationId,
    errors: [...errors]
  };
}

function normalizedLocationName(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function validateLocationRegistry() {
  if (!state.locationRegistry || typeof state.locationRegistry !== 'object' || Array.isArray(state.locationRegistry)) {
    return ['LOCATION_REGISTRY_UNAVAILABLE'];
  }
  return [];
}

function findActiveCustomLocationByName(name) {
  const normalized = normalizedLocationName(name);
  return Object.values(state.locationRegistry || {}).find(entry =>
    entry &&
    entry.type === 'custom' &&
    entry.active === true &&
    normalizedLocationName(entry.displayName) === normalized
  ) || null;
}

function validateCustomLocationName(name, existingLocationId = null) {
  const errors = validateLocationRegistry();
  const displayName = typeof name === 'string' ? name.trim() : '';
  const normalized = normalizedLocationName(displayName);

  if (!displayName) errors.push('INVALID_CUSTOM_LOCATION_NAME');
  if (displayName) {
    const duplicate = findActiveCustomLocationByName(displayName);
    if (duplicate && duplicate.locationId !== existingLocationId) errors.push('DUPLICATE_CUSTOM_LOCATION_NAME');
    if (SYSTEM_LOCATION_DISPLAY_NAMES.some(systemName => normalizedLocationName(systemName) === normalized)) {
      errors.push('SYSTEM_LOCATION_NAME_CONFLICT');
    }
  }

  return { displayName, errors };
}

function createStateSnapshot() {
  return cloneStateValue(state);
}

function restoreStateSnapshot(snapshot) {
  replaceStateContents(state, snapshot);
}

function generateCustomLocationId(options) {
  const generator = options.generateCustomLocationId || (() => `custom:${globalThis.crypto.randomUUID()}`);
  let locationId;

  try {
    locationId = generator();
  } catch {
    return null;
  }

  if (
    typeof locationId !== 'string' ||
    !locationId.startsWith('custom:') ||
    locationId.slice('custom:'.length).trim().length === 0 ||
    Object.hasOwn(state.locationRegistry || {}, locationId)
  ) {
    return null;
  }

  return locationId;
}

function saveLocationMutation(snapshot, status, locationId) {
  const saved = saveState();
  if (saved.ok) return locationResult(true, status, locationId);

  restoreStateSnapshot(snapshot);
  return locationResult(false, 'save-failed', locationId, saved.errors);
}

export function addCustomLocation(name, options = {}) {
  const { displayName, errors } = validateCustomLocationName(name);
  if (errors.length > 0) return locationResult(false, 'invalid-location', null, errors);

  const locationId = generateCustomLocationId(options);
  if (!locationId) {
    return locationResult(false, 'invalid-location', null, ['CUSTOM_LOCATION_ID_GENERATION_FAILED']);
  }

  const snapshot = createStateSnapshot();
  state.locationRegistry[locationId] = {
    locationId,
    displayName,
    type: 'custom',
    active: true
  };
  state.customLocations.push(displayName);
  for (const item of Object.values(state.inventory)) {
    if (!item.qtyByCity) item.qtyByCity = {};
    item.qtyByCity[displayName] = 0;
  }

  return saveLocationMutation(snapshot, 'location-added', locationId);
}

export function renameCustomLocation(oldName, newName) {
  const registryErrors = validateLocationRegistry();
  if (registryErrors.length > 0) return locationResult(false, 'invalid-location', null, registryErrors);

  const currentEntry = findActiveCustomLocationByName(oldName);
  if (!currentEntry) return locationResult(false, 'invalid-location', null, ['CUSTOM_LOCATION_NOT_FOUND']);

  const { displayName, errors } = validateCustomLocationName(newName, currentEntry.locationId);
  if (errors.length > 0) return locationResult(false, 'invalid-location', currentEntry.locationId, errors);
  if (normalizedLocationName(displayName) === normalizedLocationName(currentEntry.displayName)) {
    return locationResult(true, 'location-renamed', currentEntry.locationId);
  }

  const oldDisplayName = currentEntry.displayName;
  const snapshot = createStateSnapshot();
  currentEntry.displayName = displayName;
  state.customLocations = state.customLocations.map(location => (
    normalizedLocationName(location) === normalizedLocationName(oldDisplayName) ? displayName : location
  ));
  for (const item of Object.values(state.inventory)) {
    if (!item.qtyByCity) item.qtyByCity = {};
    if (Object.hasOwn(item.qtyByCity, oldDisplayName)) {
      const oldValue = item.qtyByCity[oldDisplayName];
      item.qtyByCity[displayName] = oldValue;
      delete item.qtyByCity[oldDisplayName];
    }
  }
  state.transactions.forEach(transaction => {
    if (transaction.location === oldDisplayName) transaction.location = displayName;
  });

  return saveLocationMutation(snapshot, 'location-renamed', currentEntry.locationId);
}

export function removeCustomLocation(name) {
  const registryErrors = validateLocationRegistry();
  if (registryErrors.length > 0) return locationResult(false, 'invalid-location', null, registryErrors);

  const currentEntry = findActiveCustomLocationByName(name);
  if (!currentEntry) return locationResult(false, 'invalid-location', null, ['CUSTOM_LOCATION_NOT_FOUND']);

  const displayName = currentEntry.displayName;
  const hasInventory = Object.values(state.inventory).some(item => {
    const quantity = item?.qtyByCity?.[displayName];
    return typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0;
  });
  if (hasInventory) {
    return locationResult(false, 'invalid-location', currentEntry.locationId, ['CUSTOM_LOCATION_HAS_INVENTORY']);
  }

  const snapshot = createStateSnapshot();
  currentEntry.active = false;
  state.customLocations = state.customLocations.filter(location => normalizedLocationName(location) !== normalizedLocationName(displayName));
  for (const item of Object.values(state.inventory)) {
    if (item.qtyByCity) delete item.qtyByCity[displayName];
  }

  return saveLocationMutation(snapshot, 'location-removed', currentEntry.locationId);
}

export function replaceStateContents(target, source) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  for (const [key, value] of Object.entries(source)) {
    target[key] = cloneStateValue(value);
  }
}

export function enableNewSchemaRuntime(storage) {
  const created = createBrowserNewSchemaRuntimeController(storage);

  if (!created.ok) {
    activeNewSchemaRuntimeController = null;
    return {
      ok: false,
      mode: 'blocked',
      state: null,
      sourceStatus: 'error',
      errors: [...created.errors]
    };
  }

  const result = created.controller.start();

  if (result.ok && result.mode === 'ready') {
    replaceStateContents(state, result.state);
    initDefaultState();
    activeNewSchemaRuntimeController = created.controller;
    callUIUpdate();
  } else {
    activeNewSchemaRuntimeController = null;
  }

  return result;
}

export function initializeNewSchemaRuntime(storage, input = DEFAULT_NEW_SCHEMA_INITIALIZATION_INPUT, options = {}) {
  activeNewSchemaRuntimeController = null;

  const initialized = createCleanInitialState(input, options);
  if (!initialized.ok) {
    return {
      ok: false,
      mode: 'blocked',
      state: null,
      sourceStatus: 'initialization-error',
      errors: [...initialized.errors]
    };
  }

  const created = createBrowserNewSchemaRuntimeController(storage);
  if (!created.ok) {
    return {
      ok: false,
      mode: 'blocked',
      state: null,
      sourceStatus: 'error',
      errors: [...created.errors]
    };
  }

  const projected = projectNewSchemaToRuntime(initialized.state);
  if (!projected.ok) {
    return {
      ok: false,
      mode: 'blocked',
      state: null,
      sourceStatus: 'initial-save-error',
      errors: [...projected.errors]
    };
  }

  const saved = created.controller.save(projected.state);
  if (!saved.ok) {
    return {
      ok: false,
      mode: 'blocked',
      state: null,
      sourceStatus: 'initial-save-error',
      errors: [...saved.errors]
    };
  }

  const ready = created.controller.start();
  if (ready.ok && ready.mode === 'ready') {
    replaceStateContents(state, ready.state);
    initDefaultState();
    activeNewSchemaRuntimeController = created.controller;
    callUIUpdate();
  }

  return ready;
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
         let initialQty = Object.fromEntries(CURRENT_RUNTIME_LOCATION_KEYS.map(location => [location, 0]));
         state.customLocations.forEach(c => initialQty[c] = 0);
         state.inventory[key] = { qtyByCity: initialQty, globalAvgCost: null };
      } else {
         if (!state.inventory[key].qtyByCity) state.inventory[key].qtyByCity = {};
         CURRENT_RUNTIME_LOCATION_KEYS.forEach(location => {
             if(state.inventory[key].qtyByCity[location] === undefined) state.inventory[key].qtyByCity[location] = 0;
         });
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
  if (typeof state.assets.debt !== 'number' || Number.isNaN(state.assets.debt)) state.assets.debt = 0;
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
  if (state.laborerLogs.length > 100) state.laborerLogs.splice(100);

  if (activeNewSchemaRuntimeController) {
    const result = activeNewSchemaRuntimeController.save(state);

    if (result.ok) callUIUpdate();
    return result;
  }
  
  localStorage.setItem('albion_crafting_stocks', JSON.stringify(state.inventory));
  localStorage.setItem('albion_crafting_assets', JSON.stringify(state.assets));
  localStorage.setItem('albion_crafting_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('albion_crafting_laborer_stocks', JSON.stringify(state.laborerInventory));
  localStorage.setItem('albion_crafting_laborer_logs', JSON.stringify(state.laborerLogs));
  localStorage.setItem('albion_crafting_custom_locs', JSON.stringify(state.customLocations));
  callUIUpdate();
  return {
    ok: true,
    status: 'legacy-saved',
    state: null,
    errors: []
  };
}
