import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLocationMap } from '../src/adapters/locationAdapter.js';
import { resolveLocationIdentity } from '../src/adapters/locationIdentity.js';
import { validateLocationMigration } from '../src/adapters/locationMigrationValidator.js';
import { createCleanInitialState } from '../src/adapters/cleanInitialState.js';
import {
  encodeNewSchemaState,
  decodeNewSchemaState
} from '../src/adapters/newSchemaStorageCodec.js';
import { createBackup } from '../src/adapters/newSchemaBackupCodec.js';
import {
  projectNewSchemaToRuntime,
  projectRuntimeToNewSchema
} from '../src/adapters/newSchemaRuntimeBridge.js';
import { createNewSchemaStorageRepository } from '../src/adapters/newSchemaStorageRepository.js';
import { createBrowserStorageBackend } from '../src/adapters/browserStorageBackend.js';
import { createBrowserNewSchemaRepository } from '../src/adapters/browserNewSchemaRepository.js';
import {
  loadBrowserNewSchemaState,
  resolveBrowserNewSchemaStartup
} from '../src/adapters/browserNewSchemaStartup.js';
import { createBrowserNewSchemaRuntimeController } from '../src/adapters/browserNewSchemaRuntimeController.js';
import { QUAL_GROUPS, SYSTEM_CITIES } from '../src/data/constants.js';

const elements = new Map();

function createElement(id = '') {
  return {
    id,
    value: '',
    handlers: {},
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
    click() {
      browserDownloadCount++;
    }
  };
}

function getElement(id) {
  if (!elements.has(id)) elements.set(id, createElement(id));
  return elements.get(id);
}

globalThis.document = {
  addEventListener() {},
  createElement: () => createElement(),
  dispatchEvent() {},
  getElementById: getElement,
  querySelectorAll: () => []
};
globalThis.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

const storage = new Map();
let alerts = [];
let confirmResult = true;
let confirmCalls = 0;
let createdBlob;
let reloadCount = 0;
let browserDownloadCount = 0;
let tauriInvocations = [];
let toastCalls = [];
let storageGetCalls = [];
let storageSetCalls = [];
let storageRemoveCalls = [];
let clearCalls = 0;
let fileReaderReads = 0;
let fileReaderShouldError = false;

globalThis.localStorage = {
  clear: () => {
    clearCalls++;
    storage.clear();
  },
  getItem: key => {
    storageGetCalls.push(key);
    return storage.get(key) ?? null;
  },
  setItem: (key, value) => {
    storageSetCalls.push({ key, value: String(value) });
    storage.set(key, String(value));
  },
  removeItem: key => {
    storageRemoveCalls.push(key);
    storage.delete(key);
  }
};

globalThis.alert = message => alerts.push(message);
globalThis.confirm = () => {
  confirmCalls++;
  return confirmResult;
};
globalThis.location = {
  reload: () => {
    reloadCount++;
  }
};
globalThis.window = {
  showToast() {}
};
globalThis.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    createdBlob = this;
  }
};
globalThis.URL = {
  createObjectURL: () => 'blob:backup',
  revokeObjectURL() {}
};
globalThis.FileReader = class FileReader {
  readAsText(file) {
    fileReaderReads++;
    if (fileReaderShouldError) {
      this.onerror({ target: { error: new Error('read failed') } });
      return;
    }
    this.onload({ target: { result: file.contents } });
  }
};

const { initGlobalEvents, startApplicationState } = await import('../src/app.js');
const {
  enableNewSchemaRuntime,
  initializeNewSchemaRuntime,
  initDefaultState,
  loadState,
  replaceStateContents,
  saveState,
  state,
  addCustomLocation,
  renameCustomLocation,
  removeCustomLocation
} = await import('../src/core/state.js');

window.showToast = (message, type) => toastCalls.push({ message, type });
initGlobalEvents();

const STORAGE_KEYS = {
  inventory: 'albion_crafting_stocks',
  assets: 'albion_crafting_assets',
  transactions: 'albion_crafting_transactions',
  laborerInventory: 'albion_crafting_laborer_stocks',
  laborerLogs: 'albion_crafting_laborer_logs',
  customLocations: 'albion_crafting_custom_locs'
};

function resetMocks() {
  storage.clear();
  alerts = [];
  confirmResult = true;
  confirmCalls = 0;
  createdBlob = undefined;
  reloadCount = 0;
  browserDownloadCount = 0;
  tauriInvocations = [];
  toastCalls = [];
  storageGetCalls = [];
  storageSetCalls = [];
  storageRemoveCalls = [];
  clearCalls = 0;
  fileReaderReads = 0;
  fileReaderShouldError = false;
  delete window.__TAURI__;
  getElement('import-file').value = '';
}

function resetExportTracking() {
  createdBlob = undefined;
  browserDownloadCount = 0;
  tauriInvocations = [];
  toastCalls = [];
  storageGetCalls = [];
  storageSetCalls = [];
  storageRemoveCalls = [];
  clearCalls = 0;
}

function resetResetTracking() {
  alerts = [];
  confirmCalls = 0;
  reloadCount = 0;
  storageGetCalls = [];
  storageSetCalls = [];
  storageRemoveCalls = [];
  clearCalls = 0;
}

function seedStorage(data) {
  for (const [field, value] of Object.entries(data)) {
    localStorage.setItem(STORAGE_KEYS[field], JSON.stringify(value));
  }
}

function seedV2Storage(canonical = makeRuntimeBridgeNewSchemaState()) {
  const encoded = encodeNewSchemaState(canonical);
  assert.equal(encoded.ok, true);
  localStorage.setItem(NEW_SCHEMA_STORAGE_KEY, encoded.serialized);
  return canonical;
}

function startProductionLegacyMode() {
  const result = startApplicationState(localStorage, {
    confirmEnableNewSchema: () => false,
    showBlockedError: errors => assert.fail(`unexpected blocked startup: ${errors.join(',')}`)
  });
  assert.equal(result.mode, 'legacy');
  return result;
}

function startProductionV2Mode(canonical = makeRuntimeBridgeNewSchemaState()) {
  seedV2Storage(canonical);
  const result = startApplicationState(localStorage, {
    showBlockedError: errors => assert.fail(`unexpected blocked startup: ${errors.join(',')}`)
  });
  assert.equal(result.mode, 'ready');
  return result;
}

function importBackup(data) {
  const target = {
    files: [{ contents: JSON.stringify(data) }],
    value: 'backup.json'
  };
  getElement('import-file').handlers.change({ target });
  return target;
}

function importBackupText(text) {
  const target = {
    files: [{ contents: text }],
    value: 'backup.json'
  };
  getElement('import-file').handlers.change({ target });
  return target;
}

function createV2BackupTextFromState(canonical = makeRuntimeBridgeNewSchemaState()) {
  const created = createBackup(canonical, {
    exportedAt: '2026-06-30T00:00:00.000Z'
  });

  assert.equal(created.ok, true);
  return created.backupText;
}

function storageSnapshot() {
  return JSON.stringify([...storage.entries()]);
}

function legacyLocationBackupFixture() {
  const customLocations = ['公會T8地堡', 'North Hideout / 北方倉'];
  return {
    inventory: {
      '布料_6.1': {
        qtyByCity: {
          Thetford: 120,
          Martlock: 5,
          [customLocations[0]]: 7
        },
        globalAvgCost: 12345
      },
      'TestProduct_6.1': {
        qtyByCity: {
          Bridgewatch: 3,
          [customLocations[1]]: 11
        },
        globalAvgCost: 98765
      }
    },
    assets: { cash: 7654321, debt: 0 },
    transactions: [],
    customLocations
  };
}

function makeLegacyLocationSnapshot() {
  return {
    inventory: {
      '布料_6.1': {
        qtyByCity: {
          Thetford: 120,
          LaborerIsland: 0,
          '公會T8地堡': 7
        },
        globalAvgCost: 12345
      },
      'TestProduct_6.1': {
        qtyByCity: {
          Bridgewatch: 3
        },
        globalAvgCost: 98765
      },
      'UnknownCostProduct_6.1': {
        qtyByCity: {
          Thetford: 0
        },
        globalAvgCost: null
      }
    },
    assets: {
      cash: 7654321
    },
    transactions: [
      { id: 1 },
      { id: 2 }
    ],
    customLocations: [
      '公會T8地堡'
    ]
  };
}

function makeFutureLocationSnapshot() {
  return {
    inventory: {
      '布料_6.1': {
        qtyByLocation: {
          thetford: 120,
          laborer_island: 0,
          'custom:sample-001': 7
        },
        globalAvgCost: 12345
      },
      'TestProduct_6.1': {
        qtyByLocation: {
          bridgewatch: 3
        },
        globalAvgCost: 98765
      },
      'UnknownCostProduct_6.1': {
        qtyByLocation: {
          thetford: 0
        },
        globalAvgCost: null
      }
    },
    assets: {
      cash: 7654321
    },
    transactions: [
      { id: 1 },
      { id: 2 }
    ],
    locationRegistry: [
      {
        locationId: 'custom:sample-001',
        displayName: '公會T8地堡'
      }
    ]
  };
}

function makeLocationMappings() {
  const legacy = makeLegacyLocationSnapshot();
  return {
    Thetford: 'thetford',
    LaborerIsland: 'laborer_island',
    [legacy.customLocations[0]]: 'custom:sample-001',
    Bridgewatch: 'bridgewatch'
  };
}

function primaryLocationItemKey() {
  return Object.keys(makeLegacyLocationSnapshot().inventory)[0];
}

const CLEAN_INITIALIZATION_FIXED_SYSTEM_REGISTRY = [
  'thetford',
  'martlock',
  'bridgewatch',
  'lymhurst',
  'fort_sterling',
  'caerleon',
  'brecilien',
  'laborer_island'
];

const CLEAN_INITIALIZATION_LABORER_CATEGORIES = [
  '鋼條',
  '布料',
  '板材',
  '皮革',
  '滿日誌'
];

const CLEAN_INITIALIZATION_SUPPORTED_QUALITIES =
  QUAL_GROUPS.flatMap(group => group.items);

const CLEAN_INITIALIZATION_ALL_LABORER_QUALITIES = [
  ...new Set([
    ...CLEAN_INITIALIZATION_SUPPORTED_QUALITIES,
    '4.0',
    '5.0',
    '6.0',
    '7.0',
    '8.0'
  ])
];

// Future contract only: validation errors are emitted in this order, each code at most once.
// INITIALIZATION_ABORTED is reserved for unclassified internal exception fallback.
const CLEAN_INITIALIZATION_ERROR_ORDER = [
  'INVALID_CASH',
  'INVALID_DEBT',
  'INVALID_CUSTOM_LOCATION_NAME',
  'DUPLICATE_CUSTOM_LOCATION_REF',
  'DUPLICATE_CUSTOM_LOCATION_NAME',
  'SYSTEM_LOCATION_NAME_CONFLICT',
  'CUSTOM_LOCATION_ID_GENERATION_FAILED',
  'INVALID_INVENTORY_SEED',
  'INVALID_LOCATION_REFERENCE',
  'INVALID_CUSTOM_LOCATION_REF',
  'UNKNOWN_LOCATION_ID',
  'DUPLICATE_INVENTORY_SEED',
  'INITIALIZATION_ABORTED'
];

function makeCleanInitializationInput() {
  return {
    cash: 5000000,
    debt: 0,
    customLocations: [
      {
        clientRef: 'warehouse-1',
        displayName: '公會倉庫'
      }
    ],
    inventorySeeds: [
      {
        itemKey: '布料_6.1',
        locationId: 'thetford',
        quantity: 54,
        globalAvgCost: null
      },
      {
        itemKey: '鋼條_6.2',
        customLocationRef: 'warehouse-1',
        quantity: 20,
        globalAvgCost: 28738
      }
    ]
  };
}

function makeCustomLocationIdGenerator() {
  return () => 'custom:test-001';
}

const NEW_SCHEMA_STORAGE_KEY = 'albion-logistics-v2-state';

const NEW_SCHEMA_STORAGE_ERROR_ORDER = [
  'INVALID_SERIALIZED_INPUT',
  'INVALID_JSON',
  'INVALID_ROOT_STATE',
  'UNSUPPORTED_SCHEMA_VERSION',
  'INVALID_ASSETS',
  'INVALID_LOCATION_REGISTRY',
  'INVALID_INVENTORY',
  'INVALID_TRANSACTIONS',
  'INVALID_LABORER_INVENTORY',
  'INVALID_LABORER_LOGS',
  'LEGACY_FIELD_NOT_ALLOWED',
  'STORAGE_CODEC_ABORTED'
];

function makeValidNewSchemaState() {
  const result = createCleanInitialState(
    makeCleanInitializationInput(),
    {
      generateCustomLocationId: makeCustomLocationIdGenerator()
    }
  );

  assert.equal(result.ok, true);
  return result.state;
}

function makeRuntimeBridgeNewSchemaState() {
  const state = makeValidNewSchemaState();
  const systemItemKey = Object.keys(state.inventory)[0];

  state.inventory[systemItemKey].qtyByLocation.laborer_island = 5;
  state.inventory[systemItemKey].globalAvgCost = 1234;
  state.transactions.push({
    type: 'bridge-sample',
    locationId: 'thetford',
    quantity: 2
  });
  state.laborerInventory['滿日誌']['6.1'] = 3;
  state.laborerInventory['皮革']['6.2'] = 11;
  state.laborerLogs.push({
    type: 'bridge-laborer-sample',
    item: '滿日誌',
    quality: '6.1'
  });

  return state;
}

function makeRuntimeControllerProjectionFailureState() {
  const state = makeRuntimeBridgeNewSchemaState();
  const itemKey = Object.keys(state.inventory)[0];

  state.locationRegistry['custom:laborer-collision'] = {
    locationId: 'custom:laborer-collision',
    displayName: 'LaborerIsland',
    type: 'custom',
    active: true
  };
  state.inventory[itemKey].qtyByLocation['custom:laborer-collision'] = 2;

  assert.equal(encodeNewSchemaState(state).ok, true);
  return state;
}

const NEW_SCHEMA_STORAGE_REPOSITORY_ERROR_ORDER = [
  'INVALID_STORAGE_BACKEND',
  'STORAGE_READ_FAILED',
  'STORAGE_WRITE_FAILED'
];

const LEGACY_STORAGE_KEYS = [
  'albion_crafting_stocks',
  'albion_crafting_assets',
  'albion_crafting_transactions',
  'albion_crafting_laborer_stocks',
  'albion_crafting_laborer_logs',
  'albion_crafting_custom_locs'
];

const OWNED_STORAGE_KEYS = [
  NEW_SCHEMA_STORAGE_KEY,
  ...LEGACY_STORAGE_KEYS
];

const UNRELATED_STORAGE_SENTINELS = {
  'unrelated-key': 'keep-unrelated',
  'albion-logistics-v2-state-extra': 'keep-v2-like',
  albion_crafting_unknown: 'keep-legacy-like'
};

const CURRENT_RUNTIME_LOCATION_KEYS = [
  'LaborerIsland',
  'Fort Sterling',
  'Bridgewatch',
  'Lymhurst',
  'Martlock',
  'Thetford'
];

function makeInjectedStorageBackend(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  const calls = [];

  return {
    calls,
    entries,

    getItem(key) {
      calls.push({ method: 'getItem', key });
      return entries.has(key) ? entries.get(key) : null;
    },

    setItem(key, value) {
      calls.push({ method: 'setItem', key, value });
      entries.set(key, value);
    }
  };
}

function makeValidSerializedNewSchemaState() {
  const encoded = encodeNewSchemaState(makeValidNewSchemaState());

  assert.equal(encoded.ok, true);
  return encoded.serialized;
}

function seedOwnedStorage(entries = makeOwnedStorageEntries()) {
  for (const [key, value] of Object.entries(entries)) {
    localStorage.setItem(key, value);
  }
}

function makeOwnedStorageEntries(prefix = 'owned') {
  return Object.fromEntries(OWNED_STORAGE_KEYS.map((key, index) => [key, `${prefix}:${index}:${key}`]));
}

function seedUnrelatedStorageSentinels() {
  for (const [key, value] of Object.entries(UNRELATED_STORAGE_SENTINELS)) {
    localStorage.setItem(key, value);
  }
}

function assertOwnedStorageAbsent() {
  for (const key of OWNED_STORAGE_KEYS) assert.equal(storage.has(key), false, key);
}

function assertOwnedStorageRestored(snapshot) {
  for (const key of OWNED_STORAGE_KEYS) {
    if (Object.hasOwn(snapshot, key)) assert.equal(storage.get(key), snapshot[key], key);
    else assert.equal(storage.has(key), false, key);
  }
}

function assertUnrelatedSentinelsUntouched() {
  for (const [key, value] of Object.entries(UNRELATED_STORAGE_SENTINELS)) {
    assert.equal(storage.get(key), value, key);
    assert.equal(storageGetCalls.includes(key), false, key);
    assert.equal(storageSetCalls.some(call => call.key === key), false, key);
    assert.equal(storageRemoveCalls.includes(key), false, key);
  }
}

function runFactoryReset() {
  getElement('btn-reset-system').handlers.click();
}

const BROWSER_STORAGE_BACKEND_ERROR_ORDER = [
  'INVALID_BROWSER_STORAGE'
];

function makeBrowserStorageDouble(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  const calls = [];

  return {
    entries,
    calls,

    getItem(key) {
      calls.push({ method: 'getItem', key });
      return entries.has(key) ? entries.get(key) : null;
    },

    setItem(key, value) {
      calls.push({ method: 'setItem', key, value });
      entries.set(key, String(value));
    },

    removeItem(key) {
      calls.push({ method: 'removeItem', key });
      entries.delete(key);
    }
  };
}

function makeFailingWriteBrowserStorageDouble(initialEntries = {}) {
  const storageDouble = makeBrowserStorageDouble(initialEntries);
  storageDouble.setItem = (key, value) => {
    storageDouble.calls.push({ method: 'setItem', key, value });
    throw new Error('write failed');
  };
  return storageDouble;
}

function clearCanonicalCustomLocationQuantities(canonical, locationId = 'custom:test-001') {
  for (const item of Object.values(canonical.inventory)) {
    if (item.qtyByLocation && Object.hasOwn(item.qtyByLocation, locationId)) {
      item.qtyByLocation[locationId] = 0;
    }
  }
}

function startReadyRuntimeWithCanonical(canonical = makeRuntimeBridgeNewSchemaState(), storageOverrides = {}) {
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized,
    ...storageOverrides
  });

  const result = enableNewSchemaRuntime(storageDouble);
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'ready');
  return storageDouble;
}

function decodeStoredRuntime(storageDouble) {
  const decoded = decodeNewSchemaState(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY));
  assert.equal(decoded.ok, true);
  return decoded.state;
}

function customIdGenerator(...ids) {
  let index = 0;
  return () => ids[index++];
}

test('TEST-B04: Factory Reset confirmation cancel does not compose backend mutate clear or reload', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  seedOwnedStorage();
  seedUnrelatedStorageSentinels();
  resetResetTracking();
  confirmResult = false;

  runFactoryReset();

  assert.equal(confirmCalls, 1);
  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 0);
  assert.deepEqual(alerts, []);
});

test('TEST-B04: Factory Reset clears all owned keys in v2 mode through scoped service only', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  startProductionV2Mode(canonical);
  for (const key of LEGACY_STORAGE_KEYS) localStorage.setItem(key, `legacy:${key}`);
  seedUnrelatedStorageSentinels();
  const beforeRuntime = JSON.stringify(state);
  resetResetTracking();

  runFactoryReset();

  assert.equal(confirmCalls, 1);
  assertOwnedStorageAbsent();
  assertUnrelatedSentinelsUntouched();
  assert.deepEqual(storageGetCalls, [...OWNED_STORAGE_KEYS, ...OWNED_STORAGE_KEYS]);
  assert.deepEqual(storageRemoveCalls, OWNED_STORAGE_KEYS);
  assert.deepEqual(storageSetCalls, []);
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 1);
  assert.equal(alerts.some(message => /成功|清除/.test(message)), true);
  assert.equal(JSON.stringify(state), beforeRuntime);
});

test('TEST-B04: Factory Reset in legacy mode removes legacy keys and v2 sentinel', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  seedOwnedStorage(makeOwnedStorageEntries('legacy-mode'));
  seedUnrelatedStorageSentinels();
  resetResetTracking();

  runFactoryReset();

  assertOwnedStorageAbsent();
  assertUnrelatedSentinelsUntouched();
  assert.deepEqual(storageRemoveCalls, OWNED_STORAGE_KEYS);
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 1);
});

test('TEST-B04: Factory Reset can recover blocked startup by scoped owned-key reset', { concurrency: false }, () => {
  resetMocks();
  localStorage.setItem(NEW_SCHEMA_STORAGE_KEY, '{"schemaVersion":2}');
  for (const key of LEGACY_STORAGE_KEYS) localStorage.setItem(key, `legacy:${key}`);
  seedUnrelatedStorageSentinels();
  const startup = startApplicationState(localStorage, {
    showBlockedError() {}
  });
  assert.equal(startup.ok, false);
  resetResetTracking();

  runFactoryReset();

  assertOwnedStorageAbsent();
  assertUnrelatedSentinelsUntouched();
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 1);
});

test('TEST-B04: Factory Reset reports reset-noop without writes clears or reload', { concurrency: false }, () => {
  resetMocks();
  seedUnrelatedStorageSentinels();
  resetResetTracking();

  runFactoryReset();

  assert.deepEqual(storageGetCalls, OWNED_STORAGE_KEYS);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 0);
  assert.equal(alerts.some(message => /沒有|無/.test(message) && /清除|資料/.test(message)), true);
  assertUnrelatedSentinelsUntouched();
});

test('TEST-B04: Factory Reset reports backend composition failure without mutation or reload', { concurrency: false }, () => {
  resetMocks();
  seedOwnedStorage();
  seedUnrelatedStorageSentinels();
  resetResetTracking();
  const originalRemoveItem = localStorage.removeItem;
  Object.defineProperty(localStorage, 'removeItem', {
    configurable: true,
    get() {
      throw new Error('remove getter failed');
    }
  });

  try {
    runFactoryReset();
  } finally {
    Object.defineProperty(localStorage, 'removeItem', {
      configurable: true,
      writable: true,
      value: originalRemoveItem
    });
  }

  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /INVALID_BROWSER_STORAGE/);
  assertUnrelatedSentinelsUntouched();
});

test('TEST-B04: Factory Reset remove failure rolls back exact owned snapshot without reload', { concurrency: false }, () => {
  resetMocks();
  const snapshot = makeOwnedStorageEntries('remove-failure');
  snapshot[NEW_SCHEMA_STORAGE_KEY] = '{malformed-v2-raw';
  seedOwnedStorage(snapshot);
  seedUnrelatedStorageSentinels();
  resetResetTracking();
  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = key => {
    storageRemoveCalls.push(key);
    storage.delete(key);
    if (key === LEGACY_STORAGE_KEYS[2]) throw new Error('remove failed');
  };

  try {
    runFactoryReset();
  } finally {
    localStorage.removeItem = originalRemoveItem;
  }

  assertOwnedStorageRestored(snapshot);
  assertUnrelatedSentinelsUntouched();
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /STORAGE_REMOVE_FAILED/);
});

test('TEST-B04: Factory Reset verification failure rolls back exact snapshot without reload', { concurrency: false }, () => {
  resetMocks();
  const snapshot = makeOwnedStorageEntries('verification-failure');
  seedOwnedStorage(snapshot);
  seedUnrelatedStorageSentinels();
  resetResetTracking();
  const originalGetItem = localStorage.getItem;
  localStorage.getItem = key => {
    storageGetCalls.push(key);
    const resetVerification = storageRemoveCalls.length === OWNED_STORAGE_KEYS.length &&
      storageSetCalls.length === 0;
    if (resetVerification && key === LEGACY_STORAGE_KEYS[0]) return 'reappeared';
    return storage.get(key) ?? null;
  };

  try {
    runFactoryReset();
  } finally {
    localStorage.getItem = originalGetItem;
  }

  assertOwnedStorageRestored(snapshot);
  assertUnrelatedSentinelsUntouched();
  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /STORAGE_VERIFICATION_FAILED/);
});

test('TEST-B04: Factory Reset rollback failure reports fatal codes without retry clear or reload', { concurrency: false }, () => {
  resetMocks();
  const snapshot = makeOwnedStorageEntries('rollback-failure');
  seedOwnedStorage(snapshot);
  seedUnrelatedStorageSentinels();
  resetResetTracking();
  const originalRemoveItem = localStorage.removeItem;
  const originalSetItem = localStorage.setItem;
  localStorage.removeItem = key => {
    storageRemoveCalls.push(key);
    storage.delete(key);
    if (key === LEGACY_STORAGE_KEYS[2]) throw new Error('remove failed');
  };
  localStorage.setItem = (key, value) => {
    storageSetCalls.push({ key, value: String(value) });
    if (key === NEW_SCHEMA_STORAGE_KEY) throw new Error('rollback set failed');
    storage.set(key, String(value));
  };

  try {
    runFactoryReset();
  } finally {
    localStorage.removeItem = originalRemoveItem;
    localStorage.setItem = originalSetItem;
  }

  assert.equal(clearCalls, 0);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /ROLLBACK_FAILED/);
  assert.match(alerts.at(-1) || '', /STORAGE_REMOVE_FAILED/);
  assert.match(alerts.at(-1) || '', /STORAGE_WRITE_FAILED/);
  assert.equal(storageRemoveCalls.filter(key => key === LEGACY_STORAGE_KEYS[2]).length, 1);
  assertUnrelatedSentinelsUntouched();
});

