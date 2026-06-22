# Albion Logistics ERP Project Handoff

## Current Status

- Phase: legacy-compatible stabilization / clean-cutover preparation.
- Test baseline: 190 tests / 190 pass / 0 fail / 0 TODO.
- Selected Location strategy: single-user clean cutover.
- Location schema contract, pure state/codec helpers, injected repository, browser Storage backend binding, and browser new-schema repository composition helper exist; schema persistence and production integration are not implemented.
- Writer/storage migration: not started.

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

## Current Blockers

- New Location schema persistence and production integration are not implemented.
- The fixed storage key `albion-logistics-v2-state` is used by the injected repository; production bootstrap has not acquired global `localStorage`.
- The explicit browser Storage backend binding and browser new-schema repository composition helper are implemented and tested, but production bootstrap has not acquired global `localStorage` and called the helper.
- Pure initializer is implemented and tested but not integrated with state, storage, writer, backup, or UI.
- The pure storage codec is implemented and tested but is not connected to `localStorage`, `state.js`, writers, backup, startup, or UI.
- The injected repository, browser Storage backend, and browser new-schema repository composition helper are implemented and tested in isolation but are not connected to startup, `state.js`, writers, backup, or UI.
- New writer tests are not created.
- New backup export/import is not created.
- Launch confirmation flow is not created.
- Smoke/release checklist is not completed.

## Next Approved Step

- Docs sync is complete after this checkpoint; return to Spec Lead for the next decision.
- Do not self-approve production integration or connect startup, `state.js`, writers, backup, or UI.

## High-Risk Boundaries

- No direct `state.js` rewrite.
- No automatic legacy `localStorage` deletion.
- No writer/storage switch without tests.
- No fallback removal by incidental refactor.
- No transaction history migration.
- No direct future-app import requirement for legacy backups.
- No Location Registry current implementation claim.
- Do not connect clean initialization output to writers, storage, backup import/export, or migration until tests and implementation are explicitly approved.
