import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveItemIdentity } from '../src/adapters/itemIdentity.js';
import { normalizeLocationMap } from '../src/adapters/locationAdapter.js';
import { readTransaction } from '../src/adapters/transactionReader.js';
import { TAX_RATE } from '../src/data/constants.js';

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
    removeChild(child) {
      this.children = this.children.filter(item => item !== child);
      this.rows = this.rows.filter(item => item !== child);
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
  addEventListener: () => {},
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
function recordToast(message, type) {
  toasts.push({ message, type });
}
globalThis.confirm = () => confirmResult;
globalThis.window = {
  showToast: recordToast,
  updateDashboardUI: () => {},
  renderCityDropdowns: () => {}
};

const Inventory = await import('../src/components/inventory.js');
const Laborer = await import('../src/components/laborer.js');
const Crafting = await import('../src/components/crafting.js');
const App = await import('../src/app.js');
const { state, craftingQueue, setCurrentBuyQuality, setCurrentCraftQuality } = await import('../src/core/state.js');
globalThis.window.showToast = recordToast;

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
  globalThis.window.showToast = recordToast;
  setCurrentBuyQuality('');
  setCurrentCraftQuality('');
  getElement('global-shopfee').value = '0';
}

function setGlobalShopFeeForTax(recipe, qty, quality, desiredTax) {
  const { tier, enchant } = Crafting.getEnchantAndTier(quality);
  const mainValue = recipe.mainBaseQty * Math.pow(2, tier + enchant);
  const subValue = recipe.subBaseQty > 0 ? recipe.subBaseQty * Math.pow(2, tier + enchant) : 0;
  const artifactValue = recipe.artifactVal > 0 ? recipe.artifactVal * Math.pow(2, tier - 4) * qty : 0;
  const itemValue = (mainValue + subValue) * qty + artifactValue;
  getElement('global-shopfee').value = String(desiredTax / (itemValue * TAX_RATE));
}

function formatForRegex(value) {
  return value.toLocaleString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function flattenQualityMatrix(container) {
  const matrix = container.children.find(child => child.className === 'quality-matrix');
  const rows = matrix?.children || [];
  return {
    matrix,
    rows,
    buttons: rows.flatMap(row => row.children)
  };
}

function findLaborPill(containerId, label) {
  const group = getElement(containerId).children[0];
  return group.children.find(button => button.innerHTML === label);
}

test('UI version and craft quantity controls use the v0.4.3 / -10 -1 +1 +10 contract', { concurrency: false }, () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

  assert.match(html, /Albion Logistics v0\.4\.3/);
  assert.doesNotMatch(html, /Albion Logistics V4\.0\.0-beta/);
  assert.match(html, /<input type="number" id="craft-qty"/);
  assert.match(html, /id="btn-craft-qty-sub-10" data-val="-10">-10/);
  assert.match(html, /id="btn-craft-qty-sub-1" data-val="-1">-1/);
  assert.match(html, /id="btn-craft-qty-add-1" data-val="1">\+1/);
  assert.match(html, /id="btn-craft-qty-add-10" data-val="10">\+10/);
  assert.doesNotMatch(html, /btn-craft-qty-sub-5/);
  assert.doesNotMatch(html, /btn-craft-qty-add-5/);
  assert.doesNotMatch(html, /data-val="-5">-5/);
  assert.doesNotMatch(html, /data-val="5">\+5/);
});

test('CSS hides native number spinners and defines five-column quality matrix layout', { concurrency: false }, () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

  assert.match(css, /input\[type="number"\]\s*\{[^}]*-moz-appearance:\s*textfield/s);
  assert.match(css, /input\[type="number"\]::-webkit-outer-spin-button/);
  assert.match(css, /input\[type="number"\]::-webkit-inner-spin-button/);
  assert.match(css, /-webkit-appearance:\s*none/);
  assert.match(css, /\.quality-matrix\s*\{/);
  assert.match(css, /\.quality-matrix-row\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /@media \(max-width:\s*900px\)/);
});

test('quality renderer creates a 5 by 5 matrix in fixed 4.0 through 8.4 order', { concurrency: false }, () => {
  resetState();
  let selected = '';

  App.renderQualityPillsGroup('buy-quality-pill-group', '6.2', q => { selected = q; });

  const { matrix, rows, buttons } = flattenQualityMatrix(getElement('buy-quality-pill-group'));
  assert.equal(matrix.className, 'quality-matrix');
  assert.equal(rows.length, 5);
  rows.forEach(row => assert.equal(row.children.length, 5));
  assert.deepEqual(
    buttons.map(button => button.textContent),
    [
      '4.0', '4.1', '4.2', '4.3', '4.4',
      '5.0', '5.1', '5.2', '5.3', '5.4',
      '6.0', '6.1', '6.2', '6.3', '6.4',
      '7.0', '7.1', '7.2', '7.3', '7.4',
      '8.0', '8.1', '8.2', '8.3', '8.4'
    ]
  );
  assert.equal(buttons.length, 25);
  assert.match(buttons.find(button => button.textContent === '6.2').className, /\bactive\b/);

  buttons.find(button => button.textContent === '7.3').onclick();

  assert.equal(selected, '7.3');
});

test('quality renderer uses matrix rows without tier or enchantment labels', { concurrency: false }, () => {
  resetState();

  App.renderQualityPillsGroup('buy-quality-pill-group', '4.0', () => {});

  const { matrix, rows } = flattenQualityMatrix(getElement('buy-quality-pill-group'));
  assert.equal(matrix.children.length, 5);
  rows.forEach(row => assert.equal(row.className, 'quality-matrix-row'));
  assert.doesNotMatch(getElement('buy-quality-pill-group').innerHTML, /T4|T5|T6|T7|T8/);
  assert.doesNotMatch(getElement('buy-quality-pill-group').innerHTML, /\.0|\.1|\.2|\.3|\.4/);
});

test('quality renderer keeps boundary quality callbacks intact', { concurrency: false }, () => {
  resetState();
  const selected = [];

  App.renderQualityPillsGroup('buy-quality-pill-group', '8.4', q => { selected.push(q); });
  const { buttons } = flattenQualityMatrix(getElement('buy-quality-pill-group'));
  buttons.find(button => button.textContent === '4.0').onclick();
  buttons.find(button => button.textContent === '8.4').onclick();

  assert.deepEqual(selected, ['4.0', '8.4']);
});