test('TEST-B04: resetSystemData source no longer calls localStorage.clear', { concurrency: false }, () => {
  const source = readFileSync('src/app.js', 'utf8');
  const resetStart = source.indexOf('function resetSystemData()');
  const nextFunction = source.indexOf('function setTierHintVisibility', resetStart);
  const resetSource = source.slice(resetStart, nextFunction);

  assert.doesNotMatch(resetSource, /localStorage\.clear\s*\(/);
});

test('TEST-B04: Tauri save dialog exports readable JSON without browser fallback', { concurrency: false }, async () => {
  resetMocks();
  const transactions = Array.from({ length: 150 }, (_, index) => ({ id: index + 1, type: '測試交易' }));
  seedStorage({
    inventory: { '布料_6.1': { qtyByCity: { Thetford: 500 }, globalAvgCost: 6000 } },
    assets: { cash: 3000000, debt: 0 },
    transactions,
    laborerInventory: { 布料: { '6.1': 10 } },
    laborerLogs: [{ type: '測試工人紀錄' }],
    customLocations: ['測試倉庫']
  });
  startProductionLegacyMode();
  resetExportTracking();
  window.__TAURI__ = {
    core: {
      invoke: async (command, args, options) => {
        tauriInvocations.push({ command, args, options });
        if (command === 'plugin:dialog|save') return 'D:\\backups\\custom-name.json';
      }
    }
  };

  await getElement('btn-export-data').handlers.click();

  assert.equal(createdBlob, undefined);
  assert.equal(browserDownloadCount, 0);
  assert.deepEqual(tauriInvocations.map(call => call.command), ['plugin:dialog|save', 'plugin:fs|write_text_file']);
  const exportedText = new TextDecoder().decode(tauriInvocations[1].args);
  assert.match(exportedText, /\n  "inventory": \{/);
  const exported = JSON.parse(exportedText);
  assert.equal(Object.hasOwn(exported, 'format'), false);
  assert.equal(typeof exported.inventory, 'object');
  assert.equal(Array.isArray(exported.inventory), false);
  assert.equal(typeof exported.assets, 'object');
  assert.equal(Array.isArray(exported.assets), false);
  assert.equal(Array.isArray(exported.transactions), true);
  assert.equal(exported.transactions.length, 150);
});

test('TEST-B04: cancelling Tauri save dialog writes nothing and does not fall back', { concurrency: false }, async () => {
  resetMocks();
  seedStorage({ inventory: {}, assets: { cash: 0, debt: 0 }, transactions: [] });
  startProductionLegacyMode();
  resetExportTracking();
  window.__TAURI__ = {
    core: {
      invoke: async command => {
        tauriInvocations.push({ command });
        return null;
      }
    }
  };

  await getElement('btn-export-data').handlers.click();

  assert.deepEqual(tauriInvocations.map(call => call.command), ['plugin:dialog|save']);
  assert.equal(createdBlob, undefined);
  assert.equal(browserDownloadCount, 0);
});

test('TEST-B04: browser fallback exports readable JSON when Tauri API is unavailable', { concurrency: false }, async () => {
  resetMocks();
  seedStorage({ inventory: {}, assets: { cash: 0, debt: 0 }, transactions: [{ id: 1 }] });
  startProductionLegacyMode();
  resetExportTracking();

  await getElement('btn-export-data').handlers.click();

  assert.equal(browserDownloadCount, 1);
  assert.ok(createdBlob);
  const exported = JSON.parse(createdBlob.parts.join(''));
  assert.equal(Object.hasOwn(exported, 'format'), false);
  assert.equal(Array.isArray(exported.transactions), true);
  assert.equal(exported.transactions.length, 1);
});

test('TEST-B04: v2 browser export writes exact backup envelope without legacy root fields', { concurrency: false }, async () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  startProductionV2Mode(canonical);
  const beforeState = JSON.stringify(state);
  const beforeV2Raw = localStorage.getItem(NEW_SCHEMA_STORAGE_KEY);
  resetExportTracking();

  await getElement('btn-export-data').handlers.click();

  assert.equal(browserDownloadCount, 1);
  assert.ok(createdBlob);
  assert.deepEqual(tauriInvocations, []);
  assert.deepEqual(toastCalls.map(call => call.type), ['success']);
  const exported = JSON.parse(createdBlob.parts.join(''));
  assert.equal(exported.format, 'albion-logistics-backup');
  assert.equal(exported.backupFormatVersion, 1);
  assert.equal(new Date(exported.exportedAt).toISOString(), exported.exportedAt);
  assert.match(exported.exportedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(Object.hasOwn(exported, 'inventory'), false);
  assert.equal(Object.hasOwn(exported, 'assets'), false);
  assert.equal(Object.hasOwn(exported, 'transactions'), false);
  const itemKey = Object.keys(canonical.inventory)[0];
  assert.equal(exported.state.inventory[itemKey].qtyByLocation.laborer_island, 5);
  assert.equal(Object.hasOwn(exported.state.inventory[itemKey], 'qtyByCity'), false);
  assert.equal(localStorage.getItem(NEW_SCHEMA_STORAGE_KEY), beforeV2Raw);
  assert.equal(JSON.stringify(state), beforeState);
});

test('TEST-B04: v2 Tauri export writes envelope after save dialog without legacy payload', { concurrency: false }, async () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();
  window.__TAURI__ = {
    core: {
      invoke: async (command, args, options) => {
        tauriInvocations.push({ command, args, options });
        if (command === 'plugin:dialog|save') return 'D:\\backups\\v2.json';
      }
    }
  };

  await getElement('btn-export-data').handlers.click();

  assert.equal(createdBlob, undefined);
  assert.equal(browserDownloadCount, 0);
  assert.deepEqual(tauriInvocations.map(call => call.command), ['plugin:dialog|save', 'plugin:fs|write_text_file']);
  const exported = JSON.parse(new TextDecoder().decode(tauriInvocations[1].args));
  assert.equal(exported.format, 'albion-logistics-backup');
  assert.equal(exported.backupFormatVersion, 1);
  assert.equal(Object.hasOwn(exported, 'inventory'), false);
  assert.equal(Object.hasOwn(exported, 'assets'), false);
  assert.equal(Object.hasOwn(exported, 'transactions'), false);
  assert.deepEqual(toastCalls.map(call => call.type), ['success']);
});

test('TEST-B04: v2 export ignores invalid legacy source keys and does not use legacy helper', { concurrency: false }, async () => {
  resetMocks();
  for (const key of LEGACY_STORAGE_KEYS) localStorage.setItem(key, 'not-json legacy sentinel');
  startProductionV2Mode();
  resetExportTracking();

  await getElement('btn-export-data').handlers.click();

  assert.equal(browserDownloadCount, 1);
  assert.ok(createdBlob);
  const exported = JSON.parse(createdBlob.parts.join(''));
  assert.equal(exported.format, 'albion-logistics-backup');
  assert.deepEqual(storageGetCalls, [NEW_SCHEMA_STORAGE_KEY]);
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(localStorage.getItem(key), 'not-json legacy sentinel');
  }
});

test('TEST-B04: v2 invalid or missing source blocks export without fallback transport', { concurrency: false }, async () => {
  resetMocks();
  startProductionV2Mode();
  localStorage.setItem(NEW_SCHEMA_STORAGE_KEY, JSON.stringify({ schemaVersion: 2 }));
  resetExportTracking();

  await getElement('btn-export-data').handlers.click();

  assert.equal(createdBlob, undefined);
  assert.equal(browserDownloadCount, 0);
  assert.deepEqual(tauriInvocations, []);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].type, 'error');
  assert.match(toastCalls[0].message, /INVALID_BACKUP_STATE|UNSUPPORTED_SCHEMA_VERSION/);

  resetMocks();
  startProductionV2Mode();
  storage.delete(NEW_SCHEMA_STORAGE_KEY);
  resetExportTracking();
  await getElement('btn-export-data').handlers.click();

  assert.equal(createdBlob, undefined);
  assert.equal(browserDownloadCount, 0);
  assert.deepEqual(tauriInvocations, []);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].type, 'error');
  assert.match(toastCalls[0].message, /BACKUP_SOURCE_MISSING/);
});

test('TEST-B04: blocked or uninitialized export stops before dialog download or legacy read', { concurrency: false }, async () => {
  resetMocks();
  localStorage.setItem(NEW_SCHEMA_STORAGE_KEY, JSON.stringify({ schemaVersion: 2 }));
  const startup = startApplicationState(localStorage, {
    confirmEnableNewSchema: () => assert.fail('blocked startup should not confirm initialization'),
    showBlockedError: () => {}
  });
  assert.equal(startup.mode, 'blocked');
  resetExportTracking();

  await getElement('btn-export-data').handlers.click();

  assert.equal(createdBlob, undefined);
  assert.equal(browserDownloadCount, 0);
  assert.deepEqual(tauriInvocations, []);
  assert.deepEqual(storageGetCalls, []);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].type, 'error');
});

test('TEST-B04: export confirmation cancel stops before repository export dialog or download', { concurrency: false }, async () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();
  confirmResult = false;

  await getElement('btn-export-data').handlers.click();

  assert.equal(createdBlob, undefined);
  assert.equal(browserDownloadCount, 0);
  assert.deepEqual(tauriInvocations, []);
  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(toastCalls, []);
});

test('TEST-B04: v2 export does not mutate v2 storage legacy keys or runtime state', { concurrency: false }, async () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  startProductionV2Mode(canonical);
  for (const key of LEGACY_STORAGE_KEYS) localStorage.setItem(key, `legacy:${key}`);
  const beforeStorage = storageSnapshot();
  const beforeRuntime = JSON.stringify(state);
  resetExportTracking();

  await getElement('btn-export-data').handlers.click();

  assert.equal(browserDownloadCount, 1);
  assert.equal(storageSnapshot(), beforeStorage);
  assert.equal(JSON.stringify(state), beforeRuntime);
});

test('TEST-B04: valid v2 backup imports through production restore service only', { concurrency: false }, () => {
  resetMocks();
  const initialCanonical = makeRuntimeBridgeNewSchemaState();
  const importedCanonical = makeRuntimeBridgeNewSchemaState();
  const itemKey = Object.keys(importedCanonical.inventory)[0];
  importedCanonical.inventory[itemKey].qtyByLocation.thetford = 42;
  startProductionV2Mode(initialCanonical);
  for (const key of LEGACY_STORAGE_KEYS) localStorage.setItem(key, `legacy:${key}`);
  const beforeRuntime = JSON.stringify(state);
  const beforeLegacy = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, localStorage.getItem(key)]));
  resetExportTracking();

  importBackupText(createV2BackupTextFromState(importedCanonical));

  assert.equal(confirmCalls, 1);
  assert.equal(reloadCount, 1);
  assert.equal(alerts.some(message => /匯入成功/.test(message)), true);
  assert.deepEqual(storageSetCalls.map(call => call.key), [NEW_SCHEMA_STORAGE_KEY]);
  assert.deepEqual(storageRemoveCalls, []);
  assert.deepEqual(Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, localStorage.getItem(key)])), beforeLegacy);
  const decodedImported = decodeNewSchemaState(localStorage.getItem(NEW_SCHEMA_STORAGE_KEY));
  assert.equal(decodedImported.ok, true);
  assert.deepEqual(decodedImported.state, importedCanonical);
  assert.equal(JSON.stringify(state), beforeRuntime);
});

test('TEST-B04: valid v2 import cancel does not compose backend mutate or reload', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();
  confirmResult = false;
  const before = storageSnapshot();

  importBackupText(createV2BackupTextFromState());

  assert.equal(confirmCalls, 1);
  assert.equal(storageSnapshot(), before);
  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.equal(alerts.some(message => /匯入成功/.test(message)), false);
});

test('TEST-B04: invalid v2 import preflight stops before confirm backend mutation or reload', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();

  importBackupText('{invalid');

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /INVALID_JSON/);
});

test('TEST-B04: invalid v2 envelope reports stable codes without mutation', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();
  const invalidEnvelope = JSON.stringify({
    format: 'albion-logistics-backup',
    backupFormatVersion: 1,
    exportedAt: 'not-a-date',
    state: {}
  });

  importBackupText(invalidEnvelope);

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /INVALID_EXPORTED_AT/);
  assert.match(alerts.at(-1) || '', /INVALID_BACKUP_STATE/);
});

test('TEST-B04: legacy backup in v2 mode requires legacy path without mutation', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();

  importBackup({ inventory: {}, assets: { cash: 0, debt: 0 }, transactions: [] });

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /LEGACY_BACKUP_REQUIRES_LEGACY_PATH/);
});

test('TEST-B04: v2 import reports invalid storage backend without reload', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();
  const originalRemoveItem = localStorage.removeItem;
  delete localStorage.removeItem;

  try {
    importBackupText(createV2BackupTextFromState());
  } finally {
    localStorage.removeItem = originalRemoveItem;
  }

  assert.equal(confirmCalls, 1);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /INVALID_STORAGE_BACKEND/);
});

test('TEST-B04: v2 import verification failure restores old v2 raw and does not reload', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  const oldRaw = localStorage.getItem(NEW_SCHEMA_STORAGE_KEY);
  resetExportTracking();
  const originalGetItem = localStorage.getItem;
  let readCount = 0;
  localStorage.getItem = key => {
    storageGetCalls.push(key);
    if (key !== NEW_SCHEMA_STORAGE_KEY) return originalGetItem.call(localStorage, key);
    readCount++;
    if (readCount === 2) return '{"schemaVersion":2}';
    return storage.get(key) ?? null;
  };

  try {
    importBackupText(createV2BackupTextFromState());
  } finally {
    localStorage.getItem = originalGetItem;
  }

  assert.equal(localStorage.getItem(NEW_SCHEMA_STORAGE_KEY), oldRaw);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /STORAGE_VERIFICATION_FAILED/);
});

test('TEST-B04: v2 import rollback failure reports fatal code without retry or reload', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();
  const originalGetItem = localStorage.getItem;
  let readCount = 0;
  localStorage.getItem = key => {
    storageGetCalls.push(key);
    if (key !== NEW_SCHEMA_STORAGE_KEY) return originalGetItem.call(localStorage, key);
    readCount++;
    if (readCount >= 2) return '{"schemaVersion":2}';
    return storage.get(key) ?? null;
  };

  try {
    importBackupText(createV2BackupTextFromState());
  } finally {
    localStorage.getItem = originalGetItem;
  }

  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /ROLLBACK_FAILED/);
  assert.equal(storageSetCalls.filter(call => call.key === NEW_SCHEMA_STORAGE_KEY).length, 2);
});

test('TEST-B04: blocked production mode rejects import before FileReader or mutation', { concurrency: false }, () => {
  resetMocks();
  localStorage.setItem(NEW_SCHEMA_STORAGE_KEY, '{"schemaVersion":2}');
  const startup = startApplicationState(localStorage, {
    showBlockedError() {}
  });
  assert.equal(startup.ok, false);
  resetExportTracking();

  importBackupText(createV2BackupTextFromState());

  assert.equal(fileReaderReads, 0);
  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /IMPORT_MODE_BLOCKED/);
});

test('TEST-B04: FileReader error reports read failure and clears input without mutation', { concurrency: false }, () => {
  resetMocks();
  startProductionV2Mode();
  resetExportTracking();
  fileReaderShouldError = true;

  const target = importBackupText(createV2BackupTextFromState());

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageGetCalls, []);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.equal(target.value, '');
  assert.match(alerts.at(-1) || '', /IMPORT_READ_FAILED/);
});

test('TEST-B04: legacy import cancel does not mutate storage or reload', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  resetExportTracking();
  confirmResult = false;

  importBackup({ inventory: {}, assets: { cash: 0, debt: 0 }, transactions: [] });

  assert.equal(confirmCalls, 1);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
});

test('TEST-B04: v2 envelope in legacy mode is rejected without legacy writes', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  resetExportTracking();

  importBackupText(createV2BackupTextFromState());

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /JSON 格式不符|JSON 解析錯誤/);
});

test('TEST-B04: legacy import rejects mixed v2 envelope and legacy roots before field parsing', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  resetExportTracking();
  const mixedBackup = {
    format: 'albion-logistics-backup',
    backupFormatVersion: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    state: makeRuntimeBridgeNewSchemaState(),
    inventory: {},
    assets: { cash: 0, debt: 0 },
    transactions: []
  };

  importBackupText(JSON.stringify(mixedBackup));

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /AMBIGUOUS_BACKUP_FORMAT/);
});

test('TEST-B04: legacy import rejects unknown format marker with legacy roots as ambiguous', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  resetExportTracking();

  importBackupText(JSON.stringify({
    format: 'unknown-backup',
    inventory: {},
    assets: { cash: 0, debt: 0 },
    transactions: []
  }));

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /AMBIGUOUS_BACKUP_FORMAT/);
});

test('TEST-B04: legacy import rejects unknown format marker without legacy roots as unsupported', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  resetExportTracking();

  importBackupText(JSON.stringify({
    format: 'unknown-backup',
    state: {}
  }));

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /UNSUPPORTED_BACKUP_FORMAT/);
});

test('TEST-B04: legacy import rejects malformed root before confirm or mutation', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  resetExportTracking();

  importBackupText(JSON.stringify([]));

  assert.equal(confirmCalls, 0);
  assert.deepEqual(storageSetCalls, []);
  assert.deepEqual(storageRemoveCalls, []);
  assert.equal(reloadCount, 0);
  assert.match(alerts.at(-1) || '', /INVALID_BACKUP_ROOT/);
});

test('TEST-B04: valid legacy import preserves existing v2 raw string', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  localStorage.setItem(NEW_SCHEMA_STORAGE_KEY, 'sentinel-v2-raw');
  resetExportTracking();

  importBackup({
    inventory: {},
    assets: { cash: 1, debt: 0 },
    transactions: [],
    laborerInventory: {},
    laborerLogs: [],
    customLocations: []
  });

  assert.equal(confirmCalls, 1);
  assert.equal(reloadCount, 1);
  assert.equal(localStorage.getItem(NEW_SCHEMA_STORAGE_KEY), 'sentinel-v2-raw');
  assert.deepEqual(storageSetCalls.map(call => call.key), LEGACY_STORAGE_KEYS);
  assert.deepEqual(storageRemoveCalls, []);
});

test('TEST-B04: readable JSON backup imports, reloads, and remains loadState-compatible', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const transactions = Array.from({ length: 150 }, (_, index) => ({ id: index + 1, type: '新格式交易' }));
  const inventory = {
    '布料_6.1': {
      qtyByCity: { Thetford: 500 },
      globalAvgCost: 6000
    }
  };
  const assets = { cash: 3000000, debt: 0 };

  importBackup({ inventory, assets, transactions });

  assert.equal(reloadCount, 1);
  assert.equal(typeof localStorage.getItem(STORAGE_KEYS.inventory), 'string');
  assert.equal(typeof localStorage.getItem(STORAGE_KEYS.assets), 'string');
  assert.equal(typeof localStorage.getItem(STORAGE_KEYS.transactions), 'string');
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)).length, 150);

  loadState();
  assert.deepEqual(state.assets, assets);
  assert.equal(state.inventory['布料_6.1'].qtyByCity.Thetford, 500);
  assert.equal(state.inventory['布料_6.1'].globalAvgCost, 6000);
  for (const location of CURRENT_RUNTIME_LOCATION_KEYS) {
    assert.equal(Object.hasOwn(state.inventory['布料_6.1'].qtyByCity, location), true);
  }
  assert.equal(state.transactions.length, 150);
});

test('TEST-B04: legacy JSON-string backup imports without losing transactions', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const transactions = Array.from({ length: 150 }, (_, index) => ({ id: index + 1, type: '舊格式交易' }));
  const inventory = { '布料_6.1': { qtyByCity: { Thetford: 500 }, globalAvgCost: 6000 } };
  const assets = { cash: 3000000, debt: 0 };

  importBackup({
    inventory: JSON.stringify(inventory),
    assets: JSON.stringify(assets),
    transactions: JSON.stringify(transactions)
  });

  assert.equal(reloadCount, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory)), inventory);
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEYS.assets)), assets);
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)), transactions);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)).length, 150);
});

test('D63: legacy Chinese item key backup import preserves qtyByCity, globalAvgCost, and cash', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const inventory = {
    '布料_6.1': {
      qtyByCity: {
        Thetford: 120,
        Martlock: 5
      },
      globalAvgCost: 12345
    }
  };
  const assets = { cash: 7654321, debt: 0 };
  const transactions = [];

  importBackup({ inventory, assets, transactions });

  assert.equal(reloadCount, 1);
  const importedInventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory));
  const importedAssets = JSON.parse(localStorage.getItem(STORAGE_KEYS.assets));
  assert.equal(Object.hasOwn(importedInventory, '布料_6.1'), true);
  assert.deepEqual(importedInventory['布料_6.1'].qtyByCity, inventory['布料_6.1'].qtyByCity);
  assert.equal(Object.hasOwn(importedInventory['布料_6.1'], 'qtyByLocation'), false);
  assert.equal(importedInventory['布料_6.1'].globalAvgCost, 12345);
  assert.equal(importedAssets.cash, 7654321);

  loadState();
  assert.equal(state.inventory['布料_6.1'].qtyByCity.Thetford, 120);
  assert.equal(state.inventory['布料_6.1'].qtyByCity.Martlock, 5);
  assert.equal(state.inventory['布料_6.1'].globalAvgCost, 12345);
  assert.equal(state.assets.cash, 7654321);
});

test('D63: legacy customLocations string backup import preserves custom warehouse qtyByCity', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const customLocation = '公會T8地堡';
  const inventory = {
    '布料_6.1': {
      qtyByCity: {
        Thetford: 10,
        [customLocation]: 7
      },
      globalAvgCost: 6000
    }
  };
  const assets = { cash: 100000, debt: 0 };
  const transactions = [];
  const customLocations = [customLocation];

  importBackup({ inventory, assets, transactions, customLocations });

  assert.equal(reloadCount, 1);
  const importedInventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory));
  const importedCustomLocations = JSON.parse(localStorage.getItem(STORAGE_KEYS.customLocations));
  assert.deepEqual(importedCustomLocations, customLocations);
  assert.equal(typeof importedCustomLocations[0], 'string');
  assert.equal(Object.hasOwn(importedCustomLocations[0], 'id'), false);
  assert.equal(importedInventory['布料_6.1'].qtyByCity[customLocation], 7);
  assert.equal(Object.hasOwn(importedInventory['布料_6.1'], 'qtyByLocation'), false);

  loadState();
  assert.deepEqual(state.customLocations, customLocations);
  assert.equal(state.inventory['布料_6.1'].qtyByCity[customLocation], 7);
});

test('D63: large legacy transaction backup import preserves count and legacy transaction fields', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const legacySamples = [
    {
      date: '2026-06-18',
      type: '買材料',
      item: '布料',
      quality: '6.1',
      qty: 100,
      total: 600000,
      unitPrice: 6000,
      location: 'Thetford'
    },
    {
      date: '2026-06-18',
      type: '賣成品',
      item: 'TestProduct',
      quality: '6.1',
      qty: 3,
      total: 90000,
      unitPrice: 30000,
      location: 'Thetford'
    },
    {
      date: '2026-06-18',
      type: '工人島出售',
      item: '布料',
      quality: '6.1',
      qty: 5,
      total: 50000,
      unitPrice: 10000,
      location: '工人島'
    },
    {
      date: '2026-06-18',
      type: 'INVENTORY_ADJUSTMENT',
      item: '布料',
      quality: '6.1',
      qty: -100,
      total: -600000,
      unitPrice: 6000,
      location: 'Thetford',
      details: 'legacy adjustment sourceSignature=sample'
    }
  ];
  const transactions = Array.from({ length: 180 }, (_, index) => ({
    ...legacySamples[index % legacySamples.length],
    id: index + 1
  }));
  const inventory = {};
  const assets = { cash: 0, debt: 0 };

  importBackup({ inventory, assets, transactions });

  assert.equal(reloadCount, 1);
  const importedTransactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions));
  assert.equal(importedTransactions.length, 180);
  assert.deepEqual(importedTransactions, transactions);
  assert.deepEqual(
    [...new Set(importedTransactions.map(transaction => transaction.type))],
    ['買材料', '賣成品', '工人島出售', 'INVENTORY_ADJUSTMENT']
  );
  for (const transaction of importedTransactions) {
    assert.equal(typeof transaction.type, 'string');
    assert.equal(Object.hasOwn(transaction, 'item'), true);
    assert.equal(Object.hasOwn(transaction, 'quality'), true);
    assert.equal(Object.hasOwn(transaction, 'qty'), true);
    assert.equal(Object.hasOwn(transaction, 'total'), true);
    assert.equal(Object.hasOwn(transaction, 'unitPrice'), true);
    assert.equal(Object.hasOwn(transaction, 'location'), true);
    assert.equal(Object.hasOwn(transaction, 'action'), false);
    assert.equal(Object.hasOwn(transaction, 'cashChange'), false);
    assert.equal(Object.hasOwn(transaction, 'assetValue'), false);
    assert.equal(Object.hasOwn(transaction, 'locationId'), false);
  }

  loadState();
  assert.equal(state.transactions.length, 180);
  assert.deepEqual(state.transactions.slice(0, 4), transactions.slice(0, 4));
});

test('D76: legacy multi-item multi-location backup preserves all location quantities', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const backup = legacyLocationBackupFixture();

  importBackup(backup);

  assert.equal(reloadCount, 1);
  const importedInventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory));
  assert.deepEqual(Object.keys(importedInventory), Object.keys(backup.inventory));
  assert.deepEqual(importedInventory['布料_6.1'].qtyByCity, backup.inventory['布料_6.1'].qtyByCity);
  assert.deepEqual(importedInventory['TestProduct_6.1'].qtyByCity, backup.inventory['TestProduct_6.1'].qtyByCity);
  assert.equal(importedInventory['布料_6.1'].globalAvgCost, 12345);
  assert.equal(importedInventory['TestProduct_6.1'].globalAvgCost, 98765);
  assert.equal(Object.hasOwn(importedInventory['布料_6.1'], 'qtyByLocation'), false);
  assert.equal(Object.hasOwn(importedInventory['TestProduct_6.1'], 'qtyByLocation'), false);
  assert.equal(importedInventory['布料_6.1'].qtyByCity.Thetford, 120);
  assert.equal(importedInventory['布料_6.1'].qtyByCity.Martlock, 5);
  assert.equal(importedInventory['TestProduct_6.1'].qtyByCity.Bridgewatch, 3);
});

test('D76: loadState preserves imported legacy location maps and custom location strings', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const backup = legacyLocationBackupFixture();

  importBackup(backup);
  loadState();

  assert.deepEqual(state.customLocations, backup.customLocations);
  for (const [location, quantity] of Object.entries(backup.inventory['布料_6.1'].qtyByCity)) {
    assert.equal(state.inventory['布料_6.1'].qtyByCity[location], quantity);
  }
  for (const [location, quantity] of Object.entries(backup.inventory['TestProduct_6.1'].qtyByCity)) {
    assert.equal(state.inventory['TestProduct_6.1'].qtyByCity[location], quantity);
  }
  assert.equal(state.inventory['布料_6.1'].globalAvgCost, 12345);
  assert.equal(state.inventory['TestProduct_6.1'].globalAvgCost, 98765);
  assert.equal(Object.hasOwn(state.inventory['布料_6.1'], 'qtyByLocation'), false);
  assert.equal(Object.hasOwn(state.inventory['布料_6.1'].qtyByCity, 'locationId'), false);
  assert.equal(typeof state.customLocations[0], 'string');
});

test('D76: location adapter reads imported qtyByCity wrapper without changing state', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const backup = legacyLocationBackupFixture();

  importBackup(backup);
  loadState();
  const before = JSON.stringify(state.inventory);
  const itemState = state.inventory['布料_6.1'];
  const normalized = normalizeLocationMap(itemState);

  assert.equal(JSON.stringify(state.inventory), before);
  assert.equal(normalized.sourceFormat, 'qtyByCity');
  assert.deepEqual(normalized.quantities, itemState.qtyByCity);
  assert.deepEqual(normalized.unresolvedLocations, []);
  assert.notEqual(normalized.quantities, itemState.qtyByCity);
});

test('D76: custom location literal keys remain strings without registry conversion', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const backup = legacyLocationBackupFixture();

  importBackup(backup);
  loadState();

  assert.deepEqual(state.customLocations, ['公會T8地堡', 'North Hideout / 北方倉']);
  assert.equal(typeof state.customLocations[0], 'string');
  assert.equal(typeof state.customLocations[1], 'string');
  assert.equal(Object.hasOwn(state.customLocations[0], 'id'), false);
  assert.equal(state.inventory['布料_6.1'].qtyByCity['公會T8地堡'], 7);
  assert.equal(state.inventory['TestProduct_6.1'].qtyByCity['North Hideout / 北方倉'], 11);
  assert.equal(Object.hasOwn(state.inventory['布料_6.1'].qtyByCity, 'locationId'), false);
});

