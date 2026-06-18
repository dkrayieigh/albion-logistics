import test from 'node:test';
import assert from 'node:assert/strict';
import { readTransaction } from '../src/adapters/transactionReader.js';

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
let promptResult = null;
let toasts = [];
globalThis.confirm = () => confirmResult;
globalThis.prompt = () => promptResult;
globalThis.window = {
  showToast: (message, type) => toasts.push({ message, type }),
  updateDashboardUI: () => {}
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
  promptResult = null;
  getElement('ledger-tbody').rows = [];
  getElement('ledger-search').value = '';
  getElement('edit-ledger-modal').style.display = 'none';
}

function resetWalletState(cash, debt) {
  resetState(500);
  state.assets = { cash, debt };
  state.transactions = [];
  getElement('wallet-adjust-amt').value = '';
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

test('cash balance adjustment updates cash, preserves debt and inventory, and writes the difference', { concurrency: false }, () => {
  resetWalletState(1000, 0);
  const inventoryBefore = JSON.stringify(state.inventory);
  promptResult = '5000';

  Ledger.adjustCashBalance();

  assert.equal(state.assets.cash, 5000);
  assert.equal(state.assets.debt, 0);
  assert.equal(JSON.stringify(state.inventory), inventoryBefore);
  assert.equal(state.transactions.length, 1);
  assert.deepEqual(state.transactions[0], {
    date: new Date().toISOString().split('T')[0],
    type: '現金流校正',
    item: '-',
    quality: '-',
    qty: 1,
    total: 4000,
    unitPrice: 4000,
    location: '-'
  });
});

test('wallet deposit increases cash and debt without changing inventory', { concurrency: false }, () => {
  resetWalletState(1000, 0);
  const inventoryBefore = JSON.stringify(state.inventory);
  getElement('wallet-adjust-amt').value = '0.003';

  Ledger.adjustWallet('deposit');

  assert.equal(state.assets.cash, 4000);
  assert.equal(state.assets.debt, 3000);
  assert.equal(JSON.stringify(state.inventory), inventoryBefore);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, '注資本金');
  assert.equal(state.transactions[0].total, 3000);
});

test('wallet withdrawal decreases cash and debt without changing inventory', { concurrency: false }, () => {
  resetWalletState(5000, 3000);
  const inventoryBefore = JSON.stringify(state.inventory);
  getElement('wallet-adjust-amt').value = '0.001';

  Ledger.adjustWallet('withdraw');

  assert.equal(state.assets.cash, 4000);
  assert.equal(state.assets.debt, 2000);
  assert.equal(JSON.stringify(state.inventory), inventoryBefore);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].type, '提領利潤');
  assert.equal(state.transactions[0].total, 1000);
});

test('wallet adjustment with zero amount is blocked without state changes', { concurrency: false }, () => {
  resetWalletState(1000, 0);
  getElement('wallet-adjust-amt').value = '0';
  const before = JSON.stringify(state);

  Ledger.adjustWallet('deposit');

  assert.equal(JSON.stringify(state), before);
  assert.equal(toasts.at(-1)?.type, 'error');
});

test('transaction reader canonical sample: future PURCHASE_ITEM payload can be normalized for reader display', { concurrency: false }, () => {
  const transaction = {
    date: '2026-06-18',
    action: 'PURCHASE_ITEM',
    target: '布料',
    itemLevel: '6.1',
    qty: 100,
    cashChange: -600000,
    assetValue: 600000,
    locationId: 'Thetford'
  };
  const before = JSON.stringify(transaction);

  const entry = readTransaction(transaction);

  assert.equal(JSON.stringify(transaction), before);
  assert.equal(Object.hasOwn(transaction, 'type'), false);
  assert.equal(entry.sourceFormat, 'future');
  assert.equal(entry.displayType, 'PURCHASE_ITEM');
  assert.equal(entry.itemRef, '布料');
  assert.equal(entry.quantity, 100);
  assert.equal(entry.cashImpact, -600000);
  assert.equal(entry.locationRef, 'Thetford');
  assert.equal(entry.raw, transaction);
});

