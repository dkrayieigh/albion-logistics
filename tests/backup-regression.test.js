import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocationMap } from '../src/adapters/locationAdapter.js';

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
const { loadState, state } = await import('../src/core/state.js');

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

test.todo('location adapter should normalize legacy qtyByCity wrapper without treating qtyByCity as a literal location key');

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
