# Albion Logistics ERP Project Handoff

## Current Status

- Phase: legacy-compatible stabilization / clean-cutover preparation.
- Test baseline: 142 tests / 142 pass / 0 fail / 0 TODO.
- Latest checkpoint: clean initialization contract final docs sync.
- Selected Location strategy: single-user clean cutover.
- Location schema contract: defined as future target, not implemented.
- Writer/storage migration: not started.

## Current Implemented Safety Layers

- Item identity read-only adapter.
- Location map read-only adapter.
- Location identity read-only resolver.
- Location migration validator as research / verification utility.
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

- New Location schema is not implemented.
- New storage key `albion-logistics-v2-state` is selected but not implemented.
- Clean initialization contract is defined in docs but not tested.
- `createCleanInitialState()` is not implemented.
- New writer tests are not created.
- New backup export/import is not created.
- Launch confirmation flow is not created.
- Smoke/release checklist is not completed.

## Next Approved Step

- Add clean initialization tests-only contract for `createCleanInitialState()`.
- Do not implement the initializer or switch writers yet.

## High-Risk Boundaries

- No direct `state.js` rewrite.
- No automatic legacy `localStorage` deletion.
- No writer/storage switch without tests.
- No fallback removal by incidental refactor.
- No transaction history migration.
- No direct future-app import requirement for legacy backups.
- No Location Registry current implementation claim.
- Do not connect clean initialization output to writers, storage, backup import/export, or migration until tests and implementation are explicitly approved.
