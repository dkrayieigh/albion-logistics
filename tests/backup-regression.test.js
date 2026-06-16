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

test('adapter/migration red test: future location adapter preserves every legacy qtyByCity location quantity without mutating input', { concurrency: false }, () => {
  const qtyByCity = {
    Thetford: 100,
    Martlock: 25,
    '公會T8地堡': 7
  };
  const before = JSON.stringify(qtyByCity);

  const normalized = normalizeLocationMap(qtyByCity);

  assert.equal(JSON.stringify(qtyByCity), before);
  assert.equal(normalized.sourceFormat, 'qtyByCity');
  assert.deepEqual(normalized.quantities, qtyByCity);
  assert.equal(normalized.quantities.Thetford, 100);
  assert.equal(normalized.quantities.Martlock, 25);
  assert.equal(normalized.quantities['公會T8地堡'], 7);
  assert.deepEqual(normalized.unresolvedLocations, []);
});
