import { NEW_SCHEMA_STORAGE_KEY } from '../adapters/newSchemaStorageRepository.js';

const LEGACY_STORAGE_KEYS = Object.freeze([
  'albion_crafting_stocks',
  'albion_crafting_assets',
  'albion_crafting_transactions',
  'albion_crafting_laborer_stocks',
  'albion_crafting_laborer_logs',
  'albion_crafting_custom_locs'
]);

export const ALBION_LOGISTICS_OWNED_STORAGE_KEYS = Object.freeze([
  NEW_SCHEMA_STORAGE_KEY,
  ...LEGACY_STORAGE_KEYS
]);

const TOP_LEVEL_ERROR_ORDER = Object.freeze([
  'INVALID_STORAGE_BACKEND',
  'STORAGE_READ_FAILED',
  'STORAGE_REMOVE_FAILED',
  'STORAGE_VERIFICATION_FAILED',
  'ROLLBACK_FAILED'
]);

const ROLLBACK_DIAGNOSTIC_ERRORS = Object.freeze([
  'STORAGE_READ_FAILED',
  'STORAGE_WRITE_FAILED',
  'STORAGE_REMOVE_FAILED',
  'STORAGE_VERIFICATION_FAILED'
]);

function normalizeTopLevelErrors(errors) {
  const normalized = [];
  for (const code of TOP_LEVEL_ERROR_ORDER) {
    if (errors.includes(code)) normalized.push(code);
  }
  return normalized;
}

function normalizeInnerErrors(errors) {
  const normalized = [];
  for (const code of errors) {
    if (
      typeof code === 'string' &&
      (ROLLBACK_DIAGNOSTIC_ERRORS.includes(code) || TOP_LEVEL_ERROR_ORDER.includes(code)) &&
      !normalized.includes(code)
    ) {
      normalized.push(code);
    }
  }
  return normalized;
}

function result(ok, status, errors = [], innerErrors = []) {
  return {
    ok,
    status,
    errors: normalizeTopLevelErrors(errors),
    innerErrors: normalizeInnerErrors(innerErrors)
  };
}

function isThenable(value) {
  try {
    return (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof value.then === 'function'
    );
  } catch {
    return true;
  }
}

function resolveMethods(storageBackend) {
  if (
    storageBackend === null ||
    (typeof storageBackend !== 'object' && typeof storageBackend !== 'function')
  ) {
    return { ok: false, methods: null };
  }

  try {
    const getItem = storageBackend.getItem;
    const setItem = storageBackend.setItem;
    const removeItem = storageBackend.removeItem;

    if (
      typeof getItem !== 'function' ||
      typeof setItem !== 'function' ||
      typeof removeItem !== 'function'
    ) {
      return { ok: false, methods: null };
    }

    return { ok: true, methods: { getItem, setItem, removeItem } };
  } catch {
    return { ok: false, methods: null };
  }
}

function readOwnedValue(storageBackend, methods, key) {
  try {
    const value = methods.getItem.call(storageBackend, key);
    if (isThenable(value) || (value !== null && typeof value !== 'string')) {
      return { ok: false, value: null };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, value: null };
  }
}

function writeOwnedValue(storageBackend, methods, key, value) {
  try {
    const writeResult = methods.setItem.call(storageBackend, key, value);
    return !isThenable(writeResult);
  } catch {
    return false;
  }
}

function removeOwnedValue(storageBackend, methods, key) {
  try {
    const removeResult = methods.removeItem.call(storageBackend, key);
    return !isThenable(removeResult);
  } catch {
    return false;
  }
}

function captureSnapshot(storageBackend, methods) {
  const snapshot = new Map();
  let hasExistingOwnedValue = false;

  for (const key of ALBION_LOGISTICS_OWNED_STORAGE_KEYS) {
    const read = readOwnedValue(storageBackend, methods, key);
    if (!read.ok) return { ok: false, snapshot, hasExistingOwnedValue: false };
    snapshot.set(key, read.value);
    if (read.value !== null) hasExistingOwnedValue = true;
  }

  return { ok: true, snapshot, hasExistingOwnedValue };
}

function verifyRemoved(storageBackend, methods) {
  for (const key of ALBION_LOGISTICS_OWNED_STORAGE_KEYS) {
    const read = readOwnedValue(storageBackend, methods, key);
    if (!read.ok || read.value !== null) return false;
  }
  return true;
}

function verifySnapshot(storageBackend, methods, snapshot) {
  let verified = true;

  for (const key of ALBION_LOGISTICS_OWNED_STORAGE_KEYS) {
    const read = readOwnedValue(storageBackend, methods, key);
    if (!read.ok || read.value !== snapshot.get(key)) verified = false;
  }

  return verified;
}

function addDiagnostic(diagnostics, code) {
  if (!diagnostics.includes(code)) diagnostics.push(code);
}

function rollback(storageBackend, methods, snapshot, primaryError) {
  const diagnostics = [primaryError];
  let failed = false;

  for (const key of ALBION_LOGISTICS_OWNED_STORAGE_KEYS) {
    const original = snapshot.get(key);
    const restored = original === null
      ? removeOwnedValue(storageBackend, methods, key)
      : writeOwnedValue(storageBackend, methods, key, original);
    if (!restored) {
      failed = true;
      addDiagnostic(diagnostics, original === null ? 'STORAGE_REMOVE_FAILED' : 'STORAGE_WRITE_FAILED');
    }
  }

  if (!verifySnapshot(storageBackend, methods, snapshot)) {
    failed = true;
    addDiagnostic(diagnostics, 'STORAGE_VERIFICATION_FAILED');
  }

  if (failed) {
    return result(false, 'rollback-failed', ['ROLLBACK_FAILED'], diagnostics);
  }

  return result(false, 'error', [primaryError]);
}

export function resetOwnedStorage(storageBackend) {
  const resolved = resolveMethods(storageBackend);
  if (!resolved.ok) return result(false, 'error', ['INVALID_STORAGE_BACKEND']);
  const { methods } = resolved;

  const snapshot = captureSnapshot(storageBackend, methods);
  if (!snapshot.ok) return result(false, 'error', ['STORAGE_READ_FAILED']);
  if (!snapshot.hasExistingOwnedValue) return result(true, 'reset-noop');

  for (const key of ALBION_LOGISTICS_OWNED_STORAGE_KEYS) {
    if (snapshot.snapshot.get(key) !== null && !removeOwnedValue(storageBackend, methods, key)) {
      return rollback(storageBackend, methods, snapshot.snapshot, 'STORAGE_REMOVE_FAILED');
    }
  }

  if (!verifyRemoved(storageBackend, methods)) {
    return rollback(storageBackend, methods, snapshot.snapshot, 'STORAGE_VERIFICATION_FAILED');
  }

  return result(true, 'reset-complete');
}
