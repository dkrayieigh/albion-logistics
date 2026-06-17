import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveItemIdentity } from '../src/adapters/itemIdentity.js';
import { normalizeLocationMap } from '../src/adapters/locationAdapter.js';
import { readTransaction } from '../src/adapters/transactionReader.js';

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
    parentElement: { style: { display: 'block' } },
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
let confirmResult = true;
globalThis.confirm = () => confirmResult;
globalThis.window = {
  showToast: (message, type) => toasts.push({ message, type }),
  updateDashboardUI: () => {},
  renderCityDropdowns: () => {}
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
  confirmResult = true;
  getElement('global-shopfee').value = '0';
}

test('non-empty custom location cannot be deleted', { concurrency: false }, () => {
  resetState();
  const location = '測試倉庫';
  state.customLocations = [location];
  state.assets.cash = 12345;
  state.inventory['TestMaterial_4.0'] = {
    qtyByCity: { ...qtyByCity(0), [location]: 1 },
    globalAvgCost: 100
  };
  state.transactions = [{ type: 'existing transaction' }];
  const before = JSON.stringify(state);

  Inventory.deleteLocation(location);

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.customLocations.includes(location), true);
  assert.equal(toasts.at(-1)?.type, 'error');
  assert.match(toasts.at(-1)?.message || '', /先轉移或清空/);
});

test('empty custom location can be deleted without affecting other state', { concurrency: false }, () => {
  resetState();
  const location = '空倉庫';
  state.customLocations = [location];
  state.assets.cash = 12345;
  state.inventory['TestMaterial_4.0'] = {
    qtyByCity: { ...qtyByCity(7), [location]: 0 },
    globalAvgCost: 100
  };
  state.transactions = [{ type: 'existing transaction' }];
  const inventoryBefore = JSON.stringify(state.inventory);
  const transactionsBefore = JSON.stringify(state.transactions);

  Inventory.deleteLocation(location);

  assert.equal(state.customLocations.includes(location), false);
  assert.equal(state.inventory['TestMaterial_4.0'].qtyByCity[LOCATION], 7);
  assert.equal(state.inventory['TestMaterial_4.0'].qtyByCity[location], undefined);
  assert.equal(state.inventory['TestMaterial_4.0'].globalAvgCost, 100);
  assert.equal(JSON.stringify(state.transactions), transactionsBefore);
  assert.equal(state.assets.cash, 12345);
  assert.equal(toasts.at(-1)?.type, 'success');
  assert.notEqual(JSON.stringify(state.inventory), inventoryBefore);
});

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

test('TEST-A01: first purchase establishes globalAvgCost from total cost and quantity', { concurrency: false }, () => {
  resetState();
  const item = 'FirstPurchaseMaterial';
  const quality = '6.2';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(0),
    globalAvgCost: null
  };
  setCurrentBuyQuality(quality);
  getElement('buy-item').value = item;
  getElement('buy-qty').value = '200';
  getElement('buy-total-price').value = '5800000';
  getElement('buy-city').value = LOCATION;

  Inventory.submitPurchase();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 200);
  assert.equal(state.inventory[key].globalAvgCost, 29000);
  assert.equal(state.assets.cash, -5800000);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].qty, 200);
  assert.equal(state.transactions[0].total, 5800000);
  assert.equal(state.transactions[0].unitPrice, 29000);
});

test('TEST-A04: purchase WAC uses global inventory quantity across locations', { concurrency: false }, () => {
  resetState();
  const item = 'GlobalWacMaterial';
  const quality = '6.2';
  const key = `${item}_${quality}`;
  const locations = qtyByCity(100);
  locations.Bridgewatch = 100;
  state.assets.cash = 5800000;
  state.inventory[key] = {
    qtyByCity: locations,
    globalAvgCost: 29000
  };
  setCurrentBuyQuality(quality);
  getElement('buy-item').value = item;
  getElement('buy-qty').value = '100';
  getElement('buy-total-price').value = '2850000';
  getElement('buy-city').value = LOCATION;

  Inventory.submitPurchase();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 200);
  assert.equal(state.inventory[key].qtyByCity.Bridgewatch, 100);
  assert.equal(state.inventory[key].globalAvgCost, 28833);
  assert.equal(state.assets.cash, 2950000);
  assert.equal(state.transactions.length, 1);
});