test('transaction reader canonical sample: future SELL_ITEM payload is reader-only and does not imply writer migration', { concurrency: false }, () => {
  const transaction = {
    date: '2026-06-18',
    action: 'SELL_ITEM',
    target: 'TestProduct',
    itemLevel: '6.1',
    qty: 3,
    cashChange: 90000,
    assetValue: -36000,
    locationId: 'Thetford'
  };
  const before = JSON.stringify(transaction);

  const entry = readTransaction(transaction);

  assert.equal(JSON.stringify(transaction), before);
  assert.equal(Object.hasOwn(transaction, 'type'), false);
  assert.equal(entry.sourceFormat, 'future');
  assert.equal(entry.displayType, 'SELL_ITEM');
  assert.equal(entry.itemRef, 'TestProduct');
  assert.equal(entry.quantity, 3);
  assert.equal(entry.cashImpact, 90000);
  assert.equal(entry.locationRef, 'Thetford');
  assert.equal(entry.raw, transaction);
});

test('transaction reader canonical sample: mixed legacy and future transactions preserve order and readable entries', { concurrency: false }, () => {
  const transactions = [
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
      action: 'SELL_ITEM',
      target: 'TestProduct',
      itemLevel: '6.1',
      qty: 3,
      cashChange: 90000,
      assetValue: -36000,
      locationId: 'Thetford'
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
  const before = JSON.stringify(transactions);

  const entries = transactions.map(transaction => readTransaction(transaction));

  assert.equal(JSON.stringify(transactions), before);
  assert.equal(entries.length, transactions.length);
  assert.deepEqual(entries.map(entry => entry.sourceFormat), ['legacy', 'legacy', 'future', 'legacy']);
  assert.deepEqual(entries.map(entry => entry.displayType), ['賣成品', '工人島出售', 'SELL_ITEM', 'INVENTORY_ADJUSTMENT']);
  assert.deepEqual(entries.map(entry => entry.raw), transactions);
  assert.deepEqual(entries.map(entry => entry.quantity), [3, 5, 3, -100]);
  assert.deepEqual(entries.map(entry => entry.cashImpact), [90000, 50000, 90000, -600000]);
});

test('adapter/migration red test: future transaction reader adapter tolerates mixed legacy Chinese types and INVENTORY_ADJUSTMENT without mutating input', { concurrency: false }, () => {
  const transactions = [
    {
      date: '2026-06-16',
      type: '買材料',
      item: '布料',
      quality: '6.1',
      qty: 500,
      total: 3000000,
      unitPrice: 6000,
      location: 'Thetford'
    },
    {
      date: '2026-06-16',
      type: '製作入庫',
      item: 'TestProduct',
      quality: '6.1',
      qty: 4,
      total: 20000,
      unitPrice: 5000,
      location: 'Thetford'
    },
    {
      date: '2026-06-16',
      type: '賣成品',
      item: 'TestProduct',
      quality: '6.1',
      qty: 4,
      total: 40000,
      unitPrice: 10000,
      location: 'Thetford'
    },
    {
      date: '2026-06-16',
      type: 'INVENTORY_ADJUSTMENT',
      item: '布料',
      quality: '6.1',
      qty: -500,
      total: -3000000,
      unitPrice: 6000,
      location: 'Thetford',
      details: 'delete reversal sourceSignature=legacy-sample'
    }
  ];
  const before = JSON.stringify(transactions);

  const entries = transactions.map(transaction => readTransaction(transaction));

  assert.equal(JSON.stringify(transactions), before);
  assert.equal(entries.length, transactions.length);
  assert.deepEqual(entries.map(entry => entry.sourceFormat), ['legacy', 'legacy', 'legacy', 'legacy']);
  assert.deepEqual(entries.map(entry => entry.displayType), ['買材料', '製作入庫', '賣成品', 'INVENTORY_ADJUSTMENT']);
  assert.deepEqual(entries.map(entry => entry.raw), transactions);
});

test('adapter/integration red test: ledger render display path accepts normalized transaction reader entries without mutating legacy transactions', { concurrency: false }, () => {
  const transactions = [
    {
      date: '2026-06-17',
      type: '買材料',
      item: '布料',
      quality: '6.1',
      qty: 500,
      total: 3000000,
      unitPrice: 6000,
      location: 'Thetford'
    },
    {
      date: '2026-06-17',
      type: '製作入庫',
      item: 'TestProduct',
      quality: '6.1',
      qty: 4,
      total: 20000,
      unitPrice: 5000,
      location: 'Thetford'
    },
    {
      date: '2026-06-17',
      type: '賣成品',
      item: 'TestProduct',
      quality: '6.1',
      qty: 4,
      total: 40000,
      unitPrice: 10000,
      location: 'Thetford'
    },
    {
      date: '2026-06-17',
      type: 'INVENTORY_ADJUSTMENT',
      item: '布料',
      quality: '6.1',
      qty: -500,
      total: -3000000,
      unitPrice: 6000,
      location: 'Thetford',
      details: 'delete reversal sourceSignature=legacy-sample'
    }
  ];
  const before = JSON.stringify(transactions);
  const entries = transactions.map(transaction => readTransaction(transaction));

  state.transactions = entries;
  getElement('ledger-search').value = '';
  getElement('ledger-tbody').rows = [];

  Ledger.filterLedger();

  assert.equal(JSON.stringify(transactions), before);
  assert.equal(getElement('ledger-tbody').rows.length, 4);
  const renderedText = getElement('ledger-tbody').rows.map(row => row.innerHTML).join('\n');
  assert.match(renderedText, /買材料/);
  assert.match(renderedText, /製作入庫/);
  assert.match(renderedText, /賣成品/);
  assert.match(renderedText, /INVENTORY_ADJUSTMENT/);
});

test('transaction reader boundary: ledger display renders normalized current legacy type 賣成品 crafted sale without mutating payload', { concurrency: false }, () => {
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

  assert.equal(entry.sourceFormat, 'legacy');
  assert.equal(entry.displayType, '賣成品');
  assert.equal(entry.itemRef, 'TestProduct');
  assert.equal(entry.quantity, 3);
  assert.equal(entry.cashImpact, 90000);
  assert.equal(entry.locationRef, 'Thetford');

  state.transactions = [entry];
  getElement('ledger-search').value = '';
  getElement('ledger-tbody').rows = [];

  Ledger.filterLedger();

  assert.equal(JSON.stringify(transaction), before);
  assert.equal(Object.hasOwn(transaction, 'action'), false);
  assert.equal(getElement('ledger-tbody').rows.length, 1);
  const renderedText = getElement('ledger-tbody').rows.map(row => row.innerHTML).join('\n');
  assert.match(renderedText, /data-raw-type="賣成品"/);
  assert.match(renderedText, /賣成品/);
  assert.match(renderedText, /TestProduct/);
  assert.match(renderedText, /6\.1/);
  assert.match(renderedText, /3/);
  assert.match(renderedText, /30,000/);
  assert.match(renderedText, /90,000/);
});

test('transaction reader boundary: ledger display renders normalized current legacy type 工人島出售 laborer sale without mutating payload', { concurrency: false }, () => {
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

  assert.equal(entry.sourceFormat, 'legacy');
  assert.equal(entry.displayType, '工人島出售');
  assert.equal(entry.itemRef, '布料');
  assert.equal(entry.quantity, 5);
  assert.equal(entry.cashImpact, 50000);
  assert.equal(entry.locationRef, '工人島');

  state.transactions = [entry];
  getElement('ledger-search').value = '';
  getElement('ledger-tbody').rows = [];

  Ledger.filterLedger();

  assert.equal(JSON.stringify(transaction), before);
  assert.equal(Object.hasOwn(transaction, 'action'), false);
  assert.equal(getElement('ledger-tbody').rows.length, 1);
  const renderedText = getElement('ledger-tbody').rows.map(row => row.innerHTML).join('\n');
  assert.match(renderedText, /data-raw-type="工人島出售"/);
  assert.match(renderedText, /工人島出售/);
  assert.match(renderedText, /布料/);
  assert.match(renderedText, /6\.1/);
  assert.match(renderedText, /5/);
  assert.match(renderedText, /10,000/);
  assert.match(renderedText, /50,000/);
});