test('D76: legacy backup zero location quantity is preserved through import loadState and adapter read', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const backup = legacyLocationBackupFixture();
  backup.inventory['布料_6.1'].qtyByCity.Martlock = 0;

  importBackup(backup);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory))['布料_6.1'].qtyByCity.Martlock, 0);

  loadState();
  assert.equal(state.inventory['布料_6.1'].qtyByCity.Martlock, 0);

  const normalized = normalizeLocationMap(state.inventory['布料_6.1']);
  assert.equal(normalized.quantities.Martlock, 0);
  assert.deepEqual(normalized.unresolvedLocations, []);
});

test('D76: invalid legacy location quantity remains unresolved in adapter without coercion', { concurrency: false }, () => {
  const input = {
    qtyByCity: {
      Thetford: 120,
      StringWarehouse: '5',
      InfiniteWarehouse: Infinity
    }
  };
  const before = JSON.stringify(Object.keys(input.qtyByCity));

  const normalized = normalizeLocationMap(input);

  assert.equal(JSON.stringify(Object.keys(input.qtyByCity)), before);
  assert.deepEqual(normalized.quantities, { Thetford: 120 });
  assert.deepEqual(normalized.unresolvedLocations, ['StringWarehouse', 'InfiniteWarehouse']);
  assert.equal(Object.hasOwn(normalized.quantities, 'StringWarehouse'), false);
  assert.equal(Object.hasOwn(normalized.quantities, 'InfiniteWarehouse'), false);
});

test('D76: legacy backup export import round trip preserves qtyByCity storage shape', { concurrency: false }, async () => {
  resetMocks();
  const backup = legacyLocationBackupFixture();
  seedStorage(backup);
  startProductionLegacyMode();
  resetExportTracking();

  await getElement('btn-export-data').handlers.click();
  assert.ok(createdBlob);
  const exported = JSON.parse(createdBlob.parts.join(''));

  resetMocks();
  startProductionLegacyMode();
  importBackup(exported);

  const importedInventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory));
  const importedCustomLocations = JSON.parse(localStorage.getItem(STORAGE_KEYS.customLocations));
  assert.deepEqual(importedInventory, backup.inventory);
  assert.deepEqual(importedCustomLocations, backup.customLocations);
  assert.equal(Object.hasOwn(importedInventory['布料_6.1'], 'qtyByLocation'), false);
  assert.equal(Object.hasOwn(importedInventory['布料_6.1'].qtyByCity, 'locationId'), false);
});

test('D76: future qtyByLocation remains adapter-only sample while imported legacy backup stays qtyByCity', { concurrency: false }, () => {
  resetMocks();
  startProductionLegacyMode();
  const futureSample = normalizeLocationMap({
    qtyByLocation: {
      thetford: 120,
      custom_warehouse: 5
    }
  });
  const backup = legacyLocationBackupFixture();

  importBackup(backup);

  const importedInventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory));
  assert.equal(futureSample.sourceFormat, 'qtyByLocation');
  assert.deepEqual(futureSample.quantities, { thetford: 120, custom_warehouse: 5 });
  assert.equal(Object.hasOwn(importedInventory['布料_6.1'], 'qtyByLocation'), false);
  assert.equal(Object.hasOwn(importedInventory['TestProduct_6.1'], 'qtyByLocation'), false);
  assert.equal(Object.hasOwn(importedInventory['布料_6.1'].qtyByCity, 'locationId'), false);
});

test('D80: current SYSTEM_CITIES includes all current location compatibility keys', { concurrency: false }, () => {
  const expectedKeys = [
    'Thetford',
    'Martlock',
    'Bridgewatch',
    'Lymhurst',
    'Fort Sterling',
    'Caerleon',
    'Brecilien',
    'LaborerIsland',
    'Hideout'
  ];

  for (const key of expectedKeys) {
    assert.equal(Object.hasOwn(SYSTEM_CITIES, key), true);
    assert.equal(typeof SYSTEM_CITIES[key].name, 'string');
  }
});

test('D80: LaborerIsland remains a reserved legacy inventory key and not a custom location', { concurrency: false }, () => {
  resetMocks();
  state.assets = { cash: 0, debt: 0 };
  state.customLocations = [];
  state.inventory = {};
  state.laborerInventory = {};
  state.laborerLogs = [];
  state.transactions = [];

  initDefaultState();

  const inventoryEntry = Object.values(state.inventory).find(entry =>
    Object.hasOwn(entry.qtyByCity, 'LaborerIsland')
  );
  assert.ok(inventoryEntry);
  assert.equal(Object.hasOwn(inventoryEntry.qtyByCity, 'LaborerIsland'), true);
  assert.equal(inventoryEntry.qtyByCity.LaborerIsland, 0);
  assert.equal(state.customLocations.includes('LaborerIsland'), false);
  assert.equal(Object.hasOwn(state.laborerInventory, '皮革'), true);
  assert.equal(state.laborerInventory['皮革']['6.1'], 0);
});

test('initDefaultState hydrates existing runtime inventory items without overwriting seeded values', { concurrency: false }, () => {
  resetMocks();
  replaceStateContents(state, {
    assets: { cash: 0, debt: 0 },
    customLocations: ['Custom Warehouse'],
    inventory: {
      '布料_6.1': {
        qtyByCity: {
          Thetford: 5
        },
        globalAvgCost: 12345
      },
      '皮革_6.2': {
        globalAvgCost: 67890
      }
    },
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });

  initDefaultState();

  assert.equal(state.inventory['布料_6.1'].qtyByCity.Thetford, 5);
  assert.equal(state.inventory['布料_6.1'].globalAvgCost, 12345);
  assert.equal(state.inventory['布料_6.1'].qtyByCity.Martlock, 0);
  assert.equal(state.inventory['布料_6.1'].qtyByCity['Custom Warehouse'], 0);
  assert.equal(state.inventory['皮革_6.2'].globalAvgCost, 67890);
  for (const location of CURRENT_RUNTIME_LOCATION_KEYS) {
    assert.equal(state.inventory['皮革_6.2'].qtyByCity[location], 0);
  }
  assert.equal(state.inventory['皮革_6.2'].qtyByCity['Custom Warehouse'], 0);
  assert.equal(state.laborerInventory['皮革']['6.2'], 0);
  assert.equal(state.laborerInventory['滿日記本']['6.2'], 0);
  assert.equal(Object.hasOwn(state.laborerInventory, '滿日誌'), false);
});

test('D80: Hideout remains a current compatibility key without asserting future registry identity', { concurrency: false }, () => {
  assert.equal(Object.hasOwn(SYSTEM_CITIES, 'Hideout'), true);
  assert.equal(typeof SYSTEM_CITIES.Hideout.name, 'string');
  assert.equal(Object.hasOwn(SYSTEM_CITIES.Hideout, 'locationId'), false);
  assert.match(loadState.toString(), /Hideout/);
});

test('D81: resolveLocationIdentity maps exact current system city names to fixed future IDs', { concurrency: false }, () => {
  const expected = {
    Thetford: 'thetford',
    Martlock: 'martlock',
    Bridgewatch: 'bridgewatch',
    Lymhurst: 'lymhurst',
    'Fort Sterling': 'fort_sterling',
    Caerleon: 'caerleon',
    Brecilien: 'brecilien'
  };

  for (const [sourceName, locationId] of Object.entries(expected)) {
    assert.deepEqual(resolveLocationIdentity({ sourceName }), {
      sourceName,
      locationId,
      displayName: sourceName,
      source: 'legacy',
      unresolved: false,
      deprecatedLegacyKey: false
    });
  }
});

test('D81: resolveLocationIdentity maps LaborerIsland to laborer_island as system-special', { concurrency: false }, () => {
  assert.deepEqual(resolveLocationIdentity({ sourceName: 'LaborerIsland' }), {
    sourceName: 'LaborerIsland',
    locationId: 'laborer_island',
    displayName: 'LaborerIsland',
    source: 'legacy',
    unresolved: false,
    deprecatedLegacyKey: false
  });
});

test('D81: resolveLocationIdentity keeps residual Hideout unresolved as a deprecated legacy key', { concurrency: false }, () => {
  assert.deepEqual(resolveLocationIdentity({ sourceName: 'Hideout' }), {
    sourceName: 'Hideout',
    locationId: null,
    displayName: null,
    source: 'legacy',
    unresolved: true,
    deprecatedLegacyKey: true
  });
});

test('D81: resolveLocationIdentity resolves an exact custom location only through explicit mapping', { concurrency: false }, () => {
  const mappingTable = {
    '公會T8地堡': {
      locationId: 'custom:sample-001',
      displayName: '公會T8地堡'
    },
    LegacyWarehouseAlias: {
      locationId: 'custom:sample-002',
      displayName: 'Display Warehouse'
    }
  };

  assert.deepEqual(resolveLocationIdentity({ sourceName: '公會T8地堡', mappingTable }), {
    sourceName: '公會T8地堡',
    locationId: 'custom:sample-001',
    displayName: '公會T8地堡',
    source: 'legacy',
    unresolved: false,
    deprecatedLegacyKey: false
  });
  assert.deepEqual(resolveLocationIdentity({ sourceName: 'Display Warehouse', mappingTable }), {
    sourceName: 'Display Warehouse',
    locationId: 'custom:sample-002',
    displayName: 'Display Warehouse',
    source: 'legacy',
    unresolved: false,
    deprecatedLegacyKey: false
  });
});

test('D81: resolveLocationIdentity leaves unknown or invalid names unresolved without silent custom creation', { concurrency: false }, () => {
  const mappingTable = {
    '公會T8地堡': {
      locationId: 'custom:sample-001',
      displayName: '公會T8地堡'
    }
  };

  for (const sourceName of ['Unknown Warehouse', '', 123, null, undefined]) {
    const resolved = resolveLocationIdentity({ sourceName, mappingTable });

    assert.equal(resolved.locationId, null);
    assert.equal(resolved.displayName, null);
    assert.equal(resolved.source, 'legacy');
    assert.equal(resolved.unresolved, true);
    assert.equal(resolved.deprecatedLegacyKey, false);
  }
});

test('D81: resolveLocationIdentity rejects duplicate or conflicting normalized display names', { concurrency: false }, () => {
  const mappingTable = {
    Warehouse: {
      locationId: 'custom:sample-001',
      displayName: 'Warehouse'
    },
    ' warehouse ': {
      locationId: 'custom:sample-002',
      displayName: 'WAREHOUSE'
    }
  };

  assert.deepEqual(resolveLocationIdentity({ sourceName: 'Warehouse', mappingTable }), {
    sourceName: 'Warehouse',
    locationId: null,
    displayName: null,
    source: 'legacy',
    unresolved: true,
    deprecatedLegacyKey: false
  });
});

test('D81: resolveLocationIdentity does not use fuzzy matching', { concurrency: false }, () => {
  const mappingTable = {
    '公會T8地堡': {
      locationId: 'custom:sample-001',
      displayName: '公會T8地堡'
    }
  };

  for (const sourceName of ['Thetfor', 'FortSterling', 'T8地堡']) {
    const resolved = resolveLocationIdentity({ sourceName, mappingTable });

    assert.equal(resolved.locationId, null);
    assert.equal(resolved.displayName, null);
    assert.equal(resolved.unresolved, true);
    assert.equal(resolved.deprecatedLegacyKey, false);
  }
});

test('D81: resolveLocationIdentity does not mutate input or mapping tables', { concurrency: false }, () => {
  const input = {
    sourceName: '公會T8地堡',
    mappingTable: {
      '公會T8地堡': {
        locationId: 'custom:sample-001',
        displayName: '公會T8地堡'
      }
    }
  };
  const before = JSON.stringify(input);

  resolveLocationIdentity(input);

  assert.equal(JSON.stringify(input), before);
});

test('D81: resolveLocationIdentity treats malformed mapping entries as unresolved', { concurrency: false }, () => {
  const cases = [
    { BrokenWarehouse: null },
    { BrokenWarehouse: 'custom:sample-001' },
    { BrokenWarehouse: { displayName: 'BrokenWarehouse' } },
    { BrokenWarehouse: { locationId: '', displayName: 'BrokenWarehouse' } }
  ];

  for (const mappingTable of cases) {
    const resolved = resolveLocationIdentity({ sourceName: 'BrokenWarehouse', mappingTable });

    assert.equal(resolved.locationId, null);
    assert.equal(resolved.displayName, null);
    assert.equal(resolved.unresolved, true);
    assert.equal(resolved.deprecatedLegacyKey, false);
  }
});

test('D81: exact system mapping is not overridden by custom mapping table entries', { concurrency: false }, () => {
  const mappingTable = {
    Thetford: {
      locationId: 'custom:wrong-id',
      displayName: 'Thetford'
    }
  };

  assert.deepEqual(resolveLocationIdentity({ sourceName: 'Thetford', mappingTable }), {
    sourceName: 'Thetford',
    locationId: 'thetford',
    displayName: 'Thetford',
    source: 'legacy',
    unresolved: false,
    deprecatedLegacyKey: false
  });
});

test('D84: validateLocationMigration passes when all legacy and future snapshot invariants match', { concurrency: false }, () => {
  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after: makeFutureLocationSnapshot(),
    locationMappings: makeLocationMappings()
  });

  assert.deepEqual(result, {
    ok: true,
    errors: [],
    unresolvedMappings: []
  });
});

test('D84: validateLocationMigration fails when inventory item count or key set changes', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  delete after.inventory['TestProduct_6.1'];

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['INVENTORY_ITEM_COUNT_MISMATCH']);
});

test('D84: validateLocationMigration fails when any item location quantity changes without global total mismatch', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  const itemKey = primaryLocationItemKey();
  after.inventory[itemKey].qtyByLocation.thetford = 119;
  after.inventory[itemKey].qtyByLocation.laborer_island = 1;

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['LOCATION_QUANTITY_MISMATCH']);
});

test('D84: validateLocationMigration fails when global quantity totals change', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  after.inventory[primaryLocationItemKey()].qtyByLocation.thetford = 121;

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    'LOCATION_QUANTITY_MISMATCH',
    'GLOBAL_QUANTITY_TOTAL_MISMATCH'
  ]);
});

test('D84: validateLocationMigration fails when globalAvgCost changes while null stays compatible', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  after.inventory[primaryLocationItemKey()].globalAvgCost = 12346;

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  assert.equal(makeLegacyLocationSnapshot().inventory['UnknownCostProduct_6.1'].globalAvgCost, null);
  assert.equal(makeFutureLocationSnapshot().inventory['UnknownCostProduct_6.1'].globalAvgCost, null);
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['GLOBAL_AVG_COST_MISMATCH']);
});

test('D84: validateLocationMigration fails when cash changes', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  after.assets.cash += 1;

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['CASH_MISMATCH']);
});

test('D84: validateLocationMigration fails when transaction count changes', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  after.transactions.push({ id: 3 });

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['TRANSACTION_COUNT_MISMATCH']);
});

test('D84: validateLocationMigration fails when custom location count changes without counting system registry entries', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  after.locationRegistry.push({ locationId: 'thetford', displayName: 'Thetford' });
  const withSystemOnly = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  after.locationRegistry.push({ locationId: 'custom:extra-002', displayName: 'Extra' });
  const withExtraCustom = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings()
  });

  assert.equal(withSystemOnly.ok, true);
  assert.deepEqual(withSystemOnly.errors, []);
  assert.equal(withExtraCustom.ok, false);
  assert.deepEqual(withExtraCustom.errors, ['CUSTOM_LOCATION_COUNT_MISMATCH']);
});

test('D84: validateLocationMigration fails while unresolved mappings remain and preserves unresolved order', { concurrency: false }, () => {
  const unresolvedMappings = ['MissingWarehouse', 'Hideout'];

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after: makeFutureLocationSnapshot(),
    locationMappings: makeLocationMappings(),
    unresolvedMappings
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['UNRESOLVED_MAPPINGS']);
  assert.deepEqual(result.unresolvedMappings, unresolvedMappings);
  assert.notEqual(result.unresolvedMappings, unresolvedMappings);
});

test('D84: validateLocationMigration reports all mismatches instead of stopping at the first mismatch', { concurrency: false }, () => {
  const after = makeFutureLocationSnapshot();
  after.inventory[primaryLocationItemKey()].qtyByLocation.thetford = 121;
  after.inventory['TestProduct_6.1'].globalAvgCost = 98766;
  after.assets.cash += 1;
  after.transactions.push({ id: 3 });
  after.locationRegistry.push({ locationId: 'custom:extra-002', displayName: 'Extra' });

  const result = validateLocationMigration({
    before: makeLegacyLocationSnapshot(),
    after,
    locationMappings: makeLocationMappings(),
    unresolvedMappings: ['MissingWarehouse']
  });

  assert.deepEqual(result.errors, [
    'LOCATION_QUANTITY_MISMATCH',
    'GLOBAL_QUANTITY_TOTAL_MISMATCH',
    'GLOBAL_AVG_COST_MISMATCH',
    'CASH_MISMATCH',
    'TRANSACTION_COUNT_MISMATCH',
    'CUSTOM_LOCATION_COUNT_MISMATCH',
    'UNRESOLVED_MAPPINGS'
  ]);
});

test('D84: validateLocationMigration does not mutate before snapshot after snapshot location mappings or unresolved report', { concurrency: false }, () => {
  const before = makeLegacyLocationSnapshot();
  const after = makeFutureLocationSnapshot();
  const locationMappings = makeLocationMappings();
  const unresolvedMappings = ['MissingWarehouse'];
  const beforeSnapshot = JSON.stringify(before);
  const afterSnapshot = JSON.stringify(after);
  const locationMappingsSnapshot = JSON.stringify(locationMappings);
  const unresolvedMappingsSnapshot = JSON.stringify(unresolvedMappings);

  const result = validateLocationMigration({ before, after, locationMappings, unresolvedMappings });

  assert.equal(JSON.stringify(before), beforeSnapshot);
  assert.equal(JSON.stringify(after), afterSnapshot);
  assert.equal(JSON.stringify(locationMappings), locationMappingsSnapshot);
  assert.equal(JSON.stringify(unresolvedMappings), unresolvedMappingsSnapshot);
  assert.notEqual(result.unresolvedMappings, unresolvedMappings);
});

test('D84: validateLocationMigration rejects malformed snapshots and invalid mappings without uncontrolled errors', { concurrency: false }, () => {
  const malformedCases = [
    {
      input: {
        before: null,
        after: makeFutureLocationSnapshot(),
        locationMappings: makeLocationMappings()
      },
      errors: ['INVALID_BEFORE_SNAPSHOT']
    },
    {
      input: {
        before: makeLegacyLocationSnapshot(),
        after: { ...makeFutureLocationSnapshot(), inventory: [] },
        locationMappings: makeLocationMappings()
      },
      errors: ['INVALID_AFTER_SNAPSHOT']
    },
    {
      input: {
        before: makeLegacyLocationSnapshot(),
        after: makeFutureLocationSnapshot(),
        locationMappings: null
      },
      errors: ['INVALID_LOCATION_MAPPINGS']
    },
    {
      input: {
        before: makeLegacyLocationSnapshot(),
        after: makeFutureLocationSnapshot(),
        locationMappings: { Thetford: 'thetford' }
      },
      errors: ['INVALID_LOCATION_MAPPINGS', 'LOCATION_QUANTITY_MISMATCH']
    },
    {
      input: {
        before: makeLegacyLocationSnapshot(),
        after: makeFutureLocationSnapshot(),
        locationMappings: makeLocationMappings(),
        unresolvedMappings: 'MissingWarehouse'
      },
      errors: ['INVALID_LOCATION_MAPPINGS']
    }
  ];

  for (const { input, errors } of malformedCases) {
    assert.doesNotThrow(() => validateLocationMigration(input));
    const result = validateLocationMigration(input);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, errors);
  }
});

// Future clean initialization contract:
// Success returns ok:true with a complete new state, schemaVersion:1, debt defaulting to 0,
// the full fixed registry, qtyByLocation inventory, empty transactions and laborerLogs,
// laborer categories for 鋼條/布料/板材/皮革/滿日誌, every supported laborer quality initialized
// to 0, and no future output key for 滿日記本.
// Failure returns ok:false, state:null, ordered unique machine-readable errors, no partial
// state, no input mutation, no legacy state mutation, and no localStorage access.
// The custom location ID generator is not user input, is not stored in state, is not derived
// from displayName/clientRef, and throw/invalid format/duplicate ID/system collision aborts atomically.
test('createCleanInitialState creates a valid empty new-schema state', { concurrency: false }, () => {
  const result = createCleanInitialState({ cash: 0 });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.state.schemaVersion, 1);
  assert.deepEqual(result.state.assets, { cash: 0, debt: 0 });
  assert.deepEqual(result.state.inventory, {});
  assert.deepEqual(result.state.transactions, []);
  assert.deepEqual(result.state.laborerLogs, []);
  assert.equal(Object.hasOwn(result.state, 'customLocations'), false);
  assert.equal(Object.values(result.state.inventory).some(item => Object.hasOwn(item, 'qtyByCity')), false);
});

test('createCleanInitialState accepts finite cash and defaults omitted debt to zero', { concurrency: false }, () => {
  const omittedDebt = createCleanInitialState({ cash: -12345 });
  const negativeDebt = createCleanInitialState({ cash: 1, debt: -50 });

  assert.equal(omittedDebt.ok, true);
  assert.deepEqual(omittedDebt.state.assets, { cash: -12345, debt: 0 });
  assert.equal(negativeDebt.ok, true);
  assert.deepEqual(negativeDebt.state.assets, { cash: 1, debt: -50 });
});

test('createCleanInitialState rejects invalid cash or debt without returning partial state', { concurrency: false }, () => {
  const cases = [
    {
      input: {},
      errors: ['INVALID_CASH']
    },
    {
      input: { cash: NaN },
      errors: ['INVALID_CASH']
    },
    {
      input: { cash: Infinity },
      errors: ['INVALID_CASH']
    },
    {
      input: { cash: 0, debt: '1' },
      errors: ['INVALID_DEBT']
    },
    {
      input: {
        cash: 'bad',
        debt: null,
        customLocations: [{ clientRef: 'a', displayName: 'Thetford' }],
        inventorySeeds: [{ itemKey: '', locationId: 'missing', quantity: '1', globalAvgCost: Infinity }]
      },
      errors: [
        'INVALID_CASH',
        'INVALID_DEBT',
        'SYSTEM_LOCATION_NAME_CONFLICT',
        'CUSTOM_LOCATION_ID_GENERATION_FAILED',
        'INVALID_INVENTORY_SEED',
        'UNKNOWN_LOCATION_ID'
      ]
    }
  ];

  for (const { input, errors } of cases) {
    const result = createCleanInitialState(input);

    assert.equal(result.ok, false);
    assert.equal(result.state, null);
    assert.deepEqual(result.errors, errors);
  }
});

test('createCleanInitialState creates every fixed system registry entry with matching locationId keys', { concurrency: false }, () => {
  const result = createCleanInitialState({ cash: 0 });
  const registry = result.state.locationRegistry;

  assert.deepEqual(Object.keys(registry), CLEAN_INITIALIZATION_FIXED_SYSTEM_REGISTRY);
  for (const locationId of CLEAN_INITIALIZATION_FIXED_SYSTEM_REGISTRY) {
    assert.equal(registry[locationId].locationId, locationId);
    assert.equal(registry[locationId].active, true);
  }
  assert.equal(Object.hasOwn(registry, 'Hideout'), false);
  assert.equal(Object.hasOwn(registry, 'hideout'), false);
});

