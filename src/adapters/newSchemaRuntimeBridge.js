const RUNTIME_LOCATION_MAPPING_ERROR = 'RUNTIME_LOCATION_MAPPING_FAILED';
const CANONICAL_LABORER_JOURNAL_KEY = '滿日誌';
const RUNTIME_LABORER_JOURNAL_KEY = '滿日記本';
const RUNTIME_LABORER_LOCATION_KEY = 'LaborerIsland';
const CANONICAL_LABORER_LOCATION_ID = 'laborer_island';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(item => clone(item));
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function fail() {
  return {
    ok: false,
    state: null,
    errors: [RUNTIME_LOCATION_MAPPING_ERROR]
  };
}

function success(state) {
  return {
    ok: true,
    state,
    errors: []
  };
}

function runtimeKeyForLocation(locationId, registry) {
  if (locationId === CANONICAL_LABORER_LOCATION_ID) return RUNTIME_LABORER_LOCATION_KEY;

  const entry = registry?.[locationId];
  if (!entry || typeof entry.displayName !== 'string' || entry.displayName.length === 0) return null;
  if (entry.type === 'custom' && entry.active !== true) return null;
  return entry.displayName;
}

function buildRuntimeToLocationIdMap(registry) {
  if (!isPlainObject(registry)) return null;

  const runtimeToLocationId = new Map();

  for (const [locationId, entry] of Object.entries(registry)) {
    if (!isPlainObject(entry) || entry.locationId !== locationId) return null;
    if (entry.type === 'custom' && entry.active !== true) continue;

    const runtimeKey = runtimeKeyForLocation(locationId, registry);
    if (!runtimeKey || runtimeToLocationId.has(runtimeKey)) return null;
    runtimeToLocationId.set(runtimeKey, locationId);
  }

  return runtimeToLocationId;
}

function projectInventoryToRuntime(inventory, registry) {
  if (!isPlainObject(inventory)) return null;

  const runtimeInventory = {};

  for (const [itemKey, item] of Object.entries(inventory)) {
    if (!isPlainObject(item) || !isPlainObject(item.qtyByLocation)) return null;

    const qtyByCity = {};
    for (const [locationId, quantity] of Object.entries(item.qtyByLocation)) {
      const runtimeKey = runtimeKeyForLocation(locationId, registry);
      if (!runtimeKey || Object.hasOwn(qtyByCity, runtimeKey)) return null;
      qtyByCity[runtimeKey] = clone(quantity);
    }

    runtimeInventory[itemKey] = {
      qtyByCity,
      globalAvgCost: clone(item.globalAvgCost)
    };
  }

  return runtimeInventory;
}

function projectInventoryToCanonical(inventory, runtimeToLocationId) {
  if (!isPlainObject(inventory)) return null;

  const canonicalInventory = {};

  for (const [itemKey, item] of Object.entries(inventory)) {
    if (!isPlainObject(item) || !isPlainObject(item.qtyByCity)) return null;

    const qtyByLocation = {};
    for (const [runtimeKey, quantity] of Object.entries(item.qtyByCity)) {
      const locationId = runtimeToLocationId.get(runtimeKey);
      if (!locationId || Object.hasOwn(qtyByLocation, locationId)) return null;
      qtyByLocation[locationId] = clone(quantity);
    }

    canonicalInventory[itemKey] = {
      qtyByLocation,
      globalAvgCost: clone(item.globalAvgCost)
    };
  }

  return canonicalInventory;
}

function projectLaborerInventory(laborerInventory, fromKey, toKey) {
  if (!isPlainObject(laborerInventory)) return clone(laborerInventory);

  const projected = {};
  for (const [category, values] of Object.entries(laborerInventory)) {
    projected[category === fromKey ? toKey : category] = clone(values);
  }

  return projected;
}

function activeCustomLocationNames(registry) {
  return Object.values(registry)
    .filter(entry => entry.type === 'custom' && entry.active === true)
    .map(entry => entry.displayName);
}

function runtimeCustomLocationsMatchRegistry(runtimeCustomLocations, registry) {
  if (!Array.isArray(runtimeCustomLocations)) return false;

  const expected = activeCustomLocationNames(registry);
  return (
    runtimeCustomLocations.length === expected.length &&
    expected.every((name, index) => runtimeCustomLocations[index] === name)
  );
}

export function projectNewSchemaToRuntime(newSchemaState) {
  try {
    const registry = newSchemaState?.locationRegistry;
    const inventory = projectInventoryToRuntime(newSchemaState?.inventory, registry);

    if (!inventory) return fail();

    return success({
      schemaVersion: 1,
      assets: clone(newSchemaState.assets),
      inventory,
      customLocations: activeCustomLocationNames(registry),
      locationRegistry: clone(registry),
      transactions: clone(newSchemaState.transactions),
      laborerInventory: projectLaborerInventory(
        newSchemaState.laborerInventory,
        CANONICAL_LABORER_JOURNAL_KEY,
        RUNTIME_LABORER_JOURNAL_KEY
      ),
      laborerLogs: clone(newSchemaState.laborerLogs)
    });
  } catch {
    return fail();
  }
}

export function projectRuntimeToNewSchema(runtimeState) {
  try {
    const registry = runtimeState?.locationRegistry;
    const runtimeToLocationId = buildRuntimeToLocationIdMap(registry);

    if (!runtimeToLocationId || !runtimeCustomLocationsMatchRegistry(runtimeState?.customLocations, registry)) {
      return fail();
    }

    const inventory = projectInventoryToCanonical(runtimeState?.inventory, runtimeToLocationId);
    if (!inventory) return fail();

    return success({
      schemaVersion: 1,
      assets: clone(runtimeState.assets),
      inventory,
      locationRegistry: clone(registry),
      transactions: clone(runtimeState.transactions),
      laborerInventory: projectLaborerInventory(
        runtimeState.laborerInventory,
        RUNTIME_LABORER_JOURNAL_KEY,
        CANONICAL_LABORER_JOURNAL_KEY
      ),
      laborerLogs: clone(runtimeState.laborerLogs)
    });
  } catch {
    return fail();
  }
}