test('quality renderer still shows the selection hint without removing the matrix', { concurrency: false }, () => {
  resetState();

  App.renderQualityPillsGroup('buy-quality-pill-group', '', () => {});

  const container = getElement('buy-quality-pill-group');
  const { rows, buttons } = flattenQualityMatrix(container);
  assert.equal(container.children[0].innerText, '請選擇品質');
  assert.equal(rows.length, 5);
  assert.equal(buttons.length, 25);
});

test('crafting and purchase quality controls use the shared matrix renderer', { concurrency: false }, () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /function updateCraftQualityPills\(\) \{ renderQualityPillsGroup\('craft-quality-pill-group'/);
  assert.match(source, /function updateBuyQualityPills\(\) \{ renderQualityPillsGroup\('buy-quality-pill-group'/);
  assert.doesNotMatch(source, /QUAL_GROUPS\.forEach/);
  assert.doesNotMatch(source, /pill-hint.*工人島/s);
});

test('laborer harvest tier switch resets unsubmitted output rows to the new tier default', { concurrency: false }, () => {
  resetState();
  Laborer.updateLaborQualityPills();
  findLaborPill('labor-harvest-pill-group', 'T6').onclick();

  const list = getElement('labor-dynamic-list');
  list.children = [createElement('old-1'), createElement('old-2')];
  list.rows = [...list.children];
  Laborer.updateLaborQualityPills();

  findLaborPill('labor-harvest-pill-group', 'T8').onclick();

  assert.equal(list.children.length, 1);
  assert.match(list.children[0].innerHTML, /<option value="鋼條">鋼條<\/option>/);
  assert.match(list.children[0].innerHTML, /<option value="8\.0">8\.0<\/option>/);
  assert.match(list.children[0].innerHTML, /class="format-num li-qty"[^>]*value="0"/);
});

test('laborer harvest tier switch updates the active pill after reset', { concurrency: false }, () => {
  resetState();
  Laborer.updateLaborQualityPills();
  findLaborPill('labor-harvest-pill-group', 'T6').onclick();

  Laborer.updateLaborQualityPills();
  findLaborPill('labor-harvest-pill-group', 'T8').onclick();

  const activeButtons = getElement('labor-harvest-pill-group').children[0].children.filter(button => /\bactive\b/.test(button.className));
  assert.equal(activeButtons.length, 1);
  assert.equal(activeButtons[0].innerHTML, 'T8');
});

test('laborer harvest tier click on the already selected tier does not clear draft rows', { concurrency: false }, () => {
  resetState();
  Laborer.updateLaborQualityPills();
  findLaborPill('labor-harvest-pill-group', 'T8').onclick();

  const list = getElement('labor-dynamic-list');
  const existing = createElement('draft-row');
  existing.innerHTML = 'draft row';
  list.children = [existing];
  list.rows = [existing];
  Laborer.updateLaborQualityPills();

  findLaborPill('labor-harvest-pill-group', 'T8').onclick();

  assert.equal(list.children.length, 1);
  assert.equal(list.children[0], existing);
});

test('laborer harvest tier switch does not create or dual-write journal state keys', { concurrency: false }, () => {
  resetState();
  state.laborerInventory = {
    '滿日記本': { '6.0': 1 },
    '皮革': { '6.0': 2 }
  };
  const before = JSON.stringify(state.laborerInventory);

  Laborer.updateLaborQualityPills();
  findLaborPill('labor-harvest-pill-group', 'T6').onclick();
  Laborer.updateLaborQualityPills();
  findLaborPill('labor-harvest-pill-group', 'T8').onclick();

  assert.equal(JSON.stringify(state.laborerInventory), before);
  assert.equal(Object.hasOwn(state.laborerInventory, '滿日誌'), false);
});

test('filled journal tier switch does not clear harvest output rows or mutate laborer state', { concurrency: false }, () => {
  resetState();
  state.laborerInventory = {
    '滿日記本': { '8.0': 3 },
    '鋼條': { '8.0': 9 }
  };
  state.laborerLogs = [{ date: '2026-06-26', filled: 1, details: '鋼條(8.0)x9' }];
  const beforeInventory = JSON.stringify(state.laborerInventory);
  const beforeLogs = JSON.stringify(state.laborerLogs);
  const list = getElement('labor-dynamic-list');
  const rowA = createElement('draft-a');
  const rowB = createElement('draft-b');
  list.children = [rowA, rowB];
  list.rows = [rowA, rowB];

  Laborer.updateLaborQualityPills();
  findLaborPill('labor-add-filled-pill-group', 'T7').onclick();

  assert.deepEqual(list.children, [rowA, rowB]);
  assert.equal(JSON.stringify(state.laborerInventory), beforeInventory);
  assert.equal(JSON.stringify(state.laborerLogs), beforeLogs);
});

test('visible laborer journal copy uses 日誌 while runtime key remains 滿日記本', { concurrency: false }, () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const laborerSource = readFileSync(new URL('../src/components/laborer.js', import.meta.url), 'utf8');

  assert.match(html, /日誌階級/);
  assert.match(html, /滿日誌庫存/);
  assert.match(html, /日誌消耗/);
  assert.doesNotMatch(html, /日記本階級/);
  assert.doesNotMatch(html, /滿日記本庫存/);
  assert.doesNotMatch(html, /日記本消耗/);
  assert.match(laborerSource, /state\.laborerInventory\['滿日記本'\]/);
  assert.match(laborerSource, /data-item="滿日記本"/);
});

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

test('purchase without explicit quality is blocked without mutation', { concurrency: false }, () => {
  resetState();
  const before = JSON.stringify(state);

  getElement('buy-item').value = 'NoQualityMaterial';
  getElement('buy-qty').value = '10';
  getElement('buy-total-price').value = '1000';
  getElement('buy-city').value = LOCATION;

  Inventory.submitPurchase();

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.inventory['NoQualityMaterial_4.0'], undefined);
  assert.equal(state.transactions.length, 0);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('purchase after explicit quality selection uses selected quality', { concurrency: false }, () => {
  resetState();
  const item = 'SelectedQualityMaterial';
  const quality = '5.3';
  const key = `${item}_${quality}`;
  state.assets.cash = 5000;
  state.inventory[key] = {
    qtyByCity: qtyByCity(0),
    globalAvgCost: null
  };
  setCurrentBuyQuality(quality);
  getElement('buy-item').value = item;
  getElement('buy-qty').value = '2';
  getElement('buy-total-price').value = '1000';
  getElement('buy-city').value = LOCATION;

  Inventory.submitPurchase();

  assert.equal(state.inventory[key].qtyByCity[LOCATION], 2);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].quality, quality);
  assert.equal(state.inventory[`${item}_4.0`], undefined);
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

test('actual sale unit price updates actual sale total', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-price').value = '540000';
  Inventory.onSellPriceChange('unit');

  assert.equal(getElement('sell-crafted-total').value, '10,800,000');
});

test('actual sale total updates actual sale unit price', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-total').value = '10800000';
  Inventory.onSellPriceChange('total');

  assert.equal(getElement('sell-crafted-price').value, '540,000');
});

