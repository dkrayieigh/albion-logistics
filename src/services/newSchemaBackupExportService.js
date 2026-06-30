import { createBackup } from '../adapters/newSchemaBackupCodec.js';

const SERVICE_ERROR_ORDER = [
  'INVALID_STORAGE_BACKEND',
  'STORAGE_READ_FAILED',
  'BACKUP_SOURCE_MISSING',
  'INVALID_BACKUP_STATE',
  'INVALID_EXPORTED_AT'
];

const REPOSITORY_ERROR_CODES = ['INVALID_STORAGE_BACKEND', 'STORAGE_READ_FAILED'];

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

function normalizeErrors(errors, allowedCodes, fallback) {
  if (!Array.isArray(errors)) return [fallback];
  const unique = [];
  for (const code of SERVICE_ERROR_ORDER) {
    if (allowedCodes.includes(code) && errors.includes(code) && !unique.includes(code)) {
      unique.push(code);
    }
  }
  return unique.length > 0 ? unique : [fallback];
}

function errorResult(status, errors, innerErrors = []) {
  return {
    ok: false,
    status,
    backupText: null,
    envelope: null,
    errors: Array.isArray(errors) ? [...errors] : [],
    innerErrors: Array.isArray(innerErrors) ? [...innerErrors] : []
  };
}

function createdResult(result) {
  return {
    ok: true,
    status: 'created',
    backupText: result.backupText,
    envelope: result.envelope,
    errors: [],
    innerErrors: []
  };
}

export function createBackupFromRepository(repository, options = {}) {
  if (repository === null || (typeof repository !== 'object' && typeof repository !== 'function')) {
    return errorResult('error', ['INVALID_STORAGE_BACKEND']);
  }

  let load;
  try {
    load = repository.load;
  } catch {
    return errorResult('error', ['INVALID_STORAGE_BACKEND']);
  }

  if (typeof load !== 'function') {
    return errorResult('error', ['INVALID_STORAGE_BACKEND']);
  }

  let loaded;
  try {
    loaded = load.call(repository);
  } catch {
    return errorResult('error', ['STORAGE_READ_FAILED']);
  }

  if (isThenable(loaded)) return errorResult('error', ['STORAGE_READ_FAILED']);

  if (!loaded || typeof loaded !== 'object') {
    return errorResult('error', ['STORAGE_READ_FAILED']);
  }

  if (loaded.ok === true && loaded.status === 'loaded') {
    const created = createBackup(loaded.state, options);
    if (!created.ok) {
      return errorResult('invalid', created.errors, created.innerErrors);
    }
    return createdResult(created);
  }

  if (loaded.ok === true && loaded.status === 'missing') {
    return errorResult('missing', ['BACKUP_SOURCE_MISSING']);
  }

  if (loaded.status === 'invalid') {
    return errorResult(
      'invalid',
      ['INVALID_BACKUP_STATE'],
      Array.isArray(loaded.errors) ? loaded.errors : []
    );
  }

  if (loaded.status === 'error') {
    return errorResult(
      'error',
      normalizeErrors(loaded.errors, REPOSITORY_ERROR_CODES, 'STORAGE_READ_FAILED')
    );
  }

  return errorResult('error', ['STORAGE_READ_FAILED']);
}
