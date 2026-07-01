# Albion Logistics ERP 0.4.4 Release Notes

Release notes

Release: `v0.4.4`
Release date: 2026-06-30
Release commit: `d87a5bf7824192f3d734b7c89710fd4336fd5652`
GitHub Release: https://github.com/dkrayieigh/albion-logistics/releases/tag/v0.4.4

Status: released. Production build, NSIS installer smoke, tag creation, GitHub Release publication, and installer artifact upload are complete.

These notes summarize the released 0.4.4 behavior. They do not claim that MSI installation smoke, Stable ID migration, `qtyByLocation` migration, canonical transaction migration, or special-material inventory implementation has been completed.

Official published assets:

- `albion-logistics_0.4.4_x64-setup.exe`

Published installer SHA-256:

- `c8334d11ae74a5395a942dd93c99931de89ffceb58f5119e0159343384d47b0c`

SHA source: GitHub Release asset digest. `SHA256SUMS.txt` is not listed in the published GitHub Release asset list.

## 1. Highlights

- Production new-schema runtime is active for startup/read-write.
- Active v2 storage key: `albion-logistics-v2-state`.
- Canonical v2 backup export is integrated.
- Validated atomic v2 import is integrated.
- Browser download export transport is integrated.
- Tauri native save-dialog export transport is integrated.
- Production export/import round-trip is regression covered.
- Factory Reset is scoped to Albion Logistics owned keys.
- Unrelated same-origin storage keys are preserved by scoped reset.
- User-confirmed Tauri dev app manual smoke for 0.4.4: PASS.
- Production Tauri build: PASS.
- NSIS installer smoke: PASS.
- Built executable ProductVersion / FileVersion: `0.4.4`.

## 2. Data Safety

- Invalid backup input causes zero mutation.
- Import validation runs before confirmation and before storage commit.
- Import verification failure rolls back.
- Rollback failure is surfaced rather than hidden.
- Scoped reset has cancellation, failure, rollback, and unrelated-key preservation coverage.
- Startup blocks invalid v2 data rather than silently falling back to legacy data.

## 3. Backup And Restore

- v2 backup uses a versioned canonical envelope.
- Production v2 export reads canonical repository state.
- Production v2 import restores validated canonical state.
- Browser and Tauri export transports are both covered.
- Production v2 export/import round-trip is regression covered.

Legacy backup policy:

- Legacy backup files are not automatically migrated into v2 canonical state.
- Explicit legacy mode remains available for legacy data.
- v2 mode does not auto-convert a legacy backup into canonical v2 state.
- User-facing feedback for this unsupported path may be missing or unclear.
- There is no startup-time legacy-to-v2 migration in 0.4.4.
- This is a known limitation, not a release blocker for the documented 0.4.4 scope.

## 4. Factory Reset

- Factory Reset removes known Albion Logistics owned v2 and legacy keys.
- Factory Reset no longer relies on broad `localStorage.clear()` for the documented scoped reset behavior.
- Unrelated same-origin keys are preserved.
- Cancelled reset causes zero mutation.
- Failure paths avoid success reload and report errors.

## 5. UI And Usability Fixes

- Quotation calculated fields use formatted numeric display for programmatic writes.
- Quotation enqueue refreshes the crafting queue and shopping list immediately after success.
- Numeric inputs select all on focus for `.format-num`, `type="number"`, `inputmode="numeric"`, and `inputmode="decimal"` targets.
- Numeric focus selection does not clear values and does not dispatch input/change events.
- Artifact queue cost fields display only the artifact material name beside the cost input.
- Alchemy queue fields keep unit-cost and fixed-requirement context.

## 6. Compatibility

- Explicit legacy mode is retained.
- Existing legacy data paths remain available in explicit legacy mode.
- No storage schema migration is performed by this release.
- No transaction payload migration is performed by this release.
- Ledger display mapping remains presentation-only where applicable.
- Artifact / alchemy queue cost inputs remain planning behavior and are not formal special-material inventory.

## 7. Known Limitations

- Legacy backup to v2 migration remains future work.
- v2 mode does not auto-import or auto-convert legacy backups.
- Basic custom-warehouse management UI and stable custom-location lifecycle are implemented, but inactive-location management, canonical inventory identity, shared resolver coverage, and custom crafting profiles remain incomplete.
- Formal special-material inventory is not implemented.
- Stable Item ID migration remains future work.
- Canonical transaction migration remains future work.
- Progressive `checkJs`, Vite, CSP hardening, and SQLite remain future work.
- MSI was built but is not yet documented as installation-smoke verified.
- Selecting a legacy backup while running in v2 mode may not provide clear user-facing feedback.

## 8. Validation Completed

- Local automated regression gate has been run in the closeout sequence.
- User-confirmed Tauri manual smoke: PASS.
- Production Tauri build: PASS.
- Built executable version: `0.4.4`.
- NSIS installation: PASS.
- Installed-app launch / restart: PASS.
- Installed-app export: PASS.
- Browser export transport covered.
- Tauri native save-dialog export transport covered.
- v2 import restore covered.
- Invalid JSON / invalid backup zero mutation covered.
- Import rollback and rollback-failure reporting covered.
- Scoped reset preservation covered.
- Startup after reset covered.
- Numeric-input UX covered.
- Queue immediate render covered.
- Artifact queue label regression covered.

This document intentionally does not record a fixed automated test count because counts are run-specific and can change as regression coverage grows.

## 9. Not Included In 0.4.4

- Legacy-to-v2 backup migration.
- Canonical custom-warehouse inventory identity, inactive-location management UI, shared location-resolver completion, and custom crafting profiles.
- Special-material inventory implementation.
- Stable Item ID migration.
- Canonical transaction payload migration.
- SQLite implementation.