test('createCleanInitialState generates custom location IDs without deriving them from displayName or clientRef', { concurrency: false }, () => {
  const input = makeCleanInitializationInput();
  const result = createCleanInitialState(input, {
    generateCustomLocationId: makeCustomLocationIdGenerator()
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.locationRegistry['custom:test-001'].locationId, 'custom:test-001');
  assert.equal(result.state.locationRegistry['custom:test-001'].displayName, input.customLocations[0].displayName);
  assert.equal(Object.hasOwn(result.state.locationRegistry, input.customLocations[0].clientRef), false);
  assert.equal(Object.hasOwn(result.state.locationRegistry, input.customLocations[0].displayName), false);

  const failureCases = [
    {
      options: {},
      errors: ['CUSTOM_LOCATION_ID_GENERATION_FAILED']
    },
    {
      options: { generateCustomLocationId: () => 'warehouse-1' },
      errors: ['CUSTOM_LOCATION_ID_GENERATION_FAILED']
    },
    {
      options: { generateCustomLocationId: () => 'custom:' },
      errors: ['CUSTOM_LOCATION_ID_GENERATION_FAILED']
    },
    {
      options: { generateCustomLocationId: () => 'custom:   ' },
      errors: ['CUSTOM_LOCATION_ID_GENERATION_FAILED']
    },
    {
      input: {
        cash: 0,
        customLocations: [
          { clientRef: 'a', displayName: 'A' },
          { clientRef: 'b', displayName: 'B' }
        ]
      },
      options: { generateCustomLocationId: () => 'custom:dup' },
      errors: ['CUSTOM_LOCATION_ID_GENERATION_FAILED']
    },
    {
      options: {
        generateCustomLocationId: () => {
          throw new Error('boom');
        }
      },
      errors: ['CUSTOM_LOCATION_ID_GENERATION_FAILED']
    }
  ];

  for (const failure of failureCases) {
    const failed = createCleanInitialState(failure.input || input, failure.options);

    assert.equal(failed.ok, false);
    assert.equal(failed.state, null);
    assert.deepEqual(failed.errors, failure.errors);
  }
});

test('createCleanInitialState resolves inventory customLocationRef through input-only clientRef', { concurrency: false }, () => {
  const input = makeCleanInitializationInput();
  const [systemSeed, customSeed] = input.inventorySeeds;
  const result = createCleanInitialState(input, {
    generateCustomLocationId: makeCustomLocationIdGenerator()
  });
  const directCustomLocationId = createCleanInitialState(
    {
      ...input,
      inventorySeeds: [
        {
          itemKey: customSeed.itemKey,
          locationId: 'custom:test-001',
          quantity: customSeed.quantity,
          globalAvgCost: customSeed.globalAvgCost
        }
      ]
    },
    {
      generateCustomLocationId: makeCustomLocationIdGenerator()
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.inventory[systemSeed.itemKey], {
    qtyByLocation: { thetford: systemSeed.quantity },
    globalAvgCost: systemSeed.globalAvgCost
  });
  assert.deepEqual(result.state.inventory[customSeed.itemKey], {
    qtyByLocation: { 'custom:test-001': customSeed.quantity },
    globalAvgCost: customSeed.globalAvgCost
  });
  assert.equal(Object.hasOwn(result.state.inventory[customSeed.itemKey].qtyByLocation, customSeed.customLocationRef), false);
  assert.equal(Object.hasOwn(result.state, 'customLocationRef'), false);
  assert.equal(directCustomLocationId.ok, false);
  assert.equal(directCustomLocationId.state, null);
  assert.deepEqual(directCustomLocationId.errors, ['UNKNOWN_LOCATION_ID']);
});

test('createCleanInitialState rejects duplicate clientRef and unknown customLocationRef values', { concurrency: false }, () => {
  let nextCustomLocationId = 0;
  const duplicateRef = createCleanInitialState(
    {
      cash: 0,
      customLocations: [
        { clientRef: 'dup', displayName: 'Warehouse A' },
        { clientRef: ' dup ', displayName: 'Warehouse B' }
      ]
    },
    {
      generateCustomLocationId: () => `custom:${nextCustomLocationId += 1}`
    }
  );
  const unknownRef = createCleanInitialState(
    {
      ...makeCleanInitializationInput(),
      inventorySeeds: [
        {
          itemKey: '布料_6.1',
          customLocationRef: 'missing-ref',
          quantity: 10,
          globalAvgCost: 1
        }
      ]
    },
    {
      generateCustomLocationId: makeCustomLocationIdGenerator()
    }
  );

  assert.equal(duplicateRef.ok, false);
  assert.equal(duplicateRef.state, null);
  assert.deepEqual(duplicateRef.errors, ['DUPLICATE_CUSTOM_LOCATION_REF']);
  assert.equal(unknownRef.ok, false);
  assert.equal(unknownRef.state, null);
  assert.deepEqual(unknownRef.errors, ['INVALID_CUSTOM_LOCATION_REF']);
});

test('createCleanInitialState rejects duplicate custom display names after trim and case normalization', { concurrency: false }, () => {
  let nextCustomLocationId = 0;
  const result = createCleanInitialState(
    {
      cash: 0,
      customLocations: [
        { clientRef: 'a', displayName: ' Warehouse ' },
        { clientRef: 'b', displayName: 'warehouse' }
      ]
    },
    {
      generateCustomLocationId: () => `custom:${nextCustomLocationId += 1}`
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.state, null);
  assert.deepEqual(result.errors, ['DUPLICATE_CUSTOM_LOCATION_NAME']);
});

test('createCleanInitialState rejects custom display names that conflict with system locations', { concurrency: false }, () => {
  const result = createCleanInitialState(
    {
      cash: 0,
      customLocations: [
        { clientRef: 'a', displayName: ' thetford ' }
      ]
    },
    {
      generateCustomLocationId: () => 'custom:system-conflict'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.state, null);
  assert.deepEqual(result.errors, ['SYSTEM_LOCATION_NAME_CONFLICT']);
});

test('createCleanInitialState requires exactly one locationId or customLocationRef per inventory seed', { concurrency: false }, () => {
  const cases = [
    {
      input: {
        cash: 0,
        inventorySeeds: [
          { itemKey: '布料_6.1', quantity: 1, globalAvgCost: null }
        ]
      }
    },
    {
      input: {
        cash: 0,
        customLocations: [{ clientRef: 'warehouse-1', displayName: 'Warehouse' }],
        inventorySeeds: [
          {
            itemKey: '布料_6.1',
            locationId: 'thetford',
            customLocationRef: 'warehouse-1',
            quantity: 1,
            globalAvgCost: null
          }
        ]
      },
      options: { generateCustomLocationId: makeCustomLocationIdGenerator() }
    },
    {
      input: {
        cash: 0,
        inventorySeeds: [
          { itemKey: '布料_6.1', locationId: ' ', quantity: 1, globalAvgCost: null }
        ]
      }
    }
  ];

  for (const { input, options } of cases) {
    const result = createCleanInitialState(input, options);

    assert.equal(result.ok, false);
    assert.equal(result.state, null);
    assert.deepEqual(result.errors, ['INVALID_LOCATION_REFERENCE']);
  }
});

test('createCleanInitialState rejects invalid inventory seeds and unknown system locationIds', { concurrency: false }, () => {
  const invalidSeed = createCleanInitialState({
    cash: 0,
    inventorySeeds: [
      { itemKey: ' ', locationId: 'thetford', quantity: 1, globalAvgCost: null },
      { itemKey: '布料_6.1', locationId: 'thetford', quantity: '1', globalAvgCost: null },
      { itemKey: '鋼條_6.2', locationId: 'thetford', quantity: 1, globalAvgCost: Infinity }
    ]
  });
  const unknownLocation = createCleanInitialState({
    cash: 0,
    inventorySeeds: [
      { itemKey: '布料_6.1', locationId: 'unknown', quantity: 1, globalAvgCost: null }
    ]
  });

  assert.equal(invalidSeed.ok, false);
  assert.equal(invalidSeed.state, null);
  assert.deepEqual(invalidSeed.errors, ['INVALID_INVENTORY_SEED']);
  assert.equal(unknownLocation.ok, false);
  assert.equal(unknownLocation.state, null);
  assert.deepEqual(unknownLocation.errors, ['UNKNOWN_LOCATION_ID']);
});

test('createCleanInitialState rejects duplicate itemKey and resolved locationId seed identities', { concurrency: false }, () => {
  const duplicateIdentity = createCleanInitialState({
    cash: 0,
    inventorySeeds: [
      { itemKey: ' 布料_6.1 ', locationId: 'thetford', quantity: 1, globalAvgCost: 0 },
      { itemKey: '布料_6.1', locationId: 'thetford', quantity: -2, globalAvgCost: 0 }
    ]
  });
  const inconsistentCost = createCleanInitialState({
    cash: 0,
    inventorySeeds: [
      { itemKey: '布料_6.1', locationId: 'thetford', quantity: 1, globalAvgCost: 0 },
      { itemKey: '布料_6.1', locationId: 'martlock', quantity: 2, globalAvgCost: null }
    ]
  });
  const sameCostAcrossLocations = createCleanInitialState({
    cash: 0,
    inventorySeeds: [
      { itemKey: '布料_6.1', locationId: 'thetford', quantity: 1, globalAvgCost: 0 },
      { itemKey: '布料_6.1', locationId: 'martlock', quantity: -2, globalAvgCost: 0 }
    ]
  });

  assert.equal(duplicateIdentity.ok, false);
  assert.equal(duplicateIdentity.state, null);
  assert.deepEqual(duplicateIdentity.errors, ['DUPLICATE_INVENTORY_SEED']);
  assert.equal(inconsistentCost.ok, false);
  assert.equal(inconsistentCost.state, null);
  assert.deepEqual(inconsistentCost.errors, ['INVALID_INVENTORY_SEED']);
  assert.equal(sameCostAcrossLocations.ok, true);
  assert.deepEqual(sameCostAcrossLocations.state.inventory['布料_6.1'], {
    qtyByLocation: { thetford: 1, martlock: -2 },
    globalAvgCost: 0
  });
});

test('createCleanInitialState initializes empty transactions and canonical laborer defaults using journal category only', { concurrency: false }, () => {
  const result = createCleanInitialState({ cash: 0 });

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.transactions, []);
  assert.deepEqual(result.state.laborerLogs, []);
  assert.deepEqual(Object.keys(result.state.laborerInventory), CLEAN_INITIALIZATION_LABORER_CATEGORIES);
  for (const category of CLEAN_INITIALIZATION_LABORER_CATEGORIES) {
    assert.deepEqual(Object.keys(result.state.laborerInventory[category]), CLEAN_INITIALIZATION_ALL_LABORER_QUALITIES);
    assert.equal(Object.values(result.state.laborerInventory[category]).every(value => value === 0), true);
  }
});

test('createCleanInitialState initializes canonical leather laborer inventory with every supported quality at zero', { concurrency: false }, () => {
  const result = createCleanInitialState({ cash: 0 });

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.state.laborerInventory), CLEAN_INITIALIZATION_LABORER_CATEGORIES);
  assert.equal(Object.hasOwn(result.state.laborerInventory, '皮革'), true);
  assert.deepEqual(Object.keys(result.state.laborerInventory['皮革']), CLEAN_INITIALIZATION_ALL_LABORER_QUALITIES);
  assert.equal(Object.values(result.state.laborerInventory['皮革']).every(value => value === 0), true);
});

test('createCleanInitialState does not mutate input or legacy state and remains atomic on failure', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    inventory: { '布料_6.1': { qtyByCity: { Thetford: 9 }, globalAvgCost: 6000 } },
    assets: { cash: 1, debt: 2 },
    transactions: [{ type: 'legacy' }]
  });
  const input = makeCleanInitializationInput();
  const inputBefore = JSON.stringify(input);
  const storageBefore = JSON.stringify([...storage.entries()]);

  const failure = createCleanInitialState(input, {
    generateCustomLocationId: () => {
      throw new Error('generator failed');
    }
  });
  const success = createCleanInitialState(input, {
    generateCustomLocationId: makeCustomLocationIdGenerator()
  });
  const source = createCleanInitialState.toString();

  assert.equal(failure.ok, false);
  assert.equal(failure.state, null);
  assert.deepEqual(failure.errors, ['CUSTOM_LOCATION_ID_GENERATION_FAILED']);
  assert.equal(success.ok, true);
  assert.equal(JSON.stringify(input), inputBefore);
  assert.equal(JSON.stringify([...storage.entries()]), storageBefore);
  assert.doesNotMatch(source, /localStorage|saveState|initDefaultState|document|window/i);
});

// Future new-schema storage codec contract:
// encodeNewSchemaState/decodeNewSchemaState are pure validation and serialization boundaries
// for NEW_SCHEMA_STORAGE_KEY only. They must not access localStorage, current global state,
// DOM events, writer paths, or backup code, and they must not perform legacy migration.
// Root state is schemaVersion:1 with assets, inventory, locationRegistry, transactions,
// laborerInventory, and laborerLogs. New-schema output forbids customLocations, qtyByCity,
// and 滿日記本, while the canonical laborer category is 滿日誌. Transaction arrays are only
// container-validated here; canonical event payload validation remains out of scope.
// Invalid encode/decode returns no serialized/state payload, ordered unique errors, and no mutation.
test('encodeNewSchemaState should serialize a valid schemaVersion 1 clean state', { concurrency: false }, () => {
  const state = makeValidNewSchemaState();
  const before = JSON.stringify(state);

  const encoded = encodeNewSchemaState(state);

  assert.equal(encoded.ok, true);
  assert.equal(typeof encoded.serialized, 'string');
  assert.deepEqual(encoded.errors, []);
  assert.deepEqual(JSON.parse(encoded.serialized), state);
  assert.equal(JSON.stringify(state), before);
  assert.equal(encoded.serialized.includes(NEW_SCHEMA_STORAGE_KEY), false);
});

test('decodeNewSchemaState should parse and return an equivalent independent new-schema state', { concurrency: false }, () => {
  const state = makeValidNewSchemaState();
  const encoded = encodeNewSchemaState(state);

  const decoded = decodeNewSchemaState(encoded.serialized);

  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.errors, []);
  assert.deepEqual(decoded.state, state);
  assert.notEqual(decoded.state, state);
  assert.notEqual(decoded.state.assets, state.assets);
  assert.notEqual(decoded.state.inventory, state.inventory);
  assert.notEqual(decoded.state.locationRegistry, state.locationRegistry);
});

test('new-schema storage codec should reject malformed JSON and non-string serialized input', { concurrency: false }, () => {
  const validState = makeValidNewSchemaState();
  const cases = [
    {
      result: decodeNewSchemaState(null),
      errors: ['INVALID_SERIALIZED_INPUT']
    },
    {
      result: decodeNewSchemaState({}),
      errors: ['INVALID_SERIALIZED_INPUT']
    },
    {
      result: decodeNewSchemaState('{invalid'),
      errors: ['INVALID_JSON']
    },
    {
      result: decodeNewSchemaState(JSON.stringify(JSON.stringify(validState))),
      errors: ['INVALID_ROOT_STATE']
    }
  ];

  for (const { result, errors } of cases) {
    assert.equal(result.ok, false);
    assert.equal(result.state, null);
    assert.deepEqual(result.errors, errors);
  }
});

test('new-schema storage codec should reject missing or unsupported schemaVersion', { concurrency: false }, () => {
  const state = makeValidNewSchemaState();
  const missingSchema = { ...state };
  const extraRoot = { ...state, extra: true };
  const missingRootField = { ...state };
  delete missingSchema.schemaVersion;
  delete missingRootField.assets;

  const cases = [
    {
      state: missingSchema,
      errors: ['INVALID_ROOT_STATE', 'UNSUPPORTED_SCHEMA_VERSION']
    },
    {
      state: { ...state, schemaVersion: 2 },
      errors: ['UNSUPPORTED_SCHEMA_VERSION']
    },
    {
      state: extraRoot,
      errors: ['INVALID_ROOT_STATE']
    },
    {
      state: missingRootField,
      errors: ['INVALID_ROOT_STATE', 'INVALID_ASSETS']
    },
    {
      state: [],
      errors: ['INVALID_ROOT_STATE']
    },
    {
      state: new (class InvalidRoot {})(),
      errors: ['INVALID_ROOT_STATE']
    }
  ];

  for (const testCase of cases) {
    const encoded = encodeNewSchemaState(testCase.state);

    assert.equal(encoded.ok, false);
    assert.equal(encoded.serialized, null);
    assert.deepEqual(encoded.errors, testCase.errors);
  }
});

test('new-schema storage codec should validate finite assets cash and debt', { concurrency: false }, () => {
  const validNegativeAssets = makeValidNewSchemaState();
  validNegativeAssets.assets.cash = -1;
  validNegativeAssets.assets.debt = -2;

  assert.equal(encodeNewSchemaState(validNegativeAssets).ok, true);

  for (const assets of [
    { cash: 1 },
    { cash: 1, debt: 0, extra: true },
    { cash: NaN, debt: 0 },
    { cash: Infinity, debt: 0 },
    { cash: 1, debt: '0' }
  ]) {
    const state = makeValidNewSchemaState();
    state.assets = assets;
    const encoded = encodeNewSchemaState(state);

    assert.equal(encoded.ok, false);
    assert.equal(encoded.serialized, null);
    assert.deepEqual(encoded.errors, ['INVALID_ASSETS']);
  }
});

test('new-schema storage codec should validate fixed and custom Location Registry entries', { concurrency: false }, () => {
  const reorderedFixed = makeValidNewSchemaState();
  reorderedFixed.locationRegistry.thetford = {
    active: true,
    type: 'system',
    displayName: 'Thetford',
    locationId: 'thetford'
  };
  assert.equal(encodeNewSchemaState(reorderedFixed).ok, true);

  const fixedChanged = makeValidNewSchemaState();
  fixedChanged.locationRegistry.thetford.type = 'custom';

  const fixedExtraKey = makeValidNewSchemaState();
  fixedExtraKey.locationRegistry.thetford.extra = true;

  const fixedInactive = makeValidNewSchemaState();
  fixedInactive.locationRegistry.thetford.active = false;

  const fixedIdMismatch = makeValidNewSchemaState();
  fixedIdMismatch.locationRegistry.thetford.locationId = 'martlock';

  const hideoutEntry = makeValidNewSchemaState();
  hideoutEntry.locationRegistry.hideout = {
    locationId: 'hideout',
    displayName: 'Hideout',
    type: 'custom',
    active: true
  };

  const invalidCustomId = makeValidNewSchemaState();
  invalidCustomId.locationRegistry['custom:   '] = {
    locationId: 'custom:   ',
    displayName: 'Warehouse B',
    type: 'custom',
    active: true
  };

  const duplicateCustomName = makeValidNewSchemaState();
  duplicateCustomName.locationRegistry['custom:test-002'] = {
    locationId: 'custom:test-002',
    displayName: ' 公會倉庫 ',
    type: 'custom',
    active: true
  };

  const systemNameConflict = makeValidNewSchemaState();
  systemNameConflict.locationRegistry['custom:test-003'] = {
    locationId: 'custom:test-003',
    displayName: 'thetford',
    type: 'custom',
    active: true
  };

  for (const state of [
    fixedChanged,
    fixedExtraKey,
    fixedInactive,
    fixedIdMismatch,
    hideoutEntry,
    invalidCustomId,
    duplicateCustomName,
    systemNameConflict
  ]) {
    const encoded = encodeNewSchemaState(state);

    assert.equal(encoded.ok, false);
    assert.equal(encoded.serialized, null);
    assert.deepEqual(encoded.errors, ['INVALID_LOCATION_REGISTRY']);
  }
});

test('new-schema storage codec should validate qtyByLocation inventory and referenced locationIds', { concurrency: false }, () => {
  const valid = makeValidNewSchemaState();
  const itemKey = Object.keys(valid.inventory)[0];
  valid.inventory[itemKey].qtyByLocation.martlock = -5;
  valid.inventory[itemKey].globalAvgCost = 0;
  assert.equal(encodeNewSchemaState(valid).ok, true);

  const nullCost = makeValidNewSchemaState();
  nullCost.inventory[itemKey].globalAvgCost = null;
  assert.equal(encodeNewSchemaState(nullCost).ok, true);

  for (const mutate of [
    state => {
      state.inventory[itemKey].qtyByLocation.unknown = 1;
    },
    state => {
      state.inventory[itemKey].qtyByLocation.thetford = Infinity;
    },
    state => {
      delete state.inventory[itemKey].globalAvgCost;
    },
    state => {
      state.inventory[itemKey].globalAvgCost = '0';
    },
    state => {
      state.inventory[` ${itemKey}`] = state.inventory[itemKey];
      delete state.inventory[itemKey];
    },
    state => {
      state.inventory[itemKey].extra = true;
    }
  ]) {
    const state = makeValidNewSchemaState();
    mutate(state);
    const encoded = encodeNewSchemaState(state);

    assert.equal(encoded.ok, false);
    assert.equal(encoded.serialized, null);
    assert.deepEqual(encoded.errors, ['INVALID_INVENTORY']);
  }
});

test('new-schema storage codec should reject legacy customLocations and qtyByCity fields', { concurrency: false }, () => {
  const rootLegacy = makeValidNewSchemaState();
  rootLegacy.customLocations = ['Legacy Warehouse'];
  const itemLegacy = makeValidNewSchemaState();
  const itemKey = Object.keys(itemLegacy.inventory)[0];
  itemLegacy.inventory[itemKey].qtyByCity = { Thetford: 1 };

  const rootEncoded = encodeNewSchemaState(rootLegacy);
  const itemEncoded = encodeNewSchemaState(itemLegacy);

  assert.equal(rootEncoded.ok, false);
  assert.deepEqual(rootEncoded.errors, ['INVALID_ROOT_STATE', 'LEGACY_FIELD_NOT_ALLOWED']);
  assert.equal(itemEncoded.ok, false);
  assert.deepEqual(itemEncoded.errors, ['INVALID_INVENTORY', 'LEGACY_FIELD_NOT_ALLOWED']);
});

test('new-schema storage codec should validate transactions and laborerLogs containers without defining canonical events', { concurrency: false }, () => {
  const validUnknownFields = makeValidNewSchemaState();
  validUnknownFields.transactions.push({
    action: 'UNKNOWN_FUTURE_EVENT',
    nested: { arbitrary: [null, true, 'text', 1] }
  });
  validUnknownFields.laborerLogs.push({
    kind: 'UNKNOWN_FUTURE_LOG',
    details: { note: 'json-safe' }
  });
  assert.equal(encodeNewSchemaState(validUnknownFields).ok, true);

  const shared = { note: 'shared' };
  const sharedReferenceState = makeValidNewSchemaState();
  sharedReferenceState.transactions = [
    { payload: shared },
    { payload: shared }
  ];
  const sharedEncoded = encodeNewSchemaState(sharedReferenceState);
  const sharedDecoded = decodeNewSchemaState(sharedEncoded.serialized);

  assert.equal(sharedEncoded.ok, true);
  assert.equal(sharedDecoded.ok, true);
  assert.deepEqual(sharedDecoded.state.transactions[0].payload, sharedDecoded.state.transactions[1].payload);

  const cyclicTransaction = {};
  cyclicTransaction.self = cyclicTransaction;
  const indirectCycle = { child: {} };
  indirectCycle.child.parent = indirectCycle;
  const cases = [
    {
      mutate: state => {
        state.transactions = {};
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.transactions = [{ unsafe: () => 1 }];
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.transactions = [{ unsafe: 1n }];
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.transactions = [cyclicTransaction];
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.transactions = [indirectCycle];
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.transactions = [{ unsafe: undefined }];
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.transactions = [{ unsafe: NaN }];
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.transactions = [{ unsafe: Infinity }];
      },
      errors: ['INVALID_TRANSACTIONS']
    },
    {
      mutate: state => {
        state.laborerLogs = [new Date()];
      },
      errors: ['INVALID_LABORER_LOGS']
    },
    {
      mutate: state => {
        state.laborerLogs = [{ unsafe: new Map() }];
      },
      errors: ['INVALID_LABORER_LOGS']
    },
    {
      mutate: state => {
        state.laborerLogs = [{ unsafe: new Set() }];
      },
      errors: ['INVALID_LABORER_LOGS']
    }
  ];

  for (const { mutate, errors } of cases) {
    const state = makeValidNewSchemaState();
    mutate(state);
    const encoded = encodeNewSchemaState(state);

    assert.equal(encoded.ok, false);
    assert.equal(encoded.serialized, null);
    assert.deepEqual(encoded.errors, errors);
  }
});

test('new-schema storage codec should validate canonical laborer inventory using 滿日誌 only', { concurrency: false }, () => {
  const valid = makeValidNewSchemaState();
  valid.laborerInventory['滿日誌']['6.1'] = -10;
  valid.laborerInventory['皮革']['6.2'] = 15;
  assert.equal(encodeNewSchemaState(valid).ok, true);

  const missingCategory = makeValidNewSchemaState();
  delete missingCategory.laborerInventory['皮革'];

  const extraCategory = makeValidNewSchemaState();
  extraCategory.laborerInventory.Extra = {};

  const missingQuality = makeValidNewSchemaState();
  delete missingQuality.laborerInventory['滿日誌']['4.0'];

  const extraQuality = makeValidNewSchemaState();
  extraQuality.laborerInventory['滿日誌']['9.0'] = 0;

  const invalidQuantity = makeValidNewSchemaState();
  invalidQuantity.laborerInventory['滿日誌']['4.0'] = Infinity;

  for (const state of [missingCategory, extraCategory, missingQuality, extraQuality, invalidQuantity]) {
    const encoded = encodeNewSchemaState(state);

    assert.equal(encoded.ok, false);
    assert.equal(encoded.serialized, null);
    assert.deepEqual(encoded.errors, ['INVALID_LABORER_INVENTORY']);
  }
});

test('new-schema storage codec should round trip canonical leather laborer inventory exactly', { concurrency: false }, () => {
  const state = makeValidNewSchemaState();
  state.laborerInventory['皮革']['4.0'] = 5;
  state.laborerInventory['皮革']['6.2'] = -3;

  const encoded = encodeNewSchemaState(state);
  const decoded = decodeNewSchemaState(encoded.serialized);

  assert.equal(encoded.ok, true);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.state.laborerInventory, state.laborerInventory);
  assert.equal(decoded.state.laborerInventory['皮革']['4.0'], 5);
  assert.equal(decoded.state.laborerInventory['皮革']['6.2'], -3);
  assert.equal(Object.hasOwn(decoded.state.laborerInventory, '滿日記本'), false);
});

test('new-schema storage codec should reject legacy 滿日記本 output keys', { concurrency: false }, () => {
  const state = makeValidNewSchemaState();
  state.laborerInventory['滿日記本'] = {};

  const encoded = encodeNewSchemaState(state);
  const valid = makeValidNewSchemaState();

  assert.equal(encoded.ok, false);
  assert.equal(encoded.serialized, null);
  assert.deepEqual(encoded.errors, ['INVALID_LABORER_INVENTORY', 'LEGACY_FIELD_NOT_ALLOWED']);
  assert.equal(Object.hasOwn(valid.laborerInventory, '滿日誌'), true);
  assert.equal(Object.hasOwn(valid.laborerInventory, '滿日記本'), false);
});

test('new-schema storage codec should remain pure atomic and must not access localStorage', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    inventory: { legacy: { qtyByCity: { Thetford: 1 } } },
    assets: { cash: 1, debt: 0 },
    transactions: [{ type: 'legacy' }]
  });
  const state = makeValidNewSchemaState();
  const invalidState = makeValidNewSchemaState();
  invalidState.assets.cash = NaN;
  const stateBefore = JSON.stringify(state);
  const invalidBeforeKeys = Object.keys(invalidState);
  const storageBefore = storageSnapshot();

  const encoded = encodeNewSchemaState(state);
  const failedEncode = encodeNewSchemaState(invalidState);
  const decoded = decodeNewSchemaState(encoded.serialized);
  const source = readFileSync('src/adapters/newSchemaStorageCodec.js', 'utf8');

  assert.equal(encoded.ok, true);
  assert.equal(failedEncode.ok, false);
  assert.equal(failedEncode.serialized, null);
  assert.deepEqual(failedEncode.errors, ['INVALID_ASSETS']);
  assert.equal(decoded.ok, true);
  assert.equal(JSON.stringify(state), stateBefore);
  assert.deepEqual(Object.keys(invalidState), invalidBeforeKeys);
  assert.equal(storageSnapshot(), storageBefore);
  assert.doesNotMatch(source, /localStorage|saveState|loadState|state\.js|document|window|src\/app|backup|writer/i);
});

test('new-schema runtime bridge should project a valid clean state to runtime root shape', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const result = projectNewSchemaToRuntime(state);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(Object.keys(result.state), [
    'schemaVersion',
    'assets',
    'inventory',
    'customLocations',
    'locationRegistry',
    'transactions',
    'laborerInventory',
    'laborerLogs'
  ]);
  assert.equal(result.state.schemaVersion, 1);
  assert.deepEqual(result.state.assets, state.assets);
  assert.notEqual(result.state.assets, state.assets);
  assert.deepEqual(result.state.transactions, state.transactions);
  assert.notEqual(result.state.transactions, state.transactions);
  assert.deepEqual(result.state.laborerLogs, state.laborerLogs);
  assert.notEqual(result.state.laborerLogs, state.laborerLogs);
});

test('new-schema runtime bridge should map system location IDs to current runtime display keys', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const itemKey = Object.keys(state.inventory)[0];
  const result = projectNewSchemaToRuntime(state);

  assert.equal(result.ok, true);
  assert.equal(result.state.inventory[itemKey].qtyByCity.Thetford, state.inventory[itemKey].qtyByLocation.thetford);
  assert.equal(Object.hasOwn(result.state.inventory[itemKey].qtyByCity, 'thetford'), false);
});

test('new-schema runtime bridge should map laborer_island to LaborerIsland', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const itemKey = Object.keys(state.inventory)[0];
  const result = projectNewSchemaToRuntime(state);

  assert.equal(result.ok, true);
  assert.equal(result.state.inventory[itemKey].qtyByCity.LaborerIsland, 5);
  assert.equal(Object.hasOwn(result.state.inventory[itemKey].qtyByCity, 'laborer_island'), false);
});

test('new-schema runtime bridge should map custom location IDs to display names and customLocations', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const customLocationId = 'custom:test-001';
  const customDisplayName = state.locationRegistry[customLocationId].displayName;
  const customItemKey = Object.entries(state.inventory).find(([, item]) =>
    Object.hasOwn(item.qtyByLocation, customLocationId)
  )[0];
  const result = projectNewSchemaToRuntime(state);

  assert.equal(result.ok, true);
  assert.equal(result.state.inventory[customItemKey].qtyByCity[customDisplayName], state.inventory[customItemKey].qtyByLocation[customLocationId]);
  assert.deepEqual(result.state.customLocations, [customDisplayName]);
  assert.deepEqual(result.state.locationRegistry, state.locationRegistry);
  assert.notEqual(result.state.locationRegistry, state.locationRegistry);
});

