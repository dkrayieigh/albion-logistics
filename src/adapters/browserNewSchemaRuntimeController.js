import { createBrowserNewSchemaRepository } from './browserNewSchemaRepository.js';
import { resolveBrowserNewSchemaStartup } from './browserNewSchemaStartup.js';
import {
  projectNewSchemaToRuntime,
  projectRuntimeToNewSchema
} from './newSchemaRuntimeBridge.js';

export function createBrowserNewSchemaRuntimeController(storage) {
  const composition = createBrowserNewSchemaRepository(storage);

  if (!composition.ok) {
    return {
      ok: false,
      controller: null,
      errors: [...composition.errors]
    };
  }

  return {
    ok: true,
    controller: {
      start() {
        const decision = resolveBrowserNewSchemaStartup(storage);

        if (decision.ok && decision.mode === 'ready') {
          const projected = projectNewSchemaToRuntime(decision.state);

          if (!projected.ok) {
            return {
              ok: false,
              mode: 'blocked',
              state: null,
              sourceStatus: 'projection-error',
              errors: [...projected.errors]
            };
          }

          return {
            ok: true,
            mode: 'ready',
            state: projected.state,
            sourceStatus: 'loaded',
            errors: []
          };
        }

        return {
          ok: decision.ok,
          mode: decision.mode,
          state: null,
          sourceStatus: decision.sourceStatus,
          errors: [...decision.errors]
        };
      },

      save(runtimeState) {
        const projected = projectRuntimeToNewSchema(runtimeState);

        if (!projected.ok) {
          return {
            ok: false,
            status: 'invalid-runtime',
            state: null,
            errors: [...projected.errors]
          };
        }

        const saved = composition.repository.save(projected.state);

        if (!saved.ok) {
          return {
            ok: false,
            status: saved.status,
            state: null,
            errors: [...saved.errors]
          };
        }

        return {
          ok: true,
          status: 'saved',
          state: projected.state,
          errors: []
        };
      }
    },
    errors: []
  };
}
