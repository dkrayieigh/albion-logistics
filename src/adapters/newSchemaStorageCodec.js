import { QUAL_GROUPS } from '../data/constants.js';

const ERROR_ORDER = [
  'INVALID_SERIALIZED_INPUT',
  'INVALID_JSON',
  'INVALID_ROOT_STATE',
  'UNSUPPORTED_SCHEMA_VERSION',
  'INVALID_ASSETS',
  'INVALID_LOCATION_REGISTRY',
  'INVALID_INVENTORY',
  'INVALID_TRANSACTIONS',
  'INVALID_LABORER_INVENTORY',
  'INVALID_LABORER_LOGS',
  'LEGACY_FIELD_NOT_ALLOWED',
  'STORAGE_CODEC_ABORTED'
];

const ROOT_KEYS = [
  'schemaVersion',
  'assets',
  'inventory',
  'locationRegistry',
  'transactions',
  'laborerInventory',
  'laborerLogs'
];

const FIXED_LOCATION_REGISTRY = {
  thetford: { locationId: 'thetford', displayName: 'Thetford', type: 'system', active: true },
  martlock: { locationId: 'martlock', displayName: 'Martlock', type: 'system', active: true },
  bridgewatch: { locationId: 'bridgewatch', displayName: 'Bridgewatch', type: 'system', active: true },
  lymhurst: { locationId: 'lymhurst', displayName: 'Lymhurst', type: 'system', active: true },
  fort_sterling: { locationId: 'fort_sterling', displayName: 'Fort Sterling', type: 'system', active: true },
  caerleon: { locationId: 'caerleon', displayName: 'Caerleon', type: 'system', active: true },
  brecilien: { locationId: 'brecilien', displayName: 'Brecilien', type: 'system', active: true },
  laborer_island: { locationId: 'laborer_island', displayName: 'Laborer Island', type: 'system-special', active: true }
};

const LABORER_CATEGORIES = ['鋼條', '布料', '板材', '滿日誌'];

