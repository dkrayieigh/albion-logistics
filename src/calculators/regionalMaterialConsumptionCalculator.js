function failure(errorCode) {
  return {
    ok: false,
    status: 'invalid-consumption',
    grossQuantity: null,
    calculatedReturnedQuantity: null,
    calculatedConsumedQuantity: null,
    appliedConsumedQuantity: null,
    consumptionSource: null,
    errors: [errorCode]
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateOverride(override, grossQuantity) {
  if (override === undefined) {
    return true;
  }

  if (!isPlainObject(override)) {
    return false;
  }

  if (typeof override.overrideEnabled !== 'boolean') {
    return false;
  }

  if (!override.overrideEnabled) {
    return true;
  }

  return (
    Number.isInteger(override.overrideConsumedQuantity) &&
    override.overrideConsumedQuantity >= 0 &&
    override.overrideConsumedQuantity <= grossQuantity
  );
}

export function calculateRegionalMaterialConsumption({
  baseQuantity,
  craftQuantity,
  rrr,
  override
}) {
  if (!isPositiveInteger(baseQuantity)) {
    return failure('INVALID_BASE_QUANTITY');
  }

  if (!isPositiveInteger(craftQuantity)) {
    return failure('INVALID_CRAFT_QUANTITY');
  }

  if (!(Number.isFinite(rrr) && rrr >= 0 && rrr < 1)) {
    return failure('INVALID_RRR');
  }

  const grossQuantity = baseQuantity * craftQuantity;

  if (!validateOverride(override, grossQuantity)) {
    return failure('INVALID_OVERRIDE');
  }

  const calculatedReturnedQuantity = Math.floor(grossQuantity * rrr);
  const calculatedConsumedQuantity =
    grossQuantity - calculatedReturnedQuantity;
  const useOverride = override?.overrideEnabled === true;

  return {
    ok: true,
    status: 'calculated',
    grossQuantity,
    calculatedReturnedQuantity,
    calculatedConsumedQuantity,
    appliedConsumedQuantity: useOverride
      ? override.overrideConsumedQuantity
      : calculatedConsumedQuantity,
    consumptionSource: useOverride ? 'manual-override' : 'calculated',
    errors: []
  };
}