test('TEST-A06: purchase at zero global quantity replaces a dormant cost anchor', { concurrency: false }, () => {
  resetState();
  const item = 'DormantAnchorMaterial';
  const quality = '6.2';
  const key = `${item}_${quality}`;
  state.assets.cash = 5000000;
  state.inventory[key] = {
    qtyByCity: qtyByCity(0),
    globalAvgCost: 29000
  };
  setCurrentBuyQuality(quality);
  getElement('buy-item').value = item;
  getElement('buy-qty').value = '50';
  getElement('buy-total-price').value = '2000000';
  getElement('buy-city').value = LOCATION;

  Inventory.submitPurchase();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 50);
  assert.equal(state.inventory[key].globalAvgCost, 40000);
  assert.equal(state.assets.cash, 3000000);
  assert.equal(state.transactions.length, 1);
});

test('crafted item sale reduces inventory, increases cash, and writes a sale transaction', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: 5000
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '4';
  getElement('sell-crafted-total').value = '40000';
  Inventory.submitSellCrafted();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 6);
  assert.equal(state.inventory[key].globalAvgCost, 5000);
  assert.equal(state.assets.cash, 40000);
  assert.equal(state.transactions.length, 1);
  assert.deepEqual(state.transactions[0], {
    date: new Date().toISOString().split('T')[0],
    type: '賣成品',
    item,
    quality,
    qty: 4,
    total: 40000,
    unitPrice: 10000,
    location: LOCATION
  });
  assert.equal(toasts.at(-1)?.type, 'success');
  assert.match(toasts.at(-1)?.message || '', /40,000/);
  assert.match(toasts.at(-1)?.message || '', /10,000/);
  assert.match(toasts.at(-1)?.message || '', /20,000/);
});

test('transaction reader boundary: reads current legacy type 賣成品 crafted sale transaction without mutating payload', { concurrency: false }, () => {
  const transaction = {
    date: '2026-06-17',
    type: '賣成品',
    item: 'TestProduct',
    quality: '6.1',
    qty: 3,
    total: 90000,
    unitPrice: 30000,
    location: 'Thetford'
  };
  const before = JSON.stringify(transaction);

  const entry = readTransaction(transaction);

  assert.equal(JSON.stringify(transaction), before);
  assert.equal(Object.hasOwn(transaction, 'action'), false);
  assert.equal(entry.sourceFormat, 'legacy');
  assert.equal(entry.displayType, '賣成品');
  assert.equal(entry.itemRef, 'TestProduct');
  assert.equal(entry.quantity, 3);
  assert.equal(entry.cashImpact, 90000);
  assert.equal(entry.locationRef, 'Thetford');
  assert.equal(entry.raw, transaction);
});

test('crafted item sale reports unknown profit when cost basis is invalid', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: null
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '4';
  getElement('sell-crafted-total').value = '40000';
  Inventory.submitSellCrafted();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 6);
  assert.equal(state.inventory[key].globalAvgCost, null);
  assert.equal(state.assets.cash, 40000);
  assert.equal(state.transactions.length, 1);
  assert.equal(toasts.at(-1)?.type, 'success');
  assert.match(toasts.at(-1)?.message || '', /成本基準未知/);
});

test('crafted item sale closes modal and shows success when dashboard refresh fails', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  const originalUpdateDashboardUI = window.updateDashboardUI;
  const originalWarn = console.warn;
  state.inventory[key] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: 5000
  };

  try {
    console.warn = () => {};
    window.updateDashboardUI = () => {
      throw new Error('refresh failed');
    };
    Inventory.openSellCraftedModal(item, quality, LOCATION);
    getElement('sell-crafted-qty').value = '4';
    getElement('sell-crafted-total').value = '40000';

    Inventory.submitSellCrafted();
  } finally {
    window.updateDashboardUI = originalUpdateDashboardUI;
    console.warn = originalWarn;
  }

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 6);
  assert.equal(state.inventory[key].globalAvgCost, 5000);
  assert.equal(state.assets.cash, 40000);
  assert.equal(state.transactions.length, 1);
  assert.equal(getElement('sell-crafted-modal').style.display, 'none');
  assert.equal(toasts.at(-1)?.type, 'success');
  assert.match(toasts.at(-1)?.message || '', /出售成功/);
});

