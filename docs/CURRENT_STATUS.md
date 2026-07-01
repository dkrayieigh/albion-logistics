# Current Status

Status: Current
Authority: Current implementation summary
Last reviewed: 2026-07-01
Last verified against commit: `d87a5bf7824192f3d734b7c89710fd4336fd5652`

`Last verified against commit` is the tagged 0.4.4 release commit. This file documents current production behavior and release state; it does not imply that this docs-only update changed source, tests, package metadata, build output, tags, or release artifacts.

## Current Master Review

- Current master implementation reviewed against commit: `f9853bd1ac59f8dd2350babcfb4d84ab56994439`.
- Release baseline remains the tagged 0.4.4 release commit: `d87a5bf7824192f3d734b7c89710fd4336fd5652`.
- Post-release master includes the Inventory Transfer bounded service extraction. This is current master behavior, not a v0.4.4 release artifact.
- Post-release master includes Inventory Transfer exact-file ESLint coverage. This is a tooling gate update, not a runtime feature.
- This docs sync does not change source, tests, dependencies, lockfile, CI workflow, version metadata, build output, tags, release assets, storage schema, backup format, or transaction payload.

## Production Runtime

- Package/app version: `0.4.4`.
- Desktop shell: Tauri 2.
- Frontend: vanilla JavaScript / ES modules / HTML / CSS.
- Production `frontendDist`: `src`.
- Active new-schema storage key: `albion-logistics-v2-state`.
- Production v2 startup/read-write is integrated.
- Ready startup reads the v2 key, projects canonical state to runtime state, hydrates runtime defaults, and active-runtime `saveState()` writes the v2 key.
- Missing storage with user confirmation initializes and writes a clean canonical v2 state.
- Missing storage with user cancellation enters explicit legacy mode.
- Invalid or errored startup blocks without silent legacy fallback.
- Explicit legacy mode still uses the legacy `albion_crafting_*` localStorage path.
- Canonical v2 export is integrated in production.
- Browser download export transport is integrated.
- Tauri native save-dialog export transport is integrated.
- Validated atomic v2 import is integrated in production.
- Import verification failure rolls back instead of leaving partial v2 data.
- Factory Reset is scoped to Albion Logistics owned v2 and legacy keys.
- Factory Reset preserves unrelated same-origin storage keys.
- Legacy backup data is not automatically migrated to v2.
- No automatic legacy-to-v2 migration runs during startup, import, or reset.

## Stable / Test-Covered Areas

The current automated regression suite covers:

- production v2 export;
- production v2 import;
- production export/import round-trip;
- invalid backup zero mutation;
- import verification rollback;
- rollback failure reporting;
- scoped Factory Reset preservation;
- unrelated storage key preservation;
- startup after reset;
- quotation programmatic calculated-field formatting;
- queue immediate render after quotation enqueue;
- numeric input select-all-on-focus;
- artifact queue label regression;
- core cost / WAC behavior;
- crafting material consumption and actual-consumption safety;
- purchase / sale safety;
- inventory transfer;
- pure inventory transfer service contract;
- inventory transfer service-level validation, immutability, and selected-source sufficiency;
- inventory transfer integration behavior around legacy save path, WAC preservation, cash/debt preservation, transaction preservation, custom display-name compatibility, and no `qtyByLocation` / Location Registry side effect;
- pure Special Material purchase / consumption contract;
- Special Material account-total quantity and WAC;
- Special Material zero-balance reset and dormant anchor;
- Special Material identity / entry validation;
- Special Material location-shaped field rejection;
- Special Material input immutability;
- Special Material error priority and public API isolation;
- ledger data safety;
- custom location stable-ID add / rename / remove behavior;
- new-schema codec, repository, runtime projection, and startup decision boundary;
- browser storage backend and browser repository composition.

Do not record a fixed test count here. Treat exact counts as run-specific evidence in closeout reports.

## Current Implementation Highlights

