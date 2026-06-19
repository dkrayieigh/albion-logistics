const SYSTEM_LOCATION_IDS = {
  Thetford: 'thetford',
  Martlock: 'martlock',
  Bridgewatch: 'bridgewatch',
  Lymhurst: 'lymhurst',
  'Fort Sterling': 'fort_sterling',
  Caerleon: 'caerleon',
  Brecilien: 'brecilien',
  LaborerIsland: 'laborer_island'
};

function makeUnresolved(sourceName, deprecatedLegacyKey = false) {
  return {
    sourceName,
    locationId: null,
    displayName: null,
    source: 'legacy',
    unresolved: true,
    deprecatedLegacyKey
  };
}

function normalizeForConflict(name) {
  return String(name).trim().toLocaleLowerCase();
}

function getMappingConflicts(mappingTable) {
  const seen = new Map();
  const conflicts = new Set();

  if (!mappingTable || typeof mappingTable !== 'object') return conflicts;

  for (const [legacyName, entry] of Object.entries(mappingTable)) {
    const names = [legacyName];
    if (entry && typeof entry === 'object' && typeof entry.displayName === 'string') names.push(entry.displayName);

    for (const name of names) {
      const normalized = normalizeForConflict(name);
      const locationId = entry && typeof entry === 'object' && typeof entry.locationId === 'string' ? entry.locationId : null;
      const previous = seen.get(normalized);
      if (previous && (previous.legacyName !== legacyName || previous.locationId !== locationId)) conflicts.add(normalized);
      else seen.set(normalized, { legacyName, locationId });
    }
  }

  return conflicts;
}

export function resolveLocationIdentity(input) {
  const sourceName = typeof input?.sourceName === 'string' ? input.sourceName : String(input?.sourceName ?? '');
  const mappingTable = input?.mappingTable;

  if (sourceName === 'Hideout') return makeUnresolved(sourceName, true);
  if (Object.hasOwn(SYSTEM_LOCATION_IDS, sourceName)) {
    return {
      sourceName,
      locationId: SYSTEM_LOCATION_IDS[sourceName],
      displayName: sourceName,
      source: 'legacy',
      unresolved: false,
      deprecatedLegacyKey: false
    };
  }

  const sourceNameConflictKey = normalizeForConflict(sourceName);
  if (getMappingConflicts(mappingTable).has(sourceNameConflictKey)) return makeUnresolved(sourceName);

  if (!mappingTable || typeof mappingTable !== 'object') return makeUnresolved(sourceName);

  for (const [legacyName, entry] of Object.entries(mappingTable)) {
    if (sourceName !== legacyName && sourceName !== entry?.displayName) continue;
    if (!entry || typeof entry !== 'object' || typeof entry.locationId !== 'string' || entry.locationId === '') {
      return makeUnresolved(sourceName);
    }

    return {
      sourceName,
      locationId: entry.locationId,
      displayName: typeof entry.displayName === 'string' ? entry.displayName : legacyName,
      source: 'legacy',
      unresolved: false,
      deprecatedLegacyKey: false
    };
  }

  return makeUnresolved(sourceName);
}
