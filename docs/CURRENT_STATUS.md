# Current Status

Status: Current
Authority: Current implementation summary
Last reviewed: 2026-06-30
Last verified against commit: `d87a5bf7824192f3d734b7c89710fd4336fd5652`

`Last verified against commit` is the tagged 0.4.4 release commit. This file documents current production behavior and release state; it does not imply that this docs-only update changed source, tests, package metadata, build output, tags, or release artifacts.

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
- Artifact / alchemy queue fields are still per-queue unit-cost planning inputs.
- Basic custom-warehouse management UI and stable custom-location lifecycle are implemented, but inactive-location management, canonical inventory identity, shared resolver coverage, and custom crafting profiles remain incomplete.
- Stable Item ID migration remains future work.
- Canonical transaction migration remains future work.
- Progressive `checkJs`, Vite, stricter CSP, and SQLite remain future hardening work.
- CSP is still effectively not hardened for a packaged artifact.

For limitation details, see [Current Limitations](./CURRENT_LIMITATIONS.md) and [Implementation Gap](./IMPLEMENTATION_GAP.md).

## Active Workstreams

1. Phase-1 refactor planning and inventory.

Docs consolidation closeout is complete. The active checkpoint inventories current component/business coupling and regression coverage before selecting one bounded refactor. It does not authorize source changes, schema changes, migration, service extraction, tests, version metadata updates, or a 0.4.5 implementation branch.

## Reviewed Core Specifications

- [Architecture](./ARCHITECTURE.md)
- [Business Rules](./BUSINESS_RULES.md)
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
