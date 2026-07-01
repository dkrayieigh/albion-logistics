import test from 'node:test';
import assert from 'node:assert/strict';

import { applyInventoryTransfer } from '../src/services/inventoryTransferService.js';

function makeItem() {
  return {
    qtyByCity: {
      Thetford: 10,
      Bridgewatch: 3,
      Martlock: 2
    },
    globalAvgCost: 12000,
    metadata: { keep: true }
  };
}

function totalQty(qtyByCity) {
  return Object.values(qtyByCity).reduce((sum, qty) => sum + qty, 0);
}

test('moves quantity between qtyByCity buckets without mutating the input item', () => {
  const item = makeItem();
  const originalQtyByCity = item.qtyByCity;
  const before = JSON.stringify(item);

  const result = applyInventoryTransfer({
    item,
    quantity: 4,
    fromLocation: 'Thetford',
    toLocation: 'Bridgewatch'
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'transferred');
  assert.deepEqual(result.errors, []);
  assert.notEqual(result.item, item);
  assert.notEqual(result.item.qtyByCity, originalQtyByCity);
  assert.equal(result.item.qtyByCity.Thetford, 6);
  assert.equal(result.item.qtyByCity.Bridgewatch, 7);
  assert.equal(result.item.qtyByCity.Martlock, 2);
  assert.equal(totalQty(result.item.qtyByCity), 15);
  assert.equal(result.item.globalAvgCost, 12000);
  assert.equal(result.item.metadata, item.metadata);
  assert.equal(JSON.stringify(item), before);
});

test('supports custom display-name location keys without location migration fields', () => {
  const item = {
    qtyByCity: {
      Thetford: 10,
      '公會T8地堡': 2
    },
    globalAvgCost: 12000
  };

  const result = applyInventoryTransfer({
    item,
    quantity: 4,
    fromLocation: 'Thetford',
    toLocation: '公會T8地堡'
  });

  assert.equal(result.ok, true);
  assert.equal(result.item.qtyByCity.Thetford, 6);
  assert.equal(result.item.qtyByCity['公會T8地堡'], 6);
  assert.equal(Object.hasOwn(result.item, 'qtyByLocation'), false);
  assert.equal(Object.hasOwn(result.item, 'locationId'), false);
  assert.equal(Object.hasOwn(result.item, 'locationRegistry'), false);
});

test('rejects zero quantity without mutating the item', () => {
  const item = makeItem();
  const before = JSON.stringify(item);

  const result = applyInventoryTransfer({
    item,
    quantity: 0,
    fromLocation: 'Thetford',
    toLocation: 'Bridgewatch'
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-transfer');
  assert.equal(result.item, item);
  assert.deepEqual(result.errors, ['INVALID_QUANTITY']);
  assert.equal(JSON.stringify(item), before);
});

test('rejects negative quantity without mutating the item', () => {
  const item = makeItem();
  const before = JSON.stringify(item);

  const result = applyInventoryTransfer({
    item,
    quantity: -4,
    fromLocation: 'Thetford',
    toLocation: 'Bridgewatch'
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-transfer');
  assert.equal(result.item, item);
  assert.deepEqual(result.errors, ['INVALID_QUANTITY']);
  assert.equal(JSON.stringify(item), before);
});

test('rejects same source and destination without mutating the item', () => {
  const item = makeItem();
  const before = JSON.stringify(item);

  const result = applyInventoryTransfer({
    item,
    quantity: 4,
    fromLocation: 'Thetford',
    toLocation: 'Thetford'
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-transfer');
  assert.equal(result.item, item);
  assert.deepEqual(result.errors, ['SAME_LOCATION']);
  assert.equal(JSON.stringify(item), before);
});

test('rejects a missing item without throwing', () => {
  const result = applyInventoryTransfer({
    item: null,
    quantity: 4,
    fromLocation: 'Thetford',
    toLocation: 'Bridgewatch'
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-transfer');
  assert.equal(result.item, null);
  assert.deepEqual(result.errors, ['ITEM_NOT_FOUND']);
});

test('rejects insufficient selected source quantity without borrowing from other locations', () => {
  const item = {
    qtyByCity: {
      Thetford: 2,
      Bridgewatch: 20
    },
    globalAvgCost: 12000
  };
  const before = JSON.stringify(item);

  const result = applyInventoryTransfer({
    item,
    quantity: 4,
    fromLocation: 'Thetford',
    toLocation: 'Bridgewatch'
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-transfer');
  assert.equal(result.item, item);
  assert.deepEqual(result.errors, ['INSUFFICIENT_SOURCE_QUANTITY']);
  assert.equal(JSON.stringify(item), before);
});

test('returns invalid quantity before same location when both are invalid', () => {
  const item = makeItem();

  const result = applyInventoryTransfer({
    item,
    quantity: -1,
    fromLocation: 'Thetford',
    toLocation: 'Thetford'
  });

  assert.deepEqual(result.errors, ['INVALID_QUANTITY']);
});

test('returns same location before missing item when both are invalid', () => {
  const result = applyInventoryTransfer({
    item: null,
    quantity: 1,
    fromLocation: 'Thetford',
    toLocation: 'Thetford'
  });

  assert.deepEqual(result.errors, ['SAME_LOCATION']);
});