test('new-schema runtime bridge should expose only active custom entries when inactive shares display name', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const oldLocationId = 'custom:test-001';
  const newLocationId = 'custom:test-002';
  const displayName = state.locationRegistry[oldLocationId].displayName;
  const customItemKey = Object.entries(state.inventory).find(([, item]) =>
    Object.hasOwn(item.qtyByLocation, oldLocationId)
  )[0];

  state.locationRegistry[oldLocationId].active = false;
  state.locationRegistry[newLocationId] = {
    locationId: newLocationId,
    displayName,
    type: 'custom',
    active: true
  };
  delete state.inventory[customItemKey].qtyByLocation[oldLocationId];
  state.inventory[customItemKey].qtyByLocation[newLocationId] = 13;

  const runtime = projectNewSchemaToRuntime(state);
  const roundTrip = projectRuntimeToNewSchema(runtime.state);

  assert.equal(encodeNewSchemaState(state).ok, true);
  assert.equal(runtime.ok, true);
  assert.deepEqual(runtime.state.customLocations, [displayName]);
  assert.equal(runtime.state.locationRegistry[oldLocationId].displayName, displayName);
  assert.equal(runtime.state.locationRegistry[oldLocationId].active, false);
  assert.equal(runtime.state.locationRegistry[newLocationId].displayName, displayName);
  assert.equal(runtime.state.locationRegistry[newLocationId].active, true);
  assert.equal(runtime.state.inventory[customItemKey].qtyByCity[displayName], 13);
  assert.equal(roundTrip.ok, true);
  assert.equal(roundTrip.state.inventory[customItemKey].qtyByLocation[newLocationId], 13);
  assert.equal(Object.hasOwn(roundTrip.state.inventory[customItemKey].qtyByLocation, oldLocationId), false);
  assert.equal(roundTrip.state.locationRegistry[oldLocationId].displayName, displayName);
  assert.equal(roundTrip.state.locationRegistry[newLocationId].displayName, displayName);
});

test('new-schema runtime bridge should convert canonical laborer journal key to runtime journal key', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const result = projectNewSchemaToRuntime(state);

  assert.equal(result.ok, true);
  assert.equal(result.state.laborerInventory['滿日記本']['6.1'], 3);
  assert.equal(Object.hasOwn(result.state.laborerInventory, '滿日誌'), false);
});

test('new-schema runtime bridge should preserve leather laborer inventory through runtime round trip', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  state.laborerInventory['皮革']['4.1'] = 6;
  const runtime = projectNewSchemaToRuntime(state);
  const roundTrip = projectRuntimeToNewSchema(runtime.state);

  assert.equal(runtime.ok, true);
  assert.equal(roundTrip.ok, true);
  assert.equal(runtime.state.laborerInventory['皮革']['6.2'], 11);
  assert.equal(runtime.state.laborerInventory['皮革']['4.1'], 6);
  assert.equal(roundTrip.state.laborerInventory['皮革']['6.2'], 11);
  assert.equal(roundTrip.state.laborerInventory['皮革']['4.1'], 6);
  assert.equal(runtime.state.laborerInventory['滿日記本']['6.1'], 3);
  assert.equal(Object.hasOwn(runtime.state.laborerInventory, '滿日誌'), false);
  assert.equal(roundTrip.state.laborerInventory['滿日誌']['6.1'], 3);
  assert.equal(Object.hasOwn(roundTrip.state.laborerInventory, '滿日記本'), false);
});

test('new-schema runtime bridge should not keep qtyByLocation in runtime inventory', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const result = projectNewSchemaToRuntime(state);

  assert.equal(result.ok, true);
  for (const item of Object.values(result.state.inventory)) {
    assert.equal(Object.hasOwn(item, 'qtyByLocation'), false);
    assert.equal(Object.hasOwn(item, 'qtyByCity'), true);
  }
});

test('new-schema runtime bridge should fail atomically for unknown canonical location IDs', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const itemKey = Object.keys(state.inventory)[0];

  state.inventory[itemKey].qtyByLocation.unknown_location = 9;
  const before = JSON.stringify(state);
  const result = projectNewSchemaToRuntime(state);

  assert.equal(result.ok, false);
  assert.equal(result.state, null);
  assert.deepEqual(result.errors, ['RUNTIME_LOCATION_MAPPING_FAILED']);
  assert.equal(JSON.stringify(state), before);
  assert.equal(Object.hasOwn(state.inventory[itemKey].qtyByLocation, 'unknown_location'), true);
});

test('new-schema runtime bridge should not mutate new-schema input', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const before = JSON.stringify(state);

  projectNewSchemaToRuntime(state);

  assert.equal(JSON.stringify(state), before);
});

test('new-schema runtime bridge should map runtime qtyByCity keys back to location IDs', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;
  const result = projectRuntimeToNewSchema(runtime);
  const itemKey = Object.keys(state.inventory)[0];

  assert.equal(result.ok, true);
  assert.equal(result.state.inventory[itemKey].qtyByLocation.thetford, state.inventory[itemKey].qtyByLocation.thetford);
  assert.equal(result.state.inventory[itemKey].qtyByLocation.laborer_island, 5);
  assert.equal(Object.hasOwn(result.state.inventory[itemKey].qtyByLocation, 'Thetford'), false);
  assert.equal(Object.hasOwn(result.state.inventory[itemKey].qtyByLocation, 'LaborerIsland'), false);
});

test('new-schema runtime bridge should preserve custom location IDs when projecting runtime to canonical', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;
  const result = projectRuntimeToNewSchema(runtime);
  const customLocationId = 'custom:test-001';
  const customDisplayName = state.locationRegistry[customLocationId].displayName;
  const customItemKey = Object.entries(state.inventory).find(([, item]) =>
    Object.hasOwn(item.qtyByLocation, customLocationId)
  )[0];

  assert.equal(result.ok, true);
  assert.equal(result.state.inventory[customItemKey].qtyByLocation[customLocationId], runtime.inventory[customItemKey].qtyByCity[customDisplayName]);
  assert.equal(Object.hasOwn(result.state.inventory[customItemKey].qtyByLocation, customDisplayName), false);
  assert.equal(result.state.locationRegistry[customLocationId].displayName, customDisplayName);
});

test('new-schema runtime bridge should convert runtime laborer journal key back to canonical', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;
  const result = projectRuntimeToNewSchema(runtime);

  assert.equal(result.ok, true);
  assert.equal(result.state.laborerInventory['滿日誌']['6.1'], 3);
  assert.equal(Object.hasOwn(result.state.laborerInventory, '滿日記本'), false);
});

test('new-schema runtime bridge should return canonical output without legacy fields and pass codec validation', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;
  const result = projectRuntimeToNewSchema(runtime);

  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.state, 'customLocations'), false);
  assert.equal(Object.values(result.state.inventory).some(item => Object.hasOwn(item, 'qtyByCity')), false);
  assert.equal(Object.hasOwn(result.state.laborerInventory, '滿日記本'), false);
  assert.equal(encodeNewSchemaState(result.state).ok, true);
});

test('new-schema runtime bridge should fail atomically for unknown runtime locations', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;
  const itemKey = Object.keys(runtime.inventory)[0];

  runtime.inventory[itemKey].qtyByCity.UnknownRuntimeLocation = 4;
  const result = projectRuntimeToNewSchema(runtime);

  assert.equal(result.ok, false);
  assert.equal(result.state, null);
  assert.deepEqual(result.errors, ['RUNTIME_LOCATION_MAPPING_FAILED']);
  assert.equal(runtime.inventory[itemKey].qtyByCity.UnknownRuntimeLocation, 4);
});

test('new-schema runtime bridge should fail atomically for ambiguous runtime location display names', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;

  runtime.locationRegistry['custom:duplicate-display'] = {
    locationId: 'custom:duplicate-display',
    displayName: 'Thetford',
    type: 'custom',
    active: true
  };
  runtime.customLocations.push('Thetford');
  const result = projectRuntimeToNewSchema(runtime);

  assert.equal(result.ok, false);
  assert.equal(result.state, null);
  assert.deepEqual(result.errors, ['RUNTIME_LOCATION_MAPPING_FAILED']);
});

test('new-schema runtime bridge should fail when runtime customLocations no longer match registry', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;

  runtime.customLocations[0] = 'Renamed Warehouse';
  const result = projectRuntimeToNewSchema(runtime);

  assert.equal(result.ok, false);
  assert.equal(result.state, null);
  assert.deepEqual(result.errors, ['RUNTIME_LOCATION_MAPPING_FAILED']);
});

test('new-schema runtime bridge should not mutate runtime input', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state).state;
  const before = JSON.stringify(runtime);

  projectRuntimeToNewSchema(runtime);

  assert.equal(JSON.stringify(runtime), before);
});

test('new-schema runtime bridge should preserve state data across new runtime new round trip', { concurrency: false }, () => {
  const state = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(state);
  const roundTrip = projectRuntimeToNewSchema(runtime.state);

  assert.equal(runtime.ok, true);
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.state.assets, state.assets);
  assert.deepEqual(roundTrip.state.inventory, state.inventory);
  assert.deepEqual(roundTrip.state.locationRegistry, state.locationRegistry);
  assert.deepEqual(roundTrip.state.transactions, state.transactions);
  assert.deepEqual(roundTrip.state.laborerInventory, state.laborerInventory);
  assert.deepEqual(roundTrip.state.laborerLogs, state.laborerLogs);
});

test('new-schema runtime bridge should remain pure and must not access storage or runtime globals', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    inventory: { legacy: { qtyByCity: { Thetford: 1 } } },
    assets: { cash: 1, debt: 0 },
    customLocations: ['Legacy Warehouse']
  });
  const state = makeRuntimeBridgeNewSchemaState();
  const storageBefore = storageSnapshot();
  const source = readFileSync('src/adapters/newSchemaRuntimeBridge.js', 'utf8');

  assert.equal(projectNewSchemaToRuntime(state).ok, true);
  assert.equal(projectRuntimeToNewSchema(projectNewSchemaToRuntime(state).state).ok, true);
  assert.equal(storageSnapshot(), storageBefore);
  assert.doesNotMatch(source, /localStorage|saveState|loadState|state\.js|document|window|src\/app|backup|writer/i);
});

// Future new-schema storage repository contract:
// createNewSchemaStorageRepository(backend) exposes load() and save(state) over the fixed
// NEW_SCHEMA_STORAGE_KEY. The repository only coordinates the storage codec and injected
// key-value backend; it must not use global localStorage, legacy keys, state.js, startup,
// writer, backup, UI, or migration paths. Missing storage is not an error, corrupt storage
// is reported without mutation or fallback, invalid state is not written, and backend read
// or write failures are converted to repository errors without retries or clearing storage.
test('new-schema storage repository should load a valid state from the fixed storage key', { concurrency: false }, () => {
  const serialized = makeValidSerializedNewSchemaState();
  const backend = makeInjectedStorageBackend({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });
  const repository = createNewSchemaStorageRepository(backend);

  const result = repository.load();

  assert.equal(result.ok, true);
  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.state, decodeNewSchemaState(serialized).state);
  assert.notEqual(result.state, decodeNewSchemaState(serialized).state);
  assert.deepEqual(backend.calls, [{ method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }]);

  const thisBoundBackend = {
    entries: new Map([[NEW_SCHEMA_STORAGE_KEY, serialized]]),
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      return this.entries.has(key) ? this.entries.get(key) : null;
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
      this.entries.set(key, value);
    }
  };
  const thisBoundResult = createNewSchemaStorageRepository(thisBoundBackend).load();

  assert.equal(thisBoundResult.ok, true);
  assert.equal(thisBoundResult.status, 'loaded');
  assert.deepEqual(thisBoundBackend.calls, [{ method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }]);
});

test('new-schema storage repository should report missing storage without creating or writing state', { concurrency: false }, () => {
  const backend = makeInjectedStorageBackend();
  const repository = createNewSchemaStorageRepository(backend);

  const result = repository.load();

  assert.deepEqual(result, {
    ok: true,
    status: 'missing',
    state: null,
    errors: []
  });
  assert.deepEqual(backend.calls, [{ method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }]);
  assert.equal(backend.entries.size, 0);
});

test('new-schema storage repository should preserve codec errors for corrupt or invalid stored state', { concurrency: false }, () => {
  const unsupportedState = makeValidNewSchemaState();
  unsupportedState.schemaVersion = 2;
  const legacyState = makeValidNewSchemaState();
  legacyState.customLocations = ['Legacy'];
  const cases = [
    {
      serialized: '{invalid',
      errors: ['INVALID_JSON']
    },
    {
      serialized: JSON.stringify(unsupportedState),
      errors: ['UNSUPPORTED_SCHEMA_VERSION']
    },
    {
      serialized: JSON.stringify(legacyState),
      errors: ['INVALID_ROOT_STATE', 'LEGACY_FIELD_NOT_ALLOWED']
    }
  ];

  for (const { serialized, errors } of cases) {
    const backend = makeInjectedStorageBackend({ [NEW_SCHEMA_STORAGE_KEY]: serialized });
    const repository = createNewSchemaStorageRepository(backend);

    const result = repository.load();

    assert.deepEqual(result, {
      ok: false,
      status: 'invalid',
      state: null,
      errors
    });
    assert.deepEqual(backend.entries.get(NEW_SCHEMA_STORAGE_KEY), serialized);
    assert.deepEqual(backend.calls, [{ method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }]);
  }
});

test('new-schema storage repository should handle backend read failures without throwing', { concurrency: false }, () => {
  const readFailureBackends = [
    {
      calls: [],
      getItem(key) {
        this.calls.push({ method: 'getItem', key });
        throw new Error('read failed');
      },
      setItem() {
        this.calls.push({ method: 'setItem' });
      }
    },
    makeInjectedStorageBackend({ [NEW_SCHEMA_STORAGE_KEY]: 1 }),
    makeInjectedStorageBackend({ [NEW_SCHEMA_STORAGE_KEY]: {} }),
    makeInjectedStorageBackend({ [NEW_SCHEMA_STORAGE_KEY]: undefined }),
    makeInjectedStorageBackend({ [NEW_SCHEMA_STORAGE_KEY]: Promise.resolve('{}') }),
    makeInjectedStorageBackend({
      [NEW_SCHEMA_STORAGE_KEY]: {
        get then() {
          throw new Error('then getter failure');
        }
      }
    })
  ];

  for (const backend of readFailureBackends) {
    const repository = createNewSchemaStorageRepository(backend);

    assert.doesNotThrow(() => repository.load());
    const result = repository.load();

    assert.deepEqual(result, {
      ok: false,
      status: 'error',
      state: null,
      errors: ['STORAGE_READ_FAILED']
    });
    assert.equal(backend.calls.every(call => call.method !== 'setItem'), true);
  }
});

test('new-schema storage repository should save a valid state through one encoded fixed-key write', { concurrency: false }, () => {
  const state = makeValidNewSchemaState();
  const before = JSON.stringify(state);
  const backend = makeInjectedStorageBackend();
  const repository = createNewSchemaStorageRepository(backend);

  const result = repository.save(state);
  const stored = backend.entries.get(NEW_SCHEMA_STORAGE_KEY);

  assert.deepEqual(result, {
    ok: true,
    status: 'saved',
    errors: []
  });
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(backend.calls.map(call => call.method), ['setItem']);
  assert.equal(backend.calls[0].key, NEW_SCHEMA_STORAGE_KEY);
  assert.deepEqual(decodeNewSchemaState(stored).state, state);

  const thisBoundBackend = {
    entries: new Map(),
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      return this.entries.has(key) ? this.entries.get(key) : null;
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
      this.entries.set(key, value);
    }
  };
  const thisBoundSave = createNewSchemaStorageRepository(thisBoundBackend).save(state);

  assert.equal(thisBoundSave.ok, true);
  assert.equal(thisBoundSave.status, 'saved');
  assert.deepEqual(thisBoundBackend.calls.map(call => call.method), ['setItem']);
  assert.deepEqual(decodeNewSchemaState(thisBoundBackend.entries.get(NEW_SCHEMA_STORAGE_KEY)).state, state);
});

test('new-schema storage repository should reject invalid state without attempting a write', { concurrency: false }, () => {
  const invalidAssets = makeValidNewSchemaState();
  invalidAssets.assets.cash = NaN;
  const legacyInventory = makeValidNewSchemaState();
  const itemKey = Object.keys(legacyInventory.inventory)[0];
  legacyInventory.inventory[itemKey].qtyByCity = { Thetford: 1 };
  const cases = [
    {
      state: invalidAssets,
      errors: ['INVALID_ASSETS']
    },
    {
      state: legacyInventory,
      errors: ['INVALID_INVENTORY', 'LEGACY_FIELD_NOT_ALLOWED']
    }
  ];

  for (const { state, errors } of cases) {
    const backend = makeInjectedStorageBackend({ existing: 'value' });
    const repository = createNewSchemaStorageRepository(backend);

    const result = repository.save(state);

    assert.deepEqual(result, {
      ok: false,
      status: 'invalid',
      errors
    });
    assert.deepEqual(backend.calls, []);
    assert.deepEqual([...backend.entries.entries()], [['existing', 'value']]);
  }
});

test('new-schema storage repository should handle backend write failures without retrying or clearing storage', { concurrency: false }, () => {
  const backend = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      return null;
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
      throw new Error('write failed');
    },
    removeItem(key) {
      this.calls.push({ method: 'removeItem', key });
    }
  };
  const repository = createNewSchemaStorageRepository(backend);

  const result = repository.save(makeValidNewSchemaState());

  assert.deepEqual(result, {
    ok: false,
    status: 'error',
    errors: ['STORAGE_WRITE_FAILED']
  });
  assert.deepEqual(backend.calls.map(call => call.method), ['setItem']);

  const asyncBackend = makeInjectedStorageBackend();
  asyncBackend.setItem = (key, value) => {
    asyncBackend.calls.push({ method: 'setItem', key, value });
    return Promise.resolve();
  };
  const asyncResult = createNewSchemaStorageRepository(asyncBackend).save(makeValidNewSchemaState());

  assert.deepEqual(asyncResult, {
    ok: false,
    status: 'error',
    errors: ['STORAGE_WRITE_FAILED']
  });
  assert.deepEqual(asyncBackend.calls.map(call => call.method), ['setItem']);

  const thenGetterBackend = makeInjectedStorageBackend();
  thenGetterBackend.setItem = (key, value) => {
    thenGetterBackend.calls.push({ method: 'setItem', key, value });
    return {
      get then() {
        throw new Error('then getter failure');
      }
    };
  };
  const thenGetterResult = createNewSchemaStorageRepository(thenGetterBackend).save(makeValidNewSchemaState());

  assert.deepEqual(thenGetterResult, {
    ok: false,
    status: 'error',
    errors: ['STORAGE_WRITE_FAILED']
  });
  assert.deepEqual(thenGetterBackend.calls.map(call => call.method), ['setItem']);
});

test('new-schema storage repository should reject invalid injected backend contracts', { concurrency: false }, () => {
  const invalidBackends = [
    null,
    [],
    1,
    'backend',
    new Date(),
    new Map(),
    new Set(),
    new (class Backend {
      getItem() {}
      setItem() {}
    })(),
    {
      get getItem() {
        throw new Error('getter failure');
      },
      setItem() {}
    },
    {
      getItem() {
        return null;
      },
      get setItem() {
        throw new Error('getter failure');
      }
    },
    { setItem() {} },
    { getItem() {} },
    { getItem: 'not-function', setItem() {} },
    { getItem() {}, setItem: 'not-function' }
  ];

  for (const backend of invalidBackends) {
    const repository = createNewSchemaStorageRepository(backend);

    assert.doesNotThrow(() => repository.load());
    assert.doesNotThrow(() => repository.save(makeValidNewSchemaState()));
    assert.deepEqual(repository.load(), {
      ok: false,
      status: 'error',
      state: null,
      errors: ['INVALID_STORAGE_BACKEND']
    });
    assert.deepEqual(repository.save(makeValidNewSchemaState()), {
      ok: false,
      status: 'error',
      errors: ['INVALID_STORAGE_BACKEND']
    });
  }
});

test('new-schema storage repository should never read write delete or scan legacy storage keys', { concurrency: false }, () => {
  const legacyEntries = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]));
  const backend = makeInjectedStorageBackend({
    ...legacyEntries,
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  backend.removeItem = key => {
    backend.calls.push({ method: 'removeItem', key });
    throw new Error('unexpected remove');
  };
  backend.key = index => {
    backend.calls.push({ method: 'key', index });
    throw new Error('unexpected scan');
  };
  Object.defineProperty(backend, 'length', {
    get() {
      backend.calls.push({ method: 'length' });
      throw new Error('unexpected length');
    }
  });
  const repository = createNewSchemaStorageRepository(backend);

  const loadResult = repository.load();
  const saveResult = repository.save(makeValidNewSchemaState());

  assert.equal(loadResult.ok, true);
  assert.equal(saveResult.ok, true);
  assert.deepEqual(
    backend.calls.map(call => call.key).filter(Boolean),
    [NEW_SCHEMA_STORAGE_KEY, NEW_SCHEMA_STORAGE_KEY]
  );
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(backend.entries.get(key), legacyEntries[key]);
  }
  assert.equal(backend.calls.some(call => ['removeItem', 'key', 'length'].includes(call.method)), false);
});

test('new-schema storage repository should remain isolated from global localStorage state startup writer backup and UI', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    inventory: { legacy: { qtyByCity: { Thetford: 1 } } },
    assets: { cash: 1, debt: 0 },
    transactions: [{ type: 'legacy' }]
  });
  const before = storageSnapshot();
  const backend = makeInjectedStorageBackend();
  const repository = createNewSchemaStorageRepository(backend);

  repository.save(makeValidNewSchemaState());
  repository.load();

  const source = readFileSync('src/adapters/newSchemaStorageRepository.js', 'utf8');
  assert.equal(storageSnapshot(), before);
  assert.doesNotMatch(source, /localStorage|window|document|state\.js|src\/app|component|backup|writer|removeItem|key\(|length|albion_crafting/i);
});

// Future browser Storage backend binding contract:
// createBrowserStorageBackend(storage) accepts only an explicit Storage-like object and
// returns repository-compatible getItem/setItem methods. It must preserve storage as method
// this, forward arguments without key transformation, and leave read/write operation errors
// to the repository. The binding must not read global localStorage/window/document, import
// repository/codec/state/startup/writer/backup/UI paths, inspect schema or keys, scan length,
// call key(index), or delete storage entries.
test('browser storage backend should wrap a valid Storage-like object', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble();
  const binding = createBrowserStorageBackend(storageDouble);

  assert.deepEqual(binding, {
    ok: true,
    backend: binding.backend,
    errors: []
  });
  assert.equal(typeof binding.backend.getItem, 'function');
  assert.equal(typeof binding.backend.setItem, 'function');

  const repository = createNewSchemaStorageRepository(binding.backend);
  const state = makeValidNewSchemaState();
  const saveResult = repository.save(state);
  const loadResult = repository.load();

  assert.equal(saveResult.ok, true);
  assert.equal(saveResult.status, 'saved');
  assert.equal(loadResult.ok, true);
  assert.equal(loadResult.status, 'loaded');
  assert.deepEqual(loadResult.state, state);
});

test('browser storage backend should preserve the original storage as method this', { concurrency: false }, () => {
  class StorageDouble {
    constructor(initialEntries = {}) {
      this.entries = new Map(Object.entries(initialEntries));
      this.calls = [];
    }

    getItem(key) {
      this.calls.push({ method: 'getItem', thisValue: this, key });
      return this.entries.has(key) ? this.entries.get(key) : null;
    }

    setItem(key, value) {
      this.calls.push({ method: 'setItem', thisValue: this, key, value });
      this.entries.set(key, String(value));
    }
  }

  const storageDouble = new StorageDouble();
  const binding = createBrowserStorageBackend(storageDouble);
  const repository = createNewSchemaStorageRepository(binding.backend);

  assert.equal(binding.ok, true);
  assert.equal(repository.save(makeValidNewSchemaState()).ok, true);
  assert.equal(repository.load().ok, true);
  assert.equal(storageDouble.calls.every(call => call.thisValue === storageDouble), true);
});

test('browser storage backend should forward getItem and setItem arguments without transformation', { concurrency: false }, () => {
  const key = { marker: 'key' };
  const value = { marker: 'value' };
  const calls = [];
  const storageDouble = {
    getItem(receivedKey) {
      calls.push({ method: 'getItem', key: receivedKey });
      return null;
    },

    setItem(receivedKey, receivedValue) {
      calls.push({ method: 'setItem', key: receivedKey, value: receivedValue });
    }
  };
  const binding = createBrowserStorageBackend(storageDouble);

  assert.equal(binding.ok, true);
  binding.backend.getItem(key);
  binding.backend.setItem(key, value);

  assert.equal(calls[0].key, key);
  assert.equal(calls[1].key, key);
  assert.equal(calls[1].value, value);
});

test('browser storage backend should expose removeItem with storage this binding when available', { concurrency: false }, () => {
  class StorageDouble {
    constructor(initialEntries = {}) {
      this.entries = new Map(Object.entries(initialEntries));
      this.calls = [];
    }

    getItem(key) {
      this.calls.push({ method: 'getItem', thisValue: this, key });
      return this.entries.has(key) ? this.entries.get(key) : null;
    }

    setItem(key, value) {
      this.calls.push({ method: 'setItem', thisValue: this, key, value });
      this.entries.set(key, String(value));
    }

    removeItem(key) {
      this.calls.push({ method: 'removeItem', thisValue: this, key });
      this.entries.delete(key);
    }
  }

  const storageDouble = new StorageDouble({ keep: 'yes', remove: 'old' });
  const binding = createBrowserStorageBackend(storageDouble);

  assert.equal(binding.ok, true);
  assert.equal(typeof binding.backend.removeItem, 'function');
  binding.backend.removeItem('remove');

  assert.equal(storageDouble.entries.get('keep'), 'yes');
  assert.equal(storageDouble.entries.has('remove'), false);
  assert.deepEqual(storageDouble.calls, [
    { method: 'removeItem', thisValue: storageDouble, key: 'remove' }
  ]);
});

test('browser storage backend should keep read-write binding when removeItem is absent', { concurrency: false }, () => {
  const storageDouble = {
    entries: new Map(),
    getItem(key) {
      return this.entries.has(key) ? this.entries.get(key) : null;
    },
    setItem(key, value) {
      this.entries.set(key, String(value));
    }
  };

  const binding = createBrowserStorageBackend(storageDouble);

  assert.equal(binding.ok, true);
  assert.equal(typeof binding.backend.getItem, 'function');
  assert.equal(typeof binding.backend.setItem, 'function');
  assert.equal(Object.hasOwn(binding.backend, 'removeItem'), false);
  assert.equal(createNewSchemaStorageRepository(binding.backend).save(makeValidNewSchemaState()).ok, true);
});

