import test from 'node:test';
import assert from 'node:assert/strict';

const elements = new Map();

function createElement(id = '') {
  return {
    id,
    innerHTML: '',
    innerText: '',
    value: '',
    style: { display: 'none' },
    rows: [],
    handlers: {},
    appendChild(row) {
      this.rows.push(row);
    },
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    }
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

let confirmResult = true;
let toasts = [];
globalThis.confirm = () => confirmResult;
globalThis.window = {
  showToast: (message, type) => toasts.push({ message, type })
};

const Ledger = await import('../src/components/ledger.js');
const { state } = await import('../src/core/state.js');

Ledger.initLedgerEvents();

const ITEM = '布料';
const QUALITY = '6.1';
const LOCATION = 'Thetford';
const INVENTORY_KEY = `${ITEM}_${QUALITY}`;

function createPurchase() {
  return {
    date: '2026-06-15',
    type: '買材料',
    item: ITEM,
    quality: QUALITY,
    qty: 500,
    total: 3000000,
    unitPrice: 6000,
    location: LOCATION
  };
}

function resetState(inventoryQty) {
  state.assets = { cash: 0, debt: 0 };
  state.inventory = {
    [INVENTORY_KEY]: {
      qtyByCity: { [LOCATION]: inventoryQty },
      globalAvgCost: 6000
    }
  };
  state.transactions = [createPurchase()];
  state.laborerInventory = {};
  state.laborerLogs = [];
  state.customLocations = [];
  storage.clear();
  toasts = [];
  confirmResult = true;
  getElement('ledger-tbody').rows = [];
  getElement('ledger-search').value = '';
  getElement('edit-ledger-modal').style.display = 'none';
}

function clickDelete(index) {
  const handler = getElement('ledger-tbody').handlers.click;
  handler({
    target: {
      closest: () => ({
        getAttribute: key => key === 'data-action' ? 'delete-purchase-adjustment' : String(index)
      })
    }
  });
}

test('TEST-B02: purchase deletion creates an adjustment and preserves the original', { concurrency: false }, () => {
  resetState(500);
  const original = state.transactions[0];

  clickDelete(0);

  assert.equal(state.transactions.length, 2);
  assert.ok(state.transactions.includes(original));
  assert.equal(state.transactions[0].type, 'INVENTORY_ADJUSTMENT');
  assert.equal(state.inventory[INVENTORY_KEY].qtyByCity[LOCATION], 0);
  assert.equal(state.assets.cash, 3000000);
  assert.equal(state.inventory[INVENTORY_KEY].globalAvgCost, 6000);
});

test('TEST-B03: insufficient inventory blocks purchase reversal without state changes', { concurrency: false }, () => {
  resetState(200);
  const before = JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions
  });

  clickDelete(0);

  assert.equal(JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions
  }), before);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions.some(transaction => transaction.type === 'INVENTORY_ADJUSTMENT'), false);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('TEST-B07: the same purchase cannot be reversed twice', { concurrency: false }, () => {
  resetState(1200);
  const original = state.transactions[0];

  clickDelete(0);

  assert.equal(state.transactions.length, 2);
  assert.ok(state.transactions.includes(original));
  assert.equal(state.transactions[0].type, 'INVENTORY_ADJUSTMENT');
  assert.match(state.transactions[0].details, /sourceSignature=/);
  assert.equal(state.inventory[INVENTORY_KEY].qtyByCity[LOCATION], 700);
  assert.equal(state.assets.cash, 3000000);
  assert.equal(state.inventory[INVENTORY_KEY].globalAvgCost, 6000);

  getElement('ledger-tbody').rows = [];
  Ledger.filterLedger();
  const purchaseRow = getElement('ledger-tbody').rows.find(row => row.innerHTML.includes('買材料') && row.innerHTML.includes(ITEM));
  assert.ok(purchaseRow);
  assert.equal(purchaseRow.innerHTML.includes('delete-purchase-adjustment'), false);

  const beforeSecondAttempt = JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions
  });
  Ledger.openEditLedgerModal(state.transactions.indexOf(original));
  Ledger.deleteEditLedger();

  assert.equal(JSON.stringify({
    assets: state.assets,
    inventory: state.inventory,
    transactions: state.transactions
  }), beforeSecondAttempt);
  assert.equal(state.transactions.length, 2);
  assert.equal(state.transactions.filter(transaction => transaction.type === 'INVENTORY_ADJUSTMENT').length, 1);
  assert.equal(state.inventory[INVENTORY_KEY].qtyByCity[LOCATION], 700);
  assert.equal(state.assets.cash, 3000000);
  assert.equal(state.inventory[INVENTORY_KEY].globalAvgCost, 6000);
  assert.equal(toasts.at(-1)?.type, 'error');
});