test('estimated unit value updates estimated total without setting actual sale price', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-estimate-unit').value = '527000';
  Inventory.onSellEstimatePriceChange('unit');

  assert.equal(getElement('sell-crafted-estimate').value, '10,540,000');
  assert.equal(getElement('sell-crafted-total').value, '');
  assert.equal(getElement('sell-crafted-price').value, '');
});

test('estimated total value updates estimated unit', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-estimate').value = '10540000';
  Inventory.onSellEstimatePriceChange('total');

  assert.equal(getElement('sell-crafted-estimate-unit').value, '527,000');
});

test('sale popup uses game valuation labels', { concurrency: false }, () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

  assert.match(html, /遊戲估價單價/);
  assert.match(html, /Est\. Unit Value/);
  assert.match(html, /遊戲估價總價/);
  assert.match(html, /Est\. Total Value/);
  assert.doesNotMatch(html, /預估市值單價|Estimated Unit Value|預估市值總價|Estimated Total Value/);
});

test('profit summary uses bilingual compact labels', { concurrency: false }, () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

  assert.match(html, /成本狀態 \/ Status/);
  assert.match(html, /成本總額 \/ Total Cost/);
  assert.match(html, /預估毛利 \/ Est\. GP/);
  assert.match(html, /單件毛利 \/ Unit GP/);
  assert.match(html, /毛利率 \/ GP %/);
  assert.match(html, /sale-summary-grid/);
  assert.match(html, /white-space:nowrap/);
});

test('sale confirmation button uses compact label and separate inventory wallet hint', { concurrency: false }, () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

  assert.match(html, /確認完成 \| Confirm/);
  assert.doesNotMatch(html, /確認完成交易 \(更新庫存與錢包\)/);
  assert.match(html, /完成後將同步更新您的庫存與錢包餘額/);
  assert.match(html, /Inventory and wallet balances will be updated\./);
});

test('P2P valuation reference total generates 90% and 85% references without setting actual sale price', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-estimate').value = '10540000';
  Inventory.onSellEstimateChange();

  assert.equal(getElement('sell-bench-90').innerText, '9,486,000');
  assert.equal(getElement('sell-bench-85').innerText, '8,959,000');
  assert.equal(getElement('sell-crafted-total').value, '');
  assert.equal(getElement('sell-crafted-price').value, '');
});

test('sale popup shows cost and profit summary from globalAvgCost', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-total').value = '10800000';
  Inventory.onSellPriceChange('total');

  assert.equal(getElement('sell-cost-status').innerText, '✅');
  assert.equal(getElement('sell-cost-status').title, '成本基準已建立');
  assert.equal(getElement('sell-cost-total').innerText, '9,908,500');
  assert.equal(getElement('sell-profit-total').innerText, '891,500');
  assert.equal(getElement('sell-profit-unit').innerText, '44,575');
  assert.equal(getElement('sell-profit-margin').innerText, '8.25%');
});

test('unknown cost basis shows unknown status without fake numeric profit', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: null
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-total').value = '10800000';
  Inventory.onSellPriceChange('total');

  assert.equal(getElement('sell-cost-status').innerText, '⚠️');
  assert.equal(getElement('sell-cost-status').title, '成本基準未知');
  assert.equal(getElement('sell-cost-total').innerText, '未知');
  assert.equal(getElement('sell-profit-total').innerText, '未知');
  assert.equal(getElement('sell-profit-unit').innerText, '未知');
  assert.equal(getElement('sell-profit-margin').innerText, '未知');
  assert.doesNotMatch(getElement('sell-estimator-result').innerHTML, /NaN|Infinity/);
});

test('fixed tax estimate is no longer primary sale popup display', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-total').value = '10800000';
  Inventory.onSellPriceChange('total');

  const summaryHtml = getElement('sell-estimator-result').innerHTML;
  assert.match(summaryHtml, /sell-cost-total/);
  assert.match(summaryHtml, /sell-profit-total/);
  assert.match(summaryHtml, /sell-profit-margin/);
  assert.doesNotMatch(summaryHtml, /0\.935|10,098,000|tax/i);
});

