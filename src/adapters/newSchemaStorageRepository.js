import {
  encodeNewSchemaState,
  decodeNewSchemaState
} from './newSchemaStorageCodec.js';

const NEW_SCHEMA_STORAGE_KEY = 'albion-logistics-v2-state';

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isThenable(value) {
  return value !== null && typeof value === 'object' && typeof value.then === 'function';
}

function isValidBackend(backend) {
  return (
    isPlainObject(backend) &&
    typeof backend.getItem === 'function' &&
    typeof backend.setItem === 'function'
  );
}

function invalidBackendLoadResult() {
  return {
    ok: false,
    status: 'error',
    state: null,
    errors: ['INVALID_STORAGE_BACKEND']
  };
}

function invalidBackendSaveResult() {
  return {
    ok: false,
    status: 'error',
    errors: ['INVALID_STORAGE_BACKEND']
  };
}

export function createNewSchemaStorageRepository(backend) {
  return {
    load() {
      if (!isValidBackend(backend)) return invalidBackendLoadResult();

      let serialized;
      try {
        serialized = backend.getItem(NEW_SCHEMA_STORAGE_KEY);
      } catch {
        return {
          ok: false,
          status: 'error',
          state: null,
          errors: ['STORAGE_READ_FAILED']
        };
      }

      if (serialized === null) {
        return {
          ok: true,
          status: 'missing',
          state: null,
          errors: []
        };
      }

      if (typeof serialized !== 'string' || isThenable(serialized)) {
        return {
          ok: false,
          status: 'error',
          state: null,
          errors: ['STORAGE_READ_FAILED']
        };
      }

      const decoded = decodeNewSchemaState(serialized);
      if (!decoded.ok) {
        return {
          ok: false,
          status: 'invalid',
          state: null,
          errors: decoded.errors
        };
      }

      return {
        ok: true,
        status: 'loaded',
        state: decoded.state,
        errors: []
      };
    },

    save(state) {
      if (!isValidBackend(backend)) return invalidBackendSaveResult();

      const encoded = encodeNewSchemaState(state);
      if (!encoded.ok) {
        return {
          ok: false,
          status: 'invalid',
          errors: encoded.errors
        };
      }

      try {
        const result = backend.setItem(NEW_SCHEMA_STORAGE_KEY, encoded.serialized);
        if (isThenable(result)) {
          return {
            ok: false,
            status: 'error',
            errors: ['STORAGE_WRITE_FAILED']
          };
        }
      } catch {
        return {
          ok: false,
          status: 'error',
          errors: ['STORAGE_WRITE_FAILED']
        };
      }

      return {
        ok: true,
        status: 'saved',
        errors: []
      };
    }
  };
}
