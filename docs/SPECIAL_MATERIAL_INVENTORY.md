# Albion Logistics ERP Special Material Inventory Specification

Status: Target
Authority: Approved specification
Current implementation: Not implemented
Last reviewed: 2026-06-30

本文件定義 Artifact / Alchemy 特殊材料庫存的 approved target specification。這不是 current implementation 宣告，也不代表 schema、storage、writer、backup、transaction payload 或 UI 已完成。

本文件不得被解讀為要求立即修改 `src`、tests、storage key、`schemaVersion`、backup format、transaction payload、custom location implementation 或 release/version metadata。

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

Decision: **Location-based quantity + account-wide global WAC**.

Special materials use location-based quantity so purchase location, crafting location, transfer, and custom location identity can be represented explicitly. Their cost basis remains account-wide through one `globalAvgCost` per stable material identity.

Target contract:

```js
SpecialMaterialIdentity = {
  stableId,
  category,
  tier
}

SpecialMaterialInventoryEntry = {
  identity,
  qtyByLocation,
  globalAvgCost
}
```

Rules:

1. `qtyByLocation` keys must use stable `locationId`.
2. `globalAvgCost` is not location-specific.
3. This decision does not define final storage root key or `schemaVersion`.
4. Account-wide quantity is a rejected alternative for the selected target. It may be retained only as historical context, not as an open schema decision.
5. `qtyByLocation` here is target specification only. It is not current implementation for special materials.

Rejected alternative:

```js
specialMaterialInventory[itemId] = {
  quantity: 15,
  globalAvgCost: 12345
}
```

This account-wide quantity shape is not the selected target because it cannot represent purchase/crafting location buckets or stable custom-location inventory identity.

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

Intake must provide `locationId`.

Allowed location targets:

- fixed system location
- active custom location

Blocked location targets:

- missing location
- unknown location
- inactive custom location
- ambiguous legacy display name

Rules:

- `locationId` determines the inventory bucket.
- Purchase transaction may also store location metadata, but metadata does not replace the inventory bucket key.
- Custom location rename must not move or split inventory because inventory is keyed by stable `locationId`.
- Transfer changes quantity by location and must not change WAC.
- Custom location crafting profile is a separate future topic and is not defined by this document.

## E. WAC Contract

Special material WAC follows the project-wide WAC principles in `BUSINESS_RULES.md`.

Rules:

1. Purchase creates or updates special-material `globalAvgCost`.
2. WAC uses account-wide quantity, not per-location quantity.
3. Transfer does not change WAC.
4. Craft consumption does not change WAC.
5. Manual correction does not change WAC unless a separate approved cost-basis adjustment rule exists.
6. When quantity becomes zero, keep the dormant anchor.
7. When quantity is zero, the next purchase may establish WAC from purchase unit cost.
8. If formal inventory `globalAvgCost` is `null`, crafting must block before mutation.

This document does not authorize retroactive recomputation of historical cost or automatic repair of existing data.

## F. Intake Command Boundary

Future special-material intake should be a dedicated command boundary, not an incidental crafting-side mutation.

Command input:

- `identity`
- `locationId`
- `quantity`
- `totalCost`
- optional `date`
- optional `note`

UI may accept unit cost or total cost. The command boundary receives normalized `totalCost`.

Validation:

- `identity` must be valid.
- `quantity` must be a positive finite number.
- `totalCost` must be finite and `>= 0`.
- `locationId` must resolve to an allowed active location.
- cash handling follows the normal purchase rule.
- no partial mutation is allowed.

Success behavior:

- update `qtyByLocation`
- update WAC
- deduct cash
- create transaction
- perform a single save

Failure behavior:

- inventory, cash, transaction, and storage effects remain unchanged.

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

- Validates required Artifact / Alchemy quantity at the crafting location.
- Does not apply RRR / return rate.
- Deducts special-material quantity.
- Uses `globalAvgCost` in crafted output cost.
- Does not read manual cost input.
- Does not treat Planner estimate as inventory cost basis.
- Does not mix usage fee with material inventory cost.

Rules:

- One craft submission must not silently mix manual cost and formal inventory.
- Missing formal inventory cost basis blocks before mutation.
- Planner estimate is not inventory cost evidence.
- Legacy mode must not be removed in the same production task that introduces formal inventory.

## H. Implementation Gates

Allowed first gates:

- pure identity resolver
- pure inventory / WAC helpers
- tests-only contract
- read-only projection

Forbidden first gates:

- production schema switch
- writer integration
- UI enablement
- backup schema change
- crafting deduction integration
- legacy fallback removal

Writer/UI integration is not allowed until all of the following exist:

1. identity catalog tests
2. location validation tests
3. WAC tests
4. rollback tests
5. new-schema codec support
6. backup export/import round-trip
7. crafting atomicity tests
8. manual/formal mode isolation tests

## I. Remaining Unresolved Decisions

Resolved decisions:

- Inventory scope is location-based quantity + account-wide global WAC.
- Intake requires `locationId`.
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

All remaining unresolved decisions can be deferred to tests-only pure contract work.

## J. Next Approved Step

Next approved step: **Tests-only special-material pure contract**.

Scope:

- identity validation
- location-based quantity helper
- WAC purchase calculation
- consumption validation
- no `src` integration
- no storage writer
- no UI

This next step may add tests or pure helper contracts only when separately approved. This document itself does not start implementation.
