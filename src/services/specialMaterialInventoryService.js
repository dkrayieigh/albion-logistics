const VALID_CATEGORIES = Object.freeze(['artifact', 'alchemy']);

function purchaseFailure(entry, errorCode) {
  return {
    ok: false,
    status: 'invalid-purchase',
    entry,
    errors: [errorCode]
  };
}

function consumptionFailure(entry, errorCode) {
  return {
    ok: false,
    status: 'invalid-consumption',
    entry,
    consumedCost: null,
    errors: [errorCode]
  };
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidIdentity(identity) {
  return (
    identity !== null &&
    typeof identity === 'object' &&
    typeof identity.stableId === 'string' &&
    identity.stableId.trim() !== '' &&
    VALID_CATEGORIES.includes(identity.category) &&
    isPositiveInteger(identity.tier)
  );
}

function isValidCostBasis(value) {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function isValidEntry(entry) {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    isValidIdentity(entry.identity) &&
    isNonnegativeInteger(entry.totalQty) &&
    isValidCostBasis(entry.globalAvgCost)
  );
}

function hasSameIdentity(left, right) {
  return (
    left.stableId === right.stableId &&
    left.category === right.category &&
    left.tier === right.tier
  );
}

function copyIdentity(identity) {
  return { ...identity };
}

export function applySpecialMaterialPurchase({ entry, identity, quantity, totalCost }) {
  if (!isValidIdentity(identity)) return purchaseFailure(entry, 'INVALID_IDENTITY');
  if (!isPositiveInteger(quantity)) return purchaseFailure(entry, 'INVALID_QUANTITY');
  if (!Number.isFinite(totalCost) || totalCost <= 0) {
    return purchaseFailure(entry, 'INVALID_TOTAL_COST');
  }
  if (entry !== null && !isValidEntry(entry)) return purchaseFailure(entry, 'INVALID_ENTRY');
  if (entry !== null && !hasSameIdentity(entry.identity, identity)) {
    return purchaseFailure(entry, 'IDENTITY_MISMATCH');
  }
  if (entry !== null && entry.totalQty > 0 && entry.globalAvgCost === null) {
    return purchaseFailure(entry, 'UNKNOWN_COST_BASIS');
  }

  const previousQty = entry?.totalQty ?? 0;
  const nextTotalQty = previousQty + quantity;
  const nextGlobalAvgCost =
    previousQty === 0
      ? Math.round(totalCost / quantity)
      : Math.round((previousQty * entry.globalAvgCost + totalCost) / nextTotalQty);

  return {
    ok: true,
    status: 'purchased',
    entry: {
      ...(entry ?? {}),
      identity: copyIdentity(identity),
      totalQty: nextTotalQty,
      globalAvgCost: nextGlobalAvgCost
    },
    errors: []
  };
}

export function applySpecialMaterialConsumption({ entry, quantity }) {
  if (!isValidEntry(entry)) return consumptionFailure(entry, 'INVALID_ENTRY');
  if (!isPositiveInteger(quantity)) return consumptionFailure(entry, 'INVALID_QUANTITY');
  if (entry.globalAvgCost === null) return consumptionFailure(entry, 'UNKNOWN_COST_BASIS');
  if (entry.totalQty < quantity) return consumptionFailure(entry, 'INSUFFICIENT_QUANTITY');

  return {
    ok: true,
    status: 'consumed',
    entry: {
      ...entry,
      totalQty: entry.totalQty - quantity,
      globalAvgCost: entry.globalAvgCost
    },
    consumedCost: quantity * entry.globalAvgCost,
    errors: []
  };
}