test('crafted item sale is blocked when inventory is insufficient', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(2),
    globalAvgCost: 5000
  };
  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '4';
  getElement('sell-crafted-total').value = '40000';
  const before = JSON.stringify(state);

  Inventory.submitSellCrafted();

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.inventory[key].qtyByCity[LOCATION], 2);
  assert.equal(state.inventory[key].globalAvgCost, 5000);
  assert.equal(state.assets.cash, 0);
  assert.equal(state.transactions.length, 0);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('crafted item sale is blocked when quantity is zero', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: 5000
  };
  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '0';
  getElement('sell-crafted-total').value = '40000';
  const before = JSON.stringify(state);

  Inventory.submitSellCrafted();

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.transactions.length, 0);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('laborer stock sale reduces temporary inventory, increases cash, and writes a sale transaction', { concurrency: false }, () => {
  resetState();
  const item = 'METALBAR';
  const quality = '6.1';
  state.laborerInventory[item] = { [quality]: 10 };

  Laborer.openSellLaborStockModal(item, quality, 10);
  getElement('sell-qty').value = '4';
  getElement('sell-price').value = '40000';
  Laborer.submitSellLaborStock();

  assert.equal(state.laborerInventory[item][quality], 6);
  assert.equal(state.assets.cash, 40000);
  assert.equal(state.transactions.length, 1);
  assert.deepEqual(state.transactions[0], {
    date: new Date().toISOString().split('T')[0],
    type: '工人島出售',
    item,
    quality,
    qty: 4,
    total: 40000,
    unitPrice: 10000,
    location: 'LaborerIsland'
  });
  assert.equal(toasts.at(-1)?.type, 'success');
});

