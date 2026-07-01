import test from 'node:test';
import assert from 'node:assert/strict';

import * as resolverModule from '../src/services/specialMaterialIdentityResolver.js';
import { listSpecialMaterialCatalogEntries } from '../src/data/specialMaterialCatalog.js';
import { applySpecialMaterialPurchase, applySpecialMaterialConsumption } from '../src/services/specialMaterialInventoryService.js';
import { resolveSpecialMaterialIdentity } from '../src/services/specialMaterialIdentityResolver.js';

function assertUnresolved(result, errorCode) {
  assert.deepEqual(result, {
    ok: false,
    status: 'unresolved',
    identity: null,
    catalogEntry: null,
    errors: [errorCode]
  });
}

function assertNoBoundaryFields(value) {
  for (const key of [
    'locationId',
    'qtyByLocation',
    'qtyByCity',
    'quantity',
    'cost',
    'globalAvgCost',
    'cash',
    'transaction',
    'storage',
    'ui'
  ]) {
    assert.equal(Object.hasOwn(value, key), false);
  }
}

function assertNoLocationFields(value) {
  for (const key of ['locationId', 'qtyByLocation', 'qtyByCity']) {
    assert.equal(Object.hasOwn(value, key), false);
  }
}

test('resolver resolves artifact and alchemy exact bilingual raw names', () => {
  const artifact = resolveSpecialMaterialIdentity({
    category: 'artifact',
    rawName: '血鑄之刃 Bloodforged Blade',
    tier: 6
  });
  assert.equal(artifact.ok, true);
  assert.deepEqual(artifact.identity, {
    stableId: 'ARTIFACT_BLOODFORGED_BLADE',
    category: 'artifact',
    tier: 6
  });
  assert.equal(artifact.catalogEntry.rawName, '血鑄之刃 Bloodforged Blade');
  assert.equal(Object.hasOwn(artifact.catalogEntry, 'tier'), false);

  const alchemy = resolveSpecialMaterialIdentity({
    category: 'alchemy',
    rawName: "小惡魔角 Imp's Horn",
    tier: 4
  });
  assert.equal(alchemy.ok, true);
  assert.equal(alchemy.identity.stableId, 'ALCHEMY_IMPS_HORN');
});

test('resolver trims only boundary whitespace and preserves tier in identity only', () => {
  const result = resolveSpecialMaterialIdentity({
    category: 'artifact',
    rawName: '  血鑄之刃 Bloodforged Blade  ',
    tier: 8
  });
  assert.equal(result.ok, true);
  assert.equal(result.identity.tier, 8);
  assert.equal(Object.hasOwn(result.catalogEntry, 'tier'), false);
});

test('resolver handles approved spot checks', () => {
  assert.equal(
    resolveSpecialMaterialIdentity({ category: 'artifact', rawName: '藍焰水晶 Blueflame Crystal', tier: 4 }).identity
      .stableId,
    'ARTIFACT_BLUEFLAME_CRYSTAL'
  );
  assert.equal(
    resolveSpecialMaterialIdentity({ category: 'artifact', rawName: '皇家徽記 Royal Sigils', tier: 4 }).identity.stableId,
    'ARTIFACT_ROYAL_SIGILS'
  );
  assert.equal(
    resolveSpecialMaterialIdentity({ category: 'alchemy', rawName: "小惡魔角 Imp's Horn", tier: 4 }).identity.stableId,
    'ALCHEMY_IMPS_HORN'
  );
});

test('resolver exhaustively resolves every catalog entry and interoperates with inventory service', () => {
  for (const catalogEntry of listSpecialMaterialCatalogEntries()) {
    const result = resolveSpecialMaterialIdentity({
      category: catalogEntry.category,
      rawName: catalogEntry.rawName,
      tier: 4
    });
    assert.equal(result.ok, true);
    assert.equal(result.identity.stableId, catalogEntry.stableId);
    assert.equal(result.identity.category, catalogEntry.category);
    assertNoBoundaryFields(result.identity);
    assertNoBoundaryFields(result.catalogEntry);

    const purchase = applySpecialMaterialPurchase({
      entry: null,
      identity: result.identity,
      quantity: 1,
      totalCost: 100
    });
    assert.equal(purchase.ok, true);
    assertNoLocationFields(purchase.entry);
  }

  const resolved = resolveSpecialMaterialIdentity({
    category: 'artifact',
    rawName: '血鑄之刃 Bloodforged Blade',
    tier: 4
  });
  const purchased = applySpecialMaterialPurchase({
    entry: null,
    identity: resolved.identity,
    quantity: 2,
    totalCost: 200
  });
  const consumed = applySpecialMaterialConsumption({ entry: purchased.entry, quantity: 1 });
  assert.equal(consumed.ok, true);
});

test('resolver validates category raw name tier unknown names and exact matching boundary', () => {
  assertUnresolved(
    resolveSpecialMaterialIdentity({ category: 'Artifact', rawName: '血鑄之刃 Bloodforged Blade', tier: 4 }),
    'INVALID_CATEGORY'
  );
  assertUnresolved(resolveSpecialMaterialIdentity({ category: 'artifact', rawName: '   ', tier: 4 }), 'INVALID_RAW_NAME');
  for (const tier of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertUnresolved(resolveSpecialMaterialIdentity({ category: 'artifact', rawName: '血鑄之刃 Bloodforged Blade', tier }), 'INVALID_TIER');
  }
  for (const rawName of [
    'Unknown Material',
    'Bloodforged Blade',
    '血鑄之刃',
    'bloodforged blade',
    'ARTIFACT_BLOODFORGED_BLADE',
    'Bloodforged-Blade'
  ]) {
    assertUnresolved(resolveSpecialMaterialIdentity({ category: 'artifact', rawName, tier: 4 }), 'MATERIAL_NOT_FOUND');
  }
});

test('resolver error priority follows the fixed order', () => {
  assertUnresolved(resolveSpecialMaterialIdentity({ category: 'Artifact', rawName: '', tier: 0 }), 'INVALID_CATEGORY');
  assertUnresolved(resolveSpecialMaterialIdentity({ category: 'artifact', rawName: '', tier: 0 }), 'INVALID_RAW_NAME');
  assertUnresolved(resolveSpecialMaterialIdentity({ category: 'artifact', rawName: 'Unknown Material', tier: 0 }), 'INVALID_TIER');
});

test('resolver result objects are copies and input remains unchanged', () => {
  const input = { category: 'artifact', rawName: '血鑄之刃 Bloodforged Blade', tier: 4 };
  const before = JSON.stringify(input);
  const first = resolveSpecialMaterialIdentity(input);
  const second = resolveSpecialMaterialIdentity(input);

  assert.equal(JSON.stringify(input), before);
  assert.notEqual(first.identity, second.identity);
  assert.notEqual(first.catalogEntry, second.catalogEntry);
  first.identity.stableId = 'MUTATED';
  first.catalogEntry.stableId = 'MUTATED';
  assert.equal(resolveSpecialMaterialIdentity(input).identity.stableId, 'ARTIFACT_BLOODFORGED_BLADE');
});

test('resolver module exposes only the approved public API and uses no browser globals', () => {
  assert.deepEqual(Object.keys(resolverModule), ['resolveSpecialMaterialIdentity']);

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
    assert.equal(
      resolveSpecialMaterialIdentity({
        category: 'artifact',
        rawName: '血鑄之刃 Bloodforged Blade',
        tier: 4
      }).ok,
      true
    );
  } finally {
    for (const name of blockers) delete globalThis[name];
  }
});
