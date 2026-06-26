# Albion Logistics ERP Project Handoff

## Current Status

- Phase: production new-schema startup/read-write cutover stabilization.
- Test baseline: 299 tests / 299 pass / 0 fail / 0 TODO.
- Selected Location strategy: single-user clean cutover.
- Location schema contract, pure state/codec helpers, injected repository, browser Storage backend binding, browser new-schema repository composition helper, startup loader/decision helpers, runtime compatibility bridge, runtime controller, and production app startup cutover exist.
- Migration/backfill: not started.
- Tauri release build: pass; MSI bundle: pass; NSIS bundle: pass.

## Current Implemented Safety Layers

- Item identity read-only adapter.
- Location map read-only adapter.
- Location identity read-only resolver.
- Location migration validator as research / verification utility.
- Pure clean-state initializer: `createCleanInitialState()`.
- Pure new-schema storage codec: `encodeNewSchemaState()` / `decodeNewSchemaState()`.
- Injected new-schema storage repository: `createNewSchemaStorageRepository(backend)`.
- Explicit injected browser Storage backend binding: `createBrowserStorageBackend(storage)`.
- Explicit injected browser new-schema repository composition: `createBrowserNewSchemaRepository(storage)`.
- Isolated browser new-schema startup loader: `loadBrowserNewSchemaState(storage)`.
- Startup ready/initialize/blocked decision boundary: `resolveBrowserNewSchemaStartup(storage)`.
- Bidirectional runtime compatibility bridge: `projectNewSchemaToRuntime(newSchemaState)` / `projectRuntimeToNewSchema(runtimeState)`.
- Production browser new-schema runtime controller: `createBrowserNewSchemaRuntimeController(storage)`.
- Production state API integration: `enableNewSchemaRuntime(storage)` / `initializeNewSchemaRuntime(storage, input, options)`.
- Production startup modes: ready / initialize / blocked.
- Explicit user-confirmed clean initialization.
- Runtime inventory default hydration.
- Production new-schema save path when runtime controller is active.
- Canonical/runtime laborer leather support.
- UI quality matrix and laborer form polish.
- Transaction mixed-format reader.
- Current regression suite.

## Current Data Strategy

- Legacy backup is retained externally as archive evidence.
- No automatic legacy migration.
- Initial transactions are empty.
- Cash is manually entered.
- Inventory is manually verified and entered.
- `globalAvgCost` defaults to `null` unless a reliable basis exists.
- Custom locations are recreated manually.
- Legacy `globalAvgCost: 0` must not be treated as reliable unknown-cost evidence.

## Current Production Startup Behavior

- Ready: read `albion-logistics-v2-state`, project canonical state to runtime state, hydrate runtime defaults, and route `saveState()` through the new-schema save path.
- Initialize confirmed: create clean canonical state, save it to the new key, then activate runtime mode.
- Initialize cancelled: explicitly use legacy mode through the existing legacy load path.
- Blocked: invalid/error startup does not create empty data and does not silently fall back to legacy mode.
- Legacy path remains available only for explicit initialize-cancel behavior.

## Current Blockers

- Custom location UI is not yet integrated with Location Registry / stable custom IDs.
- Backup import/export remains legacy-only.
- Factory Reset still uses broad `localStorage.clear()`.
- Release smoke checklist is not complete.
- Production cutover docs/release process is not finalized.

## Next Approved Step

- Return to Spec Lead to design custom location writer integration.
- Do not self-approve backup, reset, migration, or release-process changes.

## High-Risk Boundaries

- No direct `state.js` rewrite.
- No automatic legacy `localStorage` deletion.
- No additional writer/storage switch without tests.
- No fallback removal by incidental refactor.
- No transaction history migration.
- No direct future-app import requirement for legacy backups.
- No Location Registry current implementation claim.
- Do not extend clean initialization, backup import/export, reset, custom location writer, or migration behavior until tests and implementation are explicitly approved.
