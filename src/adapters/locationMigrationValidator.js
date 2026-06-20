const ERROR_ORDER = [
  'INVALID_BEFORE_SNAPSHOT',
  'INVALID_AFTER_SNAPSHOT',
  'INVALID_LOCATION_MAPPINGS',
  'INVENTORY_ITEM_COUNT_MISMATCH',
  'LOCATION_QUANTITY_MISMATCH',
  'GLOBAL_QUANTITY_TOTAL_MISMATCH',
  'GLOBAL_AVG_COST_MISMATCH',
  'CASH_MISMATCH',
  'TRANSACTION_COUNT_MISMATCH',
  'CUSTOM_LOCATION_COUNT_MISMATCH',
  'UNRESOLVED_MAPPINGS'
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidCostBasis(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isValidBeforeSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) return false;
  if (!isPlainObject(snapshot.inventory)) return false;
  if (!isPlainObject(snapshot.assets) || typeof snapshot.assets.cash !== 'number' || !Number.isFinite(snapshot.assets.cash)) return false;
  if (!Array.isArray(snapshot.transactions)) return false;
  if (!Array.isArray(snapshot.customLocations)) return false;

  return Object.values(snapshot.inventory).every(entry =>
    isPlainObject(entry) &&
    isPlainObject(entry.qtyByCity) &&
    isValidCostBasis(entry.globalAvgCost)
  );
}

function isValidAfterSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) return false;
  if (!isPlainObject(snapshot.inventory)) return false;
  if (!isPlainObject(snapshot.assets) || typeof snapshot.assets.cash !== 'number' || !Number.isFinite(snapshot.assets.cash)) return false;
  if (!Array.isArray(snapshot.transactions)) return false;
  if (!Array.isArray(snapshot.locationRegistry)) return false;

  return Object.values(snapshot.inventory).every(entry =>
    isPlainObject(entry) &&
    isPlainObject(entry.qtyByLocation) &&
    isValidCostBasis(entry.globalAvgCost)
  );
}

function sumFiniteQuantities(quantities) {
  return Object.values(quantities).reduce((total, quantity) =>
    total + (typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 0), 0);
}

function sameKeySet(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every(key => Object.hasOwn(right, key));
}

function pushError(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function orderedErrors(errors) {
  return ERROR_ORDER.filter(code => errors.includes(code));
}

export function validateLocationMigration(input) {
  const before = input?.before;
  const after = input?.after;
  const locationMappings = input?.locationMappings;
  const unresolvedInput = input?.unresolvedMappings;
  const unresolvedMappings = Array.isArray(unresolvedInput) ? [...unresolvedInput] : [];
  const errors = [];

  const validBefore = isValidBeforeSnapshot(before);
  const validAfter = isValidAfterSnapshot(after);
  const validMappingContainer = isPlainObject(locationMappings);

  if (!validBefore) pushError(errors, 'INVALID_BEFORE_SNAPSHOT');
  if (!validAfter) pushError(errors, 'INVALID_AFTER_SNAPSHOT');
  if (!validMappingContainer || (unresolvedInput !== undefined && !Array.isArray(unresolvedInput))) {
    pushError(errors, 'INVALID_LOCATION_MAPPINGS');
  }

  if (validBefore && validMappingContainer) {
    for (const item of Object.values(before.inventory)) {
      for (const legacyLocation of Object.keys(item.qtyByCity)) {
        if (typeof locationMappings[legacyLocation] !== 'string') {
          pushError(errors, 'INVALID_LOCATION_MAPPINGS');
          pushError(errors, 'LOCATION_QUANTITY_MISMATCH');
        }
      }
    }
  }

  if (validBefore && validAfter) {
    if (!sameKeySet(before.inventory, after.inventory)) pushError(errors, 'INVENTORY_ITEM_COUNT_MISMATCH');
    else {
      for (const itemKey of Object.keys(before.inventory)) {
        const beforeItem = before.inventory[itemKey];
        const afterItem = after.inventory[itemKey];

        if (validMappingContainer) {
          const expectedLocations = {};
          for (const [legacyLocation, beforeQuantity] of Object.entries(beforeItem.qtyByCity)) {
            const futureLocation = locationMappings[legacyLocation];
            if (typeof futureLocation !== 'string') continue;
            expectedLocations[futureLocation] = beforeQuantity;
            const afterQuantity = afterItem.qtyByLocation[futureLocation];
            if (typeof beforeQuantity !== 'number' || !Number.isFinite(beforeQuantity) || afterQuantity !== beforeQuantity) {
              pushError(errors, 'LOCATION_QUANTITY_MISMATCH');
            }
          }
          for (const [futureLocation, afterQuantity] of Object.entries(afterItem.qtyByLocation)) {
            if (!Object.hasOwn(expectedLocations, futureLocation) || typeof afterQuantity !== 'number' || !Number.isFinite(afterQuantity)) {
              pushError(errors, 'LOCATION_QUANTITY_MISMATCH');
            }
          }
        }

        if (sumFiniteQuantities(beforeItem.qtyByCity) !== sumFiniteQuantities(afterItem.qtyByLocation)) {
          pushError(errors, 'GLOBAL_QUANTITY_TOTAL_MISMATCH');
        }
        if (beforeItem.globalAvgCost !== afterItem.globalAvgCost) pushError(errors, 'GLOBAL_AVG_COST_MISMATCH');
      }
    }

    if (before.assets.cash !== after.assets.cash) pushError(errors, 'CASH_MISMATCH');
    if (before.transactions.length !== after.transactions.length) pushError(errors, 'TRANSACTION_COUNT_MISMATCH');

    const customRegistryCount = after.locationRegistry.filter(entry =>
      isPlainObject(entry) &&
      typeof entry.locationId === 'string' &&
      entry.locationId.startsWith('custom:')
    ).length;
    if (before.customLocations.length !== customRegistryCount) pushError(errors, 'CUSTOM_LOCATION_COUNT_MISMATCH');
  }

  if (unresolvedMappings.length > 0) pushError(errors, 'UNRESOLVED_MAPPINGS');

  const finalErrors = orderedErrors(errors);
  return {
    ok: finalErrors.length === 0,
    errors: finalErrors,
    unresolvedMappings
  };
}
