# Albion Logistics ERP Special Material Inventory Specification

## 文件定位

本文件是 Artifact / Alchemy 特殊材料庫存的 future specification。它只定義 recipe、Planner、Crafting、Inventory、Transaction 與 storage 之間的邊界，不代表目前 `src`、tests、schemaVersion、storage key、backup format 或 transaction payload 已修改。

本文件不得被解讀為 implementation task。正式實作前仍需 Spec Lead 決定 target inventory scope、identity contract、writer boundary、backup/rollback 與 regression tests。

## A. Current Implementation Summary

目前特殊材料只存在於 recipe、Planner 與 Crafting 計算流程中，尚未是正式 inventory module。

Current recipe metadata:

- Recipes may contain `artifactName`。
- Recipes may contain `artifactQty`。
- Recipes may contain `alchemyName`。
- Alchemy requirement is Tier-dependent。

Current Planner behavior:

- Planner supports manual unit estimate for Artifact / Alchemy cost。
- Planner is calculation-only。
- Planner has no inventory write。
- Planner does not apply material return rate to special materials。
- Planner does not create special-material purchase records。
- Planner-specific special material estimate controls are not a persisted quotation system。

Current Crafting behavior:

- Crafting queue / shopping list can show Artifact / Alchemy cost components。
- Crafting can calculate cash requirement from manually entered special-material cost。
- Crafting can include Artifact / Alchemy cost in crafted output cost when submitted through the current flow。
- Current crafting does not deduct special materials from a formal inventory root。
- Current crafting does not create a special-material acquisition transaction。

Current storage behavior:

- There is no dedicated `artifactInventory` root。
- There is no dedicated `alchemyInventory` root。
- There is no dedicated special-material `qtyByCity` / `qtyByLocation` storage。
- There is no dedicated special-material `globalAvgCost` storage。
- Backup/export does not yet include a formal special-material inventory section。

Therefore, documentation must not describe formal special-material inventory as current implementation.

## B. Target Inventory Scope

Special-material inventory target scope is not finalized. The key Spec Lead decision is whether special materials are location-based or account-wide.

### Option A：Location-based Special Material Inventory

```js
specialMaterialInventory[itemId] = {
  qtyByLocation: {
    "system:bridgewatch": 10,
    "custom:...": 5
  },
  globalAvgCost: 12345
}
```

Tradeoffs:

- Supports per-location purchase and crafting requirements。
- Requires custom location integration。
- Requires transfer / location rules。
- Increases WAC and backup complexity。
- Must define how crafting location selects special-material quantity。

### Option B：Account-wide Special Material Inventory

```js
specialMaterialInventory[itemId] = {
  quantity: 15,
  globalAvgCost: 12345
}
```

Tradeoffs:

- Simpler inventory and backup shape。
- No transfer flow。
- Custom location only affects crafting fee / return-rate profile, not special-material stock。
- Requires clear UI wording that Artifact / Alchemy are account-total materials。
- Must define whether purchase location is only transaction metadata。

### Decision Status

No option is selected in this document. The selected schema must be documented before any storage, writer, backup, migration, or UI enablement work.

## C. Special Material Identity Boundary

Artifact identity should not depend on display name parsing. Future implementation should use stable material identity and treat display names as presentation.

Alchemy identity must include concrete material kind and Tier. It must not collapse all alchemy requirements into a generic `alchemy` key.

Future metadata should define:

- stable id
- Chinese name
- English name
- category: `artifact` or `alchemy`
- tier

Do not invent final Albion item IDs in this document. If a temporary internal proposal is needed, it must be labeled as proposal only, for example:

```text
artifact:<normalized-key>
alchemy:<tier>:<normalized-key>
```

These examples are not current implementation and not final ID format.

## D. Purchase / Intake Flow

Future special-material intake should be a dedicated command or writer, not an incidental crafting-side mutation.

Suggested input:

- material
- quantity
- unit cost or total cost
- location, if the selected scope is location-based
- optional date / note

Expected success behavior:

- Increase special-material inventory quantity。
- Update WAC。
- Deduct cash according to purchase rule。
- Create a purchase transaction。
- Save atomically。
- Support rollback on save failure。

Expected failure behavior:

- `quantity <= 0` blocks。
- `price < 0` blocks。
- invalid material blocks。
- invalid location blocks if scope requires location。
- insufficient cash handling follows the selected purchase rule。
- save failure rolls back inventory, cash, transaction, and storage effects。

Transaction design must have two separately labeled proposals:

1. legacy-compatible writer proposal。
2. future canonical event proposal。