const SUPPORTED_LABORER_QUALITIES = [
  ...new Set([
    ...QUAL_GROUPS.flatMap(group => group.items),
    '4.0',
    '5.0',
    '6.0',
    '7.0',
    '8.0'
  ])
];

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function pushError(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function orderedErrors(errors) {
  return ERROR_ORDER.filter(code => errors.includes(code));
}

function hasExactKeys(value, expectedKeys) {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && expectedKeys.every(key => Object.hasOwn(value, key));
}

function isValidCustomLocationId(locationId) {
  return (
    typeof locationId === 'string' &&
    locationId.startsWith('custom:') &&
    locationId.slice('custom:'.length).trim().length > 0
  );
}

function isJsonSafe(value, seen = new WeakSet()) {
  if (value === null) return true;
  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') return true;
  if (valueType === 'number') return Number.isFinite(value);
  if (valueType !== 'object') return false;

  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.every(item => isJsonSafe(item, seen));
  if (!isPlainObject(value)) return false;
  return Object.values(value).every(item => isJsonSafe(item, seen));
}

function validateAssets(assets, errors) {
  if (
    !isPlainObject(assets) ||
    !hasExactKeys(assets, ['cash', 'debt']) ||
    !isFiniteNumber(assets.cash) ||
    !isFiniteNumber(assets.debt)
  ) {
    pushError(errors, 'INVALID_ASSETS');
  }
}

function validateLocationRegistry(locationRegistry, errors) {
  if (!isPlainObject(locationRegistry)) {
    pushError(errors, 'INVALID_LOCATION_REGISTRY');
    return new Set();
  }

  const locationIds = new Set();
  const fixedNames = new Set(Object.values(FIXED_LOCATION_REGISTRY).map(entry => entry.displayName.trim().toLocaleLowerCase()));
  const customNames = new Set();
  let valid = true;

  if (Object.hasOwn(locationRegistry, 'Hideout') || Object.hasOwn(locationRegistry, 'hideout')) valid = false;

  for (const [locationId, fixedEntry] of Object.entries(FIXED_LOCATION_REGISTRY)) {
    const entry = locationRegistry[locationId];
    if (!isPlainObject(entry) || JSON.stringify(entry) !== JSON.stringify(fixedEntry)) valid = false;
  }

  for (const [key, entry] of Object.entries(locationRegistry)) {
    if (!isPlainObject(entry) || !hasExactKeys(entry, ['locationId', 'displayName', 'type', 'active'])) {
      valid = false;
      continue;
    }

    if (entry.locationId !== key) valid = false;
    if (typeof entry.displayName !== 'string' || entry.displayName.trim().length === 0) valid = false;
    if (typeof entry.active !== 'boolean') valid = false;
    if (!['system', 'system-special', 'custom'].includes(entry.type)) valid = false;

    if (entry.type === 'custom') {
      if (!isValidCustomLocationId(key)) valid = false;
      const normalizedName = typeof entry.displayName === 'string' ? entry.displayName.trim().toLocaleLowerCase() : '';
      if (fixedNames.has(normalizedName) || customNames.has(normalizedName)) valid = false;
      if (normalizedName) customNames.add(normalizedName);
    } else if (!Object.hasOwn(FIXED_LOCATION_REGISTRY, key)) {
      valid = false;
    }

    if (valid) locationIds.add(key);
  }

  if (!valid) pushError(errors, 'INVALID_LOCATION_REGISTRY');
  return new Set(Object.keys(locationRegistry));
}

function validateInventory(inventory, locationIds, errors) {
  if (!isPlainObject(inventory)) {
    pushError(errors, 'INVALID_INVENTORY');
    return;
  }

  let invalid = false;

  for (const [itemKey, item] of Object.entries(inventory)) {
    if (typeof itemKey !== 'string' || itemKey.trim().length === 0 || itemKey !== itemKey.trim()) invalid = true;
    if (!isPlainObject(item)) {
      invalid = true;
      continue;
    }
    if (Object.hasOwn(item, 'qtyByCity')) pushError(errors, 'LEGACY_FIELD_NOT_ALLOWED');
    if (!hasExactKeys(item, ['qtyByLocation', 'globalAvgCost'])) {
      invalid = true;
      continue;
    }
    if (!isPlainObject(item.qtyByLocation)) {
      invalid = true;
      continue;
    }
    if (!(item.globalAvgCost === null || isFiniteNumber(item.globalAvgCost))) invalid = true;

    for (const [locationId, quantity] of Object.entries(item.qtyByLocation)) {
      if (!locationIds.has(locationId) || !isFiniteNumber(quantity)) invalid = true;
    }
  }

  if (invalid) pushError(errors, 'INVALID_INVENTORY');
}

function validateJsonSafeArray(value, errorCode, errors) {
  if (!Array.isArray(value) || !isJsonSafe(value)) {
    pushError(errors, errorCode);
  }
}

function validateLaborerInventory(laborerInventory, errors) {
  if (!isPlainObject(laborerInventory)) {
    pushError(errors, 'INVALID_LABORER_INVENTORY');
    return;
  }

  let invalid = false;
  if (Object.hasOwn(laborerInventory, '滿日記本')) pushError(errors, 'LEGACY_FIELD_NOT_ALLOWED');
  if (!hasExactKeys(laborerInventory, LABORER_CATEGORIES)) invalid = true;

  for (const category of LABORER_CATEGORIES) {
    const qualityMap = laborerInventory[category];
    if (!isPlainObject(qualityMap) || !hasExactKeys(qualityMap, SUPPORTED_LABORER_QUALITIES)) {
      invalid = true;
      continue;
    }
    for (const quantity of Object.values(qualityMap)) {
      if (!isFiniteNumber(quantity)) invalid = true;
    }
  }

  if (invalid) pushError(errors, 'INVALID_LABORER_INVENTORY');
}

function validateState(state) {
  const errors = [];

  if (!isPlainObject(state)) {
    pushError(errors, 'INVALID_ROOT_STATE');
    return orderedErrors(errors);
  }

  if (Object.hasOwn(state, 'customLocations')) pushError(errors, 'LEGACY_FIELD_NOT_ALLOWED');
  if (!hasExactKeys(state, ROOT_KEYS)) pushError(errors, 'INVALID_ROOT_STATE');
  if (state.schemaVersion !== 1) pushError(errors, 'UNSUPPORTED_SCHEMA_VERSION');

  validateAssets(state.assets, errors);
  const locationIds = validateLocationRegistry(state.locationRegistry, errors);
  validateInventory(state.inventory, locationIds, errors);
  validateJsonSafeArray(state.transactions, 'INVALID_TRANSACTIONS', errors);
  validateLaborerInventory(state.laborerInventory, errors);
  validateJsonSafeArray(state.laborerLogs, 'INVALID_LABORER_LOGS', errors);

  return orderedErrors(errors);
}

export function encodeNewSchemaState(state) {
  try {
    const errors = validateState(state);
    if (errors.length > 0) {
      return { ok: false, serialized: null, errors };
    }

    return {
      ok: true,
      serialized: JSON.stringify(state),
      errors: []
    };
  } catch {
    return {
      ok: false,
      serialized: null,
      errors: ['STORAGE_CODEC_ABORTED']
    };
  }
}

export function decodeNewSchemaState(serialized) {
  try {
    if (typeof serialized !== 'string') {
      return { ok: false, state: null, errors: ['INVALID_SERIALIZED_INPUT'] };
    }

    let parsed;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      return { ok: false, state: null, errors: ['INVALID_JSON'] };
    }

    const errors = validateState(parsed);
    if (errors.length > 0) {
      return { ok: false, state: null, errors };
    }

    return {
      ok: true,
      state: parsed,
      errors: []
    };
  } catch {
    return {
      ok: false,
      state: null,
      errors: ['STORAGE_CODEC_ABORTED']
    };
  }
}
