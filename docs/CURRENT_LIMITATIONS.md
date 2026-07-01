# Albion Logistics ERP Current Limitations

Status: Current
Last reviewed: 2026-07-01

This document lists active limitations only. It should not preserve stale pre-integration claims when production behavior has already changed.

## Legacy Backup Migration Boundary

Status: Active limitation
Risk: High
Affected area: Backup / Storage / Migration

Current behavior:

- Production v2 export/import is integrated.
- v2 backup uses a versioned canonical envelope.
- Import validates before confirmation and before storage commit.
- Invalid backup input causes zero mutation.
- Verification failure rolls back.
- Rollback failure is reported and does not silently continue as success.
- Production export/import round-trip is covered by regression.
- User-confirmed 0.4.4 Tauri manual smoke is PASS.
- Explicit legacy mode remains available for legacy data.

Current limitation:

- Legacy backup files are not automatically converted into canonical v2 state.
- Legacy `qtyByCity` and legacy Chinese item-key data are not migrated into v2 canonical state by the importer.
- In v2 mode, a legacy backup is not auto-migrated into canonical v2 state.
- User-facing feedback for this unsupported path may be missing or unclear.
- The app does not run startup-time legacy-to-v2 migration.
- A future migration remains required to transform legacy backups into v2 state.

This is a known 0.4.4 limitation, not an unimplemented v2 backup path.

Contract reference: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md).

## Factory Reset Scope

Status: Implemented for 0.4.4 scope
Risk: High
Affected area: Storage / Reset

Current behavior:

- Reset uses the owned-key registry.
- Reset removes Albion Logistics owned v2 and legacy keys.
- Reset preserves unrelated same-origin storage keys.
- Cancelled reset causes zero mutation.
- Failed reset rolls back where possible and does not reload as success.
- Scoped reset behavior is regression covered.

Remaining limitation:

- Factory Reset is scoped to known Albion Logistics browser storage keys.
- It is not a general storage migration or storage-repair tool.
- It does not convert legacy backup data into v2 state.

Contract reference: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md).

## Special Material / Custom Warehouse

Status: Active limitation
Risk: Medium
Affected area: Crafting planner / Inventory model

Current behavior:

- Artifact and alchemy fields in queue rows are unit-cost planning inputs.
- Artifact queue rows display the artifact material name beside the cost input.
- Alchemy queue rows still display the unit-cost and fixed-requirement context.
- These fields affect crafting cost calculation when crafting rows are submitted.

Current limitation:

- Formal special-material inventory is not implemented.
- Artifact / alchemy tier-only inventory schema is not implemented.
- Custom warehouse production UI is not complete.
- This release does not add custom warehouse implementation or special-material inventory.

## Stable Item ID Migration

Status: Future work
Risk: High
Affected area: Data model / Migration

Current behavior remains legacy-compatible in several runtime paths:

- item keys can still be display-name / quality strings;
- location quantities can still be keyed through legacy-compatible maps in runtime projections;
- existing readers preserve legacy payload compatibility.

Current limitation:

- Stable item IDs are not fully migrated into all production writer paths.
- Existing item-key compatibility remains part of 0.4.4 behavior.

## Canonical Transaction Migration

Status: Future work
Risk: High
Affected area: Ledger / Data model

Current behavior:

- Ledger display has presentation mapping for categories and item names.
- Existing stored transaction payloads are preserved.
- Current sale and laborer sale behaviors remain legacy-compatible where applicable.

Current limitation:

- Stored transaction payloads are not fully migrated to canonical transaction events.
- Ledger English mapping is presentation-only and does not rewrite stored payloads.
- Future canonical event work remains separate from the 0.4.4 release closeout.

## Tooling / Packaging Hardening

Status: Future work
Risk: Medium
Affected area: Build / Packaging / Security hardening

Current partial tooling baseline:

- ESLint gate currently covers `src/calculators/**/*.js`, `src/presenters/**/*.js`, `scripts/**/*.mjs`, `src/services/inventoryTransferService.js`, and `tests/inventory-transfer-service.test.js`.
- Inventory Transfer pure service and service test are covered through exact-file ESLint paths.
- CI runs `npm run lint` and `npm run format:check`.
- This is post-v0.4.4 current master tooling behavior, not a published v0.4.4 artifact.

Current limitation:

- Production Tauri build completed for 0.4.4.
- NSIS installer smoke completed successfully.
- MSI was built but is not documented as installation-smoke verified.
- v0.4.4 tag and GitHub Release are published.
- The official published installer asset is `albion-logistics_0.4.4_x64-setup.exe`.
- `SHA256SUMS.txt` is not listed in the published GitHub Release asset list.
- MSI is not part of the documented official installation-smoke verified artifact set.
- Repo-wide lint is not complete.
- Components, core, adapters, remaining services, and the full test suite are not all covered by lint.
- Progressive `checkJs` is not enabled as a release gate.
- Vite migration is not complete.
- CSP hardening is not complete; CSP is still effectively not a packaged-artifact gate.
- SQLite is not implemented.

The exact-file ESLint expansion is implemented in current post-release master. The remaining hardening items above are not implemented by that bounded change.
