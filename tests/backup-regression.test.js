import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocationMap } from '../src/adapters/locationAdapter.js';
import { resolveLocationIdentity } from '../src/adapters/locationIdentity.js';
import { validateLocationMigration } from '../src/adapters/locationMigrationValidator.js';
import { SYSTEM_CITIES } from '../src/data/constants.js';

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
globalThis.localStorage = {
  clear: () => storage.clear(),
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};

let alerts = [];
let confirmResult = true;
let createdBlob;
let reloadCount = 0;
let browserDownloadCount = 0;
let tauriInvocations = [];

globalThis.alert = message => alerts.push(message);
globalThis.confirm = () => confirmResult;
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
    this.onload({ target: { result: file.contents } });
  }
};

const { initGlobalEvents } = await import('../src/app.js');
const { initDefaultState, loadState, state } = await import('../src/core/state.js');

window.showToast = () => {};
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
  createdBlob = undefined;
  reloadCount = 0;
  browserDownloadCount = 0;
  tauriInvocations = [];
  delete window.__TAURI__;
  getElement('import-file').value = '';
}

function seedStorage(data) {
  for (const [field, value] of Object.entries(data)) {
    localStorage.setItem(STORAGE_KEYS[field], JSON.stringify(value));
  }
}

function importBackup(data) {
  const target = {
    files: [{ contents: JSON.stringify(data) }],
    value: 'backup.json'
  };
  getElement('import-file').handlers.change({ target });
  return target;
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

  await getElement('btn-export-data').handlers.click();

  assert.equal(browserDownloadCount, 1);
  assert.ok(createdBlob);
  const exported = JSON.parse(createdBlob.parts.join(''));
  assert.equal(Array.isArray(exported.transactions), true);
  assert.equal(exported.transactions.length, 1);
});

test('TEST-B04: readable JSON backup imports, reloads, and remains loadState-compatible', { concurrency: false }, () => {
  resetMocks();
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
  assert.deepEqual(state.inventory['布料_6.1'], inventory['布料_6.1']);
  assert.equal(state.transactions.length, 150);
});

test('TEST-B04: legacy JSON-string backup imports without losing transactions', { concurrency: false }, () => {
  resetMocks();
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

  await getElement('btn-export-data').handlers.click();
  assert.ok(createdBlob);
  const exported = JSON.parse(createdBlob.parts.join(''));

  resetMocks();
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
