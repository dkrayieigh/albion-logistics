# Albion Logistics ERP Special Material Inventory Specification

Status: Target
Authority: Approved specification
Current implementation: Not implemented
Implementation status: Tests-first pure contract approved; production integration not approved
Last reviewed: 2026-07-01

本文件記錄 Artifact / Alchemy 特殊材料庫存的 approved target specification。這不是 current implementation 宣告，也不代表 schema、storage、writer、backup、transaction payload 或 UI 已完成。

本文件不得被解讀為要求立即修改 `src`、tests、storage key、`schemaVersion`、backup format、transaction payload、custom location implementation 或 release/version metadata。

Tests-first pure contract approved means the next checkpoint may define executable pure-domain tests and minimum pure contract helpers when separately approved. This file does not authorize production helper wiring, writer/storage integration, UI, backup, Crafting integration, transaction payload changes, or release/version metadata work.

## Decision Record

- Spec Lead selected account-total `totalQty` as the Special Material quantity model.
- Location-based quantity is rejected for the current Special Material model.
- Selected target: account-total `totalQty`, account-wide `globalAvgCost`, no location bucket, no transfer.
- This decision reduces the first pure scope to inventory quantity and WAC behavior.
- The selected target is not current production implementation.
- Production integration remains unapproved.

Rationale:

- Special materials do not need inventory buckets by purchase or crafting city.
- Location-based scope would entangle this feature with Location migration, custom-location lifecycle, transfer behavior, backup shape, and crafting-location deduction before the pure inventory/WAC contract is stable.
- Purchase and craft location may still be recorded later as transaction metadata, but metadata must not create inventory buckets.

## A. Current Implementation Summary

目前 Artifact / Alchemy 只出現在 recipe、Planner 與 Crafting 計算流程中，尚未形成正式 inventory module。

Current recipe metadata:

- Recipes may contain `artifactName`.
- Recipes may contain `artifactQty`.
- Recipes may contain `alchemyName`.
- Alchemy requirement is Tier-dependent.

Current Planner behavior:

- Planner supports manual unit estimate for Artifact / Alchemy cost.
- Planner is calculation-only.
- Planner has no inventory write.
- Planner does not apply material return rate to special materials.
- Planner does not create special-material purchase records.
- Planner-specific special material estimate controls are not a persisted quotation system.

Current Crafting behavior:

- Crafting queue / shopping list can show Artifact / Alchemy cost components.
- Crafting can calculate cash requirement from manually entered special-material cost.
- Crafting can include Artifact / Alchemy cost in crafted output cost when submitted through the current flow.
- Current crafting does not deduct special materials from a formal inventory root.
- Current crafting does not create a special-material acquisition transaction.

Current storage behavior:

- There is no dedicated `artifactInventory` root.
- There is no dedicated `alchemyInventory` root.
- There is no dedicated special-material `qtyByCity` / `qtyByLocation` storage.
- There is no dedicated special-material `globalAvgCost` storage.
- Backup/export does not yet include a formal special-material inventory section.

Therefore, documentation must not describe formal special-material inventory as current implementation.

## B. Inventory Scope Decision

Decision: **Account-total quantity + account-wide global WAC**.

Special materials use account-total quantity so Artifact / Alchemy inventory remains independent from location buckets, custom-location rename/deactivate/delete behavior, and ERP transfer logic. Their cost basis remains account-wide through one `globalAvgCost` per stable material identity.

Target contract:

```js
SpecialMaterialIdentity = {
  stableId,
  category,
  tier
}

SpecialMaterialInventoryEntry = {
  identity,
  totalQty,
  globalAvgCost
}
```

Rules:

1. `totalQty` must be a finite number.
2. The pure contract may require integer quantity where purchase/consumption commands need discrete item counts.
3. `globalAvgCost` must be a finite number or `null`.
4. `globalAvgCost` is not location-specific.
5. `qtyByLocation`, `qtyByCity`, and fake account-total locations are not allowed in the selected target.
6. Artifact and Alchemy do not have an enchant dimension.
7. This decision does not define final storage root key or `schemaVersion`.

Rejected alternative:

```js
specialMaterialInventory[itemId] = {
  qtyByLocation: {
    bridgewatch: 15
  },
  globalAvgCost: 12345
}
```

Location-based quantity is rejected for the current target. It may be retained only as historical candidate context, not as an open schema decision.

## C. Identity Contract

Special material identity is stable catalog identity, not display-name parsing.

Target identity fields:

- `stableId`
- `category`: `artifact` or `alchemy`
- `tier`

Identity rules:

- `stableId` comes from an internal catalog.
- `stableId` must be stable across rename and display translation.
- `category` is required and must distinguish `artifact` from `alchemy`.
- `tier` is required.
- Artifact and Alchemy do not have an enchant dimension.
- `displayName` is not identity.
- Runtime must not derive identity from display name or slug.
- Storage key must not be parsed as identity.

Temporary internal catalog rule:

- It is acceptable to create an internal catalog ID when no final external Albion canonical ID exists.
- The ID must be deterministic.
- The ID must not be generated from runtime display name.
- The ID must not claim to be a final Albion canonical ID.

This document intentionally does not invent final Albion item IDs.

## D. Location Contract

Inventory helpers must not require `locationId`.