Neither proposal is current implementation until tests and writer integration exist.

## E. Crafting Deduction Flow

Future crafting behavior must define how Artifact / Alchemy formal inventory interacts with crafting.

Rules to decide:

1. Artifact / Alchemy quantities are required before submit。
2. Special materials do not use RRR / return rate。
3. Submit must validate whether required special materials exist at the selected scope。
4. Failure must block before mutating materials, crafted output, cash, transactions, queue, or storage。
5. Success deducts special-material quantity。
6. Crafted output cost basis includes special-material WAC。
7. Manual cost input and formal inventory cost must not be silently mixed。
8. Planner may keep manual estimate mode, but Planner is not accounting evidence。
9. Crafting formal inventory mode must use inventory cost basis。
10. Compatibility period must define how current manual-cost flow coexists with future formal inventory。

Possible compatibility phases:

- Phase 1：manual-cost legacy mode。
- Phase 2：formal-inventory opt-in。
- Phase 3：formal inventory required。

Legacy fallback must not be removed in the same step as first production implementation.

## F. WAC And Cost Rules

Spec Lead must decide:

- Whether special materials use global WAC。
- Whether location quantity and account-wide cost basis are separated。
- Whether transfer can affect WAC。
- Whether correction requires explicit historical cost evidence。
- How zero / unknown cost is represented。
- Whether sale / remove operations use WAC。
- Whether returned quantity exists; current business assumption says special materials do not use return rate。

Recommended conservative rule:

- Special-material purchase establishes or updates `globalAvgCost`。
- Crafting consumption uses current `globalAvgCost`。
- Crafting consumption does not recalculate special-material `globalAvgCost`。
- Manual cost input must not overwrite inventory cost basis。

## G. Custom Location Boundary

If special materials are location-based, the implementation must use stable custom location ID.

This task does not define custom location crafting profile.

Future custom location metadata remains separate future work:

- biome
- map quality
- crafting category bonus
- map bonus
- focus RRR
- hideout profile

Custom location crafting profile requires separate contracts before implementation:

- profile contract
- UI input shape
- codec/rollback tests
- existing location compatibility plan

This document must not trigger custom location profile implementation.

## H. Architecture Boundary

Future architecture target:

```text
UI
-> Special Material Intake command
-> inventory / cost rules
-> transaction runner
-> repository / storage
```

This is a future architecture boundary only. It does not require splitting `state.js` now and does not require immediate domain/application/infrastructure folder separation.

If implementation starts, prefer bounded service/helper design that can be tested before connecting UI, inventory, cash, ledger, and storage.

Future command names may include:

- `PURCHASE_SPECIAL_MATERIAL`
- `CONSUME_SPECIAL_MATERIAL`

These names are proposals, not current canonical event payload.

## I. Future Test Plan

Future tests should be labeled as future test plan / not yet implemented until real tests exist.

Purchase / intake:

1. artifact purchase success。
2. alchemy purchase success。
3. quantity increases。
4. WAC updates。
5. cash decreases。
6. transaction is created。
7. save failure rollback。
8. invalid quantity / price / material / location blocks。

Crafting:

9. artifact requirement validation。
10. alchemy Tier requirement validation。
11. no return rate is applied。
12. insufficient special material blocks before mutation。
13. crafted output cost includes special-material cost。
14. crafted output cost uses special-material WAC。
15. manual cost does not silently mix with formal inventory cost。
16. transaction / inventory / cash atomicity。

Location:

17. system location behavior if location-based scope is selected。
18. active custom location behavior。
19. inactive location is blocked。
20. rename preserves inventory by stable ID。

Compatibility:

21. manual-cost legacy path remains available during compatibility period。
22. formal mode does not read manual estimate as inventory evidence。
23. backup round-trip。
24. unknown material ID blocks。
25. no silent migration。

## J. Implementation Sequence

Recommended sequence:

1. Identity contract。
2. Pure inventory / WAC helpers。
3. Regression tests。
4. Read-only inventory projection。
5. Intake command / writer。
6. Crafting validation / deduction。
7. Backup/export。
8. UI enablement。
9. Remove legacy fallback only in a later high-risk phase。

Do not merge S9 into the first production implementation task.

## Unresolved Spec Lead Decisions

- Choose Option A location-based inventory or Option B account-wide inventory。
- Decide temporary vs final stable material ID format。
- Decide whether purchase location is inventory location or metadata。
- Decide exact WAC behavior for zero / unknown cost。
- Decide compatibility period between manual-cost crafting and formal inventory。
- Decide backup/export schema and rollback path。
- Decide future canonical event names and payload fields。
