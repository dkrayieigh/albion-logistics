# Albion Logistics ERP Migration Plan

## 文件定位

本文件定義下一階段 migration boundary。它不是執行 migration 的指令，也不要求立即修改 production code。

Current baseline: v0.4.4 is a released legacy-compatible stabilization baseline.

- Current implementation still supports legacy Chinese item keys.
- Production v2 persisted state exists and includes `locationRegistry` / canonical `qtyByLocation` storage.
- Runtime components still operate through legacy-compatible `qtyByCity` and display-name location keys.
- Current implementation still supports legacy transaction fields.
- Regression tests protect current purchase, crafting, transport, cost, ledger, startup, backup/import, reset, and custom-location behavior.

## Non-Goals

- 不做 automatic legacy `localStorage` schema migration。
- 不移除 legacy fallback。
- 不改成本規則。
- 不改 WAC。
- 不全域替換 runtime `qtyByCity` compatibility。
- 不全域替換 legacy 中文 item key。
- 不全域改寫 transaction payload。
- 不把 future spec 寫成 current implementation。

## Global Migration Boundary

在 adapter / tests / backup validation 前，不得直接改 storage key 或 transaction payload。

所有 migration track 都必須遵守：

- adapter first。
- regression tests before write migration。
- backup validation before storage mutation。
- rollback plan before release.
- at least one compatible release before removing legacy fallback.

Adapter 前置測試矩陣見 `ADAPTER_TEST_PLAN.md`。任何 migration track 開始前，必須先確認對應 compatibility tests 已完成，或已明確標註為 Adapter-only。這不代表 migration 已開始。

Adapter API reference: `ADAPTER_API.md`. Some isolated helpers and production v2 startup/read-write paths are now implemented, but this does not mean Stable Item ID migration, canonical transaction migration, full component `locationId` adoption, historical data migration, or legacy fallback removal has started.

## Implemented Clean-Cutover Foundation

Current implemented foundation:

- `createCleanInitialState()`.
- v2 storage codec.
- injected v2 repository.
- browser storage backend.
- browser new-schema repository composition.
- startup loader / decision boundary.
- runtime bridge.
- runtime controller.
- production startup/read-write cutover.
- canonical v2 backup export.
- validated atomic v2 import.
- scoped Factory Reset.
- stable custom-location lifecycle.

Remaining compatibility boundary:

- Stable Item ID migration is not started.
- Canonical transaction migration is not started.
- Full runtime/component `locationId` adoption is not complete.
- Legacy fallback removal is not started.
- Historical data automatic migration is not implemented.
- Custom crafting profiles are not defined.
- Formal Special Material persistence is not implemented.
- Future schema / backup upgrade design remains separate.

## Single-User Clean Cutover Decision

使用者已明確確認目前只有單一使用者，且不要求新版自動讀取或遷移既有 legacy 資料。因此 Location track 的 selected strategy 改為 **single-user clean cutover**。

### Confirmed Assumptions

- 此程式目前只有一位使用者。
- 新版可以建立全新 schema 與全新資料。
- 不要求 future app 直接匯入 legacy backup。
- 舊 backup 只需保留為 external archive。
- 使用者可人工重新輸入目前真實 inventory、cost 與 cash。
- 已知舊 backup 可能受 crafting hotfix 前資料污染。

### Legacy Backup Policy

- Cutover 前必須另存最後一份 legacy export。
- 舊 backup 保留為 external archive，不保證新版可直接 import。
- Rollback 方式是回到舊版 app 並重新載入舊 backup，不是新版內建 schema rollback。
- 不得自動清除 legacy `localStorage`；first new-schema launch 必須有明確 confirmation 或使用不同 storage key。

### Initial Data Policy

- 新版初始 transactions 為空。
- 新版 initial cash 由使用者人工輸入。
- Inventory 只人工輸入已核對的實際數量。
- `globalAvgCost` 預設為 `null`，除非使用者提供可靠 cost basis。
- 不從 legacy `globalAvgCost: 0` 推導 unknown cost。
- Custom locations 由使用者重新建立。

### New Location Schema Contract

- New root state uses `schemaVersion: 1`。
- New persisted storage key is `albion-logistics-v2-state`。
- New state includes `locationRegistry` object keyed by `locationId`。
- Registry entry `locationId` must equal its object key。
- Registry `type` is limited to `system`、`system-special`、`custom`。
- Registry `active` must be boolean。
- `customLocations` does not exist in new stored state。
- Inventory uses `qtyByLocation` only；`qtyByCity` does not appear in new schema。
- This Location track keeps legacy `itemKey` identity and does not perform Stable Item ID migration。
- New schema does not convert old transaction history into canonical events。

