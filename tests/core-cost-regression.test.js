import test from 'node:test';
import assert from 'node:assert/strict';

const elements = new Map();

function createElement(id = '') {
  return {
    id,
    innerHTML: '',
    innerText: '',
    textContent: '',
    value: '',
    checked: false,
    max: 0,
    style: { display: 'none' },
    children: [],
    rows: [],
    appendChild(child) {
      this.children.push(child);
      this.rows.push(child);
    },
    addEventListener() {},
    focus() {}
  };
}

function getElement(id) {
  if (!elements.has(id)) elements.set(id, createElement(id));
  return elements.get(id);
}

globalThis.document = {
  getElementById: getElement,
  createElement: () => createElement(),
  dispatchEvent: () => {}
};
globalThis.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  clear: () => storage.clear()
};

let toasts = [];
globalThis.window = {
  showToast: (message, type) => toasts.push({ message, type }),
  updateDashboardUI: () => {}
};

const Inventory = await import('../src/components/inventory.js');
const Laborer = await import('../src/components/laborer.js');
const Crafting = await import('../src/components/crafting.js');
const { state, craftingQueue, setCurrentBuyQuality } = await import('../src/core/state.js');

const LOCATION = 'Thetford';

function qtyByCity(theftfordQty = 0) {
  return {
    LaborerIsland: 0,
    'Fort Sterling': 0,
    Bridgewatch: 0,
    Lymhurst: 0,
    Martlock: 0,
    Thetford: theftfordQty
  };
}

function resetState() {
  state.assets = { cash: 0, debt: 0 };
  state.customLocations = [];
  state.inventory = {};
  state.laborerInventory = {};
  state.laborerLogs = [];
  state.transactions = [];
  craftingQueue.splice(0);
  storage.clear();
  elements.clear();
  toasts = [];
  getElement('global-shopfee').value = '0';
}

test('purchase recalculates WAC, adds inventory, deducts cash, and writes a ledger record', { concurrency: false }, () => {
  resetState();
  const item = 'TestMaterial';
  const quality = '4.0';
  const key = `${item}_${quality}`;
  state.assets.cash = 50000;
  state.inventory[key] = {
    qtyByCity: qtyByCity(100),
    globalAvgCost: 100
  };
  setCurrentBuyQuality(quality);
  getElement('buy-item').value = item;
  getElement('buy-qty').value = '100';
  getElement('buy-total-price').value = '30000';
  getElement('buy-city').value = LOCATION;

  Inventory.submitPurchase();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 200);
  assert.equal(state.inventory[key].globalAvgCost, 200);
  assert.equal(state.assets.cash, 20000);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].item, item);
  assert.equal(state.transactions[0].quality, quality);
  assert.equal(state.transactions[0].qty, 100);
  assert.equal(state.transactions[0].total, 30000);
  assert.equal(state.transactions[0].location, LOCATION);
});

test('laborer import with null cost basis is blocked before any state change', { concurrency: false }, () => {
  resetState();
  const item = 'TestMaterial';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.assets.cash = 12345;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: null
  };
  state.laborerInventory[item] = { [quality]: 10 };
  Laborer.openImportModal(item, quality, 10);
  getElement('import-qty').value = '5';
  getElement('import-city').value = LOCATION;
  const before = JSON.stringify(state);

  Laborer.submitImportLaborStock();

  assert.equal(JSON.stringify(state), before);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('laborer import adds quantity without changing cost basis or cash', { concurrency: false }, () => {
  resetState();
  const item = 'TestMaterial';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.assets.cash = 12345;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 6000
  };
  state.laborerInventory[item] = { [quality]: 10 };
  Laborer.openImportModal(item, quality, 10);
  getElement('import-qty').value = '5';
  getElement('import-city').value = LOCATION;

  Laborer.submitImportLaborStock();

  assert.equal(state.laborerInventory[item][quality], 5);
  assert.equal(state.inventory[key].qtyByCity[LOCATION], 25);
  assert.equal(state.inventory[key].globalAvgCost, 6000);
  assert.equal(state.assets.cash, 12345);
  assert.equal(state.transactions.length, 1);
});

test('crafting consumes materials at current globalAvgCost without changing material cost bases', { concurrency: false }, () => {
  resetState();
  const quality = '4.0';
  const mainKey = `MainMaterial_${quality}`;
  const subKey = `SubMaterial_${quality}`;
  const outputKey = `TestProduct_${quality}`;
  state.assets.cash = 1000;
  state.inventory[mainKey] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: 100
  };
  state.inventory[subKey] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: 50
  };
  state.inventory[outputKey] = {
    qtyByCity: qtyByCity(0),
    globalAvgCost: null
  };
  craftingQueue.push({
    id: 1,
    checked: true,
    recipe: {
      name: 'TestProduct',
      main: 'MainMaterial',
      sub: 'SubMaterial',
      mainBaseQty: 2,
      subBaseQty: 1,
      artifactVal: 0
    },
    qty: 2,
    quality,
    city: LOCATION,
    mainKey,
    mainQty: 4,
    subKey,
    subQty: 2,
    tax: 100,
    artifactPrice: 0,
    artifactQty: 1,
    alchemyName: null
  });

  Crafting.submitCraftAll();

  assert.equal(state.inventory[mainKey].qtyByCity[LOCATION], 6);
  assert.equal(state.inventory[subKey].qtyByCity[LOCATION], 8);
  assert.equal(state.inventory[mainKey].globalAvgCost, 100);
  assert.equal(state.inventory[subKey].globalAvgCost, 50);
  assert.equal(state.inventory[outputKey].qtyByCity[LOCATION], 2);
  assert.equal(state.inventory[outputKey].globalAvgCost, 300);
  assert.equal(state.assets.cash, 900);
  assert.equal(state.transactions[0].total, 600);
});

test.todo('crafting blocks material consumption when a required globalAvgCost is null');

test('legacy Chinese item key and qtyByCity remain usable for transport without cost or ledger changes', { concurrency: false }, () => {
  resetState();
  const key = '布料_6.1';
  state.assets.cash = 777;
  state.inventory[key] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: 6000
  };
  state.transactions = [{
    date: '2026-06-15',
    type: '買材料',
    item: '布料',
    quality: '6.1',
    qty: 10,
    total: 60000,
    unitPrice: 6000,
    location: LOCATION
  }];
  getElement('trans-item').value = key;
  getElement('trans-qty').value = '4';
  getElement('trans-from').value = LOCATION;
  getElement('trans-to').value = 'Bridgewatch';

  Inventory.submitTransport();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 6);
  assert.equal(state.inventory[key].qtyByCity.Bridgewatch, 4);
  assert.equal(state.inventory[key].globalAvgCost, 6000);
  assert.equal(state.assets.cash, 777);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, '買材料');
});