test('browser storage backend should reject invalid or throwing storage method contracts', { concurrency: false }, () => {
  const invalidContracts = [
    null,
    undefined,
    1,
    'storage',
    [],
    new Date(),
    new Map(),
    new Set(),
    {},
    { getItem() {} },
    { setItem() {} },
    { getItem: 'not a function', setItem() {} },
    { getItem() {}, setItem: 'not a function' },
    {
      get getItem() {
        throw new Error('getter failure');
      },
      setItem() {}
    },
    {
      getItem() {},
      get setItem() {
        throw new Error('getter failure');
      }
    },
    {
      getItem() {},
      setItem() {},
      get removeItem() {
        throw new Error('getter failure');
      }
    },
    {
      get [Symbol.toStringTag]() {
        throw new Error('tag failure');
      },
      getItem() {},
      setItem() {}
    },
    new Proxy(
      {
        getItem() {},
        setItem() {}
      },
      {
        get(target, prop, receiver) {
          if (prop === Symbol.toStringTag) throw new Error('proxy tag failure');
          return Reflect.get(target, prop, receiver);
        }
      }
    ),
    new Proxy(
      {},
      {
        get(target, prop, receiver) {
          if (prop === 'getItem') throw new Error('proxy method failure');
          return Reflect.get(target, prop, receiver);
        }
      }
    )
  ];

  for (const storageContract of invalidContracts) {
    assert.doesNotThrow(() => createBrowserStorageBackend(storageContract));
    assert.deepEqual(createBrowserStorageBackend(storageContract), {
      ok: false,
      backend: null,
      errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
    });
  }

  const firstFailure = createBrowserStorageBackend(null);
  const secondFailure = createBrowserStorageBackend(null);

  assert.notEqual(firstFailure, secondFailure);
  assert.notEqual(firstFailure.errors, secondFailure.errors);
  firstFailure.errors.push('MUTATED');
  assert.deepEqual(secondFailure.errors, BROWSER_STORAGE_BACKEND_ERROR_ORDER);
  assert.deepEqual(createBrowserStorageBackend(null).errors, BROWSER_STORAGE_BACKEND_ERROR_ORDER);

  const readFailureBinding = createBrowserStorageBackend({
    getItem() {
      throw new Error('read failure');
    },
    setItem() {}
  });
  const writeFailureBinding = createBrowserStorageBackend({
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('write failure');
    }
  });

  assert.equal(readFailureBinding.ok, true);
  assert.deepEqual(createNewSchemaStorageRepository(readFailureBinding.backend).load(), {
    ok: false,
    status: 'error',
    state: null,
    errors: ['STORAGE_READ_FAILED']
  });
  assert.equal(writeFailureBinding.ok, true);
  assert.deepEqual(createNewSchemaStorageRepository(writeFailureBinding.backend).save(makeValidNewSchemaState()), {
    ok: false,
    status: 'error',
    errors: ['STORAGE_WRITE_FAILED']
  });
});

test('browser storage backend should not scan delete or inspect unrelated storage keys', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble({
    unrelated: 'keep',
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  Object.defineProperty(storageDouble, 'length', {
    get() {
      storageDouble.calls.push({ method: 'length' });
      throw new Error('unexpected length read');
    }
  });
  storageDouble.key = index => {
    storageDouble.calls.push({ method: 'key', index });
    throw new Error('unexpected scan');
  };
  storageDouble.removeItem = key => {
    storageDouble.calls.push({ method: 'removeItem', key });
    throw new Error('unexpected delete');
  };

  const binding = createBrowserStorageBackend(storageDouble);
  const repository = createNewSchemaStorageRepository(binding.backend);
  const loadResult = repository.load();
  const saveResult = repository.save(makeValidNewSchemaState());

  assert.equal(loadResult.ok, true);
  assert.equal(saveResult.ok, true);
  assert.equal(storageDouble.entries.get('unrelated'), 'keep');
  assert.deepEqual(storageDouble.calls.map(call => call.method), ['getItem', 'setItem']);
  assert.equal(storageDouble.calls.some(call => ['removeItem', 'key', 'length'].includes(call.method)), false);
});

test('browser storage backend should remain isolated from global localStorage state startup writer backup and UI', { concurrency: false }, () => {
  const before = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble();
  const binding = createBrowserStorageBackend(storageDouble);

  assert.equal(binding.ok, true);
  binding.backend.setItem('isolated', 'value');
  binding.backend.getItem('isolated');

  const source = readFileSync('src/adapters/browserStorageBackend.js', 'utf8');
  assert.equal(storageSnapshot(), before);
  assert.doesNotMatch(source, /\bglobalThis\b|\bwindow\b|\bdocument\b|\blocalStorage\b/);
  assert.doesNotMatch(source, /state\.js|src\/app|component|backup|writer|repository|codec|key\(|length|albion_crafting|NEW_SCHEMA_STORAGE_KEY/i);
});

// Future browser new-schema repository composition contract:
// createBrowserNewSchemaRepository(storage) only composes createBrowserStorageBackend(storage)
// with createNewSchemaStorageRepository(backend). It accepts explicit Storage-like input only,
// returns { ok:true, repository, errors:[] } or { ok:false, repository:null, errors:['INVALID_BROWSER_STORAGE'] },
// preserves browser binding error semantics, creates no new storage error taxonomy, and must not
// read global localStorage, call load/save, mutate storage, inspect keys, or touch state/startup/writer/backup/UI/migration paths.
test('createBrowserNewSchemaRepository should compose a repository from an explicitly injected valid Storage-like object', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble();
  const result = createBrowserNewSchemaRepository(storageDouble);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(typeof result.repository.load, 'function');
  assert.equal(typeof result.repository.save, 'function');
  assert.deepEqual(storageDouble.calls, []);
});

test('createBrowserNewSchemaRepository should return a controlled invalid-binding result without creating a repository', { concurrency: false }, () => {
  const result = createBrowserNewSchemaRepository(null);
  const hostileResult = createBrowserNewSchemaRepository({
    get [Symbol.toStringTag]() {
      throw new Error('tag failure');
    },
    getItem() {},
    setItem() {}
  });

  assert.deepEqual(result, {
    ok: false,
    repository: null,
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
  assert.deepEqual(hostileResult, {
    ok: false,
    repository: null,
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
  assert.notEqual(result.errors, hostileResult.errors);
});

test('createBrowserNewSchemaRepository should preserve repository fixed-key save/load behavior through the composed boundary', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble();
  const result = createBrowserNewSchemaRepository(storageDouble);
  const state = makeValidNewSchemaState();

  const saveResult = result.repository.save(state);
  const loadResult = result.repository.load();

  assert.equal(saveResult.ok, true);
  assert.equal(saveResult.status, 'saved');
  assert.equal(loadResult.ok, true);
  assert.equal(loadResult.status, 'loaded');
  assert.deepEqual(loadResult.state, state);
  assert.deepEqual(
    storageDouble.calls.map(call => call.key),
    [NEW_SCHEMA_STORAGE_KEY, NEW_SCHEMA_STORAGE_KEY]
  );
});

test('createBrowserNewSchemaRepository should not read global localStorage when explicit storage is supplied', { concurrency: false }, () => {
  const before = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble();
  const result = createBrowserNewSchemaRepository(storageDouble);

  assert.equal(result.ok, true);
  assert.deepEqual(storageDouble.calls, []);
  assert.equal(storageSnapshot(), before);
});

test('createBrowserNewSchemaRepository should not call load save or mutate storage during composition', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble({ existing: 'keep' });
  const beforeEntries = Array.from(storageDouble.entries.entries());
  const result = createBrowserNewSchemaRepository(storageDouble);

  assert.equal(result.ok, true);
  assert.deepEqual(storageDouble.calls, []);
  assert.deepEqual(Array.from(storageDouble.entries.entries()), beforeEntries);
});

test('createBrowserNewSchemaRepository should remain isolated from state startup writer backup UI and migration paths', { concurrency: false }, () => {
  const before = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble();
  const result = createBrowserNewSchemaRepository(storageDouble);

  assert.equal(result.ok, true);
  assert.equal(storageSnapshot(), before);

  const source = readFileSync('src/adapters/browserNewSchemaRepository.js', 'utf8');
  assert.doesNotMatch(source, /\bglobalThis\b|\bwindow\b|\bdocument\b|\blocalStorage\b/);
  assert.doesNotMatch(source, /state\.js|src\/app|component|backup|writer|startup|migration|removeItem|key\(|length|albion_crafting/i);
});

test('loadBrowserNewSchemaState should return loaded for a valid new-schema state', { concurrency: false }, () => {
  const serialized = makeValidSerializedNewSchemaState();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });

  const result = loadBrowserNewSchemaState(storageDouble);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.state, decodeNewSchemaState(serialized).state);
});

test('loadBrowserNewSchemaState should return missing when the fixed key is absent', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble();

  const result = loadBrowserNewSchemaState(storageDouble);

  assert.deepEqual(result, {
    ok: true,
    status: 'missing',
    state: null,
    errors: []
  });
});

test('loadBrowserNewSchemaState should return invalid with codec errors for invalid serialized state', { concurrency: false }, () => {
  const invalidState = makeValidNewSchemaState();
  invalidState.schemaVersion = 2;
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: JSON.stringify(invalidState)
  });

  const result = loadBrowserNewSchemaState(storageDouble);

  assert.deepEqual(result, {
    ok: false,
    status: 'invalid',
    state: null,
    errors: ['UNSUPPORTED_SCHEMA_VERSION']
  });
});

test('loadBrowserNewSchemaState should return storage read errors without throwing', { concurrency: false }, () => {
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      throw new Error('read failure');
    },
    setItem() {
      this.calls.push({ method: 'setItem' });
    }
  };

  assert.doesNotThrow(() => loadBrowserNewSchemaState(storageDouble));
  assert.deepEqual(loadBrowserNewSchemaState(storageDouble), {
    ok: false,
    status: 'error',
    state: null,
    errors: ['STORAGE_READ_FAILED']
  });
});

test('loadBrowserNewSchemaState should return invalid browser storage errors for invalid input', { concurrency: false }, () => {
  const result = loadBrowserNewSchemaState(null);

  assert.deepEqual(result, {
    ok: false,
    status: 'error',
    state: null,
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
});

test('loadBrowserNewSchemaState should call getItem exactly once with the fixed storage key', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });

  loadBrowserNewSchemaState(storageDouble);

  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('loadBrowserNewSchemaState should not write scan delete or access legacy storage keys', { concurrency: false }, () => {
  const legacyEntries = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]));
  const storageDouble = makeBrowserStorageDouble({
    ...legacyEntries,
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  Object.defineProperty(storageDouble, 'length', {
    get() {
      storageDouble.calls.push({ method: 'length' });
      throw new Error('unexpected length read');
    }
  });
  storageDouble.key = index => {
    storageDouble.calls.push({ method: 'key', index });
    throw new Error('unexpected scan');
  };
  storageDouble.removeItem = key => {
    storageDouble.calls.push({ method: 'removeItem', key });
    throw new Error('unexpected delete');
  };

  const result = loadBrowserNewSchemaState(storageDouble);

  assert.equal(result.ok, true);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(storageDouble.entries.get(key), legacyEntries[key]);
  }
  assert.equal(storageDouble.calls.some(call => ['setItem', 'removeItem', 'key', 'length'].includes(call.method)), false);
});

test('loadBrowserNewSchemaState should not read global localStorage when explicit storage is supplied', { concurrency: false }, () => {
  const before = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble();

  loadBrowserNewSchemaState(storageDouble);

  assert.equal(storageSnapshot(), before);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('loadBrowserNewSchemaState should not mutate input storage or returned loaded state unexpectedly', { concurrency: false }, () => {
  const serialized = makeValidSerializedNewSchemaState();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });
  const beforeEntries = Array.from(storageDouble.entries.entries());

  const result = loadBrowserNewSchemaState(storageDouble);

  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(storageDouble.entries.entries()), beforeEntries);
  result.state.assets.cash = 999;
  assert.equal(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY), serialized);
  assert.notEqual(result.state, decodeNewSchemaState(serialized).state);
});

test('loadBrowserNewSchemaState should remain isolated from app state writer backup UI and migration paths', { concurrency: false }, () => {
  const before = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble();

  loadBrowserNewSchemaState(storageDouble);

  const source = readFileSync('src/adapters/browserNewSchemaStartup.js', 'utf8');
  assert.equal(storageSnapshot(), before);
  assert.doesNotMatch(source, /\bglobalThis\b|\bwindow\b|\bdocument\b|\blocalStorage\b/);
  assert.doesNotMatch(source, /core\/state|state\.js|src\/app|component|backup|writer|migration|removeItem|key\(|length|albion_crafting/i);
});

test('resolveBrowserNewSchemaStartup should return ready for a loaded new-schema state', { concurrency: false }, () => {
  const serialized = makeValidSerializedNewSchemaState();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });

  const result = resolveBrowserNewSchemaStartup(storageDouble);

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'ready');
  assert.equal(result.sourceStatus, 'loaded');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.state, decodeNewSchemaState(serialized).state);
});

test('resolveBrowserNewSchemaStartup should return initialize only for missing storage', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble();

  const result = resolveBrowserNewSchemaStartup(storageDouble);

  assert.deepEqual(result, {
    ok: true,
    mode: 'initialize',
    state: null,
    sourceStatus: 'missing',
    errors: []
  });
});

test('resolveBrowserNewSchemaStartup should block invalid serialized state without initializing', { concurrency: false }, () => {
  const invalidState = makeValidNewSchemaState();
  invalidState.schemaVersion = 2;
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: JSON.stringify(invalidState)
  });

  const result = resolveBrowserNewSchemaStartup(storageDouble);

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'invalid',
    errors: ['UNSUPPORTED_SCHEMA_VERSION']
  });
});

test('resolveBrowserNewSchemaStartup should block storage read errors without initializing', { concurrency: false }, () => {
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      throw new Error('read failure');
    },
    setItem() {
      this.calls.push({ method: 'setItem' });
    }
  };

  const result = resolveBrowserNewSchemaStartup(storageDouble);

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'error',
    errors: ['STORAGE_READ_FAILED']
  });
});

test('resolveBrowserNewSchemaStartup should block invalid Storage-like input', { concurrency: false }, () => {
  const result = resolveBrowserNewSchemaStartup(null);

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'error',
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
});

test('resolveBrowserNewSchemaStartup should never convert invalid or error results to initialize', { concurrency: false }, () => {
  const invalidState = makeValidNewSchemaState();
  invalidState.schemaVersion = 2;
  const invalidStorage = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: JSON.stringify(invalidState)
  });
  const errorStorage = {
    getItem() {
      throw new Error('read failure');
    },
    setItem() {}
  };

  const invalidResult = resolveBrowserNewSchemaStartup(invalidStorage);
  const errorResult = resolveBrowserNewSchemaStartup(errorStorage);

  assert.equal(invalidResult.mode, 'blocked');
  assert.equal(invalidResult.sourceStatus, 'invalid');
  assert.equal(errorResult.mode, 'blocked');
  assert.equal(errorResult.sourceStatus, 'error');
  assert.notEqual(invalidResult.mode, 'initialize');
  assert.notEqual(errorResult.mode, 'initialize');
});

test('resolveBrowserNewSchemaStartup should preserve the loaded state in ready mode', { concurrency: false }, () => {
  const serialized = makeValidSerializedNewSchemaState();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });

  const result = resolveBrowserNewSchemaStartup(storageDouble);

  assert.equal(result.mode, 'ready');
  assert.deepEqual(result.state, decodeNewSchemaState(serialized).state);
  result.state.assets.cash = 12345;
  assert.equal(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY), serialized);
});

test('resolveBrowserNewSchemaStartup should not write scan delete or access legacy storage keys', { concurrency: false }, () => {
  const legacyEntries = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]));
  const storageDouble = makeBrowserStorageDouble({
    ...legacyEntries,
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  Object.defineProperty(storageDouble, 'length', {
    get() {
      storageDouble.calls.push({ method: 'length' });
      throw new Error('unexpected length read');
    }
  });
  storageDouble.key = index => {
    storageDouble.calls.push({ method: 'key', index });
    throw new Error('unexpected scan');
  };
  storageDouble.removeItem = key => {
    storageDouble.calls.push({ method: 'removeItem', key });
    throw new Error('unexpected delete');
  };

  const result = resolveBrowserNewSchemaStartup(storageDouble);

  assert.equal(result.mode, 'ready');
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(storageDouble.entries.get(key), legacyEntries[key]);
  }
  assert.equal(storageDouble.calls.some(call => ['setItem', 'removeItem', 'key', 'length'].includes(call.method)), false);
});

test('resolveBrowserNewSchemaStartup should not read global localStorage or mutate input storage', { concurrency: false }, () => {
  const before = storageSnapshot();
  const serialized = makeValidSerializedNewSchemaState();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });
  const beforeEntries = Array.from(storageDouble.entries.entries());

  resolveBrowserNewSchemaStartup(storageDouble);

  assert.equal(storageSnapshot(), before);
  assert.deepEqual(Array.from(storageDouble.entries.entries()), beforeEntries);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('resolveBrowserNewSchemaStartup should remain isolated from app state writer backup UI and migration paths', { concurrency: false }, () => {
  const before = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble();

  resolveBrowserNewSchemaStartup(storageDouble);

  const source = readFileSync('src/adapters/browserNewSchemaStartup.js', 'utf8');
  assert.equal(storageSnapshot(), before);
  assert.doesNotMatch(source, /\bglobalThis\b|\bwindow\b|\bdocument\b|\blocalStorage\b/);
  assert.doesNotMatch(source, /core\/state|state\.js|src\/app|component|backup|writer|migration|removeItem|key\(|length|albion_crafting/i);
});

test('browser new-schema runtime controller should create from valid explicit storage', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble();

  const result = createBrowserNewSchemaRuntimeController(storageDouble);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(typeof result.controller.start, 'function');
  assert.equal(typeof result.controller.save, 'function');
  assert.deepEqual(storageDouble.calls, []);
});

test('browser new-schema runtime controller should reject invalid storage with controlled errors', { concurrency: false }, () => {
  const result = createBrowserNewSchemaRuntimeController(null);

  assert.deepEqual(result, {
    ok: false,
    controller: null,
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
});

test('browser new-schema runtime controller start should project loaded canonical state to runtime ready state', { concurrency: false }, () => {
  const canonical = makeRuntimeBridgeNewSchemaState();
  const serialized = encodeNewSchemaState(canonical).serialized;
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;
  const itemKey = Object.keys(canonical.inventory)[0];

  const result = controller.start();

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'ready');
  assert.equal(result.sourceStatus, 'loaded');
  assert.deepEqual(result.errors, []);
  assert.equal(result.state.inventory[itemKey].qtyByCity.Thetford, canonical.inventory[itemKey].qtyByLocation.thetford);
  assert.equal(Object.hasOwn(result.state.inventory[itemKey], 'qtyByLocation'), false);
  assert.equal(result.state.laborerInventory['滿日記本']['6.1'], 3);
});

test('browser new-schema runtime controller start should preserve initialize for missing storage', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble();
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const result = controller.start();

  assert.deepEqual(result, {
    ok: true,
    mode: 'initialize',
    state: null,
    sourceStatus: 'missing',
    errors: []
  });
});

test('browser new-schema runtime controller start should preserve blocked invalid canonical data', { concurrency: false }, () => {
  const invalidState = makeValidNewSchemaState();
  invalidState.schemaVersion = 2;
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: JSON.stringify(invalidState)
  });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const result = controller.start();

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'invalid',
    errors: ['UNSUPPORTED_SCHEMA_VERSION']
  });
});

test('browser new-schema runtime controller start should preserve blocked storage read errors', { concurrency: false }, () => {
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      throw new Error('read failed');
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
    }
  };
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const result = controller.start();

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'error',
    errors: ['STORAGE_READ_FAILED']
  });
  assert.deepEqual(storageDouble.calls, [{ method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }]);
});

test('browser new-schema runtime controller start should block runtime projection failures as projection-error', { concurrency: false }, () => {
  const canonical = makeRuntimeControllerProjectionFailureState();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const result = controller.start();

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'projection-error',
    errors: ['RUNTIME_LOCATION_MAPPING_FAILED']
  });
});

test('browser new-schema runtime controller start should read the fixed key exactly once', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.start();

  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('browser new-schema runtime controller start should not write storage', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  const beforeEntries = Array.from(storageDouble.entries.entries());
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.start();

  assert.deepEqual(Array.from(storageDouble.entries.entries()), beforeEntries);
  assert.equal(storageDouble.calls.some(call => call.method === 'setItem'), false);
});

test('browser new-schema runtime controller start should not read legacy keys', { concurrency: false }, () => {
  const legacyEntries = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]));
  const storageDouble = makeBrowserStorageDouble({
    ...legacyEntries,
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.start();

  assert.deepEqual(storageDouble.calls.map(call => call.key), [NEW_SCHEMA_STORAGE_KEY]);
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(storageDouble.entries.get(key), legacyEntries[key]);
  }
});

test('browser new-schema runtime controller save should project valid runtime state and save canonical state', { concurrency: false }, () => {
  const canonical = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(canonical).state;
  const storageDouble = makeBrowserStorageDouble();
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const result = controller.save(runtime);
  const stored = decodeNewSchemaState(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'saved');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(stored.state, result.state);
  assert.deepEqual(result.state.inventory, canonical.inventory);
  assert.equal(Object.hasOwn(result.state, 'customLocations'), false);
});

test('browser new-schema runtime controller save should set the fixed key exactly once', { concurrency: false }, () => {
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const storageDouble = makeBrowserStorageDouble();
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.save(runtime);

  assert.equal(storageDouble.calls.length, 1);
  assert.equal(storageDouble.calls[0].method, 'setItem');
  assert.equal(storageDouble.calls[0].key, NEW_SCHEMA_STORAGE_KEY);
});

test('browser new-schema runtime controller save should not write legacy keys', { concurrency: false }, () => {
  const legacyEntries = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]));
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const storageDouble = makeBrowserStorageDouble(legacyEntries);
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.save(runtime);

  assert.deepEqual(storageDouble.calls.map(call => call.key), [NEW_SCHEMA_STORAGE_KEY]);
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(storageDouble.entries.get(key), legacyEntries[key]);
  }
});

test('browser new-schema runtime controller save should reject runtime mapping failures without writing', { concurrency: false }, () => {
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const itemKey = Object.keys(runtime.inventory)[0];
  const storageDouble = makeBrowserStorageDouble({ existing: 'keep' });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  runtime.inventory[itemKey].qtyByCity.UnknownRuntimeLocation = 1;
  const result = controller.save(runtime);

  assert.deepEqual(result, {
    ok: false,
    status: 'invalid-runtime',
    state: null,
    errors: ['RUNTIME_LOCATION_MAPPING_FAILED']
  });
  assert.deepEqual(storageDouble.calls, []);
  assert.deepEqual(Array.from(storageDouble.entries.entries()), [['existing', 'keep']]);
});

test('browser new-schema runtime controller save should preserve codec validation failures without writing invalid data', { concurrency: false }, () => {
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const storageDouble = makeBrowserStorageDouble({ existing: 'keep' });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  runtime.assets.cash = NaN;
  const result = controller.save(runtime);

  assert.deepEqual(result, {
    ok: false,
    status: 'invalid',
    state: null,
    errors: ['INVALID_ASSETS']
  });
  assert.deepEqual(storageDouble.calls, []);
  assert.deepEqual(Array.from(storageDouble.entries.entries()), [['existing', 'keep']]);
});

test('browser new-schema runtime controller save should preserve storage write failures', { concurrency: false }, () => {
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      return null;
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
      throw new Error('write failed');
    }
  };
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const result = controller.save(runtime);

  assert.deepEqual(result, {
    ok: false,
    status: 'error',
    state: null,
    errors: ['STORAGE_WRITE_FAILED']
  });
  assert.deepEqual(storageDouble.calls.map(call => call.method), ['setItem']);
  assert.equal(storageDouble.calls[0].key, NEW_SCHEMA_STORAGE_KEY);
});

test('browser new-schema runtime controller save should return canonical state rather than runtime state', { concurrency: false }, () => {
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const storageDouble = makeBrowserStorageDouble();
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const result = controller.save(runtime);

  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.state, 'customLocations'), false);
  assert.equal(Object.values(result.state.inventory).some(item => Object.hasOwn(item, 'qtyByCity')), false);
  assert.equal(Object.values(result.state.inventory).some(item => Object.hasOwn(item, 'qtyByLocation')), true);
  assert.equal(Object.hasOwn(result.state.laborerInventory, '滿日記本'), false);
});

test('browser new-schema runtime controller save should not mutate runtime input', { concurrency: false }, () => {
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const before = JSON.stringify(runtime);
  const storageDouble = makeBrowserStorageDouble();
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.save(runtime);

  assert.equal(JSON.stringify(runtime), before);
});

test('browser new-schema runtime controller should preserve runtime edits through save and next start', { concurrency: false }, () => {
  const canonical = makeRuntimeBridgeNewSchemaState();
  const runtime = projectNewSchemaToRuntime(canonical).state;
  const itemKey = Object.keys(runtime.inventory)[0];
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  const firstStart = controller.start();
  runtime.assets.cash = 777;
  runtime.inventory[itemKey].qtyByCity.Thetford = 88;
  runtime.inventory[itemKey].globalAvgCost = 4321;
  runtime.laborerInventory['滿日記本']['6.1'] = 9;
  const saveResult = controller.save(runtime);
  const secondStart = controller.start();

  assert.equal(firstStart.ok, true);
  assert.equal(saveResult.ok, true);
  assert.equal(secondStart.ok, true);
  assert.equal(secondStart.state.assets.cash, 777);
  assert.equal(secondStart.state.inventory[itemKey].qtyByCity.Thetford, 88);
  assert.equal(secondStart.state.inventory[itemKey].globalAvgCost, 4321);
  assert.equal(secondStart.state.locationRegistry['custom:test-001'].locationId, 'custom:test-001');
  assert.equal(secondStart.state.laborerInventory['滿日記本']['6.1'], 9);
});

test('browser new-schema runtime controller should not read global localStorage', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    inventory: { legacy: { qtyByCity: { Thetford: 1 } } },
    assets: { cash: 1, debt: 0 },
    customLocations: ['Legacy Warehouse']
  });
  const before = storageSnapshot();
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const storageDouble = makeBrowserStorageDouble();
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.start();
  controller.save(runtime);

  assert.equal(storageSnapshot(), before);
});

test('browser new-schema runtime controller should remain isolated from app state backup UI and migration paths', { concurrency: false }, () => {
  const source = readFileSync('src/adapters/browserNewSchemaRuntimeController.js', 'utf8');

  assert.doesNotMatch(source, /\bglobalThis\b|\bwindow\b|\bdocument\b|\blocalStorage\b/);
  assert.doesNotMatch(source, /core\/state|state\.js|src\/app|component|backup|writer|migration|albion_crafting/i);
});

test('browser new-schema runtime controller should not scan delete or inspect storage collection APIs', { concurrency: false }, () => {
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: makeValidSerializedNewSchemaState()
  });
  Object.defineProperty(storageDouble, 'length', {
    get() {
      storageDouble.calls.push({ method: 'length' });
      throw new Error('unexpected length read');
    }
  });
  storageDouble.key = index => {
    storageDouble.calls.push({ method: 'key', index });
    throw new Error('unexpected scan');
  };
  storageDouble.removeItem = key => {
    storageDouble.calls.push({ method: 'removeItem', key });
    throw new Error('unexpected delete');
  };
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  assert.equal(controller.start().ok, true);
  assert.equal(controller.save(runtime).ok, true);
  assert.equal(storageDouble.calls.some(call => ['removeItem', 'key', 'length'].includes(call.method)), false);
});

test('browser new-schema runtime controller should not dual write', { concurrency: false }, () => {
  const runtime = projectNewSchemaToRuntime(makeRuntimeBridgeNewSchemaState()).state;
  const storageDouble = makeBrowserStorageDouble();
  const controller = createBrowserNewSchemaRuntimeController(storageDouble).controller;

  controller.save(runtime);

  const setCalls = storageDouble.calls.filter(call => call.method === 'setItem');
  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].key, NEW_SCHEMA_STORAGE_KEY);
  assert.deepEqual([...storageDouble.entries.keys()], [NEW_SCHEMA_STORAGE_KEY]);
});

