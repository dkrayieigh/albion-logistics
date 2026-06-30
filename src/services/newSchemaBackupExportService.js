import { createBackup } from '../adapters/newSchemaBackupCodec.js';

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

function errorResult(status, errors, innerErrors = []) {
  return {
    ok: false,
    status,
    backupText: null,
    envelope: null,
    errors,
    innerErrors
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
  if (!repository || typeof repository.load !== 'function') {
    return errorResult('error', ['INVALID_STORAGE_BACKEND']);
  }

  let loaded;
  try {
    loaded = repository.load();
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
    return errorResult('invalid', ['INVALID_BACKUP_STATE'], loaded.errors || []);
  }

  if (Array.isArray(loaded.errors) && loaded.errors.length > 0) {
    return errorResult('error', loaded.errors);
  }

  return errorResult('error', ['STORAGE_READ_FAILED']);
}