test('runEstimator no longer contains or renders fixed tax estimate', { concurrency: false }, () => {
  const source = readFileSync(new URL('../src/components/inventory.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /0\.935/);
  assert.doesNotMatch(source, /扣除稅額預估/);
});

test('sale writer remains legacy payload while valuation UI readiness tests are added', { concurrency: false }, () => {
  resetState();
  const item = 'TestProduct';
  const quality = '6.1';
  const key = `${item}_${quality}`;
  state.inventory[key] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 495425
  };

  Inventory.openSellCraftedModal(item, quality, LOCATION);
  getElement('sell-crafted-qty').value = '20';
  getElement('sell-crafted-total').value = '10800000';
  Inventory.submitSellCrafted();

  assert.equal(state.transactions.length, 1);
  assert.deepEqual(state.transactions[0], {
    date: new Date().toISOString().split('T')[0],
    type: '賣成品',
    item,
    quality,
    qty: 20,
    total: 10800000,
    unitPrice: 540000,
    location: LOCATION
  });
  assert.equal(Object.hasOwn(state.transactions[0], 'action'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'cashChange'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'assetValue'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'locationId'), false);
});

test('crafted item sale state transition preserves legacy transaction payload and location-specific inventory', { concurrency: false }, () => {
  resetState();
  state.assets.cash = 100000;
  state.transactions = [
    {
      date: '2026-06-16',
      type: '買材料',
      item: 'TestMaterial',
      quality: '6.1',
      qty: 10,
      total: 50000,
      unitPrice: 5000,
      location: 'Thetford'
    }
  ];

  const key = 'TestProduct_6.1';
  state.inventory[key] = {
    globalAvgCost: 12000,
    qtyByCity: {
      Thetford: 5,
      Martlock: 2
    }
  };

  Inventory.openSellCraftedModal('TestProduct', '6.1', 'Thetford');
  getElement('sell-crafted-qty').value = '3';
  getElement('sell-crafted-total').value = '90000';
  Inventory.submitSellCrafted();

  assert.equal(state.inventory[key].qtyByCity.Thetford, 2);
  assert.equal(state.inventory[key].qtyByCity.Martlock, 2);
  assert.equal(state.assets.cash, 190000);
  assert.equal(state.inventory[key].globalAvgCost, 12000);

  assert.equal(state.transactions.length, 2);
  assert.equal(state.transactions[0].type, '賣成品');
  assert.equal(state.transactions[0].item, 'TestProduct');
  assert.equal(state.transactions[0].quality, '6.1');
  assert.equal(state.transactions[0].qty, 3);
  assert.equal(state.transactions[0].total, 90000);
  assert.equal(state.transactions[0].unitPrice, 30000);
  assert.equal(state.transactions[0].location, 'Thetford');

  assert.equal(Object.hasOwn(state.transactions[0], 'action'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'cashChange'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'assetValue'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'locationId'), false);

  assert.equal(state.transactions[1].type, '買材料');
});

test('crafted item sale with invalid total is blocked without mutating state', { concurrency: false }, () => {
  resetState();
  state.assets.cash = 100000;
  state.transactions = [
    {
      date: '2026-06-16',
      type: '買材料',
      item: 'TestMaterial',
      quality: '6.1',
      qty: 10,
      total: 50000,
      unitPrice: 5000,
      location: 'Thetford'
    }
  ];

  const key = 'TestProduct_6.1';
  state.inventory[key] = {
    globalAvgCost: 12000,
    qtyByCity: {
      Thetford: 5,
      Martlock: 2
    }
  };

  const beforeInventory = JSON.stringify(state.inventory);
  const beforeCash = state.assets.cash;
  const beforeTransactions = JSON.stringify(state.transactions);

  Inventory.openSellCraftedModal('TestProduct', '6.1', 'Thetford');
  getElement('sell-crafted-qty').value = '3';
  getElement('sell-crafted-total').value = '0';
  Inventory.submitSellCrafted();

  assert.equal(JSON.stringify(state.inventory), beforeInventory);
  assert.equal(state.assets.cash, beforeCash);
  assert.equal(JSON.stringify(state.transactions), beforeTransactions);
  assert.equal(state.inventory[key].globalAvgCost, 12000);
  assert.equal(state.inventory[key].qtyByCity.Thetford, 5);
  assert.equal(state.inventory[key].qtyByCity.Martlock, 2);

  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, '買材料');
  assert.equal(state.transactions.some(t => t.type === '賣成品'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'action'), false);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('crafted item sale with insufficient selected-location inventory is blocked without mutating state', { concurrency: false }, () => {
  resetState();
  state.assets.cash = 100000;
  state.transactions = [
    {
      date: '2026-06-16',
      type: '買材料',
      item: 'TestMaterial',
      quality: '6.1',
      qty: 10,
      total: 50000,
      unitPrice: 5000,
      location: 'Thetford'
    }
  ];

  const key = 'TestProduct_6.1';
  state.inventory[key] = {
    globalAvgCost: 12000,
    qtyByCity: {
      Thetford: 2,
      Martlock: 10
    }
  };

  const beforeInventory = JSON.stringify(state.inventory);
  const beforeCash = state.assets.cash;
  const beforeTransactions = JSON.stringify(state.transactions);

  Inventory.openSellCraftedModal('TestProduct', '6.1', 'Thetford');
  getElement('sell-crafted-qty').value = '3';
  getElement('sell-crafted-total').value = '90000';
  Inventory.submitSellCrafted();

  assert.equal(JSON.stringify(state.inventory), beforeInventory);
  assert.equal(state.assets.cash, beforeCash);
  assert.equal(JSON.stringify(state.transactions), beforeTransactions);
  assert.equal(state.inventory[key].globalAvgCost, 12000);
  assert.equal(state.inventory[key].qtyByCity.Thetford, 2);
  assert.equal(state.inventory[key].qtyByCity.Martlock, 10);

  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, '買材料');
  assert.equal(state.transactions.some(t => t.type === '賣成品'), false);
  assert.equal(state.transactions.some(t => t.action === 'SELL_ITEM'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'action'), false);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('crafted item sale with negative quantity is blocked without mutating state', { concurrency: false }, () => {
  resetState();
  state.assets.cash = 100000;
  state.transactions = [
    {
      date: '2026-06-16',
      type: '買材料',
      item: 'TestMaterial',
      quality: '6.1',
      qty: 10,
      total: 50000,
      unitPrice: 5000,
      location: 'Thetford'
    }
  ];

  const key = 'TestProduct_6.1';
  state.inventory[key] = {
    globalAvgCost: 12000,
    qtyByCity: {
      Thetford: 5,
      Martlock: 2
    }
  };

  const beforeInventory = JSON.stringify(state.inventory);
  const beforeCash = state.assets.cash;
  const beforeTransactions = JSON.stringify(state.transactions);

  Inventory.openSellCraftedModal('TestProduct', '6.1', 'Thetford');
  getElement('sell-crafted-qty').value = '-3';
  getElement('sell-crafted-total').value = '90000';
  Inventory.submitSellCrafted();

  assert.equal(JSON.stringify(state.inventory), beforeInventory);
  assert.equal(state.assets.cash, beforeCash);
  assert.equal(JSON.stringify(state.transactions), beforeTransactions);
  assert.equal(state.inventory[key].globalAvgCost, 12000);
  assert.equal(state.inventory[key].qtyByCity.Thetford, 5);
  assert.equal(state.inventory[key].qtyByCity.Martlock, 2);

  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, '買材料');
  assert.equal(state.transactions.some(t => t.type === '賣成品'), false);
  assert.equal(state.transactions.some(t => t.action === 'SELL_ITEM'), false);
  assert.equal(Object.hasOwn(state.transactions[0], 'action'), false);
  assert.equal(toasts.at(-1)?.type, 'error');
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

test('laborer stock sale success preserves legacy payload, insertion order, and unrelated inventory', { concurrency: false }, () => {
  resetState();
  state.assets.cash = 100000;
  const existingTransaction = {
    date: '2026-06-17',
    type: '買材料',
    item: 'TestMaterial',
    quality: '6.1',
    qty: 10,
    total: 50000,
    unitPrice: 5000,
    location: 'Thetford'
  };
  state.transactions = [existingTransaction];
  state.laborerInventory = {
    METALBAR: {
      '6.1': 10,
      '6.2': 3
    },
    CLOTH: {
      '6.1': 8
    },
    '滿日記本': {
      '6.0': 2
    }
  };
  const beforeJournal = JSON.stringify(state.laborerInventory['滿日記本']);

  Laborer.openSellLaborStockModal('METALBAR', '6.1', 10);
  getElement('sell-qty').value = '4';
  getElement('sell-price').value = '40000';
  Laborer.submitSellLaborStock();

  assert.equal(state.laborerInventory.METALBAR['6.1'], 6);
  assert.equal(state.laborerInventory.METALBAR['6.2'], 3);
  assert.equal(state.laborerInventory.CLOTH['6.1'], 8);
  assert.equal(JSON.stringify(state.laborerInventory['滿日記本']), beforeJournal);
  assert.equal(state.assets.cash, 140000);

  assert.equal(state.transactions.length, 2);
  assert.deepEqual(state.transactions[0], {
    date: new Date().toISOString().split('T')[0],
    type: '工人島出售',
    item: 'METALBAR',
    quality: '6.1',
    qty: 4,
    total: 40000,
    unitPrice: 10000,
    location: 'LaborerIsland'
  });
  assert.equal(Object.hasOwn(state.transactions[0], 'action'), false);
  assert.equal(state.transactions[1], existingTransaction);
  assert.equal(toasts.at(-1)?.type, 'success');
});

test('transaction reader boundary: reads current legacy type 工人島出售 laborer sale transaction without mutating payload', { concurrency: false }, () => {
  const transaction = {
    date: '2026-06-18',
    type: '工人島出售',
    item: '布料',
    quality: '6.1',
    qty: 5,
    total: 50000,
    unitPrice: 10000,
    location: '工人島'
  };
  const before = JSON.stringify(transaction);

  const entry = readTransaction(transaction);

  assert.equal(JSON.stringify(transaction), before);
  assert.equal(Object.hasOwn(transaction, 'action'), false);
  assert.equal(entry.sourceFormat, 'legacy');
  assert.equal(entry.displayType, '工人島出售');
  assert.equal(entry.itemRef, '布料');
  assert.equal(entry.quantity, 5);
  assert.equal(entry.cashImpact, 50000);
  assert.equal(entry.locationRef, '工人島');
  assert.equal(entry.raw, transaction);
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

test('laborer render table includes leather with general resource actions', { concurrency: false }, () => {
  resetState();
  state.laborerInventory = {
    '鋼條': { '6.1': 10 },
    '布料': { '6.1': 20 },
    '板材': { '6.1': 30 },
    '皮革': { '6.1': 40 },
    '滿日記本': { '6.0': 1 }
  };
  const before = JSON.stringify(state.laborerInventory);

  Laborer.renderLaborerTable();

  assert.equal(JSON.stringify(state.laborerInventory), before);
  const renderedGoodsText = getElement('labor-tbody').rows
    .map(row => row.innerHTML)
    .join('\n');

  for (const item of ['鋼條', '布料', '板材', '皮革']) {
    assert.match(renderedGoodsText, new RegExp(`<strong>${item}</strong>`));
    assert.match(renderedGoodsText, new RegExp(`data-action="edit-labor" data-item="${item}"`));
    assert.match(renderedGoodsText, new RegExp(`data-action="import-labor" data-item="${item}"`));
    assert.match(renderedGoodsText, new RegExp(`data-action="sell-labor" data-item="${item}"`));
  }
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
    actualMainQty: 4,
    subKey,
    subQty: 2,
    actualSubQty: 2,
    tax: 100,
    artifactPrice: 0,
    artifactQty: 1,
    alchemyName: null
  });
  setGlobalShopFeeForTax(craftingQueue[0].recipe, craftingQueue[0].qty, quality, 100);

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
    actualMainQty: 4,
    subKey,
    subQty: 2,
    actualSubQty: 2,
    tax: 100,
    artifactPrice: 0,
    artifactQty: 1,
    alchemyName: null
  });
  setGlobalShopFeeForTax(craftingQueue[0].recipe, craftingQueue[0].qty, quality, 100);

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
    actualMainQty: 4,
    subKey,
    subQty: 2,
    actualSubQty: 2,
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
    actualMainQty: 4,
    subKey,
    subQty: 2,
    actualSubQty: 2,
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

test('artifact equipment crafting fee multiplies artifact item value by quantity', { concurrency: false }, () => {
  const recipe = Crafting.RECIPES.find(item => item.name === '審判者護甲');
  const qty = 19;
  const quality = '5.3';
  const shopFee = 690;
  const expected = Math.round(((16 * Math.pow(2, 5 + 3) * qty) + (448 * Math.pow(2, 5 - 4) * qty)) * TAX_RATE * shopFee);
  const oldBugValue = Math.round(((16 * Math.pow(2, 5 + 3) * qty) + (448 * Math.pow(2, 5 - 4))) * TAX_RATE * shopFee);

  assert.equal(recipe.name, '審判者護甲');
  assert.equal(recipe.artifactVal, 448);
  assert.equal(recipe.artifactQty, 1);
  assert.equal(Crafting.calculateCraftingFee(recipe, qty, quality, shopFee), expected);
  assert.notEqual(Crafting.calculateCraftingFee(recipe, qty, quality, shopFee), oldBugValue);
  assert.equal(oldBugValue, 61106);
});

test('submitCraftAll includes artifactPrice in crafted item globalAvgCost and transaction total', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.name === '審判者護甲');
  const quality = '5.3';
  const qty = 19;
  const city = 'Bridgewatch';
  const mainKey = '鋼條_5.3';
  const outputKey = '審判者護甲_5.3';
  const materialQty = 160;
  const materialCost = materialQty * 34980;
  const artifactCost = 200000 * qty;
  const expectedTax = Crafting.calculateCraftingFee(recipe, qty, quality, 690);
  const expectedTotal = materialCost + artifactCost + expectedTax;
  const startingCash = 20000000;

  state.assets.cash = startingCash;
  state.inventory[mainKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 170 },
    globalAvgCost: 34980
  };
  state.inventory[outputKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 0 },
    globalAvgCost: null
  };
  getElement('global-shopfee').value = '690';
  craftingQueue.push({
    id: 9001,
    checked: true,
    recipe,
    qty,
    quality,
    city,
    focus: true,
    mainKey,
    mainQty: materialQty,
    actualMainQty: materialQty,
    subKey: '_5.3',
    subQty: 0,
    actualSubQty: 0,
    tax: 0,
    artifactPrice: 200000,
    artifactQty: 1,
    alchemyName: null
  });

  Crafting.submitCraftAll();

  assert.equal(state.inventory[outputKey].globalAvgCost, Math.round(expectedTotal / qty));
  assert.ok(state.inventory[outputKey].globalAvgCost > 295943);
  assert.equal(state.transactions[0].total, expectedTotal);
  assert.equal(state.transactions[0].unitPrice, Math.round(expectedTotal / qty));
  assert.equal(startingCash - state.assets.cash, expectedTax + artifactCost);
});