### Clean Initialization Contract

Clean cutover uses a pure initializer contract:

```js
createCleanInitialState(input, options?)
```

The initializer contract is implemented as a pure helper and is part of the completed v2 clean-cutover foundation. It does not read or mutate legacy state, does not auto-migrate legacy backups, and does not start Stable Item ID, canonical transaction, or full component `locationId` migration.

Input shape:

```js
{
  cash: Number,
  debt?: Number,
  customLocations?: [
    {
      clientRef: String,
      displayName: String
    }
  ],
  inventorySeeds?: [
    {
      itemKey: String,
      locationId?: String,
      customLocationRef?: String,
      quantity: Number,
      globalAvgCost?: Number | null
    }
  ]
}
```

Options shape:

```js
{
  generateCustomLocationId?: () => String
}
```

Contract rules:

- `clientRef` is input-only and must not be stored in root state or Location Registry.
- `clientRef` must be trimmed, non-empty, unique within one input, and not derived from `displayName`.
- `customLocationRef` must reference an input `customLocations[].clientRef`; unknown references fail.
- Each inventory seed must provide exactly one of `locationId` or `customLocationRef`.
- Custom permanent IDs are generated by the initializer and must not derive from `displayName` or `clientRef`.
- `generateCustomLocationId` exists only for pure implementation and deterministic tests; it is not user input and is not stored.
- Generated custom IDs must use `custom:<generated-id>`; generator failure, duplicate IDs, or system ID conflicts fail the whole initialization.
- Duplicate inventory seed identity is `itemKey + resolved locationId`; duplicate seeds are invalid and must not be auto-summed.
- Failure returns no partial state, does not mutate input, does not read/write `localStorage`, and does not modify legacy keys.

Future clean initialization creates canonical `laborerInventory` categories with `滿日誌`, not `滿日記本`. Current legacy src/storage may still use `滿日記本`; clean cutover does not auto-convert legacy laborer data.

### Fixed Location Registry Entries

The clean-cutover registry must create fixed entries for:

- `thetford`
- `martlock`
- `bridgewatch`
- `lymhurst`
- `fort_sterling`
- `caerleon`
- `brecilien`
- `laborer_island`

`Hideout` must not create a permanent registry entry.

### Superseded Location Strategy

以下要求不再是 selected Location strategy：

- automatic backup migration。
- dual-write。
- long-term legacy fallback。
- automatic transaction migration。
- complete legacy inventory key preservation。
- same transaction count。
- same cash requirement。
- complete custom location count preservation。
- full legacy snapshot equality as release blocker。

### Completed Prerequisites

The following clean-cutover prerequisites are completed for the current v0.4.4 baseline and must not be listed as remaining blockers:

- new schema definition.
- clean initializer.
- writer / codec / repository regression tests for the v2 foundation.
- backup export / validated import tests.
- manual initialization / first-launch confirmation behavior.
- release checklist for v0.4.4.
- build / installed-app smoke.

### Remaining Requirements For Future Migration

Clean cutover remains high risk for future migration work. Remaining requirements are:

- full runtime/component `locationId` adoption tests.
- shared resolver completion and UI coverage.
- future schema / backup compatibility upgrade design.
- historical transaction location strategy.
- fallback removal gates.
- rollback instructions for any future schema upgrade.
- user confirmation before deleting or ignoring legacy `localStorage` in any future migration step.

不得因此直接修改 `state.js`、production storage schema、writer path、backup format 或 legacy fallback。

### Validator Scope

`src/adapters/locationMigrationValidator.js` is now classified as read-only research / verification utility. It is not a production migration runner.

- Full snapshot equality is no longer a clean-cutover release blocker。
- The validator may later be adjusted into a selected seed data validator。
- The validator does not authorize automatic storage rewrite, backup rewrite, writer switch, or legacy fallback removal。

---

## Track 1：Item ID Migration

### Precondition

- 建立 legacy 中文 key ↔ Stable ID mapping。
- 明確定義 `itemLevel` 格式與來源。
- 確認所有 material、crafted item、laborer item 都能被 mapping。

### Adapter-First Rule

- 先建立 item identity adapter。
- Adapter 必須能讀取 legacy 中文 key 與 future Stable ID。
- 新 code 應透過 adapter 取得 item identity，不直接拆解 `itemKey`。

### Test Requirement

- Legacy 中文 key 仍可讀。
- Stable ID key 可透過 adapter 讀。
- Mapping 缺失必須被阻擋或明確報錯。
- Mapping 衝突不得靜默覆寫。
- 遷移前後 inventory quantity、`globalAvgCost`、ledger display 必須一致。

