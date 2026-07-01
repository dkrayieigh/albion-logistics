import test from 'node:test';
import assert from 'node:assert/strict';

import * as specialMaterialInventoryService from '../src/services/specialMaterialInventoryService.js';
import {
  applySpecialMaterialPurchase,
  applySpecialMaterialConsumption
} from '../src/services/specialMaterialInventoryService.js';

function artifactIdentity(overrides = {}) {
  return {
    stableId: 'artifact-rune-t4',
    category: 'artifact',
    tier: 4,
    displayName: 'Adept Rune',
    ...overrides
  };
}

function alchemyIdentity(overrides = {}) {
  return {
    stableId: 'alchemy-relic-t6',
    category: 'alchemy',
    tier: 6,
    displayName: 'Grandmaster Relic',
    ...overrides
  };
}

function entry(overrides = {}) {
  return {
    identity: artifactIdentity(),
    totalQty: 10,
    globalAvgCost: 1200,
    note: { keep: true },
    ...overrides
  };
}

function assertNoLocationFields(value) {
  assert.equal(Object.hasOwn(value, 'qtyByLocation'), false);
  assert.equal(Object.hasOwn(value, 'qtyByCity'), false);
  assert.equal(Object.hasOwn(value, 'locationId'), false);
}

function assertPurchaseFailure(result, originalEntry, errorCode) {
  assert.deepEqual(result, {
    ok: false,
    status: 'invalid-purchase',
    entry: originalEntry,
    errors: [errorCode]
  });
}

function assertConsumptionFailure(result, originalEntry, errorCode) {
  assert.deepEqual(result, {
    ok: false,
    status: 'invalid-consumption',
    entry: originalEntry,
    consumedCost: null,
    errors: [errorCode]
  });
}

test('first artifact purchase creates an account-total entry with copied identity', () => {
  const identity = artifactIdentity();
  const beforeIdentity = JSON.stringify(identity);

  const result = applySpecialMaterialPurchase({
    entry: null,
    identity,
    quantity: 5,
    totalCost: 6150
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'purchased',
    entry: {
      identity,
      totalQty: 5,
      globalAvgCost: 1230
    },
    errors: []
  });
  assert.notEqual(result.entry.identity, identity);
  assert.deepEqual(result.entry.identity, identity);
  assert.equal(JSON.stringify(identity), beforeIdentity);
  assertNoLocationFields(result.entry);
});