test('submitCraftAll recalculates tax from current global-shopfee before commit', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.name === '審判者護甲');
  const quality = '5.3';
  const qty = 1;
  const city = 'Bridgewatch';
  const mainKey = '鋼條_5.3';
  const outputKey = '審判者護甲_5.3';
  const oldTax = Crafting.calculateCraftingFee(recipe, qty, quality, 100);
  const newTax = Crafting.calculateCraftingFee(recipe, qty, quality, 690);
  const materialCost = 16 * 34980;
  const startingCash = 5000000;

  state.assets.cash = startingCash;
  state.inventory[mainKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 16 },
    globalAvgCost: 34980
  };
  state.inventory[outputKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 0 },
    globalAvgCost: null
  };
  craftingQueue.push({
    id: 9002,
    checked: true,
    recipe,
    qty,
    quality,
    city,
    focus: true,
    mainKey,
    mainQty: 16,
    actualMainQty: 16,
    subKey: '_5.3',
    subQty: 0,
    actualSubQty: 0,
    tax: oldTax,
    artifactPrice: 0,
    artifactQty: 1,
    alchemyName: null
  });
  getElement('global-shopfee').value = '690';

  Crafting.submitCraftAll();

  assert.notEqual(oldTax, newTax);
  assert.equal(state.transactions[0].total, materialCost + newTax);
  assert.equal(startingCash - state.assets.cash, newTax);
});