### Backup / Rollback Requirement

- Migration 前必須匯出完整 backup。
- Migration 後必須可比較 item count、quantity total、cash、transaction count。
- 必須保留 legacy backup 可回復。

### Release Boundary

- 第一個 migration release 只能新增 adapter 與雙讀支援。
- 不得在同一 release 移除 legacy 中文 key fallback。
- Stable ID 不得宣告為 current implementation，直到 storage write path 與 backup migration 完成並受測。

---

## Track 2：Location Migration

### Selected Strategy：Single-User Clean Cutover

Location migration no longer uses a full legacy-compatible automatic migration path as the selected strategy. The selected strategy is single-user clean cutover:

- Do not implement automatic legacy storage migration。
- Do not require future app to directly import legacy backup。
- Do not create dual-writer or long-term legacy fallback。
- Do not convert old transaction history into canonical events。
- Start a new schema with manually confirmed seed data。
- Keep old backup outside the future app as archive evidence。

This section supersedes earlier Location-track language that assumed full snapshot equality, same transaction count, same cash, complete custom location count preservation, or automatic legacy backup conversion as release blockers.

### Completed Prerequisites

- Production v2 persisted state includes `locationRegistry` and canonical `qtyByLocation` storage。
- Production writer/storage v2 foundation exists through the runtime controller and v2 save path。
- Clean initializer and first-launch confirmation behavior exist and are regression covered。
- Stable custom-location IDs are generated by the current initializer/lifecycle path; exact generator internals remain implementation detail。
- Location identity business rules are defined: `locationId` immutable, `displayName` mutable, rename preserves `locationId`。
- Fixed system IDs, `LaborerIsland` / `laborer_island`, and deprecated `Hideout` boundaries are defined。
- Non-empty custom-location delete blocking remains required and covered。

### Remaining Requirements For Future Location Migration

- Runtime/component full `locationId` adoption is not complete。
- Historical transaction location canonicalization is not implemented。
- Shared resolver completion and inactive-location UI remain incomplete。
- Custom crafting profiles remain undefined。
- Automatic legacy backup migration is not implemented。
- Legacy fallback removal has not started。
- Future schema / backup upgrade design remains separate。

### Adapter / Test Boundary

- Existing read-only location adapters remain compatibility and verification support。
- Persisted `qtyByLocation` is current v2 storage, but adapter support does not mean every runtime component or historical payload now uses stable `locationId`。
- Future work must test full component `locationId` adoption, resolver/UI coverage, backup compatibility upgrades, historical transaction strategy, and fallback-removal gates before any migration cleanup。

### Backup / Rollback Requirement

- Cutover 前必須保存最後一份 legacy backup export。
- Legacy backup is external archive only；future app does not need to import it directly。
- Rollback means returning to old app and reloading old backup。
- New app rollback is not an automatic schema rollback from legacy data。
- Seed data validation should focus on manually selected current inventory, user-entered cash, and user-provided reliable cost basis。
- New backup exports only new schema。
- New importer accepts only matching new schema and `schemaVersion`。
- Legacy backup is handled by the old app, not the new importer。

### Release Boundary

- Future migration steps must not auto-delete legacy `localStorage`。
- If legacy keys are detected in a future migration flow, user-facing warning / confirmation remains required。
- Canceling confirmation must not write new state。
- Do not declare full runtime/component Location ID migration complete until component writers, historical payload strategy, resolver/UI coverage, backup compatibility, and fallback-removal gates are complete。
- Do not remove legacy fallback in the old app path as part of this docs decision。

---

## Track 3：Transaction / Event Migration

### Precondition

- 定義 canonical event payload。
- 建立 legacy transaction ↔ canonical event mapping。
- 明確區分 current legacy sale transactions 與 future `SELL_ITEM` event。
- 確認 ledger reader、搜尋、reversal、backup import 都能處理 legacy transactions。

### Adapter-First Rule

- 先建立 ledger reader adapter。
- Adapter 必須同時支援 legacy transaction 欄位與 future event payload。
- Canonical event writer 必須集中，不得由 UI 任意寫入 storage。

### Test Requirement

- Legacy transactions 可顯示、搜尋、匯入。
- 採購 reversal 仍保留原始交易並新增 adjustment。
- 成品出售與工人島出售的 current behavior 不回歸。
- 現金校正、注資、提領的 cash / debt / ledger 行為不回歸。
- Future event samples 可被 reader adapter 正確顯示。

### Backup / Rollback Requirement