test('first alchemy purchase creates an account-total entry', () => {
  const identity = alchemyIdentity();

  const result = applySpecialMaterialPurchase({
    entry: null,
    identity,
    quantity: 3,
    totalCost: 9000
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'purchased');
  assert.deepEqual(result.entry.identity, identity);
  assert.equal(result.entry.totalQty, 3);
  assert.equal(result.entry.globalAvgCost, 3000);
});

test('purchase preserves presentation fields but does not mutate identity', () => {
  const identity = artifactIdentity({ icon: { id: 'rune' } });
  const before = JSON.stringify(identity);

  const result = applySpecialMaterialPurchase({
    entry: null,
    identity,
    quantity: 1,
    totalCost: 100
  });

  assert.deepEqual(result.entry.identity, identity);
  assert.notEqual(result.entry.identity, identity);
  assert.equal(result.entry.identity.icon, identity.icon);
  assert.equal(JSON.stringify(identity), before);
});

test('purchase applies WAC for existing positive quantity and preserves entry extras', () => {
  const originalEntry = entry();
  const before = JSON.stringify(originalEntry);

  const result = applySpecialMaterialPurchase({
    entry: originalEntry,
    identity: artifactIdentity(),
    quantity: 5,
    totalCost: 9000
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.entry, originalEntry);
  assert.notEqual(result.entry.identity, originalEntry.identity);
  assert.equal(result.entry.totalQty, 15);
  assert.equal(result.entry.globalAvgCost, 1400);
  assert.equal(result.entry.note, originalEntry.note);
  assert.equal(JSON.stringify(originalEntry), before);
});

test('purchase WAC uses Math.round', () => {
  const result = applySpecialMaterialPurchase({
    entry: entry({ totalQty: 2, globalAvgCost: 100 }),
    identity: artifactIdentity(),
    quantity: 3,
    totalCost: 101
  });

  assert.equal(result.entry.globalAvgCost, 60);
});

test('purchase with zero totalQty ignores dormant anchor and resets WAC', () => {
  const originalEntry = entry({ totalQty: 0, globalAvgCost: 9999 });

  const result = applySpecialMaterialPurchase({
    entry: originalEntry,
    identity: artifactIdentity(),
    quantity: 4,
    totalCost: 1000
  });

  assert.equal(result.ok, true);
  assert.equal(result.entry.totalQty, 4);
  assert.equal(result.entry.globalAvgCost, 250);
});

test('purchase blocks positive inventory with unknown cost basis', () => {
  const originalEntry = entry({ totalQty: 3, globalAvgCost: null });

  const result = applySpecialMaterialPurchase({
    entry: originalEntry,
    identity: artifactIdentity(),
    quantity: 2,
    totalCost: 1000
  });

  assertPurchaseFailure(result, originalEntry, 'UNKNOWN_COST_BASIS');
});

test('purchase blocks identity mismatch', () => {
  const originalEntry = entry();

  const result = applySpecialMaterialPurchase({
    entry: originalEntry,
    identity: artifactIdentity({ stableId: 'artifact-other-t4' }),
    quantity: 2,
    totalCost: 1000
  });

  assertPurchaseFailure(result, originalEntry, 'IDENTITY_MISMATCH');
});

test('purchase blocks invalid identity values', () => {
  const cases = [
    artifactIdentity({ stableId: '   ' }),
    artifactIdentity({ category: 'material' }),
    artifactIdentity({ tier: 0 }),
    artifactIdentity({ tier: 4.5 })
  ];

  for (const identity of cases) {
    const result = applySpecialMaterialPurchase({
      entry: null,
      identity,
      quantity: 1,
      totalCost: 100
    });

    assertPurchaseFailure(result, null, 'INVALID_IDENTITY');
  }
});

test('purchase blocks invalid quantity values', () => {
  for (const quantity of [0, -1, 1.5]) {
    const result = applySpecialMaterialPurchase({
      entry: null,
      identity: artifactIdentity(),
      quantity,
      totalCost: 100
    });

    assertPurchaseFailure(result, null, 'INVALID_QUANTITY');
  }
});

test('purchase blocks invalid totalCost values', () => {
  for (const totalCost of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = applySpecialMaterialPurchase({
      entry: null,
      identity: artifactIdentity(),
      quantity: 1,
      totalCost
    });

    assertPurchaseFailure(result, null, 'INVALID_TOTAL_COST');
  }
});

test('purchase blocks malformed entry and preserves the original reference', () => {
  const originalEntry = entry({ totalQty: -1 });
  const before = JSON.stringify(originalEntry);

  const result = applySpecialMaterialPurchase({
    entry: originalEntry,
    identity: artifactIdentity(),
    quantity: 1,
    totalCost: 100
  });

  assertPurchaseFailure(result, originalEntry, 'INVALID_ENTRY');
  assert.equal(JSON.stringify(originalEntry), before);
});

test('purchase error priority follows the contract', () => {
  const originalEntry = entry({ totalQty: -1 });

  assertPurchaseFailure(
    applySpecialMaterialPurchase({
      entry: originalEntry,
      identity: artifactIdentity({ stableId: '' }),
      quantity: 0,
      totalCost: 0
    }),
    originalEntry,
    'INVALID_IDENTITY'
  );
  assertPurchaseFailure(
    applySpecialMaterialPurchase({
      entry: originalEntry,
      identity: artifactIdentity(),
      quantity: 0,
      totalCost: 0
    }),
    originalEntry,
    'INVALID_QUANTITY'
  );
  assertPurchaseFailure(
    applySpecialMaterialPurchase({
      entry: originalEntry,
      identity: artifactIdentity(),
      quantity: 1,
      totalCost: 0
    }),
    originalEntry,
    'INVALID_TOTAL_COST'
  );
});

test('fixed quantity consumption deducts from account total and returns consumed cost', () => {
  const originalEntry = entry();
  const before = JSON.stringify(originalEntry);

  const result = applySpecialMaterialConsumption({
    entry: originalEntry,
    quantity: 4
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'consumed',
    entry: {
      ...originalEntry,
      totalQty: 6,
      globalAvgCost: 1200
    },
    consumedCost: 4800,
    errors: []
  });
  assert.notEqual(result.entry, originalEntry);
  assert.equal(result.entry.identity, originalEntry.identity);
  assert.equal(JSON.stringify(originalEntry), before);
});

test('consumption to zero preserves dormant cost anchor', () => {
  const originalEntry = entry({ totalQty: 4, globalAvgCost: 777 });

  const result = applySpecialMaterialConsumption({
    entry: originalEntry,
    quantity: 4
  });

  assert.equal(result.ok, true);
  assert.equal(result.entry.totalQty, 0);
  assert.equal(result.entry.globalAvgCost, 777);
  assert.equal(result.consumedCost, 3108);
});

test('consumption blocks insufficient quantity', () => {
  const originalEntry = entry({ totalQty: 2 });

  const result = applySpecialMaterialConsumption({
    entry: originalEntry,
    quantity: 3
  });

  assertConsumptionFailure(result, originalEntry, 'INSUFFICIENT_QUANTITY');
});

test('consumption blocks unknown cost basis', () => {
  const originalEntry = entry({ totalQty: 2, globalAvgCost: null });

  const result = applySpecialMaterialConsumption({
    entry: originalEntry,
    quantity: 1
  });

  assertConsumptionFailure(result, originalEntry, 'UNKNOWN_COST_BASIS');
});

test('consumption blocks invalid quantity and invalid entry values', () => {
  const originalEntry = entry();

  for (const quantity of [0, -1, 1.5]) {
    assertConsumptionFailure(
      applySpecialMaterialConsumption({ entry: originalEntry, quantity }),
      originalEntry,
      'INVALID_QUANTITY'
    );
  }

  const malformedEntry = entry({ globalAvgCost: -1 });
  assertConsumptionFailure(
    applySpecialMaterialConsumption({ entry: malformedEntry, quantity: 1 }),
    malformedEntry,
    'INVALID_ENTRY'
  );
});

test('consumption failure preserves input and returns original entry reference', () => {
  const originalEntry = entry({ totalQty: 1 });
  const before = JSON.stringify(originalEntry);

  const result = applySpecialMaterialConsumption({
    entry: originalEntry,
    quantity: 2
  });

  assertConsumptionFailure(result, originalEntry, 'INSUFFICIENT_QUANTITY');
  assert.equal(JSON.stringify(originalEntry), before);
});

test('consumption error priority follows the contract', () => {
  const malformedEntry = entry({ totalQty: -1, globalAvgCost: null });
  assertConsumptionFailure(
    applySpecialMaterialConsumption({ entry: malformedEntry, quantity: 0 }),
    malformedEntry,
    'INVALID_ENTRY'
  );

  const unknownCostEntry = entry({ totalQty: 1, globalAvgCost: null });
  assertConsumptionFailure(
    applySpecialMaterialConsumption({ entry: unknownCostEntry, quantity: 0 }),
    unknownCostEntry,
    'INVALID_QUANTITY'
  );
  assertConsumptionFailure(
    applySpecialMaterialConsumption({ entry: unknownCostEntry, quantity: 2 }),
    unknownCostEntry,
    'UNKNOWN_COST_BASIS'
  );
});

test('module exports only the approved special material inventory API', () => {
  assert.deepEqual(Object.keys(specialMaterialInventoryService).sort(), [
    'applySpecialMaterialConsumption',
    'applySpecialMaterialPurchase'
  ]);
});

test('helpers execute in plain Node without browser or storage globals', () => {
  const blockers = ['window', 'document', 'localStorage'];
  for (const name of blockers) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        throw new Error(`${name} must not be read`);
      }
    });
  }

  try {
    const purchase = applySpecialMaterialPurchase({
      entry: null,
      identity: artifactIdentity(),
      quantity: 1,
      totalCost: 100
    });
    const consumption = applySpecialMaterialConsumption({
      entry: purchase.entry,
      quantity: 1
    });

    assert.equal(purchase.ok, true);
    assert.equal(consumption.ok, true);
  } finally {
    for (const name of blockers) {
      delete globalThis[name];
    }
  }
});
