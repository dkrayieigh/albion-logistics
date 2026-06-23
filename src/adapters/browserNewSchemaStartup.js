import { createBrowserNewSchemaRepository } from './browserNewSchemaRepository.js';

export function loadBrowserNewSchemaState(storage) {
  const composition = createBrowserNewSchemaRepository(storage);

  if (!composition.ok) {
    return {
      ok: false,
      status: 'error',
      state: null,
      errors: [...composition.errors]
    };
  }

  try {
    return composition.repository.load();
  } catch {
    return {
      ok: false,
      status: 'error',
      state: null,
      errors: ['STORAGE_READ_FAILED']
    };
  }
}

export function resolveBrowserNewSchemaStartup(storage) {
  const loaded = loadBrowserNewSchemaState(storage);

  if (loaded.ok && loaded.status === 'loaded') {
    return {
      ok: true,
      mode: 'ready',
      state: loaded.state,
      sourceStatus: 'loaded',
      errors: []
    };
  }

  if (loaded.ok && loaded.status === 'missing') {
    return {
      ok: true,
      mode: 'initialize',
      state: null,
      sourceStatus: 'missing',
      errors: []
    };
  }

  return {
    ok: false,
    mode: 'blocked',
    state: null,
    sourceStatus: loaded.status,
    errors: [...loaded.errors]
  };
}
