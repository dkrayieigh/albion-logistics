# Albion Logistics ERP Project Handoff

## Handoff Status

- Latest checkpoint: D60 close
- Latest master commit: `da11f7ee14194394f6436059947ab66fefc12fc8`
- Commit title: `docs: add laborer sale behavior checkpoint`
- Baseline: `56 tests / 56 pass / 0 fail / 0 TODO`
- Project phase: legacy-compatible stabilization

This document is a handoff checkpoint for D62 Migration readiness review. It summarizes current stable behavior, covered safety nets, future targets, and migration boundaries. It does not start implementation, migration, storage rewrite, writer rewrite, or canonical event rollout.

## D1-D60 Completed Summary

### Documentation Boundary Foundation

- Established `IMPLEMENTATION_GAP.md` as the current-vs-future status map.
- Added migration boundary documents for item identity, transaction/event model, and migration sequencing.
- Synced existing architecture, data model, location model, event catalog, business rules, and test case docs to distinguish current implementation from future targets.
- Added adapter-first planning docs: `ADAPTER_TEST_PLAN.md` and `ADAPTER_API.md`.
- Preserved the rule that future specs must not be documented as current implementation.

### Current Behavior Safety Net

- Regression baseline now protects 56 tests with no failures and no TODO tests.
- Core cost and inventory behaviors remain covered in `tests/core-cost-regression.test.js`.
- Ledger display and transaction reader safety remain covered in `tests/ledger-data-safety.test.js`.
- Backup import/export and compatibility safety remain covered in `tests/backup-regression.test.js`.

### Adapter Readiness Progress

- Minimal read-only item identity adapter exists for missing mapping failure coverage.
- Minimal read-only transaction reader adapter exists for mixed legacy/future transaction tolerance.
- Minimal read-only location adapter exists for legacy `qtyByCity` normalization/display tolerance.
- Adapter coverage remains reader/display oriented. It does not migrate writers, storage keys, backup import/export, or canonical payloads.

### Sell Item Checkpoint

D33-D50 completed the Sell Item / 成品出售 current behavior protection checkpoint.

Covered current behavior:

- Legacy `type: '賣成品'` transaction can be read by `transactionReader`.
- Normalized legacy sale reader entry can be displayed by Ledger display path.
- Current crafted sale writer deducts selected-location inventory and does not consume other locations.
- Successful sale increases cash, writes legacy transaction payload, preserves transaction insertion order, and does not recalculate `globalAvgCost`.
- Failure paths are covered for invalid total, insufficient selected-location inventory, and negative quantity with no state mutation.

Future boundary:

- Canonical `SELL_ITEM` is not current implementation.
- Transaction payload migration has not started.
- Writer migration has not started.
- Storage migration has not started.
- Backup/import/export paths are unchanged.
- Legacy `type: '賣成品'` fallback must remain supported.

### Laborer Sale Checkpoint

D51-D60 completed the Laborer Sale / 工人島物資出售 current behavior protection checkpoint.

Covered current behavior:

- Legacy `type: '工人島出售'` transaction can be read by `transactionReader`.
- Normalized legacy laborer sale reader entry can be displayed by Ledger display path.
- Current laborer sale writer deducts selected `laborerInventory` item/quality.
- Unrelated laborer inventory is preserved.
- Cash increases on successful sale.
- Legacy `type: '工人島出售'` transaction payload is written.
- `unitPrice` is calculated from total and quantity.
- Transaction insertion order is preserved.
- Legacy storage key `滿日記本` is preserved.
- User-facing terminology may display 「日誌」, but it must not be written back as the internal/storage key.

Future boundary:

- Canonical laborer sale event is not current implementation.
- Transaction payload migration has not started.
- Writer migration has not started.
- Storage migration has not started.
- Backup/import/export paths are unchanged.
- Legacy `type: '工人島出售'` fallback must remain supported.
- Legacy storage key `滿日記本` must not be directly renamed to `滿日誌`.

