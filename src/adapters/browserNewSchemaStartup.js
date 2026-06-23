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
