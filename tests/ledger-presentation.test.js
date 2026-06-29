import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getDistinctLedgerDisplayCategories,
  resolveLedgerCategoryDisplay,
  resolveLedgerItemDisplay
} from '../src/presenters/ledgerDisplay.js';

const elements = new Map();

function createElement(id = '') {
  return {
    id,
    innerHTML: '',
    innerText: '',
    value: '',
    style: {},
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
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  clear: () => {}
};
globalThis.confirm = () => true;
globalThis.window = {
  showToast: () => {},
  updateDashboardUI: () => {}
};

const Ledger = await import('../src/components/ledger.js');
const { state } = await import('../src/core/state.js');
Ledger.initLedgerEvents();

function resetLedger(transactions) {
  state.assets = { cash: 0, debt: 0 };
  state.inventory = {};
  state.transactions = transactions;
  getElement('ledger-search').value = '';
  getElement('ledger-tbody').rows = [];
  getElement('ledger-page-info').innerText = '';
}

test('ledger category display maps legacy and canonical transaction aliases', () => {
  assert.equal(resolveLedgerCategoryDisplay('買材料'), 'Material Purchase');
  assert.equal(resolveLedgerCategoryDisplay('製作入庫'), 'Crafting Output');
  assert.equal(resolveLedgerCategoryDisplay('賣成品'), 'Product Sale');
  assert.equal(resolveLedgerCategoryDisplay('庫存校正'), 'Inventory Adjustment');
  assert.equal(resolveLedgerCategoryDisplay('INVENTORY_ADJUSTMENT'), 'Inventory Adjustment');
  assert.equal(resolveLedgerCategoryDisplay('成本校正'), 'Cost Adjustment');
  assert.equal(resolveLedgerCategoryDisplay('工人島出售'), 'Laborer Output Sale');
  assert.equal(resolveLedgerCategoryDisplay('FUTURE_EVENT'), 'FUTURE_EVENT');
  assert.equal(resolveLedgerCategoryDisplay('未知事件'), 'Unknown Transaction');
});

test('ledger display category aliases deduplicate', () => {
  assert.deepEqual(
    getDistinctLedgerDisplayCategories([
      { type: '庫存校正' },
      { type: 'INVENTORY_ADJUSTMENT' },
      { type: '買材料' }
    ]),
    ['Inventory Adjustment', 'Material Purchase']
  );
});

test('ledger item display resolves materials recipes specials laborer journals and fallbacks', () => {
  assert.equal(resolveLedgerItemDisplay({ item: '鋼條' }), 'Bars');
  assert.equal(resolveLedgerItemDisplay({ item: '板材' }), 'Planks');
  assert.equal(resolveLedgerItemDisplay({ item: '布料' }), 'Cloth');
  assert.equal(resolveLedgerItemDisplay({ item: '皮革' }), 'Leather');
  assert.equal(resolveLedgerItemDisplay({ item: '闊劍' }), 'Broadsword');
  assert.equal(resolveLedgerItemDisplay({ item: 'Broadsword' }), 'Broadsword');
  assert.equal(resolveLedgerItemDisplay({ item: 'Clarent Blade' }), 'Clarent Blade');
  assert.equal(resolveLedgerItemDisplay({ item: '血鑄之刃 Bloodforged Blade' }), 'Bloodforged Blade');
  assert.equal(resolveLedgerItemDisplay({ item: '暗影之爪 Shadow Claws' }), 'Shadow Claws');
  assert.equal(resolveLedgerItemDisplay({ item: '滿日記本' }), 'Full Journal');
  assert.equal(resolveLedgerItemDisplay({ item: '滿日誌' }), 'Full Journal');
  assert.equal(resolveLedgerItemDisplay({ item: 'Already English Item' }), 'Already English Item');
  assert.equal(resolveLedgerItemDisplay({ item: '未知物品' }), 'Unknown Item');
  assert.equal(resolveLedgerItemDisplay({ item: '-' }), '-');
});

test('ledger display resolvers do not mutate transaction objects or import runtime state', () => {
  const transaction = {
    type: '買材料',
    item: '闊劍',
    raw: { type: '買材料', item: '闊劍' }
  };
  const before = JSON.stringify(transaction);
  const source = readFileSync(new URL('../src/presenters/ledgerDisplay.js', import.meta.url), 'utf8');

  assert.equal(resolveLedgerCategoryDisplay(transaction), 'Material Purchase');
  assert.equal(resolveLedgerItemDisplay(transaction), 'Broadsword');
  assert.equal(JSON.stringify(transaction), before);
  assert.doesNotMatch(source, /core\/state|saveState|localStorage|document|window|dispatchEvent/);
});

test('ledger English search matches raw Chinese types aliases and item names', () => {
  resetLedger([
    { date: '2026-06-20', type: '買材料', item: '鋼條', quality: '6.1', qty: 1, total: 100, unitPrice: 100, location: 'Thetford' },
    { date: '2026-06-20', type: '庫存校正', item: '布料', quality: '6.1', qty: 1, total: 0, unitPrice: 0, location: 'Thetford' },
    { date: '2026-06-20', type: 'INVENTORY_ADJUSTMENT', item: '皮革', quality: '6.1', qty: -1, total: 0, unitPrice: 0, location: 'Thetford' },
    { date: '2026-06-20', type: '賣成品', item: '闊劍', quality: '6.1', qty: 1, total: 1000, unitPrice: 1000, location: 'Thetford' }
  ]);

  getElement('ledger-search').value = 'Material Purchase';
  getElement('ledger-tbody').rows = [];
  Ledger.filterLedger();
  assert.equal(getElement('ledger-tbody').rows.length, 1);
  assert.match(getElement('ledger-tbody').rows[0].innerHTML, /Material Purchase/);

  getElement('ledger-search').value = 'Inventory Adjustment';
  getElement('ledger-tbody').rows = [];
  Ledger.filterLedger();
  assert.equal(getElement('ledger-tbody').rows.length, 2);

  getElement('ledger-search').value = 'Broadsword';
  getElement('ledger-tbody').rows = [];
  Ledger.filterLedger();
  assert.equal(getElement('ledger-tbody').rows.length, 1);
  assert.match(getElement('ledger-tbody').rows[0].innerHTML, /Broadsword/);

  getElement('ledger-search').value = '買材料';
  getElement('ledger-tbody').rows = [];
  Ledger.filterLedger();
  assert.equal(getElement('ledger-tbody').rows.length, 1);
});

test('ledger table renders display category item raw-type metadata and compact delete action', () => {
  resetLedger([
    { date: '2026-06-21', type: '買材料', item: '闊劍', quality: '6.1', qty: 2, total: 2000, unitPrice: 1000, location: 'Thetford' },
    { date: '2026-06-21', type: 'INVENTORY_ADJUSTMENT', item: '布料', quality: '6.1', qty: -2, total: -2000, unitPrice: 1000, location: 'Thetford' }
  ]);

  Ledger.filterLedger();

  const purchaseHtml = getElement('ledger-tbody').rows[0].innerHTML;
  const adjustmentHtml = getElement('ledger-tbody').rows[1].innerHTML;
  assert.match(purchaseHtml, /data-raw-type="買材料"/);
  assert.match(purchaseHtml, />Material Purchase<\/span>/);
  assert.doesNotMatch(purchaseHtml, />買材料<\/span>/);
  assert.match(purchaseHtml, /Broadsword \(6\.1\)/);
  assert.match(purchaseHtml, /data-action="delete-purchase-adjustment"/);
  assert.match(purchaseHtml, /title="刪除"/);
  assert.match(purchaseHtml, /aria-label="刪除"/);
  assert.match(purchaseHtml, />×<\/button>/);
  assert.match(adjustmentHtml, /data-raw-type="INVENTORY_ADJUSTMENT"/);
  assert.match(adjustmentHtml, />Inventory Adjustment<\/span>/);
  assert.match(adjustmentHtml, /Cloth \(6\.1\)/);
});