test('material consumption helper distinguishes expected consumption, conservative consumption, and safe start stock', { concurrency: false }, () => {
  const result = Crafting.calculateMaterialConsumption(16, 20, 0.479);

  assert.equal(result.expectedNetConsumption, 167);
  assert.equal(result.conservativeNetConsumption, 180);
  assert.equal(result.safeStartStock, 187);
  assert.notEqual(result.expectedNetConsumption, result.safeStartStock);
});

test('single row aggregated safe-start stock equals existing single-row safe-start', { concurrency: false }, () => {
  const result = Crafting.calculateMaterialConsumption(16, 20, 0.479);
  const planning = Crafting.calculateAggregatedMaterialPlanning([{
    checked: true,
    city: LOCATION,
    mainKey: 'Steel_5.3',
    qty: 20,
    recipe: {
      mainBaseQty: 16,
      subBaseQty: 0
    }
  }], () => 0.479);

  assert.equal(result.conservativeNetConsumption, 180);
  assert.equal(result.safeStartStock, 187);
  assert.deepEqual(planning[`${LOCATION}|Steel_5.3`], {
    expected: result.expectedNetConsumption,
    conservative: result.conservativeNetConsumption,
    safeStart: result.safeStartStock
  });
});

function makePlanningRow(overrides = {}) {
  return {
    checked: true,
    city: LOCATION,
    mainKey: 'Steel_5.3',
    subKey: '_5.3',
    qty: 10,
    actualMainQty: '',
    actualSubQty: 0,
    recipe: {
      name: 'PlanningProduct',
      main: 'Steel',
      sub: '',
      mainBaseQty: 16,
      subBaseQty: 0,
      category: 'planning'
    },
    ...overrides
  };
}

test('aggregated safe-start stock groups same material as sum(row conservative consumption) plus max(per-craft min return)', { concurrency: false }, () => {
  const rows = [
    makePlanningRow({ qty: 10, recipe: { mainBaseQty: 16, subBaseQty: 0 } }),
    makePlanningRow({ qty: 5, recipe: { mainBaseQty: 8, subBaseQty: 0 } })
  ];
  const planning = Crafting.calculateAggregatedMaterialPlanning(rows, () => 0.479);
  const rowASafeStart = Crafting.calculateMaterialConsumption(16, 10, 0.479).safeStartStock;
  const rowBSafeStart = Crafting.calculateMaterialConsumption(8, 5, 0.479).safeStartStock;

  assert.deepEqual(planning[`${LOCATION}|Steel_5.3`], {
    expected: 105,
    conservative: 115,
    safeStart: 122
  });
  assert.notEqual(planning[`${LOCATION}|Steel_5.3`].safeStart, rowASafeStart + rowBSafeStart);
});

test('aggregated safe-start stock is independent of crafting queue row order', { concurrency: false }, () => {
  const rowA = makePlanningRow({ qty: 10, recipe: { mainBaseQty: 16, subBaseQty: 0 } });
  const rowB = makePlanningRow({ qty: 5, recipe: { mainBaseQty: 8, subBaseQty: 0 } });

  assert.deepEqual(
    Crafting.calculateAggregatedMaterialPlanning([rowA, rowB], () => 0.479),
    Crafting.calculateAggregatedMaterialPlanning([rowB, rowA], () => 0.479)
  );
});

test('aggregated safe-start stock keeps different material keys and cities in separate planning groups', { concurrency: false }, () => {
  const planning = Crafting.calculateAggregatedMaterialPlanning([
    makePlanningRow({ city: LOCATION, mainKey: 'Steel_5.3' }),
    makePlanningRow({ city: 'Bridgewatch', mainKey: 'Steel_5.3' }),
    makePlanningRow({ city: LOCATION, mainKey: 'Cloth_5.3' })
  ], () => 0.479);

  assert.deepEqual(Object.keys(planning).sort(), [
    `${LOCATION}|Cloth_5.3`,
    `${LOCATION}|Steel_5.3`,
    'Bridgewatch|Steel_5.3'
  ].sort());
});