- Migration 前必須保存含大量 transactions 的 backup。
- Migration 後必須驗證 transaction count、cash total、inventory impact 與 reversal 狀態。
- 必須保留 legacy transaction backup 可回復。

### Release Boundary

- 第一個 event migration release 只能提供 reader adapter 與受控 writer boundary。
- `SELL_ITEM` 不得宣告為 current implementation，直到 canonical event writer、reader、tests 與 backup migration 完成。
- 不得在同一 release 移除 legacy transaction fallback。

---

## Final Removal Boundary

Legacy fallback 只能在以下條件全部滿足後移除：

- Adapter 已在至少一個 stable release 中運作。
- Regression tests 覆蓋 legacy 與 future samples。
- Backup migration 已受測。
- Rollback path 已驗證。
- Release notes 明確公告 breaking changes。

未滿足以上條件前，所有 legacy storage key 與 transaction payload 都必須視為 supported current implementation。

## Future Transition Outline：Account-total Products / Special Materials / Ledger English

Status: Superseded for product inventory by the 0.5.0 Crafting Domain Model.

This historical outline is retained as planning context only. Account-total Product Inventory is rejected for 0.5.0; Product Inventory remains location-based. Do not use Phase 2 through Phase 4 below as the selected product migration strategy.

本段是 future transition outline，不是 migration 執行指令。它不得覆蓋 single-user clean-cutover boundary，也不得宣稱會自動轉換既有 production data。舊資料是否重建仍以人工 clean initialization 與 Spec Lead 決策為準。

### Phase 1：English Ledger Presentation Mapping

- 只新增 Ledger presentation mapping。
- Category 與 Item 顯示可轉英文。
- 不重寫 stored legacy transaction payload。
- 不改 transaction writer、backup、storage schema 或 historical transactions。

### Phase 2：Inventory Classification Tests And Read-only Projection

- 補 inventory classification tests：regional materials、account-total products、special materials、laborer inventory。
- 建立 read-only projection helpers 前，先定義 failure mode 與 fallback。
- 不切換 writer，不改 storage。

### Phase 3：Product Account-total Adapter

- 建立 product account-total read-only adapter / projection。
- 驗證 product `totalQty` 與 legacy city buckets 的差異處理。
- 不切換 crafting writer、sale writer、transport writer 或 dashboard valuation writer。

### Phase 4：Product Writer Cutover

- 切換 crafting output to product `totalQty`。
- 切換 sale consumption from product `totalQty`。
- Dashboard valuation 改用 product account-total。
- Product transport 必須停用或排除。
- Crafting city / sale city 只保留為 event metadata。
- 此 phase 必須有 writer tests、restart round-trip tests、backup tests 與 rollback/release checklist。

### Phase 5：Special Material Inventory

- 建立 artifact inventory 與 alchemy inventory 兩個獨立清單。
- 特殊材料只使用 Tier，不使用 enchant level。
- 支援 unit price / total price purchase entry。
- 維護 global WAC。
- 製作時固定消耗，不套用返還率，不建立 regional inventory 或 transport。

### Phase 6：Cost Adjustment Event Correction

- 定義 `INVENTORY_COST_ADJUSTMENT` 或等價 future event。
- 成本校正 `cashImpact` 必須為 `0`。
- 記錄 `valuationImpact`、`oldUnitCost`、`newUnitCost`、`quantityBasis`。
- 修正 Ledger 顯示，避免把估值調整誤讀為現金支出。
- 不回溯重寫歷史 transactions，除非 Spec Lead 另行批准資料修復策略。
## 0.5.0 Selected Crafting Transition Outline

Canonical decision source: [0.5.0 Crafting Domain Model](./CRAFTING_DOMAIN_MODEL.md).

Version strategy:

- Do not publish a formal 0.4.5 release.
- Keep package/app metadata at `0.4.4` until a future 0.5.0 release-preparation task.
- Do not tag, build, or release 0.4.5.

Selected product strategy:

- Product Inventory remains location-based.
- Crafting output writes to selected production `locationId`.
- Sale consumes from selected product location.
- Product transfer remains valid logistics behavior.
- Do not create account-total product storage or an `AccountTotal` fake location.

Selected migration / implementation order:

1. Tests-first production bonus/profile/consumption pure contract.
2. General material purchase/WAC service extraction.
3. Craft requirement resolver.
4. Craft completion calculation modules.
5. Craft operation composer.
6. Development build identifier.
7. Progressive `checkJs` and CI gates.
8. Production storage/backup/transaction design.
9. Production integration.
10. 0.5.0 release preparation.

Production Profile storage migration remains future high risk. Existing custom locations without profiles are warehouse-only and must not be silently promoted into craft locations.