Metadata boundary:

- Purchase location may be recorded later as transaction metadata.
- Craft location may be recorded later as transaction metadata.
- Location metadata must not change `totalQty`.
- Location metadata must not create an inventory bucket.

Custom location boundary:

- Custom location rename does not affect Special Material quantity.
- Custom location deactivate does not affect Special Material quantity.
- Custom location delete does not affect Special Material quantity.

Rules:

- No Special Material transfer service is part of the selected target.
- No Special Material transfer event is part of the selected target.
- Custom location crafting profile is a separate future topic and is not defined by this document.

## E. WAC Contract

Special material WAC follows the project-wide WAC principles in `BUSINESS_RULES.md`.

Rules:

1. Purchase creates or updates special-material `globalAvgCost`.
2. WAC uses account-wide quantity, not per-location quantity.
3. Special Material has no inventory transfer in the selected target.
4. Craft consumption does not change WAC.
5. Manual correction does not change WAC unless a separate approved cost-basis adjustment rule exists.
6. When quantity becomes zero, keep the dormant anchor.
7. When quantity is zero, the next purchase may establish WAC from purchase unit cost.
8. If formal inventory `globalAvgCost` is `null`, crafting must block before mutation.

This document does not authorize retroactive recomputation of historical cost or automatic repair of existing data.

## F. Intake Command Boundary

Future special-material intake should be a dedicated command boundary, not an incidental crafting-side mutation.

Command input:

```js
{
  entry,
  identity,
  quantity,
  totalCost
}
```

Not part of the pure command input:

- `locationId`
- `date`
- `note`
- transaction payload
- cash
- storage

UI may accept unit cost or total cost. The command boundary receives normalized `totalCost`.

Validation:

- `identity` must be valid.
- `quantity` must be a positive integer.
- `totalCost` must be finite and `> 0`.
- Zero-cost quantity increases are not purchases and require a separately approved adjustment or import rule.
- no partial mutation is allowed.
- input must not be mutated.

Success behavior:

- increase account-total `totalQty`
- update WAC
- return a structured result

Failure behavior:

- inventory result remains unchanged.
- no cash, transaction, save, storage, or UI effect occurs in the pure contract.

This is a command boundary, not a canonical event payload definition.

## G. Crafting Compatibility

Future crafting must support two explicitly separated modes during compatibility work:

1. `legacy-manual-cost`
2. `formal-inventory`

### `legacy-manual-cost`

- Preserves current behavior.
- Artifact / Alchemy cost comes from user-entered estimate.
- Does not read formal inventory.

### `formal-inventory`

- Validates required Artifact / Alchemy quantity against account-total `totalQty`.
- Does not apply RRR / return rate.
- Deducts fixed special-material quantity from account-total `totalQty`.
- Uses `globalAvgCost` in crafted output cost.
- Does not read manual cost input.
- Does not treat Planner estimate as inventory cost basis.
- Does not mix usage fee with material inventory cost.
- Does not turn crafting city into an inventory bucket.

Rules:

- One craft submission must not silently mix manual cost and formal inventory.
- Missing formal inventory cost basis blocks before mutation.
- Planner estimate is not inventory cost evidence.
- Legacy mode must not be removed in the same production task that introduces formal inventory.

## H. Implementation Gates

Approved gate:

**Tests-first pure Special Material inventory/WAC contract**.

Expected pure coverage:

- identity shape validation
- purchase WAC calculation
- account-total quantity increment
- fixed-quantity consumption
- insufficient quantity rejection
- unknown cost rejection
- zero-quantity dormant anchor
- input immutability
- structured result contract

Not included in the approved gate:

- catalog implementation
- storage
- cash
- transactions
- save
- backup
- UI
- Crafting integration
- production schema switch
- legacy fallback removal

Production writer/UI integration is not allowed until pure tests and the pure result contract are reviewed separately.

## I. Remaining Unresolved Decisions

Resolved decisions:

- Inventory scope is account-total `totalQty` + account-wide global WAC.
- Inventory helpers do not require `locationId`.
- Location metadata may be added later to transaction payloads, but it must not create inventory buckets.
- Special Material inventory transfer is not part of the selected target.
- Identity uses stable internal catalog identity with `stableId`, `category`, and `tier`.
- Artifact / Alchemy do not have enchant dimension.
- Display name, runtime slug, and parsed storage key are not identity.
- Manual-cost and formal-inventory modes must remain isolated.
- Current manual-cost path remains available during compatibility work.
- Canonical event payload is deferred.

Remaining unresolved decisions:

- Final catalog contents.
- Exact stable ID naming convention.
- Storage root encoding.
- Legacy-compatible transaction payload for intake and consumption.
- Future canonical event payload.
- Backup envelope / version.
- UI layout.

All remaining unresolved decisions can be deferred to tests-first pure contract work.

## J. Next Approved Step

Next approved step: **Tests-first special-material pure contract**.

Scope:

- identity validation
- account-total quantity helper
- WAC purchase calculation
- fixed-quantity consumption validation
- structured no-mutation failure result
- consumption validation
- no `src` integration
- no storage writer
- no UI

This next step may add executable tests and pure helper contracts only when separately approved. This document itself does not start source, storage, writer, backup, UI, or Crafting integration.