## Current Implementation

Current implementation remains legacy-compatible and should be treated as the source of truth until a migration track satisfies adapter, tests, backup validation, and release boundary requirements.

- Item identity: legacy Chinese item keys remain supported.
- Location quantity: `qtyByCity` remains the current persisted quantity map.
- Transaction payload: legacy fields remain supported:
  - `type`
  - `item`
  - `quality`
  - `qty`
  - `total`
  - `unitPrice`
  - `location`
- Custom locations: legacy name/string behavior remains supported where applicable.
- Laborer inventory: `state.laborerInventory['滿日記本']` remains the internal/storage key.
- Existing legacy transaction fallbacks remain supported.

## Test-Covered Behavior

The current stable safety net covers:

- Purchase, WAC, dormant cost anchor, crafting cost basis, and blocked crafting when material `globalAvgCost === null`.
- Inventory transport without changing cash, ledger, or `globalAvgCost`.
- Non-empty custom location deletion block.
- Backup import/export schema safety, invalid import no-overwrite behavior, and legacy backup compatibility.
- Minimal read-only adapter reader/display tolerance for item identity, location display, transaction reader, and ledger display paths.
- Current Sell Item success and failure behavior.
- Current Laborer Sale success, reader, display, and terminology/key boundary behavior.

## Future Target

The following remain future target / migration target only:

- Stable ID.
- `qtyByLocation`.
- Location Registry object.
- Canonical event payload:
  - `action`
  - `target`
  - `cashChange`
  - `assetValue`
  - `locationId`
- Canonical `SELL_ITEM`.
- Canonical laborer sale event.
- Adapter-first compatibility layer expansion.
- Backup/import/export migration for future schemas.

These items must not be described as current implementation until the corresponding migration track completes its preconditions and validation.

## Migration Boundary

Before any migration work:

- Do not directly modify storage keys or transaction payloads.
- Do not remove legacy fallback.
- Do not rewrite writers to canonical payloads without compatibility tests and rollback coverage.
- Do not migrate `qtyByCity` to `qtyByLocation` before location adapter, backup validation, and regression coverage are ready.
- Do not migrate legacy Chinese item keys to Stable ID before mapping, adapter, conflict handling, backup validation, and regression coverage are ready.
- Do not migrate legacy transaction payloads before reader/writer boundaries, legacy-to-canonical mapping, backup validation, and ledger compatibility tests are ready.
- Do not rename internal/storage key `滿日記本`.

## Prohibited For D62 Readiness Review

D62 should remain a review/planning checkpoint unless explicitly re-scoped.

Do not:

- Modify `src`.
- Modify tests.
- Modify `package.json` or `package-lock.json`.
- Change localStorage schema.
- Change transaction payload.
- Change writer or storage paths.
- Add migration code.
- Expand adapter implementation.
- Remove legacy fallback.
- Rename `滿日記本`.
- Declare canonical `SELL_ITEM` or canonical laborer sale event complete.
- Declare transaction payload, writer, storage, Stable ID, or Location Registry migration started.

## D62 Recommendation

D62 should be a Migration readiness review, not direct implementation.

Recommended review questions:

- Which current behavior safety net is still missing before any migration track can begin?
- Are there remaining high-risk legacy behaviors that need regression tests before adapter expansion?
- Are backup/rollback validation fixtures sufficient for Item ID, Location, and Transaction/Event migration tracks?
- Which adapter-only planning anchors are ready to become tests, and which still need clearer specs?
- Are Sell Item and Laborer Sale current behavior checkpoints sufficient to protect legacy sale flows during future event planning?

Candidate routes for post-review planning:

- Current behavior safety net expansion.
- Backup compatibility fixture expansion.
- Adapter test planning refinement.
- Item ID readiness review.
- Location readiness review.
- Transaction/Event readiness review.

No candidate route should be treated as selected implementation work by this handoff document.
