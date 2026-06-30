import { parseBackup } from '../adapters/newSchemaBackupCodec.js';
import {
  decodeNewSchemaState,
  encodeNewSchemaState
} from '../adapters/newSchemaStorageCodec.js';
import { NEW_SCHEMA_STORAGE_KEY } from '../adapters/newSchemaStorageRepository.js';

const ERROR_ORDER = [
  'INVALID_BACKUP_TEXT',
  'INVALID_JSON',
  'INVALID_BACKUP_ROOT',
  'AMBIGUOUS_BACKUP_FORMAT',
  'UNSUPPORTED_BACKUP_FORMAT',
  'UNSUPPORTED_BACKUP_VERSION',
  'INVALID_EXPORTED_AT',
  'INVALID_BACKUP_STATE',
  'LEGACY_BACKUP_REQUIRES_LEGACY_PATH',
  'INVALID_STORAGE_BACKEND',
  'STORAGE_READ_FAILED',
  'STORAGE_WRITE_FAILED',
  'STORAGE_VERIFICATION_FAILED',
  'ROLLBACK_FAILED'
];

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

function normalizeTopLevelErrors(errors) {
  if (!Array.isArray(errors)) return [];
  return ERROR_ORDER.filter(code => errors.includes(code));
}

function normalizeInnerErrors(innerErrors) {
  if (!Array.isArray(innerErrors)) return [];
  const normalized = [];
  for (const code of innerErrors) {
    if (typeof code === 'string' && !normalized.includes(code)) normalized.push(code);
  }
  return normalized;
}

function result(ok, status, state, errors = [], innerErrors = []) {
  return {
    ok,
    status,
    state,
    errors: normalizeTopLevelErrors(errors),
    innerErrors: normalizeInnerErrors(innerErrors)
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeDeepEqual(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => safeDeepEqual(value, right[index]));
  }
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false;
  }

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!safeDeepEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every(key => safeDeepEqual(left[key], right[key]));
}

function resolveMethods(backend) {
  if (backend === null || (typeof backend !== 'object' && typeof backend !== 'function')) {
    return { ok: false, methods: null };
  }

  try {
    const getItem = backend.getItem;
    const setItem = backend.setItem;
    const removeItem = backend.removeItem;
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

function readSnapshot(backend, methods) {
  try {
    const raw = methods.getItem.call(backend, NEW_SCHEMA_STORAGE_KEY);
    if (isThenable(raw) || (raw !== null && typeof raw !== 'string')) {
      return { ok: false, raw: null };
    }
    return { ok: true, raw };
  } catch {
    return { ok: false, raw: null };
  }
}

function writeValue(backend, methods, value) {
  try {
    const writeResult = methods.setItem.call(backend, NEW_SCHEMA_STORAGE_KEY, value);
    return !isThenable(writeResult);
  } catch {
    return false;
  }
}

function removeValue(backend, methods) {
  try {
    const removeResult = methods.removeItem.call(backend, NEW_SCHEMA_STORAGE_KEY);
    return !isThenable(removeResult);
  } catch {
    return false;
  }
}

function verifyRollback(backend, methods, originalRaw) {
  const snapshot = readSnapshot(backend, methods);
  if (!snapshot.ok) return false;
  return originalRaw === null ? snapshot.raw === null : snapshot.raw === originalRaw;
}

function rollback(backend, methods, originalRaw, primaryError) {
  const rolledBack = originalRaw === null
    ? removeValue(backend, methods)
    : writeValue(backend, methods, originalRaw);

  if (!rolledBack || !verifyRollback(backend, methods, originalRaw)) {
    return result(false, 'rollback-failed', null, ['ROLLBACK_FAILED'], [primaryError]);
  }

  return result(false, 'error', null, [primaryError]);
}

function verifyCommittedState(raw, expectedState) {
  if (typeof raw !== 'string' || isThenable(raw)) return false;
  const decoded = decodeNewSchemaState(raw);
  if (!decoded.ok) return false;
  return safeDeepEqual(decoded.state, expectedState);
}

export function restoreBackup(storageBackend, backupText) {
  const parsed = parseBackup(backupText);
  if (!parsed.ok) {
    return result(false, 'invalid', null, parsed.errors, parsed.innerErrors);
  }

  if (parsed.status === 'legacy') {
    return result(false, 'invalid', null, ['LEGACY_BACKUP_REQUIRES_LEGACY_PATH']);
  }

  const encoded = encodeNewSchemaState(parsed.state);
  if (!encoded.ok) {
    return result(false, 'invalid', null, ['INVALID_BACKUP_STATE'], encoded.errors);
  }

  const resolved = resolveMethods(storageBackend);
  if (!resolved.ok) return result(false, 'error', null, ['INVALID_STORAGE_BACKEND']);
  const { methods } = resolved;

  const original = readSnapshot(storageBackend, methods);
  if (!original.ok) return result(false, 'error', null, ['STORAGE_READ_FAILED']);

  if (!writeValue(storageBackend, methods, encoded.serialized)) {
    return rollback(storageBackend, methods, original.raw, 'STORAGE_WRITE_FAILED');
  }

  const readBack = readSnapshot(storageBackend, methods);
  if (!readBack.ok || !verifyCommittedState(readBack.raw, parsed.state)) {
    return rollback(storageBackend, methods, original.raw, 'STORAGE_VERIFICATION_FAILED');
  }

  return result(true, 'committed', cloneJson(parsed.state));
}
