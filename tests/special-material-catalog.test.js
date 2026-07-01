import test from 'node:test';
import assert from 'node:assert/strict';

import { ALBION_DB } from '../src/data/albion_db.js';
import {
  listSpecialMaterialCatalogEntries,
  findSpecialMaterialCatalogEntry,
  findSpecialMaterialCatalogEntryByStableId
} from '../src/data/specialMaterialCatalog.js';

const CATALOG_KEYS = ['stableId', 'category', 'rawName', 'zhName', 'enName'];
const FORBIDDEN_KEYS = [
  'tier',
  'quantity',
  'artifactQty',
  'locationId',
  'qtyByCity',
  'qtyByLocation',
  'recipeId',
  'sourceRecipeIds',
  'globalAvgCost',
  'storageKey',
  'transactionMetadata',
  'reviewStatus'
];

function expectedStableId(entry) {
  const asciiKey = entry.enName
    .replace(/'/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase();
  return `${entry.category.toUpperCase()}_${asciiKey}`;
}

function walk(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value !== null && typeof value === 'object') {
    visit(value);
    for (const nested of Object.values(value)) walk(nested, visit);
  }
}

function sourceRawSets() {
  const artifact = new Set();
  const alchemy = new Set();
  walk(ALBION_DB, recipe => {
    if (typeof recipe.artifactName === 'string' && recipe.artifactName.trim()) {
      artifact.add(recipe.artifactName.trim());
    }
    if (typeof recipe.alchemyName === 'string' && recipe.alchemyName.trim()) {
      alchemy.add(recipe.alchemyName.trim());
    }
  });
  return { artifact, alchemy };
}

function catalogRawSet(category) {
  return new Set(
    listSpecialMaterialCatalogEntries()
      .filter(entry => entry.category === category)
      .map(entry => entry.rawName)
  );
}

test('special material catalog has the approved total and category counts', () => {
  const entries = listSpecialMaterialCatalogEntries();
  assert.equal(entries.length, 153);
  assert.equal(entries.filter(entry => entry.category === 'artifact').length, 146);
  assert.equal(entries.filter(entry => entry.category === 'alchemy').length, 7);
});

test('special material catalog entries use the exact approved shape only', () => {
  for (const entry of listSpecialMaterialCatalogEntries()) {
    assert.deepEqual(Object.keys(entry).sort(), [...CATALOG_KEYS].sort());
    assert.equal(['artifact', 'alchemy'].includes(entry.category), true);
    for (const key of CATALOG_KEYS) {
      assert.equal(typeof entry[key], 'string');
      assert.notEqual(entry[key].trim(), '');
    }
    for (const key of FORBIDDEN_KEYS) {
      assert.equal(Object.hasOwn(entry, key), false);
    }
  }
});

test('special material catalog stable IDs are unique and follow the approved naming policy', () => {
  const entries = listSpecialMaterialCatalogEntries();
  const stableIds = new Set();
  const rawKeys = new Set();

  for (const entry of entries) {
    assert.equal(stableIds.has(entry.stableId), false);
    stableIds.add(entry.stableId);
    const rawKey = `${entry.category}\u0000${entry.rawName}`;
    assert.equal(rawKeys.has(rawKey), false);
    rawKeys.add(rawKey);
    assert.equal(entry.stableId, expectedStableId(entry));
    assert.match(entry.stableId, /^[A-Z0-9_]+$/);
    assert.equal(entry.stableId.includes('__'), false);
    assert.equal(entry.stableId.startsWith('_'), false);
    assert.equal(entry.stableId.endsWith('_'), false);
    assert.equal(entry.stableId.includes('TBD'), false);
    assert.equal(/_T[4-8]$/.test(entry.stableId), false);
    assert.equal(entry.stableId.startsWith(`${entry.category.toUpperCase()}_`), true);
  }
});

test('special material catalog includes required stable ID spot checks', () => {
  assert.equal(
    findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: '血鑄之刃 Bloodforged Blade' })
      .stableId,
    'ARTIFACT_BLOODFORGED_BLADE'
  );
  assert.equal(
    findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: '藍焰水晶 Blueflame Crystal' })
      .stableId,
    'ARTIFACT_BLUEFLAME_CRYSTAL'
  );
  assert.equal(
    findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: '皇家徽記 Royal Sigils' })
      .stableId,
    'ARTIFACT_ROYAL_SIGILS'
  );
  assert.equal(
    findSpecialMaterialCatalogEntry({ category: 'alchemy', rawName: "小惡魔角 Imp's Horn" })
      .stableId,
    'ALCHEMY_IMPS_HORN'
  );
});

test('special material catalog list and find results are defensive copies', () => {
  const first = listSpecialMaterialCatalogEntries();
  const second = listSpecialMaterialCatalogEntries();
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);

  first.pop();
  first[0].stableId = 'MUTATED';
  const afterMutation = listSpecialMaterialCatalogEntries();
  assert.equal(afterMutation.length, 153);
  assert.notEqual(afterMutation[0].stableId, 'MUTATED');

  const found = findSpecialMaterialCatalogEntry({
    category: 'artifact',
    rawName: '血鑄之刃 Bloodforged Blade'
  });
  const foundAgain = findSpecialMaterialCatalogEntryByStableId('ARTIFACT_BLOODFORGED_BLADE');
  assert.notEqual(found, foundAgain);
  found.stableId = 'MUTATED';
  assert.equal(
    findSpecialMaterialCatalogEntryByStableId('ARTIFACT_BLOODFORGED_BLADE').stableId,
    'ARTIFACT_BLOODFORGED_BLADE'
  );
});

test('special material catalog lookup boundaries are exact and invalid lookup returns null', () => {
  assert.equal(
    findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: '  血鑄之刃 Bloodforged Blade  ' })
      .stableId,
    'ARTIFACT_BLOODFORGED_BLADE'
  );
  assert.equal(findSpecialMaterialCatalogEntry({ category: 'Artifact', rawName: '血鑄之刃 Bloodforged Blade' }), null);
  assert.equal(findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: 'Bloodforged Blade' }), null);
  assert.equal(findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: '血鑄之刃' }), null);
  assert.equal(findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: 'bloodforged blade' }), null);
  assert.equal(findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: 'ARTIFACT_BLOODFORGED_BLADE' }), null);
  assert.equal(findSpecialMaterialCatalogEntryByStableId(' ARTIFACT_BLOODFORGED_BLADE ').rawName, '血鑄之刃 Bloodforged Blade');
  assert.equal(findSpecialMaterialCatalogEntryByStableId('artifact_bloodforged_blade'), null);
  assert.equal(findSpecialMaterialCatalogEntryByStableId(null), null);
});

test('special material catalog raw values match current ALBION_DB artifact and alchemy sets exactly', () => {
  const before = JSON.stringify(ALBION_DB);
  const source = sourceRawSets();
  assert.deepEqual(catalogRawSet('artifact'), source.artifact);
  assert.deepEqual(catalogRawSet('alchemy'), source.alchemy);
  assert.equal(source.artifact.size, 146);
  assert.equal(source.alchemy.size, 7);
  assert.equal(findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: '皇家徽記 Royal Sigils' }).stableId, 'ARTIFACT_ROYAL_SIGILS');
  assert.equal(findSpecialMaterialCatalogEntry({ category: 'artifact', rawName: '藍焰水晶 Blueflame Crystal' }).stableId, 'ARTIFACT_BLUEFLAME_CRYSTAL');
  assert.equal(JSON.stringify(ALBION_DB), before);
});