test('aggregated safe-start stock ignores unchecked and invalid quantity queue rows', { concurrency: false }, () => {
  const valid = makePlanningRow({ qty: 1 });
  const planning = Crafting.calculateAggregatedMaterialPlanning([
    valid,
    makePlanningRow({ checked: false, qty: 10 }),
    makePlanningRow({ qty: 0 }),
    makePlanningRow({ qty: -1 }),
    makePlanningRow({ qty: Number.NaN })
  ], () => 0.479);
  const expected = Crafting.calculateMaterialConsumption(16, 1, 0.479);

  assert.deepEqual(planning, {
    [`${LOCATION}|Steel_5.3`]: {
      expected: expected.expectedNetConsumption,
      conservative: expected.conservativeNetConsumption,
      safeStart: expected.safeStartStock
    }
  });
});

test('aggregated safe-start stock ignores actual material consumed inputs and remains planning-only', { concurrency: false }, () => {
  const baseRows = [
    makePlanningRow({ qty: 10, actualMainQty: '' }),
    makePlanningRow({ qty: 5, actualMainQty: '' })
  ];
  const actualRows = [
    makePlanningRow({ qty: 10, actualMainQty: 1 }),
    makePlanningRow({ qty: 5, actualMainQty: 999 })
  ];

  assert.deepEqual(
    Crafting.calculateAggregatedMaterialPlanning(baseRows, () => 0.479),
    Crafting.calculateAggregatedMaterialPlanning(actualRows, () => 0.479)
  );
});

test('aggregated material planning includes sub material groups with sub base quantities', { concurrency: false }, () => {
  const planning = Crafting.calculateAggregatedMaterialPlanning([
    makePlanningRow({
      mainKey: 'Main_5.3',
      subKey: 'Sub_5.3',
      qty: 5,
      recipe: {
        mainBaseQty: 16,
        subBaseQty: 8
      }
    })
  ], () => 0.479);

  assert.deepEqual(planning[`${LOCATION}|Main_5.3`], {
    expected: 42,
    conservative: 45,
    safeStart: 52
  });
  assert.deepEqual(planning[`${LOCATION}|Sub_5.3`], {
    expected: 21,
    conservative: 25,
    safeStart: 28
  });
});

test('crafting without explicit quality is blocked before queue mutation', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.artifactVal === 448 && item.mainBaseQty === 16);
  const beforeQueueLength = craftingQueue.length;

  getElement('craft-recipe').value = recipe.name;
  getElement('craft-qty').value = '20';
  getElement('craft-city').value = 'Bridgewatch';
  getElement('craft-focus').checked = true;

  Crafting.addToCraftingQueue();

  assert.equal(craftingQueue.length, beforeQueueLength);
  assert.equal(craftingQueue.some(item => item.quality === '4.0'), false);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('crafting calculator does not throw when quality is unselected', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.artifactVal === 448 && item.mainBaseQty === 16);

  getElement('craft-recipe').value = recipe.name;
  getElement('craft-qty').value = '20';
  getElement('craft-city').value = 'Bridgewatch';
  getElement('craft-focus').checked = true;

  assert.doesNotThrow(() => Crafting.runCraftingCalculator());
  assert.equal(craftingQueue.length, 0);
});

test('crafting after explicit quality selection uses selected quality and blank actual consumed input', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.artifactVal === 448 && item.mainBaseQty === 16);

  setCurrentCraftQuality('5.3');
  getElement('craft-recipe').value = recipe.name;
  getElement('craft-qty').value = '20';
  getElement('craft-city').value = 'Bridgewatch';
  getElement('craft-focus').checked = true;

  Crafting.addToCraftingQueue();

  assert.equal(craftingQueue.length, 1);
  assert.equal(craftingQueue[0].quality, '5.3');
  assert.match(craftingQueue[0].mainKey, /_5\.3$/);
  assert.equal(craftingQueue[0].mainQty, 167);
  assert.equal(craftingQueue[0].actualMainQty, '');
  assert.equal(craftingQueue[0].actualSubQty, 0);

  const rowHtml = getElement('crafting-queue-tbody').rows[0].innerHTML;
  assert.match(rowHtml, /placeholder="實際消耗（必填）"/);
  assert.match(rowHtml, /queue-actual-main-qty[^>]*value=""/);
  assert.doesNotMatch(rowHtml, /queue-actual-main-qty[^>]*value="167"/);
});

test('queue material display uses full expected consumption and safe start stock labels', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.name === '審判者護甲');
  const qty = 20;
  const quality = '5.3';
  const city = 'Bridgewatch';
  const consumption = Crafting.calculateMaterialConsumption(recipe.mainBaseQty, qty, 0.479);

  craftingQueue.push({
    id: 9201,
    checked: true,
    recipe,
    qty,
    quality,
    city,
    focus: true,
    mainKey: '鋼條_5.3',
    mainQty: consumption.expectedNetConsumption,
    actualMainQty: '',
    subKey: '_5.3',
    subQty: 0,
    actualSubQty: 0,
    tax: 0,
    artifactPrice: 0,
    artifactQty: 1,
    alchemyName: null
  });

  Crafting.updateShoppingListTotal();

  const materialDisplay = getElement('shopping-list-content').innerHTML;
  assert.match(materialDisplay, /預估消耗/);
  assert.match(materialDisplay, /保守備料/);
  assert.match(materialDisplay, /167/);
  assert.match(materialDisplay, /187/);
  assert.doesNotMatch(materialDisplay, /x 167/);
});

test('submitCraftAll uses actual material consumed for material deduction and crafted cost', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.name === '審判者護甲');
  const quality = '5.3';
  const qty = 19;
  const city = 'Bridgewatch';
  const mainKey = '鋼條_5.3';
  const outputKey = '審判者護甲_5.3';
  const expectedConsumption = Crafting.calculateMaterialConsumption(recipe.mainBaseQty, qty, 0.479).expectedNetConsumption;
  const actualConsumption = 160;
  const materialCost = actualConsumption * 34980;
  const expectedMaterialCost = expectedConsumption * 34980;
  const artifactCost = 200000 * qty;
  const expectedTax = Crafting.calculateCraftingFee(recipe, qty, quality, 690);
  const expectedTotal = materialCost + artifactCost + expectedTax;
  const startingCash = 20000000;

  state.assets.cash = startingCash;
  state.inventory[mainKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 170 },
    globalAvgCost: 34980
  };
  state.inventory[outputKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 0 },
    globalAvgCost: null
  };
  getElement('global-shopfee').value = '690';
  craftingQueue.push({
    id: 9202,
    checked: true,
    recipe,
    qty,
    quality,
    city,
    focus: true,
    mainKey,
    mainQty: expectedConsumption,
    actualMainQty: actualConsumption,
    subKey: '_5.3',
    subQty: 0,
    actualSubQty: 0,
    tax: 0,
    artifactPrice: 200000,
    artifactQty: 1,
    alchemyName: null
  });

  Crafting.submitCraftAll();

  assert.equal(expectedConsumption, 159);
  assert.notEqual(materialCost, expectedMaterialCost);
  assert.equal(state.inventory[mainKey].qtyByCity.Bridgewatch, 10);
  assert.equal(state.transactions[0].total, expectedTotal);
  assert.equal(state.transactions[0].unitPrice, Math.round(expectedTotal / qty));
  assert.equal(state.inventory[outputKey].globalAvgCost, Math.round(expectedTotal / qty));
  assert.equal(startingCash - state.assets.cash, expectedTax + artifactCost);
});