- Crafting Planner / quotation remains a planning path that hands rows to the transient crafting queue; it does not mutate inventory, cash, transactions, or storage directly.
- `RECIPES` is the shared Crafting and Planner item source.
- Ledger English category / item display is presentation mapping and does not migrate stored transaction payloads.
- Custom location add / rename / remove uses the stable custom-location lifecycle in current runtime behavior.
- Production new-schema runtime is active for startup/read-write.
- Backup import/export is now v2-aware in production, while explicit legacy mode remains available for legacy data.
- Factory Reset uses a scoped owned-key reset path instead of broad `localStorage.clear()`.
- Artifact and alchemy queue rows remain cost-input planning behavior, not formal special-material inventory.
- `src/services/specialMaterialInventoryService.js` provides the current master pure Special Material purchase / consumption service.
- `src/data/specialMaterialCatalog.js` provides the current master pure Special Material catalog.
- `src/services/specialMaterialIdentityResolver.js` provides the current master pure Special Material identity resolver.
- This pure service is not wired to state, Crafting, storage, UI, cash, transactions, save, or backup.
- Formal Special Material inventory root does not exist in production runtime.
- Current Crafting still uses manual Artifact / Alchemy cost inputs.
- `src/services/inventoryTransferService.js` provides the current master pure `applyInventoryTransfer()` service.
- `src/components/inventory.js` remains the DOM input, toast, `state.inventory[key]` assignment, `saveState()`, and UI refresh adapter for transfer.
- Inventory transfer extraction refactors existing behavior; it does not add transport capability.
- Runtime inventory transfer remains legacy-compatible through `qtyByCity` display-name keys and does not start Location migration.
- Custom warehouse current boundary: persisted v2 keeps `locationRegistry` and canonical `qtyByLocation`, while runtime components still use `customLocations` and display-name `qtyByCity` compatibility.
- Custom warehouse add / rename / remove uses stable custom IDs where `locationRegistry` is present.
- Custom warehouse removal blocks non-empty locations, deactivates empty registry entries, preserves inactive registry evidence, and has save rollback coverage.
- Custom warehouse delete confirmation now matches the current non-empty deletion guard and tells users to transfer or clear inventory before deletion.
- Custom warehouse deletion cancellation leaves custom locations, registry, inventory, transactions, and toast state unchanged.
- Confirmed non-empty custom warehouse deletion remains blocked without mutation and shows an error toast.
- Confirmed empty custom warehouse deletion preserves the successful behavior: the registry entry is deactivated, runtime custom location / `qtyByCity` bucket are removed, unrelated inventory is preserved, and a success toast is shown.
- This checkpoint changed only component confirmation copy and tests; it did not change schema, state lifecycle, registry lifecycle, storage, backup, runtime bridge, transaction payload, or legacy fallback.

## Current Tooling Boundary

Current partial ESLint scope:

- `src/calculators/**/*.js`
- `src/presenters/**/*.js`
- `src/services/inventoryTransferService.js`
- `tests/inventory-transfer-service.test.js`
- `src/services/specialMaterialInventoryService.js`
- `tests/special-material-inventory-service.test.js`
- `scripts/**/*.mjs`

Tooling boundary:

- `npm run lint` uses the partial scope above.
- CI still runs the existing `npm run lint` step.
- `format:check` scope is unchanged and remains limited to package/config/scripts/workflow formatting targets.
- `npm test` still uses recursive test discovery through `scripts/run-tests.mjs`.
- This is not repo-wide lint coverage.
- Progressive `checkJs` is not enabled.
- Vite, CSP, and SQLite remain future hardening work.

## Release Readiness

- Release: `v0.4.4`.
- Release date: 2026-06-30.
- Release commit: `d87a5bf7824192f3d734b7c89710fd4336fd5652`.
- GitHub Release: https://github.com/dkrayieigh/albion-logistics/releases/tag/v0.4.4
- GitHub Release status: published, not draft, not prerelease.
- User-confirmed Tauri dev app manual smoke for 0.4.4: PASS.
- Export/import/reset/startup and numeric-input UX hotfix regressions are passing locally.
- Version metadata is consistent at `0.4.4` across package, lockfile, Cargo, Tauri config, and built executable metadata.
- Production Tauri build: PASS.
- NSIS installer build: PASS.
- NSIS installer published: `albion-logistics_0.4.4_x64-setup.exe`.
- Published installer SHA-256 from GitHub Release asset digest: `c8334d11ae74a5395a942dd93c99931de89ffceb58f5119e0159343384d47b0c`.
- User-confirmed installed-app smoke: PASS.
- Installed executable ProductVersion / FileVersion: `0.4.4`.
- Installed app launch: PASS.
- Installed app restart: PASS.
- Numeric input UX: PASS.
- Quotation queue immediate update: PASS.
- Native save dialog / export: PASS.
- `SHA256SUMS.txt` is not listed in the published GitHub Release asset list.
- MSI was built, but is not documented as installation-smoke verified and is not the official published installer asset.

