# Albion Logistics ERP 0.4.4 Release Notes

Release notes

Prepared from commit: `4b618fd2456aca7021863d5d4c4dc0f202e458b7`

Status: release candidate; production build, tag, GitHub Release, and artifact upload are pending.

These notes summarize the current 0.4.4 release-candidate behavior. They do not claim that a release tag, installer, packaged artifact, or GitHub Release has already been created.

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
- v2 mode blocks legacy backup import rather than auto-converting it.
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
- Custom warehouse production UI is not complete.
- Formal special-material inventory is not implemented.
- Stable Item ID migration remains future work.
- Canonical transaction migration remains future work.
- Progressive `checkJs`, Vite, CSP hardening, and SQLite remain future work.
- Production build, installer / artifact verification, release tag, GitHub Release, and artifact upload are still pending.

## 8. Validation Completed

- Local automated regression gate has been run in the closeout sequence.
- User-confirmed Tauri manual smoke: PASS.
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

- Production installer build.
- Release tag creation.
- GitHub Release publication.
- Artifact upload.
- Legacy-to-v2 backup migration.
- Custom warehouse production implementation.
- Special-material inventory implementation.
- Stable Item ID migration.
- Canonical transaction payload migration.
- SQLite implementation.
