import { QUAL_GROUPS } from '../data/constants.js';

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

const ERROR_ORDER = [
  'INVALID_CASH',
  'INVALID_DEBT',
  'INVALID_CUSTOM_LOCATION_NAME',
  'DUPLICATE_CUSTOM_LOCATION_REF',
  'DUPLICATE_CUSTOM_LOCATION_NAME',
  'SYSTEM_LOCATION_NAME_CONFLICT',
  'CUSTOM_LOCATION_ID_GENERATION_FAILED',
  'INVALID_INVENTORY_SEED',
  'INVALID_LOCATION_REFERENCE',
  'INVALID_CUSTOM_LOCATION_REF',
  'UNKNOWN_LOCATION_ID',
  'DUPLICATE_INVENTORY_SEED',
  'INITIALIZATION_ABORTED'
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pushError(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function orderedErrors(errors) {
  return ERROR_ORDER.filter(code => errors.includes(code));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : null;
}

function isValidCostBasis(value) {
  return value === null || isFiniteNumber(value);
}

function buildLaborerInventory() {
  const qualities = [
    ...new Set([
      ...QUAL_GROUPS.flatMap(group => group.items),
      '4.0',
      '5.0',
      '6.0',
      '7.0',
      '8.0'
    ])
  ];
  const laborerInventory = {};

  for (const category of LABORER_CATEGORIES) {
    laborerInventory[category] = {};
    for (const quality of qualities) laborerInventory[category][quality] = 0;
  }

  return laborerInventory;
}

function cloneFixedRegistry() {
  return Object.fromEntries(Object.entries(FIXED_LOCATION_REGISTRY).map(([key, value]) => [key, { ...value }]));
}

function validateCustomLocations(customLocations, options, errors) {
  const entries = [];
  const refSet = new Set();
  const nameSet = new Set();
  const systemNames = new Set(Object.values(FIXED_LOCATION_REGISTRY).map(entry => entry.displayName.trim().toLocaleLowerCase()));

  if (!Array.isArray(customLocations)) {
    pushError(errors, 'INVALID_CUSTOM_LOCATION_NAME');
    return { entries, refToLocationId: new Map(), registryEntries: [] };
  }

  for (const location of customLocations) {
    if (!isPlainObject(location)) {
      pushError(errors, 'INVALID_CUSTOM_LOCATION_REF');
      pushError(errors, 'INVALID_CUSTOM_LOCATION_NAME');
      continue;
    }

    const clientRef = trimString(location.clientRef);
    const displayName = trimString(location.displayName);

    if (!clientRef) pushError(errors, 'INVALID_CUSTOM_LOCATION_REF');
    else if (refSet.has(clientRef)) pushError(errors, 'DUPLICATE_CUSTOM_LOCATION_REF');
    else refSet.add(clientRef);

    if (!displayName) pushError(errors, 'INVALID_CUSTOM_LOCATION_NAME');
    else {
      const normalizedName = displayName.toLocaleLowerCase();
      if (nameSet.has(normalizedName)) pushError(errors, 'DUPLICATE_CUSTOM_LOCATION_NAME');
      else nameSet.add(normalizedName);
      if (systemNames.has(normalizedName)) pushError(errors, 'SYSTEM_LOCATION_NAME_CONFLICT');
    }

    if (clientRef && displayName) entries.push({ clientRef, displayName });
  }

  const refToLocationId = new Map();
  const registryEntries = [];
  const generatedIds = new Set();

  if (entries.length > 0 && typeof options.generateCustomLocationId !== 'function') {
    pushError(errors, 'CUSTOM_LOCATION_ID_GENERATION_FAILED');
    return { entries, refToLocationId, registryEntries };
  }

  for (const entry of entries) {
    let locationId;
    try {
      locationId = options.generateCustomLocationId();
    } catch {
      pushError(errors, 'CUSTOM_LOCATION_ID_GENERATION_FAILED');
      continue;
    }

    if (
      typeof locationId !== 'string' ||
      !locationId.startsWith('custom:') ||
      locationId.slice('custom:'.length).trim().length === 0 ||
      Object.hasOwn(FIXED_LOCATION_REGISTRY, locationId) ||
      generatedIds.has(locationId)
    ) {
      pushError(errors, 'CUSTOM_LOCATION_ID_GENERATION_FAILED');
      continue;
    }

    generatedIds.add(locationId);
    refToLocationId.set(entry.clientRef, locationId);
    registryEntries.push({
      locationId,
      displayName: entry.displayName,
      type: 'custom',
      active: true
    });
  }

  return { entries, refToLocationId, registryEntries };
}

function validateInventorySeeds(seeds, refToLocationId, errors, suppressCustomRefErrors = false) {
  const normalizedSeeds = [];
  const seedIdentities = new Set();
  const itemCosts = new Map();

  if (!Array.isArray(seeds)) {
    pushError(errors, 'INVALID_INVENTORY_SEED');
    return normalizedSeeds;
  }

  for (const seed of seeds) {
    if (!isPlainObject(seed)) {
      pushError(errors, 'INVALID_INVENTORY_SEED');
      continue;
    }

    const itemKey = trimString(seed.itemKey);
    const hasLocationId = Object.hasOwn(seed, 'locationId');
    const hasCustomRef = Object.hasOwn(seed, 'customLocationRef');
    const locationId = trimString(seed.locationId);
    const customLocationRef = trimString(seed.customLocationRef);
    const globalAvgCost = Object.hasOwn(seed, 'globalAvgCost') ? seed.globalAvgCost : null;
    let resolvedLocationId = null;

    if (!itemKey || !isFiniteNumber(seed.quantity) || !isValidCostBasis(globalAvgCost)) {
      pushError(errors, 'INVALID_INVENTORY_SEED');
    }

    if ((hasLocationId && hasCustomRef) || (!hasLocationId && !hasCustomRef)) {
      pushError(errors, 'INVALID_LOCATION_REFERENCE');
    } else if (hasLocationId) {
      if (!locationId) pushError(errors, 'INVALID_LOCATION_REFERENCE');
      else if (!Object.hasOwn(FIXED_LOCATION_REGISTRY, locationId)) {
        pushError(errors, 'UNKNOWN_LOCATION_ID');
      } else resolvedLocationId = locationId;
    } else if (hasCustomRef) {
      if (!customLocationRef || !refToLocationId.has(customLocationRef)) {
        if (!suppressCustomRefErrors) pushError(errors, 'INVALID_CUSTOM_LOCATION_REF');
      }
      else resolvedLocationId = refToLocationId.get(customLocationRef);
    }

    if (itemKey && resolvedLocationId) {
      const identity = `${itemKey}|${resolvedLocationId}`;
      if (seedIdentities.has(identity)) pushError(errors, 'DUPLICATE_INVENTORY_SEED');
      else seedIdentities.add(identity);

      if (itemCosts.has(itemKey) && itemCosts.get(itemKey) !== globalAvgCost) pushError(errors, 'INVALID_INVENTORY_SEED');
      else itemCosts.set(itemKey, globalAvgCost);
    }

    if (itemKey && resolvedLocationId && isFiniteNumber(seed.quantity) && isValidCostBasis(globalAvgCost)) {
      normalizedSeeds.push({
        itemKey,
        locationId: resolvedLocationId,
        quantity: seed.quantity,
        globalAvgCost
      });
    }
  }

  return normalizedSeeds;
}

export function createCleanInitialState(input, options = {}) {
  try {
    const errors = [];
    const source = isPlainObject(input) ? input : {};
    const cash = source.cash;
    const debt = Object.hasOwn(source, 'debt') ? source.debt : 0;
    const customLocations = Object.hasOwn(source, 'customLocations') ? source.customLocations : [];
    const inventorySeeds = Object.hasOwn(source, 'inventorySeeds') ? source.inventorySeeds : [];

    if (!isFiniteNumber(cash)) pushError(errors, 'INVALID_CASH');
    if (!isFiniteNumber(debt)) pushError(errors, 'INVALID_DEBT');

    const customResult = validateCustomLocations(customLocations, options, errors);
    const normalizedSeeds = validateInventorySeeds(
      inventorySeeds,
      customResult.refToLocationId,
      errors,
      errors.includes('CUSTOM_LOCATION_ID_GENERATION_FAILED')
    );

    if (errors.length > 0) {
      return {
        ok: false,
        state: null,
        errors: orderedErrors(errors)
      };
    }

    const inventory = {};
    for (const seed of normalizedSeeds) {
      if (!inventory[seed.itemKey]) {
        inventory[seed.itemKey] = {
          qtyByLocation: {},
          globalAvgCost: seed.globalAvgCost
        };
      }
      inventory[seed.itemKey].qtyByLocation[seed.locationId] = seed.quantity;
    }

    return {
      ok: true,
      state: {
        schemaVersion: 1,
        assets: { cash, debt },
        inventory,
        locationRegistry: {
          ...cloneFixedRegistry(),
          ...Object.fromEntries(customResult.registryEntries.map(entry => [entry.locationId, { ...entry }]))
        },
        transactions: [],
        laborerInventory: buildLaborerInventory(),
        laborerLogs: []
      },
      errors: []
    };
  } catch {
    return {
      ok: false,
      state: null,
      errors: ['INITIALIZATION_ABORTED']
    };
  }
}