This means 0.4.4 is documented here as released. It does not mean Stable Item ID, `qtyByLocation` writer/storage migration, or canonical transaction payload migration are current production behavior. A v2 Location Registry and stable custom-location lifecycle are already present, while runtime inventory remains display-name keyed through legacy `qtyByCity` compatibility.

## Active Limitations

- Legacy backup files are not automatically converted into canonical v2 state.
- A v2-mode import does not migrate a legacy backup into canonical v2 state.
- User-facing feedback for this unsupported legacy-backup path may be missing or unclear.
- Explicit legacy mode can still read and write legacy data paths.
- Formal special-material inventory is not implemented.
- Special Material catalog and resolver pure boundaries are implemented and test-covered, but they are not production-integrated.
- Artifact / alchemy queue fields are still per-queue unit-cost planning inputs.
- Special Material account-total `totalQty` is the selected future production-integration target, but it is not current production runtime behavior.
- Location-based Special Material quantity and transfer are not the selected target.
- Basic custom-warehouse management UI and stable custom-location lifecycle are implemented, but inactive-location management, canonical inventory identity, shared resolver coverage, and custom crafting profiles remain incomplete.
- Stable Item ID migration remains future work.
- Canonical transaction migration remains future work.
- Progressive `checkJs`, Vite, stricter CSP, and SQLite remain future hardening work.
- CSP is still effectively not hardened for a packaged artifact.

For limitation details, see [Current Limitations](./CURRENT_LIMITATIONS.md) and [Implementation Gap](./IMPLEMENTATION_GAP.md).

## Active Workstreams

1. Phase-1 refactor planning and inventory — completed.
2. Inventory Transfer bounded service extraction — completed.
3. Incremental quality tooling planning and boundary — completed.
4. Inventory Transfer exact-file ESLint coverage — completed.
5. Custom warehouse boundary specification and inventory — completed.
6. Custom warehouse deletion UX contract regression and fix — completed.
7. Special material inventory contract reconciliation — completed.
8. Tests-first special-material pure contract — completed.
9. Special Material exact-file ESLint coverage — completed.
10. Special material identity catalog review — completed.
11. Tests-first pure catalog/resolver contract — completed.
12. 0.5.0 crafting domain contract reconciliation — completed.
13. Tests-first production bonus, profile validation, and material consumption contract — active.

Docs consolidation closeout is complete. Phase-1 planning selected Inventory Transfer as the first bounded extraction, and current master now contains that completed pure-service extraction plus exact-file ESLint coverage for the transfer service and service test. The custom warehouse boundary inventory and deletion UX contract fix are complete. Special Material inventory contract reconciliation, pure service/test contract, exact-file ESLint coverage, identity catalog review, pure catalog/resolver contract, and 0.5.0 crafting domain contract reconciliation are complete. Formal Special Material inventory remains unimplemented in production runtime; current Crafting still uses manual Artifact / Alchemy cost inputs. The active checkpoint is Tests-first production bonus, profile validation, and material consumption contract. It may add pure tests and pure domain modules only when separately approved; it does not authorize state/storage integration, Crafting integration, version metadata updates, release work, or a 0.4.5 implementation branch.

## Reviewed Core Specifications

- [Architecture](./ARCHITECTURE.md)
- [Business Rules](./BUSINESS_RULES.md)
- [0.5.0 Crafting Domain Model](./CRAFTING_DOMAIN_MODEL.md)
- [Data Model](./DATA_MODEL.md)
- [Location Model](./LOCATION_MODEL.md)
- [Item ID Model](./ITEM_ID_MODEL.md)
- [Transaction Event Model](./TRANSACTION_EVENT_MODEL.md)
- [Event Catalog](./EVENT_CATALOG.md)
- [Test Cases](./TEST_CASES.md)

## Historical / Planning Material

The following documents are useful for context and migration boundaries, but they should not override current source, current tests, confirmed bug reports, or user-confirmed release-closeout facts:

- [Project Handoff](./PROJECT_HANDOFF.md)
- [Implementation Gap](./IMPLEMENTATION_GAP.md)
- [Migration Plan](./MIGRATION_PLAN.md)
- [Adapter API](./ADAPTER_API.md)
- [Adapter Test Plan](./ADAPTER_TEST_PLAN.md)
- [Roadmap](./ROADMAP.md)