test('laborer stock sale is blocked when temporary inventory is insufficient', { concurrency: false }, () => {
  resetState();
  const item = 'METALBAR';
  const quality = '6.1';
  state.laborerInventory[item] = { [quality]: 2 };
  Laborer.openSellLaborStockModal(item, quality, 2);
  getElement('sell-qty').value = '4';
  getElement('sell-price').value = '40000';
  const before = JSON.stringify(state);

  Laborer.submitSellLaborStock();

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.laborerInventory[item][quality], 2);
  assert.equal(state.assets.cash, 0);
  assert.equal(state.transactions.length, 0);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('laborer stock sale is blocked when quantity is zero', { concurrency: false }, () => {
  resetState();
  const item = 'METALBAR';
  const quality = '6.1';
  state.laborerInventory[item] = { [quality]: 10 };
  Laborer.openSellLaborStockModal(item, quality, 10);
  getElement('sell-qty').value = '0';
  getElement('sell-price').value = '40000';
  const before = JSON.stringify(state);

  Laborer.submitSellLaborStock();

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.transactions.length, 0);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('laborer render table displays journal terminology while preserving legacy journal action key without mutating state', { concurrency: false }, () => {
  resetState();
  state.laborerInventory = {
    '滿日記本': {
      '6.0': 3,
      '7.0': 2,
      '8.0': 1
    },
    '布料': {
      '6.1': 25
    }
  };
  getElement('labor-tbody').rows = [];
  getElement('labor-journal-tbody').rows = [];
  const before = JSON.stringify(state.laborerInventory);

  Laborer.renderLaborerTable();

  assert.equal(JSON.stringify(state.laborerInventory), before);
  const renderedJournalText = getElement('labor-journal-tbody').rows
    .map(row => row.innerHTML)
    .join('\n');

  assert.match(renderedJournalText, /T6 日誌/);
  assert.match(renderedJournalText, /T7 日誌/);
  assert.match(renderedJournalText, /T8 日誌/);
  assert.doesNotMatch(renderedJournalText, /T6 日記本/);
  assert.doesNotMatch(renderedJournalText, /T7 日記本/);
  assert.doesNotMatch(renderedJournalText, /T8 日記本/);
  assert.match(renderedJournalText, /data-item="滿日記本"/);
  assert.doesNotMatch(renderedJournalText, /data-item="滿日誌"/);
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

test('TEST-B01: laborer import revives zero inventory without changing dormant cost anchor', { concurrency: false }, () => {
  resetState();
  const item = 'DormantLaborMaterial';
  const quality = '6.2';
  const key = `${item}_${quality}`;
  state.assets.cash = 12345;
  state.inventory[key] = {
    qtyByCity: qtyByCity(0),
    globalAvgCost: 29000
  };
  state.laborerInventory[item] = { [quality]: 5 };
  Laborer.openImportModal(item, quality, 5);
  getElement('import-qty').value = '5';
  getElement('import-city').value = LOCATION;

  Laborer.submitImportLaborStock();

  assert.equal(state.laborerInventory[item][quality], 0);
  assert.equal(state.inventory[key].qtyByCity[LOCATION], 5);
  assert.equal(state.inventory[key].globalAvgCost, 29000);
  assert.equal(state.assets.cash, 12345);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].item, item);
  assert.equal(state.transactions[0].quality, quality);
  assert.equal(state.transactions[0].qty, 5);
  assert.equal(state.transactions[0].total, 0);
  assert.equal(state.transactions[0].location, LOCATION);
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

test('TEST-A03: crafting applies WAC when finished goods already have inventory', { concurrency: false }, () => {
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
    qtyByCity: qtyByCity(2),
    globalAvgCost: 200
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
  assert.equal(state.inventory[outputKey].qtyByCity[LOCATION], 4);
  assert.equal(state.inventory[outputKey].globalAvgCost, 250);
  assert.equal(state.assets.cash, 900);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].item, 'TestProduct');
  assert.equal(state.transactions[0].qty, 2);
  assert.equal(state.transactions[0].total, 600);
  assert.equal(state.transactions[0].unitPrice, 300);
});

test('TEST-A05: insufficient materials block crafting before any state change', { concurrency: false }, () => {
  resetState();
  const quality = '4.0';
  const mainKey = `MainMaterial_${quality}`;
  const subKey = `SubMaterial_${quality}`;
  const outputKey = `TestProduct_${quality}`;
  state.assets.cash = 1000;
  state.inventory[mainKey] = {
    qtyByCity: qtyByCity(3),
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
  const before = JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions,
    craftingQueue
  });

  Crafting.submitCraftAll();

  assert.equal(JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions,
    craftingQueue
  }), before);
  assert.equal(state.inventory[mainKey].qtyByCity[LOCATION], 3);
  assert.equal(state.inventory[subKey].qtyByCity[LOCATION], 10);
  assert.equal(state.inventory[outputKey].qtyByCity[LOCATION], 0);
  assert.equal(state.inventory[mainKey].globalAvgCost, 100);
  assert.equal(state.inventory[subKey].globalAvgCost, 50);
  assert.equal(state.inventory[outputKey].globalAvgCost, null);
  assert.equal(state.assets.cash, 1000);
  assert.equal(state.transactions.length, 0);
  assert.equal(craftingQueue.length, 1);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('TEST-A07: crafting blocks material consumption when a required globalAvgCost is null', { concurrency: false }, () => {
  resetState();
  const quality = '4.0';
  const mainKey = `MainMaterial_${quality}`;
  const subKey = `SubMaterial_${quality}`;
  const outputKey = `TestProduct_${quality}`;
  state.assets.cash = 1000;
  state.inventory[mainKey] = {
    qtyByCity: qtyByCity(10),
    globalAvgCost: null
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
  const before = JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions,
    craftingQueue
  });

  Crafting.submitCraftAll();

  assert.equal(JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions,
    craftingQueue
  }), before);
  assert.equal(state.inventory[mainKey].qtyByCity[LOCATION], 10);
  assert.equal(state.inventory[subKey].qtyByCity[LOCATION], 10);
  assert.equal(state.inventory[outputKey].qtyByCity[LOCATION], 0);
  assert.equal(state.assets.cash, 1000);
  assert.equal(state.transactions.length, 0);
  assert.equal(craftingQueue.length, 1);
  assert.equal(toasts.at(-1)?.type, 'error');
  assert.match(toasts.at(-1)?.message || '', /成本|定錨/);
});