test('blank actual main consumption blocks submit without mutating state', { concurrency: false }, () => {
  resetState();
  const recipe = Crafting.RECIPES.find(item => item.name === '審判者護甲');
  const quality = '5.3';
  const qty = 1;
  const city = 'Bridgewatch';
  const mainKey = '鋼條_5.3';
  const outputKey = '審判者護甲_5.3';
  state.assets.cash = 1000000;
  state.inventory[mainKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 20 },
    globalAvgCost: 34980
  };
  state.inventory[outputKey] = {
    qtyByCity: { ...qtyByCity(0), Bridgewatch: 0 },
    globalAvgCost: null
  };
  craftingQueue.push({
    id: 9203,
    checked: true,
    recipe,
    qty,
    quality,
    city,
    focus: true,
    mainKey,
    mainQty: 8,
    actualMainQty: '',
    subKey: '_5.3',
    subQty: 0,
    actualSubQty: 0,
    tax: 0,
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
  assert.equal(toasts.at(-1)?.type, 'error');
  assert.match(toasts.at(-1)?.message || '', /實際消耗|非負整數/);
});

test('blank actual sub consumption blocks submit without mutating state', { concurrency: false }, () => {
  resetState();
  const recipe = {
    name: 'SubActualProduct',
    main: 'MainMaterial',
    sub: 'SubMaterial',
    mainBaseQty: 2,
    subBaseQty: 1,
    category: 'cloth',
    artifactVal: 0
  };
  const quality = '4.0';
  const qty = 2;
  const city = LOCATION;
  const mainKey = 'MainMaterial_4.0';
  const subKey = 'SubMaterial_4.0';
  const outputKey = 'SubActualProduct_4.0';

  state.assets.cash = 1000000;
  state.inventory[mainKey] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 100
  };
  state.inventory[subKey] = {
    qtyByCity: qtyByCity(20),
    globalAvgCost: 50
  };
  state.inventory[outputKey] = {
    qtyByCity: qtyByCity(0),
    globalAvgCost: null
  };
  craftingQueue.push({
    id: 9204,
    checked: true,
    recipe,
    qty,
    quality,
    city,
    focus: false,
    mainKey,
    mainQty: 4,
    actualMainQty: 4,
    subKey,
    subQty: 2,
    actualSubQty: '',
    tax: 0,
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
  assert.equal(toasts.at(-1)?.type, 'error');
  assert.match(toasts.at(-1)?.message || '', /SubMaterial|實際消耗|非負整數/);
});

test('checked queue display separates shop fee, artifact cost, alchemy cost, and cash total without material cost', { concurrency: false }, () => {
  resetState();
  const recipe = {
    name: 'CashDisplayProduct',
    main: 'DisplayMaterial',
    sub: '',
    mainBaseQty: 1,
    subBaseQty: 0,
    artifactVal: 0
  };
  const qty = 3;
  const quality = '4.0';
  const shopFee = 690;
  const expectedShopFee = Crafting.calculateCraftingFee(recipe, qty, quality, shopFee);
  const expectedArtifactCost = 200 * 2 * qty;
  const expectedAlchemyCost = 50 * 4 * qty;
  const expectedCashCost = expectedShopFee + expectedArtifactCost + expectedAlchemyCost;
  const materialCostThatMustNotAppear = 999 * 9999;

  getElement('global-shopfee').value = String(shopFee);
  craftingQueue.push({
    id: 9101,
    checked: true,
    recipe,
    qty,
    quality,
    city: LOCATION,
    mainKey: 'DisplayMaterial_4.0',
    mainQty: 999,
    actualMainQty: 999,
    subKey: '_4.0',
    subQty: 0,
    actualSubQty: 0,
    tax: 0,
    artifactPrice: 200,
    artifactQty: 2,
    alchemyName: 'Test Alchemy',
    alchemyTier: 'T3',
    alchemyBaseQty: 4,
    alchemyPrice: 50
  });

  Crafting.updateShoppingListTotal();

  const materialDisplay = getElement('shopping-list-content').innerHTML;
  const cashDisplay = getElement('queue-total-cost').innerHTML;
  assert.match(materialDisplay, /T3/);
  assert.match(materialDisplay, /Test Alchemy/);
  assert.match(materialDisplay, /12/);
  assert.match(cashDisplay, /店鋪使用費/);
  assert.match(cashDisplay, /Shop Fee/);
  assert.match(cashDisplay, /神器成本/);
  assert.match(cashDisplay, /Artifact Cost/);
  assert.match(cashDisplay, /鍊金成本/);
  assert.match(cashDisplay, /Alchemy Cost/);
  assert.match(cashDisplay, /本次製作現金支出/);
  assert.match(cashDisplay, /Craft Cash Cost/);
  assert.match(cashDisplay, /justify-content:space-between/);
  assert.match(cashDisplay, /font-size:0\.85rem/);
  assert.match(cashDisplay, /font-weight:700/);
  assert.doesNotMatch(cashDisplay, /text-align:center/);
  assert.match(cashDisplay, new RegExp(formatForRegex(expectedShopFee)));
  assert.match(cashDisplay, new RegExp(formatForRegex(expectedArtifactCost)));
  assert.match(cashDisplay, new RegExp(formatForRegex(expectedAlchemyCost)));
  assert.match(cashDisplay, new RegExp(formatForRegex(expectedCashCost)));
  assert.doesNotMatch(cashDisplay, new RegExp(formatForRegex(materialCostThatMustNotAppear)));
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
