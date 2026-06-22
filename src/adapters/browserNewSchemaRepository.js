import { createBrowserStorageBackend } from './browserStorageBackend.js';
import { createNewSchemaStorageRepository } from './newSchemaStorageRepository.js';

export function createBrowserNewSchemaRepository(storage) {
  const binding = createBrowserStorageBackend(storage);

  if (!binding.ok) {
    return {
      ok: false,
      repository: null,
      errors: [...binding.errors]
    };
  }

  return {
    ok: true,
    repository: createNewSchemaStorageRepository(binding.backend),
    errors: []
  };
}