test('TEST-A02: transport moves inventory without changing cost, cash, or ledger', { concurrency: false }, () => {
  resetState();
  const key = 'TransportMaterial_6.2';
  state.assets.cash = -5800000;
  state.inventory[key] = {
    qtyByCity: qtyByCity(200),
    globalAvgCost: 29000
  };
  state.transactions = [{
    date: '2026-06-15',
    type: '買材料',
    item: 'TransportMaterial',
    quality: '6.2',
    qty: 200,
    total: 5800000,
    unitPrice: 29000,
    location: LOCATION
  }];
  const originalTransaction = state.transactions[0];
  getElement('trans-item').value = key;
  getElement('trans-qty').value = '100';
  getElement('trans-from').value = LOCATION;
  getElement('trans-to').value = 'Bridgewatch';

  Inventory.submitTransport();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 100);
  assert.equal(state.inventory[key].qtyByCity.Bridgewatch, 100);
  assert.equal(state.inventory[key].globalAvgCost, 29000);
  assert.equal(state.assets.cash, -5800000);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0], originalTransaction);
});

test('TEST-A02: insufficient source inventory blocks transport before any state change', { concurrency: false }, () => {
  resetState();
  const key = 'TransportMaterial_6.2';
  state.assets.cash = 12345;
  state.inventory[key] = {
    qtyByCity: qtyByCity(50),
    globalAvgCost: 29000
  };
  state.transactions = [{
    date: '2026-06-15',
    type: '買材料',
    item: 'TransportMaterial',
    quality: '6.2',
    qty: 50,
    total: 1450000,
    unitPrice: 29000,
    location: LOCATION
  }];
  getElement('trans-item').value = key;
  getElement('trans-qty').value = '100';
  getElement('trans-from').value = LOCATION;
  getElement('trans-to').value = 'Bridgewatch';
  const before = JSON.stringify(state);

  Inventory.submitTransport();

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.inventory[key].qtyByCity[LOCATION], 50);
  assert.equal(state.inventory[key].qtyByCity.Bridgewatch, 0);
  assert.equal(state.inventory[key].globalAvgCost, 29000);
  assert.equal(state.assets.cash, 12345);
  assert.equal(state.transactions.length, 1);
  assert.equal(toasts.at(-1)?.type, 'error');
});

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

test('adapter/integration red test: inventory render display path preserves legacy qtyByCity quantities without mutating state or legacy action dataset', { concurrency: false }, () => {
  resetState();
  const key = 'TestProduct_6.1';
  const legacyQtyByCity = {
    Thetford: 100,
    Martlock: 25,
    '公會T8地堡': 7
  };
  const legacyActionDataset = [
    {
      action: 'render-inventory-display',
      itemKey: key,
      sourceFormat: 'qtyByCity'
    }
  ];
  const legacyQtyBefore = JSON.stringify(legacyQtyByCity);
  const actionDatasetBefore = JSON.stringify(legacyActionDataset);

  state.customLocations = ['公會T8地堡'];
  state.inventory[key] = {
    locationEntry: normalizeLocationMap(legacyQtyByCity),
    globalAvgCost: 5000
  };
  getElement('inventory-search').value = '';
  getElement('inventory-city-cards').rows = [];

  Inventory.renderInventoryTable();

  assert.equal(JSON.stringify(legacyQtyByCity), legacyQtyBefore);
  assert.equal(JSON.stringify(legacyActionDataset), actionDatasetBefore);
  assert.equal(JSON.stringify(state.inventory[key].locationEntry.quantities), legacyQtyBefore);
  const renderedText = getElement('inventory-city-cards').rows.map(row => row.innerHTML).join('\n');
  assert.match(renderedText, /Thetford/);
  assert.match(renderedText, /100/);
  assert.match(renderedText, /Martlock/);
  assert.match(renderedText, /25/);
  assert.match(renderedText, /公會T8地堡/);
  assert.match(renderedText, /7/);
});

test('adapter/migration red test: future item identity adapter fails explicitly on missing legacy item mapping without mutating input', { concurrency: false }, () => {
  const input = {
    legacyItemKey: '未知材料_6.2',
    mappingTable: {}
  };
  const before = JSON.stringify(input);

  assert.equal(typeof resolveItemIdentity, 'function');
  assert.throws(
    () => resolveItemIdentity(input),
    /mapping|Stable ID|item/i
  );

  assert.equal(JSON.stringify(input), before);
});
