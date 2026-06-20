# Albion Logistics ERP Migration Plan

## 文件定位

本文件定義下一階段 migration boundary。它不是執行 migration 的指令，也不要求立即修改 production code。

目前 v0.4.2 應視為 legacy-compatible stable release：

- current implementation 仍支援 legacy 中文 item key。
- current implementation 仍支援 `qtyByCity`。
- current implementation 仍使用 legacy transaction 欄位。
- regression tests 保護目前穩定版資料安全與核心成本規則。

## Non-Goals

本階段不做：

- 不做 `localStorage` schema migration。
- 不移除 legacy fallback。
- 不改成本規則。
- 不改 WAC。
- 不全域替換 `qtyByCity`。
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

Adapter API draft: `ADAPTER_API.md`。該文件是 future API draft，不代表 migration 已開始，也不代表 adapter 已是 current implementation。

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

### Still Required

Clean cutover 仍屬 High risk，仍必須先完成：

- new schema 定義。
- new writer tests。
- new backup export/import tests。
- manual initialization flow。
- release checklist。
- old backup archive。
- build / smoke test。
- rollback instructions。
- user confirmation before deleting 或 ignoring legacy `localStorage`。

不得因單一使用者而省略 new schema tests。不得直接修改 `state.js` 或 `localStorage` schema，直到 docs 與 tests 先完成。

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

### Precondition

- 定義 Location Registry。
- 建立 legacy location name ↔ future locationId mapping。
- 確認 system cities、自訂倉庫、LaborerIsland / laborer island 邊界。
- 定義 `LaborerIsland` special legacy key mapping：current exact legacy key remains `LaborerIsland`；future fixed special system ID is `laborer_island`；writer/storage migration remains not started。
- 定義 `Hideout` deprecated legacy key gate：future registry must not assign permanent ID `hideout` / `Hideout`；residual `Hideout` must be unresolved / deprecated legacy key and block migration until handled。
- 明確定義非空自訂倉庫刪除安全規則仍保留。
- 定義 Location identity business rules：`locationId` immutable、`displayName` mutable、rename preserves `locationId`。
- 定義 fixed system IDs：`thetford`、`martlock`、`bridgewatch`、`lymhurst`、`fort_sterling`、`caerleon`、`brecilien`。
- 定義 custom location generated ID policy。Conceptual format is `custom:<generated-id>`；exact UUID / generator implementation remains future design。
- 定義 name conflict policy：trim surrounding whitespace、case-insensitive comparison、no duplicate displayName、no conflict with system city display names、no silent suffixing or automatic rename。
- 定義 legacy mapping policy：exact match only、no fuzzy matching、no silent custom creation、duplicate/conflicting/unknown names become unresolved。
- For clean cutover, unresolved legacy mappings are used for audit only；they do not require automatic conversion because selected seed data is manually entered。
- Define new schema before writer/storage changes。
- Define manual initialization flow before first new-schema launch。
- Confirm old backup archive before ignoring or deleting legacy local data。

### Adapter-First Rule

- 先建立 location adapter。
- Adapter 必須同時支援 legacy `qtyByCity` 與 future `qtyByLocation`。
- New schema writer/storage changes must wait for explicit clean-cutover contract and tests。
- Existing read-only adapters remain research / verification support and do not imply writer integration。

### Test Requirement

- New schema writer tests must be added before writer switch。
- New backup export/import tests must be added before release。
- Manual initialization flow must be tested before release。
- 自訂倉庫更名與刪除安全限制不回歸。
- 物流轉移不得改 cash、ledger 或 `globalAvgCost`。
- Future `qtyByLocation` sample readability remains adapter-only until new schema is implemented and tested。

### Backup / Rollback Requirement

- Cutover 前必須保存最後一份 legacy backup export。
- Legacy backup is external archive only；future app does not need to import it directly。
- Rollback means returning to old app and reloading old backup。
- New app rollback is not an automatic schema rollback from legacy data。
- Seed data validation should focus on manually selected current inventory, user-entered cash, and user-provided reliable cost basis。

### Release Boundary

- First clean-cutover release must not auto-delete legacy `localStorage`。
- First new-schema launch must require explicit user confirmation or use a different storage key。
- Do not declare `qtyByLocation` current implementation until new schema, writer tests, backup tests, manual initialization, and smoke checks are complete。
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