test('TEST-B04: invalid backup data cannot overwrite existing localStorage', { concurrency: false }, async t => {
  const validInventory = { '布料_6.1': { qtyByCity: { Thetford: 500 }, globalAvgCost: 6000 } };
  const validAssets = { cash: 3000000, debt: 0 };
  const validTransactions = [{ id: 1, type: '原始交易' }];
  const invalidBackups = {
    'missing assets': {
      inventory: validInventory,
      transactions: validTransactions
    },
    'transactions is an object': {
      inventory: validInventory,
      assets: validAssets,
      transactions: {}
    },
    'inventory is an array': {
      inventory: [],
      assets: validAssets,
      transactions: validTransactions
    },
    'legacy transactions contains invalid JSON': {
      inventory: JSON.stringify(validInventory),
      assets: JSON.stringify(validAssets),
      transactions: '{invalid'
    }
  };

  for (const [name, backup] of Object.entries(invalidBackups)) {
    await t.test(name, () => {
      resetMocks();
      startProductionLegacyMode();
      seedStorage({
        inventory: validInventory,
        assets: validAssets,
        transactions: validTransactions,
        laborerInventory: { 布料: { '6.1': 10 } },
        laborerLogs: [{ type: '原始工人紀錄' }],
        customLocations: ['原始倉庫']
      });
      const before = storageSnapshot();

      importBackup(backup);

      assert.equal(storageSnapshot(), before);
      assert.equal(reloadCount, 0);
      assert.match(alerts.at(-1) || '', /匯入失敗/);
    });
  }
});

test('location adapter read-only: legacy direct location map normalizes without migration', { concurrency: false }, () => {
  const qtyByCity = {
    Thetford: 120,
    Martlock: 5
  };
  const before = JSON.stringify(qtyByCity);

  const normalized = normalizeLocationMap(qtyByCity);

  assert.equal(JSON.stringify(qtyByCity), before);
  assert.equal(normalized.sourceFormat, 'qtyByCity');
  assert.deepEqual(normalized.quantities, qtyByCity);
  assert.deepEqual(normalized.unresolvedLocations, []);
});

test('location adapter read-only: future qtyByLocation wrapper normalizes as future sample only', { concurrency: false }, () => {
  const input = {
    qtyByLocation: {
      thetford: 120,
      martlock: 5
    }
  };
  const before = JSON.stringify(input);

  const normalized = normalizeLocationMap(input);

  assert.equal(JSON.stringify(input), before);
  assert.equal(normalized.sourceFormat, 'qtyByLocation');
  assert.deepEqual(normalized.quantities, input.qtyByLocation);
  assert.deepEqual(normalized.unresolvedLocations, []);
});

test('location adapter read-only: invalid and non-finite quantities are reported unresolved without throwing', { concurrency: false }, () => {
  const input = {
    ValidLocation: 1,
    NaNLocation: NaN,
    InfiniteLocation: Infinity,
    StringNumberLocation: '5',
    NullLocation: null,
    ObjectLocation: { qty: 5 }
  };

  const normalized = normalizeLocationMap(input);

  assert.deepEqual(normalized.quantities, { ValidLocation: 1 });
  assert.deepEqual(normalized.unresolvedLocations, [
    'NaNLocation',
    'InfiniteLocation',
    'StringNumberLocation',
    'NullLocation',
    'ObjectLocation'
  ]);
});

test('location adapter read-only: zero and negative finite quantities are preserved', { concurrency: false }, () => {
  const input = {
    ZeroLocation: 0,
    NegativeLocation: -5
  };

  const normalized = normalizeLocationMap(input);

  assert.deepEqual(normalized.quantities, input);
  assert.deepEqual(normalized.unresolvedLocations, []);
});

test('location adapter read-only: multiple literal location keys are preserved without location id conversion', { concurrency: false }, () => {
  const input = {
    Thetford: 1,
    '公會T8地堡': 2,
    'Warehouse A / 測試': 3,
    'Bridgewatch Market #2': 4
  };

  const normalized = normalizeLocationMap(input);

  assert.deepEqual(Object.keys(normalized.quantities), Object.keys(input));
  assert.deepEqual(normalized.quantities, input);
  assert.equal(Object.hasOwn(normalized.quantities, 'locationId'), false);
  assert.deepEqual(normalized.unresolvedLocations, []);
});

test('location adapter read-only: input objects are not mutated and output quantities are copies', { concurrency: false }, () => {
  const directInput = {
    Thetford: 120,
    Martlock: 5
  };
  const wrappedInput = {
    qtyByLocation: {
      thetford: 120,
      martlock: 5
    }
  };
  const directBefore = JSON.stringify(directInput);
  const wrappedBefore = JSON.stringify(wrappedInput);

  const directNormalized = normalizeLocationMap(directInput);
  const wrappedNormalized = normalizeLocationMap(wrappedInput);

  assert.equal(JSON.stringify(directInput), directBefore);
  assert.equal(JSON.stringify(wrappedInput), wrappedBefore);
  assert.notEqual(directNormalized.quantities, directInput);
  assert.notEqual(wrappedNormalized.quantities, wrappedInput.qtyByLocation);
  assert.deepEqual(directNormalized.quantities, directInput);
  assert.deepEqual(wrappedNormalized.quantities, wrappedInput.qtyByLocation);
});

test('location adapter read-only: unresolvedLocations preserves invalid key insertion order', { concurrency: false }, () => {
  const input = {
    FirstInvalid: '1',
    ValidLocation: 1,
    SecondInvalid: Infinity,
    ThirdInvalid: null
  };

  const normalized = normalizeLocationMap(input);

  assert.deepEqual(normalized.quantities, { ValidLocation: 1 });
  assert.deepEqual(normalized.unresolvedLocations, ['FirstInvalid', 'SecondInvalid', 'ThirdInvalid']);
});

test('location adapter read-only: empty null and undefined input normalize to empty qtyByCity contract', { concurrency: false }, () => {
  for (const input of [{}, null, undefined]) {
    const normalized = normalizeLocationMap(input);

    assert.equal(normalized.sourceFormat, 'qtyByCity');
    assert.deepEqual(normalized.quantities, {});
    assert.deepEqual(normalized.unresolvedLocations, []);
  }
});

test('location adapter read-only: legacy qtyByCity wrapper normalizes without treating qtyByCity as a literal location key', { concurrency: false }, () => {
  const input = {
    qtyByCity: {
      Thetford: 120,
      CustomWarehouse: 5
    }
  };
  const before = JSON.stringify(input);

  const normalized = normalizeLocationMap(input);

  assert.equal(JSON.stringify(input), before);
  assert.equal(normalized.sourceFormat, 'qtyByCity');
  assert.deepEqual(normalized.quantities, {
    Thetford: 120,
    CustomWarehouse: 5
  });
  assert.deepEqual(normalized.unresolvedLocations, []);
  assert.equal(Object.hasOwn(normalized.quantities, 'qtyByCity'), false);
  assert.notEqual(normalized.quantities, input.qtyByCity);
});

test('location adapter read-only: legacy qtyByCity wrapper reports invalid values unresolved', { concurrency: false }, () => {
  const input = {
    qtyByCity: {
      Thetford: 120,
      InvalidWarehouse: '5',
      InfiniteWarehouse: Infinity
    }
  };
  const beforeKeys = Object.keys(input.qtyByCity);

  const normalized = normalizeLocationMap(input);

  assert.deepEqual(Object.keys(input.qtyByCity), beforeKeys);
  assert.equal(normalized.sourceFormat, 'qtyByCity');
  assert.deepEqual(normalized.quantities, { Thetford: 120 });
  assert.deepEqual(normalized.unresolvedLocations, ['InvalidWarehouse', 'InfiniteWarehouse']);
});

test('location adapter read-only: boundary does not touch storage writers or registry paths', { concurrency: false }, () => {
  const source = normalizeLocationMap.toString();
  const input = {
    qtyByCity: {
      Thetford: 120,
      CustomWarehouse: 5
    }
  };
  const before = JSON.stringify(input);

  normalizeLocationMap(input);

  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.hasOwn(input, 'qtyByCity'), true);
  assert.doesNotMatch(source, /localStorage|saveState|LocationRegistry|purchase|transport|submitPurchase|submitTransport/i);
});

test('state integration should enable ready new-schema runtime without replacing exported state identity', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  const itemKey = Object.keys(canonical.inventory)[0];
  const customLocation = canonical.locationRegistry['custom:test-001'].displayName;
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  const originalState = state;
  let updateCount = 0;
  const originalDispatch = document.dispatchEvent;
  document.dispatchEvent = event => {
    if (event.type === 'stateUpdated') updateCount++;
  };

  try {
    const result = enableNewSchemaRuntime(storageDouble);

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'ready');
    assert.equal(result.sourceStatus, 'loaded');
    assert.equal(state, originalState);
    assert.deepEqual(state.assets, result.state.assets);
    assert.equal(state.inventory[itemKey].qtyByCity.Thetford, canonical.inventory[itemKey].qtyByLocation.thetford);
    assert.equal(state.inventory[itemKey].qtyByCity[customLocation], 0);
    for (const location of CURRENT_RUNTIME_LOCATION_KEYS) {
      assert.equal(Object.hasOwn(state.inventory[itemKey].qtyByCity, location), true);
    }
    assert.deepEqual(Object.keys(state.inventory['皮革_6.2'].qtyByCity), [
      ...CURRENT_RUNTIME_LOCATION_KEYS,
      customLocation
    ]);
    assert.equal(state.inventory['皮革_6.2'].globalAvgCost, null);
    assert.equal(Object.hasOwn(state.inventory[itemKey], 'qtyByLocation'), false);
    assert.equal(state.laborerInventory['滿日記本']['6.1'], 3);
    assert.equal(state.laborerInventory['皮革']['6.2'], 11);
    assert.equal(Object.hasOwn(state.laborerInventory, '滿日誌'), false);
    assert.equal(Object.hasOwn(result.state.inventory, '皮革_6.2'), false);
    assert.equal(updateCount, 1);
    assert.deepEqual(storageDouble.calls, [
      { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
    ]);
  } finally {
    document.dispatchEvent = originalDispatch;
  }
});

test('replaceStateContents should replace enumerable root fields without mutating source or identity', { concurrency: false }, () => {
  const target = {
    oldField: true,
    assets: { cash: 1 },
    transactions: [{ id: 1 }]
  };
  const source = {
    assets: { cash: 2, debt: 0 },
    inventory: { item: { qtyByCity: { Thetford: 1 } } },
    transactions: []
  };
  const originalTarget = target;
  const sourceBefore = JSON.stringify(source);

  replaceStateContents(target, source);
  target.assets.cash = 3;
  target.inventory.item.qtyByCity.Thetford = 2;

  assert.equal(target, originalTarget);
  assert.equal(Object.hasOwn(target, 'oldField'), false);
  assert.equal(source.assets.cash, 2);
  assert.equal(source.inventory.item.qtyByCity.Thetford, 1);
  assert.equal(JSON.stringify(source), sourceBefore);
});

test('state integration should preserve initialize missing storage without binding controller or touching state storage or legacy load', { concurrency: false }, () => {
  resetMocks();
  replaceStateContents(state, {
    assets: { cash: 42, debt: 0 },
    customLocations: ['Legacy Warehouse'],
    inventory: { legacy: { qtyByCity: { Thetford: 1 }, globalAvgCost: null } },
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const beforeState = JSON.stringify(state);
  const storageDouble = makeBrowserStorageDouble();

  const result = enableNewSchemaRuntime(storageDouble);
  const saveResult = saveState();

  assert.deepEqual(result, {
    ok: true,
    mode: 'initialize',
    state: null,
    sourceStatus: 'missing',
    errors: []
  });
  assert.equal(JSON.stringify(state), beforeState);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
  assert.equal(storageDouble.entries.size, 0);
  assert.equal(saveResult.status, 'legacy-saved');
  assert.equal(localStorage.getItem(STORAGE_KEYS.inventory), JSON.stringify(state.inventory));
  assert.equal(storage.has(NEW_SCHEMA_STORAGE_KEY), false);
});

test('state integration should preserve blocked invalid storage without binding controller or touching legacy load path', { concurrency: false }, () => {
  resetMocks();
  const invalidState = makeValidNewSchemaState();
  invalidState.schemaVersion = 2;
  replaceStateContents(state, {
    assets: { cash: 99, debt: 0 },
    customLocations: [],
    inventory: {},
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const beforeState = JSON.stringify(state);
  const serialized = JSON.stringify(invalidState);
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });

  const result = enableNewSchemaRuntime(storageDouble);
  const saveResult = saveState();

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'invalid',
    errors: ['UNSUPPORTED_SCHEMA_VERSION']
  });
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(saveResult.status, 'legacy-saved');
  assert.equal(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY), serialized);
  assert.equal(localStorage.getItem(STORAGE_KEYS.assets), JSON.stringify(state.assets));
});

test('state integration should block invalid storage binding without state storage or legacy load fallback', { concurrency: false }, () => {
  resetMocks();
  replaceStateContents(state, {
    assets: { cash: 7, debt: 0 },
    customLocations: [],
    inventory: {},
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const beforeState = JSON.stringify(state);

  const result = enableNewSchemaRuntime(null);

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'error',
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(storageSnapshot(), '[]');
});

test('state integration saveState should write only the new-schema key when controller is ready', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  const itemKey = Object.keys(canonical.inventory)[0];
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized,
    ...Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]))
  });
  let updateCount = 0;
  const originalDispatch = document.dispatchEvent;
  document.dispatchEvent = event => {
    if (event.type === 'stateUpdated') updateCount++;
  };

  try {
    assert.equal(enableNewSchemaRuntime(storageDouble).mode, 'ready');
    assert.deepEqual(storageDouble.calls, [
      { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
    ]);
    state.assets.cash = 777;
    state.inventory[itemKey].qtyByCity.Thetford = 88;
    state.laborerInventory['滿日記本']['6.1'] = 9;
    state.laborerInventory['皮革']['6.2'] = 12;
    state.laborerLogs = Array.from({ length: 105 }, (_, index) => ({ index }));

    const result = saveState();
    const stored = decodeNewSchemaState(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY));

    assert.equal(result.ok, true);
    assert.equal(result.status, 'saved');
    assert.equal(stored.ok, true);
    assert.equal(state.laborerLogs.length, 100);
    assert.equal(stored.state.assets.cash, 777);
    assert.equal(stored.state.inventory[itemKey].qtyByLocation.thetford, 88);
    assert.equal(stored.state.laborerInventory['滿日誌']['6.1'], 9);
    assert.equal(stored.state.laborerInventory['皮革']['6.2'], 12);
    assert.deepEqual(Object.keys(stored.state.laborerInventory), CLEAN_INITIALIZATION_LABORER_CATEGORIES);
    assert.equal(stored.state.laborerLogs.length, 100);
    assert.equal(updateCount, 2);
    assert.deepEqual(storageDouble.calls.map(call => call.method), ['getItem', 'setItem']);
    assert.deepEqual(storageDouble.calls.filter(call => call.method === 'setItem').map(call => call.key), [
      NEW_SCHEMA_STORAGE_KEY
    ]);
    for (const key of LEGACY_STORAGE_KEYS) {
      assert.equal(storageDouble.entries.get(key), `legacy:${key}`);
      assert.equal(storage.has(key), false);
    }
  } finally {
    document.dispatchEvent = originalDispatch;
  }
});

