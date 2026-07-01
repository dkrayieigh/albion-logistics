import { findSpecialMaterialCatalogEntry } from '../data/specialMaterialCatalog.js';

function unresolved(errorCode) {
  return {
    ok: false,
    status: 'unresolved',
    identity: null,
    catalogEntry: null,
    errors: [errorCode]
  };
}

function isValidCategory(category) {
  return category === 'artifact' || category === 'alchemy';
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function resolveSpecialMaterialIdentity({ category, rawName, tier } = {}) {
  if (!isValidCategory(category)) return unresolved('INVALID_CATEGORY');
  if (typeof rawName !== 'string' || rawName.trim() === '') return unresolved('INVALID_RAW_NAME');
  if (!isPositiveInteger(tier)) return unresolved('INVALID_TIER');

  const catalogEntry = findSpecialMaterialCatalogEntry({
    category,
    rawName: rawName.trim()
  });
  if (!catalogEntry) return unresolved('MATERIAL_NOT_FOUND');

  return {
    ok: true,
    status: 'resolved',
    identity: {
      stableId: catalogEntry.stableId,
      category: catalogEntry.category,
      tier
    },
    catalogEntry,
    errors: []
  };
}