test('custom location writer add creates stable custom id, runtime location, and canonical qtyByLocation', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  canonical.inventory['布料_6.1'].qtyByLocation.thetford = 7;
  const storageDouble = startReadyRuntimeWithCanonical(canonical, Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`])));

  const result = addCustomLocation('  East Hideout  ', {
    generateCustomLocationId: customIdGenerator('custom:east-001')
  });
  const stored = decodeStoredRuntime(storageDouble);

  assert.deepEqual(result, {
    ok: true,
    status: 'location-added',
    locationId: 'custom:east-001',
    errors: []
  });
  assert.deepEqual(state.locationRegistry['custom:east-001'], {
    locationId: 'custom:east-001',
    displayName: 'East Hideout',
    type: 'custom',
    active: true
  });
  assert.equal(state.customLocations.includes('East Hideout'), true);
  assert.equal(state.inventory['布料_6.1'].qtyByCity['East Hideout'], 0);
  assert.equal(stored.locationRegistry['custom:east-001'].displayName, 'East Hideout');
  assert.equal(stored.inventory['布料_6.1'].qtyByLocation['custom:east-001'], 0);
  assert.equal(Object.hasOwn(stored.inventory['布料_6.1'].qtyByLocation, 'East Hideout'), false);
  assert.deepEqual(storageDouble.calls.filter(call => call.method === 'setItem').map(call => call.key), [NEW_SCHEMA_STORAGE_KEY]);
  for (const key of LEGACY_STORAGE_KEYS) assert.equal(storageDouble.entries.get(key), `legacy:${key}`);
});

test('custom location writer add survives restart with the same stable locationId', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = startReadyRuntimeWithCanonical();

  assert.equal(addCustomLocation('Restart Warehouse', {
    generateCustomLocationId: customIdGenerator('custom:restart-001')
  }).ok, true);
  const storedAfterAdd = storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY);

  const restartStorage = makeBrowserStorageDouble({ [NEW_SCHEMA_STORAGE_KEY]: storedAfterAdd });
  const restarted = enableNewSchemaRuntime(restartStorage);

  assert.equal(restarted.ok, true);
  assert.equal(state.locationRegistry['custom:restart-001'].displayName, 'Restart Warehouse');
  assert.equal(state.customLocations.includes('Restart Warehouse'), true);
  assert.deepEqual(restartStorage.calls, [{ method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }]);
});

test('custom location writer rejects duplicate active names and system location conflicts without mutation', { concurrency: false }, () => {
  resetMocks();
  startReadyRuntimeWithCanonical();
  assert.equal(addCustomLocation('Alpha Warehouse', {
    generateCustomLocationId: customIdGenerator('custom:alpha-001')
  }).ok, true);
  const before = JSON.stringify(state);

  const duplicate = addCustomLocation(' alpha warehouse ', {
    generateCustomLocationId: customIdGenerator('custom:alpha-002')
  });
  const systemConflict = addCustomLocation(' LaborerIsland ', {
    generateCustomLocationId: customIdGenerator('custom:laborer-001')
  });

  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.status, 'invalid-location');
  assert.deepEqual(duplicate.errors, ['DUPLICATE_CUSTOM_LOCATION_NAME']);
  assert.equal(systemConflict.ok, false);
  assert.deepEqual(systemConflict.errors, ['SYSTEM_LOCATION_NAME_CONFLICT']);
  assert.equal(JSON.stringify(state), before);
});

test('custom location writer rejects invalid id generator without state or storage mutation', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = startReadyRuntimeWithCanonical();
  const beforeState = JSON.stringify(state);
  const beforeStorage = JSON.stringify([...storageDouble.entries.entries()]);

  const invalid = addCustomLocation('Bad Generator', { generateCustomLocationId: () => 'bad-id' });
  const throwing = addCustomLocation('Throwing Generator', { generateCustomLocationId: () => { throw new Error('bad'); } });

  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.errors, ['CUSTOM_LOCATION_ID_GENERATION_FAILED']);
  assert.equal(throwing.ok, false);
  assert.deepEqual(throwing.errors, ['CUSTOM_LOCATION_ID_GENERATION_FAILED']);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify([...storageDouble.entries.entries()]), beforeStorage);
});

test('custom location writer add rolls back all runtime changes on save failure', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  const storageDouble = makeFailingWriteBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  assert.equal(enableNewSchemaRuntime(storageDouble).mode, 'ready');
  const beforeState = JSON.stringify(state);
  const beforeStorage = JSON.stringify([...storageDouble.entries.entries()]);

  const result = addCustomLocation('Rollback Add', {
    generateCustomLocationId: customIdGenerator('custom:rollback-add')
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'save-failed');
  assert.equal(result.locationId, 'custom:rollback-add');
  assert.deepEqual(result.errors, ['STORAGE_WRITE_FAILED']);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify([...storageDouble.entries.entries()]), beforeStorage);
  assert.equal(storageDouble.calls.filter(call => call.method === 'setItem').length, 1);
});

test('custom location writer rename preserves id, order, zero quantity, transactions, and canonical id', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  canonical.locationRegistry['custom:second-001'] = {
    locationId: 'custom:second-001',
    displayName: 'Second Warehouse',
    type: 'custom',
    active: true
  };
  canonical.inventory['布料_6.1'].qtyByLocation['custom:test-001'] = 0;
  canonical.inventory['布料_6.1'].qtyByLocation['custom:second-001'] = 4;
  canonical.transactions = [
    { date: '2026-06-26', type: '買材料', item: '布料', quality: '6.1', qty: 1, total: 1, unitPrice: 1, location: '公會倉庫' }
  ];
  const storageDouble = startReadyRuntimeWithCanonical(canonical);

  const result = renameCustomLocation('公會倉庫', ' Renamed Warehouse ');
  const stored = decodeStoredRuntime(storageDouble);

  assert.deepEqual(result, {
    ok: true,
    status: 'location-renamed',
    locationId: 'custom:test-001',
    errors: []
  });
  assert.equal(state.locationRegistry['custom:test-001'].displayName, 'Renamed Warehouse');
  assert.deepEqual(state.customLocations, ['Renamed Warehouse', 'Second Warehouse']);
  assert.equal(state.inventory['布料_6.1'].qtyByCity['Renamed Warehouse'], 0);
  assert.equal(Object.hasOwn(state.inventory['布料_6.1'].qtyByCity, '公會倉庫'), false);
  assert.equal(state.transactions[0].location, 'Renamed Warehouse');
  assert.equal(stored.locationRegistry['custom:test-001'].displayName, 'Renamed Warehouse');
  assert.equal(stored.inventory['布料_6.1'].qtyByLocation['custom:test-001'], 0);
  assert.equal(stored.transactions[0].location, 'Renamed Warehouse');
});

test('custom location writer rename no-op keeps state and storage without another save', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = startReadyRuntimeWithCanonical();
  const beforeState = JSON.stringify(state);
  const beforeCalls = storageDouble.calls.length;

  const result = renameCustomLocation('公會倉庫', ' 公會倉庫 ');

  assert.equal(result.ok, true);
  assert.equal(result.status, 'location-renamed');
  assert.equal(result.locationId, 'custom:test-001');
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(storageDouble.calls.length, beforeCalls);
});

test('custom location writer rename rejects duplicate and system conflicts without mutation', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  canonical.locationRegistry['custom:second-001'] = {
    locationId: 'custom:second-001',
    displayName: 'Second Warehouse',
    type: 'custom',
    active: true
  };
  const storageDouble = startReadyRuntimeWithCanonical(canonical);
  const beforeState = JSON.stringify(state);
  const beforeStorage = JSON.stringify([...storageDouble.entries.entries()]);

  const duplicate = renameCustomLocation('公會倉庫', ' second warehouse ');
  const conflict = renameCustomLocation('公會倉庫', 'Caerleon');

  assert.equal(duplicate.ok, false);
  assert.deepEqual(duplicate.errors, ['DUPLICATE_CUSTOM_LOCATION_NAME']);
  assert.equal(conflict.ok, false);
  assert.deepEqual(conflict.errors, ['SYSTEM_LOCATION_NAME_CONFLICT']);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify([...storageDouble.entries.entries()]), beforeStorage);
});

test('custom location writer rename rolls back registry inventory and transactions on save failure', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  const storageDouble = makeFailingWriteBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  assert.equal(enableNewSchemaRuntime(storageDouble).mode, 'ready');
  state.transactions.push({ location: '公會倉庫', type: '買材料' });
  const beforeState = JSON.stringify(state);
  const beforeStorage = JSON.stringify([...storageDouble.entries.entries()]);

  const result = renameCustomLocation('公會倉庫', 'Rollback Rename');

  assert.equal(result.ok, false);
  assert.equal(result.status, 'save-failed');
  assert.equal(result.locationId, 'custom:test-001');
  assert.deepEqual(result.errors, ['STORAGE_WRITE_FAILED']);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify([...storageDouble.entries.entries()]), beforeStorage);
});

test('custom location writer remove rejects finite positive inventory before mutation', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  canonical.inventory['布料_6.1'].qtyByLocation['custom:test-001'] = 5;
  const storageDouble = startReadyRuntimeWithCanonical(canonical);
  const beforeState = JSON.stringify(state);

  const result = removeCustomLocation('公會倉庫');

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-location');
  assert.equal(result.locationId, 'custom:test-001');
  assert.deepEqual(result.errors, ['CUSTOM_LOCATION_HAS_INVENTORY']);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(storageDouble.calls.filter(call => call.method === 'setItem').length, 0);
});

test('custom location writer remove deactivates registry entry, removes runtime quantities, and preserves transaction history', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  clearCanonicalCustomLocationQuantities(canonical);
  canonical.transactions = [{ type: '買材料', location: '公會倉庫' }];
  const storageDouble = startReadyRuntimeWithCanonical(canonical);

  const result = removeCustomLocation('公會倉庫');
  const stored = decodeStoredRuntime(storageDouble);

  assert.deepEqual(result, {
    ok: true,
    status: 'location-removed',
    locationId: 'custom:test-001',
    errors: []
  });
  assert.equal(state.locationRegistry['custom:test-001'].active, false);
  assert.equal(Object.hasOwn(state.locationRegistry, 'custom:test-001'), true);
  assert.deepEqual(state.customLocations, []);
  assert.equal(Object.hasOwn(state.inventory['布料_6.1'].qtyByCity, '公會倉庫'), false);
  assert.deepEqual(state.transactions, [{ type: '買材料', location: '公會倉庫' }]);
  assert.equal(stored.locationRegistry['custom:test-001'].active, false);
  assert.equal(Object.hasOwn(stored.inventory['布料_6.1'].qtyByLocation, 'custom:test-001'), false);
  assert.deepEqual(stored.transactions, [{ type: '買材料', location: '公會倉庫' }]);
});

test('custom location writer remove rolls back on save failure', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  clearCanonicalCustomLocationQuantities(canonical);
  const storageDouble = makeFailingWriteBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  assert.equal(enableNewSchemaRuntime(storageDouble).mode, 'ready');
  const beforeState = JSON.stringify(state);
  const beforeStorage = JSON.stringify([...storageDouble.entries.entries()]);

  const result = removeCustomLocation('公會倉庫');

  assert.equal(result.ok, false);
  assert.equal(result.status, 'save-failed');
  assert.deepEqual(result.errors, ['STORAGE_WRITE_FAILED']);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify([...storageDouble.entries.entries()]), beforeStorage);
});

test('custom location writer re-adding a removed display name uses a new id and does not reactivate inactive entries', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  clearCanonicalCustomLocationQuantities(canonical);
  const storageDouble = startReadyRuntimeWithCanonical(canonical);

  assert.equal(removeCustomLocation('公會倉庫').ok, true);
  const added = addCustomLocation('公會倉庫', {
    generateCustomLocationId: customIdGenerator('custom:test-002')
  });
  const stored = decodeStoredRuntime(storageDouble);

  assert.equal(added.ok, true);
  assert.equal(added.locationId, 'custom:test-002');
  assert.equal(state.locationRegistry['custom:test-001'].active, false);
  assert.equal(state.locationRegistry['custom:test-002'].active, true);
  assert.equal(stored.locationRegistry['custom:test-001'].active, false);
  assert.equal(stored.locationRegistry['custom:test-002'].displayName, '公會倉庫');
});

test('custom location writer re-add keeps inactive display name and exposes only the new active target after restart', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  clearCanonicalCustomLocationQuantities(canonical);
  const storageDouble = startReadyRuntimeWithCanonical(canonical);
  const originalDisplayName = state.locationRegistry['custom:test-001'].displayName;
  const customItemKey = Object.entries(state.inventory).find(([, item]) =>
    Object.hasOwn(item.qtyByCity, originalDisplayName)
  )[0];
  const beforeTransactions = JSON.stringify(state.transactions);
  const beforeThetfordQuantity = state.inventory[customItemKey].qtyByCity.Thetford;

  assert.equal(removeCustomLocation(originalDisplayName).ok, true);
  assert.equal(addCustomLocation(originalDisplayName, {
    generateCustomLocationId: customIdGenerator('custom:test-002')
  }).ok, true);
  state.inventory[customItemKey].qtyByCity[originalDisplayName] = 13;
  assert.equal(saveState().ok, true);

  const storedBeforeRestart = decodeStoredRuntime(storageDouble);
  const restartStorage = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY)
  });

  assert.equal(enableNewSchemaRuntime(restartStorage).mode, 'ready');

  assert.equal(storedBeforeRestart.locationRegistry['custom:test-001'].active, false);
  assert.equal(storedBeforeRestart.locationRegistry['custom:test-001'].displayName, originalDisplayName);
  assert.equal(storedBeforeRestart.locationRegistry['custom:test-002'].active, true);
  assert.equal(storedBeforeRestart.locationRegistry['custom:test-002'].displayName, originalDisplayName);
  assert.notEqual(storedBeforeRestart.locationRegistry['custom:test-001'].locationId, storedBeforeRestart.locationRegistry['custom:test-002'].locationId);
  assert.equal(Object.hasOwn(storedBeforeRestart.inventory[customItemKey].qtyByLocation, 'custom:test-001'), false);
  assert.equal(storedBeforeRestart.inventory[customItemKey].qtyByLocation['custom:test-002'], 13);
  assert.equal(state.locationRegistry['custom:test-001'].displayName, originalDisplayName);
  assert.equal(state.locationRegistry['custom:test-001'].active, false);
  assert.equal(state.locationRegistry['custom:test-002'].displayName, originalDisplayName);
  assert.equal(state.locationRegistry['custom:test-002'].active, true);
  assert.deepEqual(state.customLocations, [originalDisplayName]);
  assert.equal(state.inventory[customItemKey].qtyByCity[originalDisplayName], 13);
  assert.equal(state.inventory[customItemKey].qtyByCity.Thetford, beforeThetfordQuantity);
  assert.equal(JSON.stringify(state.transactions), beforeTransactions);
  assert.deepEqual(restartStorage.calls, [{ method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }]);
});

test('custom location writer rollback keeps inactive same-name entry unchanged on save failure', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  clearCanonicalCustomLocationQuantities(canonical);
  canonical.locationRegistry['custom:test-001'].active = false;
  for (const item of Object.values(canonical.inventory)) {
    if (item.qtyByLocation) delete item.qtyByLocation['custom:test-001'];
  }
  const originalDisplayName = canonical.locationRegistry['custom:test-001'].displayName;
  const storageDouble = makeFailingWriteBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  assert.equal(enableNewSchemaRuntime(storageDouble).mode, 'ready');
  const beforeState = JSON.stringify(state);
  const beforeStorage = JSON.stringify([...storageDouble.entries.entries()]);

  const result = addCustomLocation(originalDisplayName, {
    generateCustomLocationId: customIdGenerator('custom:test-002')
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'save-failed');
  assert.equal(result.locationId, 'custom:test-002');
  assert.deepEqual(result.errors, ['STORAGE_WRITE_FAILED']);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify([...storageDouble.entries.entries()]), beforeStorage);
  assert.equal(state.locationRegistry['custom:test-001'].displayName, originalDisplayName);
  assert.equal(Object.hasOwn(state.locationRegistry, 'custom:test-002'), false);
  assert.deepEqual(state.customLocations, []);
});

test('custom location writer add purchase transport save and restart round trips stable id and quantities', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = startReadyRuntimeWithCanonical();
  assert.equal(addCustomLocation('Flow Warehouse', {
    generateCustomLocationId: customIdGenerator('custom:flow-001')
  }).ok, true);
  state.inventory['布料_6.1'].qtyByCity.Thetford = 3;
  state.inventory['布料_6.1'].qtyByCity['Flow Warehouse'] = 11;
  assert.equal(saveState().ok, true);

  const restartStorage = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY)
  });
  assert.equal(enableNewSchemaRuntime(restartStorage).mode, 'ready');

  assert.equal(state.locationRegistry['custom:flow-001'].displayName, 'Flow Warehouse');
  assert.equal(state.inventory['布料_6.1'].qtyByCity['Flow Warehouse'], 11);
  assert.equal(decodeStoredRuntime(restartStorage).inventory['布料_6.1'].qtyByLocation['custom:flow-001'], 11);
});

test('custom location writer rename save and restart preserves quantity and id', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  canonical.inventory['布料_6.1'].qtyByLocation['custom:test-001'] = 9;
  const storageDouble = startReadyRuntimeWithCanonical(canonical);

  assert.equal(renameCustomLocation('公會倉庫', 'Restart Rename').ok, true);
  const restartStorage = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY)
  });
  assert.equal(enableNewSchemaRuntime(restartStorage).mode, 'ready');

  assert.equal(state.locationRegistry['custom:test-001'].displayName, 'Restart Rename');
  assert.equal(state.inventory['布料_6.1'].qtyByCity['Restart Rename'], 9);
});

test('custom location writer remove save and restart hides inactive location from runtime customLocations', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  clearCanonicalCustomLocationQuantities(canonical);
  const storageDouble = startReadyRuntimeWithCanonical(canonical);

  assert.equal(removeCustomLocation('公會倉庫').ok, true);
  const restartStorage = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY)
  });
  assert.equal(enableNewSchemaRuntime(restartStorage).mode, 'ready');

  assert.equal(state.locationRegistry['custom:test-001'].active, false);
  assert.equal(state.customLocations.includes('公會倉庫'), false);
  assert.equal(Object.hasOwn(state.inventory['布料_6.1'].qtyByCity, '公會倉庫'), false);
});

test('custom location writer preserves exported state identity and transaction payload shape', { concurrency: false }, () => {
  resetMocks();
  startReadyRuntimeWithCanonical();
  const originalState = state;
  state.transactions.push({ date: '2026-06-26', type: '買材料', item: '布料', quality: '6.1', qty: 1, total: 10, unitPrice: 10, location: '公會倉庫' });

  assert.equal(renameCustomLocation('公會倉庫', 'Payload Rename').ok, true);
  const changedTransaction = state.transactions.find(transaction => transaction.item === '布料' && transaction.location === 'Payload Rename');

  assert.equal(state, originalState);
  assert.deepEqual(Object.keys(changedTransaction), ['date', 'type', 'item', 'quality', 'qty', 'total', 'unitPrice', 'location']);
  assert.equal(changedTransaction.location, 'Payload Rename');
});

test('custom location writer APIs reject legacy mode without incidental registry creation', { concurrency: false }, () => {
  resetMocks();
  replaceStateContents(state, {
    assets: { cash: 1, debt: 0 },
    customLocations: ['Legacy Warehouse'],
    inventory: { '布料_6.1': { qtyByCity: { 'Legacy Warehouse': 0 }, globalAvgCost: 100 } },
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const before = JSON.stringify(state);

  const addResult = addCustomLocation('New Legacy Warehouse', {
    generateCustomLocationId: customIdGenerator('custom:legacy-001')
  });
  const renameResult = renameCustomLocation('Legacy Warehouse', 'Renamed Legacy Warehouse');
  const removeResult = removeCustomLocation('Legacy Warehouse');

  for (const result of [addResult, renameResult, removeResult]) {
    assert.equal(result.ok, false);
    assert.equal(result.status, 'invalid-location');
    assert.deepEqual(result.errors, ['LOCATION_REGISTRY_UNAVAILABLE']);
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(Object.hasOwn(state, 'locationRegistry'), false);
});

test('custom location writer source stays isolated from backup reset migration and storage key logic', { concurrency: false }, () => {
  const source = readFileSync('src/core/state.js', 'utf8');

  assert.match(source, /export function addCustomLocation/);
  assert.match(source, /export function renameCustomLocation/);
  assert.match(source, /export function removeCustomLocation/);
  assert.doesNotMatch(source, /removeItem|clear\(|migration|backup|albion-logistics-v2-state/);
});

test('state integration saveState should return controller failures without UI update or storage mutation', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(canonical).serialized
  });
  let updateCount = 0;
  const originalDispatch = document.dispatchEvent;
  document.dispatchEvent = event => {
    if (event.type === 'stateUpdated') updateCount++;
  };

  try {
    assert.equal(enableNewSchemaRuntime(storageDouble).mode, 'ready');
    updateCount = 0;
    const beforeEntries = JSON.stringify([...storageDouble.entries.entries()]);
    const itemKey = Object.keys(state.inventory)[0];
    state.inventory[itemKey].qtyByCity.UnknownRuntimeLocation = 1;

    const result = saveState();

    assert.deepEqual(result, {
      ok: false,
      status: 'invalid-runtime',
      state: null,
      errors: ['RUNTIME_LOCATION_MAPPING_FAILED']
    });
    assert.equal(updateCount, 0);
    assert.equal(JSON.stringify([...storageDouble.entries.entries()]), beforeEntries);
  } finally {
    document.dispatchEvent = originalDispatch;
  }
});

test('state integration should clear a ready controller after later initialize enable', { concurrency: false }, () => {
  resetMocks();
  const readyStorage = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(makeRuntimeBridgeNewSchemaState()).serialized
  });
  const missingStorage = makeBrowserStorageDouble();

  assert.equal(enableNewSchemaRuntime(readyStorage).mode, 'ready');
  assert.equal(enableNewSchemaRuntime(missingStorage).mode, 'initialize');

  const saveResult = saveState();

  assert.equal(saveResult.status, 'legacy-saved');
  assert.equal(missingStorage.entries.size, 0);
  assert.equal(localStorage.getItem(STORAGE_KEYS.assets), JSON.stringify(state.assets));
});

test('state integration should keep loadState legacy-only and avoid app component imports', { concurrency: false }, () => {
  resetMocks();
  const canonical = makeRuntimeBridgeNewSchemaState();
  replaceStateContents(state, {
    assets: { cash: 0, debt: 0 },
    customLocations: [],
    inventory: {},
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  localStorage.setItem(NEW_SCHEMA_STORAGE_KEY, encodeNewSchemaState(canonical).serialized);
  seedStorage({
    inventory: { legacy: { qtyByCity: { Thetford: 1 }, globalAvgCost: null } },
    assets: { cash: 321, debt: 0 },
    transactions: [],
    laborerInventory: {},
    laborerLogs: [],
    customLocations: []
  });

  loadState();

  const source = readFileSync('src/core/state.js', 'utf8');
  assert.equal(state.assets.cash, 321);
  assert.equal(Object.hasOwn(state.inventory, 'legacy'), true);
  assert.equal(Object.hasOwn(state, 'locationRegistry'), false);
  assert.doesNotMatch(source, /from ['"].*app\.js|from ['"].*components\//);
  assert.doesNotMatch(enableNewSchemaRuntime.toString(), /\bloadState\b|\blocalStorage\b/);
});

test('initializeNewSchemaRuntime should create a clean default runtime and write the new-schema key once', { concurrency: false }, () => {
  resetMocks();
  const originalState = state;
  const storageDouble = makeBrowserStorageDouble({
    ...Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]))
  });
  let updateCount = 0;
  const originalDispatch = document.dispatchEvent;
  document.dispatchEvent = event => {
    if (event.type === 'stateUpdated') updateCount++;
  };

  try {
    const result = initializeNewSchemaRuntime(storageDouble);
    const decoded = decodeNewSchemaState(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY));

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'ready');
    assert.equal(state, originalState);
    assert.equal(state.assets.cash, 0);
    assert.equal(state.assets.debt, 0);
    assert.deepEqual(state.transactions, []);
    assert.equal(state.laborerInventory['皮革']['6.1'], 0);
    assert.equal(state.laborerInventory['滿日記本']['6.1'], 0);
    assert.equal(Object.hasOwn(state.laborerInventory, '滿日誌'), false);
    assert.equal(decoded.ok, true);
    assert.deepEqual(Object.keys(decoded.state.laborerInventory), CLEAN_INITIALIZATION_LABORER_CATEGORIES);
    assert.equal(updateCount, 1);
    assert.deepEqual(storageDouble.calls.map(call => call.method), ['setItem', 'getItem']);
    assert.deepEqual(storageDouble.calls.filter(call => call.method === 'setItem').map(call => call.key), [
      NEW_SCHEMA_STORAGE_KEY
    ]);
    for (const key of LEGACY_STORAGE_KEYS) {
      assert.equal(storageDouble.entries.get(key), `legacy:${key}`);
      assert.equal(storage.has(key), false);
    }
  } finally {
    document.dispatchEvent = originalDispatch;
  }
});

test('initializeNewSchemaRuntime should block initializer failures without writing storage or changing state', { concurrency: false }, () => {
  resetMocks();
  replaceStateContents(state, {
    assets: { cash: 55, debt: 0 },
    customLocations: [],
    inventory: {},
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const beforeState = JSON.stringify(state);
  const storageDouble = makeBrowserStorageDouble();

  const result = initializeNewSchemaRuntime(storageDouble, { cash: 'bad' });

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'initialization-error',
    errors: ['INVALID_CASH']
  });
  assert.equal(JSON.stringify(state), beforeState);
  assert.deepEqual(storageDouble.calls, []);
  assert.equal(storageDouble.entries.size, 0);
});

test('initializeNewSchemaRuntime should block initial save failures without enabling controller', { concurrency: false }, () => {
  resetMocks();
  replaceStateContents(state, {
    assets: { cash: 66, debt: 0 },
    customLocations: [],
    inventory: {},
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const beforeState = JSON.stringify(state);
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      return null;
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
      throw new Error('write failed');
    }
  };

  const result = initializeNewSchemaRuntime(storageDouble);
  const fallbackSave = saveState();

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'initial-save-error',
    errors: ['STORAGE_WRITE_FAILED']
  });
  assert.equal(JSON.stringify(state), beforeState);
  assert.deepEqual(storageDouble.calls.map(call => call.method), ['setItem']);
  assert.equal(fallbackSave.status, 'legacy-saved');
});

test('initializeNewSchemaRuntime should persist explicit clean input without reading legacy storage', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    assets: { cash: 9999, debt: 0 },
    inventory: { legacy: { qtyByCity: { Thetford: 7 }, globalAvgCost: 1 } },
    transactions: [{ type: 'legacy' }],
    laborerInventory: {},
    laborerLogs: [],
    customLocations: ['Legacy Warehouse']
  });
  const legacyBefore = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble();
  const input = {
    cash: 500,
    debt: 25,
    customLocations: [{ clientRef: 'warehouse', displayName: 'New Warehouse' }],
    inventorySeeds: [{
      itemKey: '布料_6.1',
      customLocationRef: 'warehouse',
      quantity: 4,
      globalAvgCost: 100
    }]
  };

  const result = initializeNewSchemaRuntime(storageDouble, input, {
    generateCustomLocationId: makeCustomLocationIdGenerator()
  });
  const decoded = decodeNewSchemaState(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY));

  assert.equal(result.ok, true);
  assert.equal(decoded.state.assets.cash, 500);
  assert.equal(decoded.state.assets.debt, 25);
  assert.equal(decoded.state.inventory['布料_6.1'].qtyByLocation['custom:test-001'], 4);
  assert.equal(decoded.state.inventory['布料_6.1'].globalAvgCost, 100);
  assert.equal(storageSnapshot(), legacyBefore);
});

test('initializeNewSchemaRuntime should block invalid browser storage without state mutation', { concurrency: false }, () => {
  resetMocks();
  replaceStateContents(state, {
    assets: { cash: 77, debt: 0 },
    customLocations: [],
    inventory: {},
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const beforeState = JSON.stringify(state);

  const result = initializeNewSchemaRuntime(null);

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'error',
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
  assert.equal(JSON.stringify(state), beforeState);
});

test('initializeNewSchemaRuntime should keep controller active for later new-schema saves', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = makeBrowserStorageDouble({
    ...Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]))
  });

  const initialized = initializeNewSchemaRuntime(storageDouble);
  state.assets.cash = 123;
  const saved = saveState();
  const decoded = decodeNewSchemaState(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY));

  assert.equal(initialized.ok, true);
  assert.equal(saved.ok, true);
  assert.equal(saved.status, 'saved');
  assert.equal(decoded.state.assets.cash, 123);
  assert.deepEqual(storageDouble.calls.map(call => call.method), ['setItem', 'getItem', 'setItem']);
  assert.deepEqual(storageDouble.calls.filter(call => call.method === 'setItem').map(call => call.key), [
    NEW_SCHEMA_STORAGE_KEY,
    NEW_SCHEMA_STORAGE_KEY
  ]);
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(storageDouble.entries.get(key), `legacy:${key}`);
  }
});

test('startApplicationState should use existing valid new-schema data without confirmation or legacy load', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    assets: { cash: 999, debt: 0 },
    inventory: {},
    transactions: [],
    laborerInventory: {},
    laborerLogs: [],
    customLocations: []
  });
  const beforeLegacyStorage = storageSnapshot();
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: encodeNewSchemaState(makeRuntimeBridgeNewSchemaState()).serialized
  });
  let confirmCount = 0;
  let blockedErrors = null;

  const result = startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => {
      confirmCount++;
      return true;
    },
    showBlockedError: errors => {
      blockedErrors = errors;
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'ready');
  assert.equal(confirmCount, 0);
  assert.equal(blockedErrors, null);
  assert.equal(storageSnapshot(), beforeLegacyStorage);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('startApplicationState should initialize missing new-schema storage after one confirmation', { concurrency: false }, () => {
  resetMocks();
  const legacyEntries = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]));
  const storageDouble = makeBrowserStorageDouble(legacyEntries);
  let confirmCount = 0;

  const result = startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => {
      confirmCount++;
      return true;
    },
    showBlockedError: errors => assert.fail(`unexpected blocked startup: ${errors.join(',')}`)
  });
  const decoded = decodeNewSchemaState(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY));

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'ready');
  assert.equal(confirmCount, 1);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.state.assets.cash, 0);
  assert.equal(decoded.state.assets.debt, 0);
  assert.deepEqual(decoded.state.transactions, []);
  assert.deepEqual(Object.keys(decoded.state.laborerInventory), CLEAN_INITIALIZATION_LABORER_CATEGORIES);
  assert.deepEqual(storageDouble.calls.map(call => call.method), ['getItem', 'setItem', 'getItem']);
  assert.deepEqual(storageDouble.calls.filter(call => call.method === 'setItem').map(call => call.key), [
    NEW_SCHEMA_STORAGE_KEY
  ]);
  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(storageDouble.entries.get(key), legacyEntries[key]);
  }
});

test('startApplicationState should use legacy mode on missing storage when confirmation is cancelled', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    assets: { cash: 1234, debt: 0 },
    inventory: { legacy: { qtyByCity: { Thetford: 2 }, globalAvgCost: 10 } },
    transactions: [{ type: 'legacy' }],
    laborerInventory: {},
    laborerLogs: [],
    customLocations: []
  });
  const storageDouble = makeBrowserStorageDouble();
  let confirmCount = 0;

  const result = startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => {
      confirmCount++;
      return false;
    },
    showBlockedError: errors => assert.fail(`unexpected blocked startup: ${errors.join(',')}`)
  });

  assert.deepEqual(result, {
    ok: true,
    mode: 'legacy',
    state: null,
    sourceStatus: 'user-cancelled',
    errors: []
  });
  assert.equal(confirmCount, 1);
  assert.equal(state.assets.cash, 1234);
  assert.equal(state.transactions.length, 1);
  assert.equal(storageDouble.entries.has(NEW_SCHEMA_STORAGE_KEY), false);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('startApplicationState should block invalid new-schema data without legacy fallback or empty initialization', { concurrency: false }, () => {
  resetMocks();
  seedStorage({
    assets: { cash: 4321, debt: 0 },
    inventory: { legacy: { qtyByCity: { Thetford: 3 }, globalAvgCost: 20 } },
    transactions: [{ type: 'legacy' }],
    laborerInventory: {},
    laborerLogs: [],
    customLocations: []
  });
  replaceStateContents(state, {
    assets: { cash: 0, debt: 0 },
    customLocations: [],
    inventory: {},
    laborerInventory: {},
    laborerLogs: [],
    transactions: []
  });
  const invalidState = makeValidNewSchemaState();
  invalidState.schemaVersion = 2;
  const serialized = JSON.stringify(invalidState);
  const storageDouble = makeBrowserStorageDouble({
    [NEW_SCHEMA_STORAGE_KEY]: serialized
  });
  let blockedErrors = null;

  const result = startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => assert.fail('blocked startup should not confirm initialization'),
    showBlockedError: errors => {
      blockedErrors = errors;
    }
  });

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'invalid',
    errors: ['UNSUPPORTED_SCHEMA_VERSION']
  });
  assert.deepEqual(blockedErrors, ['UNSUPPORTED_SCHEMA_VERSION']);
  assert.equal(state.assets.cash, 0);
  assert.equal(state.transactions.length, 0);
  assert.equal(storageDouble.entries.get(NEW_SCHEMA_STORAGE_KEY), serialized);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('startApplicationState should block read errors and report error codes', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      throw new Error('read failed');
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
    }
  };
  let blockedErrors = null;

  const result = startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => assert.fail('read-error startup should not confirm initialization'),
    showBlockedError: errors => {
      blockedErrors = errors;
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.mode, 'blocked');
  assert.deepEqual(result.errors, ['STORAGE_READ_FAILED']);
  assert.deepEqual(blockedErrors, ['STORAGE_READ_FAILED']);
  assert.deepEqual(storageDouble.calls, [
    { method: 'getItem', key: NEW_SCHEMA_STORAGE_KEY }
  ]);
});

test('startApplicationState should block missing-confirm initialization save failures', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      return null;
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
      throw new Error('write failed');
    }
  };
  let blockedErrors = null;

  const result = startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => true,
    showBlockedError: errors => {
      blockedErrors = errors;
    }
  });

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'initial-save-error',
    errors: ['STORAGE_WRITE_FAILED']
  });
  assert.deepEqual(blockedErrors, ['STORAGE_WRITE_FAILED']);
  assert.deepEqual(storageDouble.calls.map(call => call.method), ['getItem', 'setItem']);
});

test('startApplicationState should block invalid storage binding without confirmation', { concurrency: false }, () => {
  resetMocks();
  let confirmCount = 0;
  let blockedErrors = null;

  const result = startApplicationState(null, {
    confirmEnableNewSchema: () => {
      confirmCount++;
      return true;
    },
    showBlockedError: errors => {
      blockedErrors = errors;
    }
  });

  assert.deepEqual(result, {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: 'error',
    errors: BROWSER_STORAGE_BACKEND_ERROR_ORDER
  });
  assert.equal(confirmCount, 0);
  assert.deepEqual(blockedErrors, BROWSER_STORAGE_BACKEND_ERROR_ORDER);
});

test('startApplicationState should show blocked errors only after confirmed initialization failure', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = {
    calls: [],
    getItem(key) {
      this.calls.push({ method: 'getItem', key });
      return null;
    },
    setItem(key, value) {
      this.calls.push({ method: 'setItem', key, value });
      throw new Error('write failed');
    }
  };
  let confirmCount = 0;
  let blockedCount = 0;

  startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => {
      confirmCount++;
      return true;
    },
    showBlockedError: () => {
      blockedCount++;
    }
  });

  assert.equal(confirmCount, 1);
  assert.equal(blockedCount, 1);
});

test('startApplicationState should not show blocked errors when missing storage is cancelled', { concurrency: false }, () => {
  resetMocks();
  const storageDouble = makeBrowserStorageDouble();
  let blockedCount = 0;

  const result = startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => false,
    showBlockedError: () => {
      blockedCount++;
    }
  });

  assert.equal(result.mode, 'legacy');
  assert.equal(blockedCount, 0);
});

test('startApplicationState should leave legacy keys untouched across missing-confirm startup', { concurrency: false }, () => {
  resetMocks();
  const legacyEntries = Object.fromEntries(LEGACY_STORAGE_KEYS.map(key => [key, `legacy:${key}`]));
  const storageDouble = makeBrowserStorageDouble(legacyEntries);

  startApplicationState(storageDouble, {
    confirmEnableNewSchema: () => true,
    showBlockedError: errors => assert.fail(`unexpected blocked startup: ${errors.join(',')}`)
  });

  for (const key of LEGACY_STORAGE_KEYS) {
    assert.equal(storageDouble.entries.get(key), legacyEntries[key]);
  }
  assert.equal(storageDouble.calls.some(call => call.method === 'removeItem'), false);
});

test('app startup blocked message should include preservation guidance and error codes', { concurrency: false }, () => {
  const source = readFileSync('src/app.js', 'utf8');

  assert.match(source, /新版資料無法安全載入/);
  assert.match(source, /系統已停止載入資料，避免覆寫/);
  assert.match(source, /請保留現有資料並回報錯誤代碼/);
  assert.match(source, /errors\.join\(', '\)/);
});

test('app startup missing-data confirmation should describe no automatic legacy import or deletion', { concurrency: false }, () => {
  const source = readFileSync('src/app.js', 'utf8');

  assert.match(source, /找不到新版資料/);
  assert.match(source, /是否建立全新的新版資料庫/);
  assert.match(source, /舊版庫存、交易與設定不會自動匯入，也不會被刪除/);
  assert.match(source, /現金 0、空交易與空庫存/);
});

test('window startup should continue final render only after ready or legacy startup result', { concurrency: false }, () => {
  const source = readFileSync('src/app.js', 'utf8');
  const onloadSource = source.slice(source.indexOf('window.onload'));

  assert.match(onloadSource, /const startupResult = startApplicationState\(localStorage\);/);
  assert.match(onloadSource, /if \(startupResult\.mode === 'blocked'\) return;/);
  assert.match(onloadSource, /Crafting\.onRecipeChange\(\);/);
  assert.match(onloadSource, /Ledger\.updateDashboardUI\(\);/);
});

test('app startup source should not directly reference new-schema or legacy storage keys', { concurrency: false }, () => {
  const source = readFileSync('src/app.js', 'utf8');
  const startupSource = startApplicationState.toString();

  assert.doesNotMatch(source, /albion-logistics-v2-state/);
  assert.doesNotMatch(startupSource, /albion_crafting_|removeItem|key\(|length/);
});

test('window startup should register global events before state decision and stop final render when blocked', { concurrency: false }, () => {
  const source = readFileSync('src/app.js', 'utf8');
  const onloadSource = source.slice(source.indexOf('window.onload'));
  const globalEventsIndex = onloadSource.indexOf('initGlobalEvents()');
  const startupIndex = onloadSource.indexOf('startApplicationState(localStorage)');
  const blockedReturnIndex = onloadSource.indexOf("startupResult.mode === 'blocked'");
  const recipeIndex = onloadSource.indexOf('Crafting.onRecipeChange()');

  assert.ok(globalEventsIndex >= 0);
  assert.ok(startupIndex > globalEventsIndex);
  assert.ok(blockedReturnIndex > startupIndex);
  assert.ok(recipeIndex > blockedReturnIndex);
  assert.match(onloadSource, /if \(startupResult\.mode === 'blocked'\) return;/);
});
