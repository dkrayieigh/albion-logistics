# Albion Logistics ERP Roadmap

## 文件定位

本文件只描述目前 Spec Lead 指定的 active roadmap。Paused / Backlog 項目不代表取消；approved target 不代表 implementation authorization。

## Active Roadmap

### Completed Checkpoint：Docs consolidation closeout

目標：

- 確保 active planning 文件不保留過時 current claims。
- 區分 historical plan、completed release baseline、current execution plan 與 future target。
- 統一 current、legacy-compatible、test-covered、future、migration boundary 的語義。
- 不啟動 Phase-1 source refactor 或其他 production implementation。
- 保留 confirmed business rules、regression expectations、confirmed bug reports 與 user-confirmed specification 的優先權。

不包含：

- production code 修改。
- migration implementation。
- release/version metadata 修改。
- service / adapter implementation。
- storage schema、backup format 或 transaction payload 修改。

完成摘要：

- Current、legacy-compatible、future、migration boundary 已重新對齊。
- Backup/import/reset/release 相關舊 planning 內容已改列 completed / historical。
- Location persisted/runtime boundary 已修正。
- Special Material account-total target decision 已完成。
- Active planning 文件不再把已完成 baseline 誤列為 current gap。

### Completed Checkpoint：Phase-1 refactor planning and inventory

目標：

- 盤點 current component / business mutation coupling。
- 盤點既有 regression coverage。
- 找出一個 bounded refactor candidate。
- 定義候選範圍、風險、驗證方式與交接內容。
- 交回 Codex / Core Engineer 任務包。

不包含：

- production source 修改。
- service extraction。
- tests 修改。
- version metadata 修改。
- storage schema、backup format 或 transaction payload 修改。
- `qtyByLocation` runtime writer migration。
- Stable Item ID migration。
- Special Material production implementation。

完成摘要：

- 已盤點 Purchase / WAC、Inventory Transfer、Crafting Completion 等候選範圍。
- 已選定 Inventory Transfer 作為第一個 bounded extraction。
- 已確認 transfer 既有 regression baseline。
- 已建立 pure service contract 與 component adapter boundary 的交付範圍。

### Completed Checkpoint：Inventory Transfer bounded service extraction

目標：

- 將既有 inventory transfer 行為抽成可測、可回滾的 bounded pure service。
- 保留使用者可見 transport / transfer 行為；這只是既有行為的 bounded extraction。
- 不改 storage schema、backup format、transaction payload、Location migration 或 release metadata。

完成摘要：

- `src/services/inventoryTransferService.js` 已提供 `applyInventoryTransfer()`。
- Pure service 處理 quantity validation、same-location validation、item existence、selected-source sufficiency 與 `qtyByCity` physical move。
- `src/components/inventory.js` 仍是 DOM input、toast、`state.inventory[key]` assignment、`saveState()` 與 UI refresh adapter。
- Service-level regression tests 已覆蓋 success、immutability、total quantity preservation、custom display-name locations、zero/negative quantity rejection、same-location rejection、missing item rejection、selected-source insufficiency 與 validation priority。
- Existing integration regressions 仍保護 legacy save path、WAC preservation、cash/debt preservation、transaction preservation、custom display-name compatibility 與 no `qtyByLocation` / Location Registry side effect。

不包含：

- 新增 transport feature。
- `qtyByLocation` writer/storage migration。
- Location identity migration。
- canonical `TRANSFER_ITEM` event。
- transfer transaction writer。
- cash/debt、transaction、backup、storage 或 `globalAvgCost` 行為變更。
- v0.4.4 release artifact 變更。

### Completed Checkpoint：Incremental quality tooling planning and boundary

目標：

- 盤點目前 ESLint / Prettier / test runner 狀態。
- 找出尚未 lint-safe 或 type-check-safe 的檔案與風險。
- 規劃 progressive `checkJs` boundary。
- 選定一個 low-risk tooling task，且不得改 runtime behavior、dependency behavior 或 production flow。
- 交回下一個明確任務。

不包含：

- 修改 `package.json`。
- 修改 ESLint config。
- 啟用 repo-wide `checkJs`。
- Vite、CSP、SQLite。
- source refactor。
- dependency/runtime behavior change。
- version bump、release、tag 或 artifact work。

完成摘要：

- 已盤點 ESLint、Prettier、test runner 與 CI gate。
- 已確認現有 lint 覆蓋 calculators、presenters 與 scripts。
- 已確認 repo-wide `checkJs` 與 `@ts-check` boundary 尚未啟用。
- 已選定 Inventory Transfer pure service 與 service test 作為第一個 exact-file lint 擴張範圍。
- 已交付 bounded implementation 任務包。

### Completed Checkpoint：Inventory Transfer exact-file ESLint coverage

目標：

- 只擴張 incremental ESLint coverage，不啟動 repo-wide lint。
- 將 Inventory Transfer pure service 與對應 service test 納入 exact-file lint gate。
- 保持 runtime behavior、source、tests、Prettier scope、CI workflow、dependencies、version 與 release assets 不變。

完成摘要：

- `eslint.config.js` 已納入 `src/services/inventoryTransferService.js` 與 `tests/inventory-transfer-service.test.js`。
- `package.json` 的 `lint` script 已納入相同 exact paths。
- 原本 scope 仍包含 `src/calculators/**/*.js`、`src/presenters/**/*.js` 與 `scripts/**/*.mjs`。
- CI 仍透過既有 `npm run lint` step 執行，沒有新增 workflow step。
- Rules 維持 `no-dupe-keys`、`no-fallthrough`、`no-undef`、`no-unreachable`。
- 未新增 globals、plugins、ignores、dependencies 或 warning-only 規則。
- 未修改 source、tests、Prettier scope 或 CI workflow。

不包含：

- `src/services/**/*.js` 全範圍 coverage。
- `src/components/**/*.js` coverage。
- `tests/**/*.test.js` 全 suite coverage。
- repo-wide lint。
- `checkJs`。
- TypeScript。
- Vite、CSP、SQLite。
- runtime / business behavior change。
- version / release work。

### Completed Checkpoint：Custom warehouse boundary specification and inventory

目標：

- 盤點目前 custom warehouse / custom location production behavior。
- 釐清 persisted v2 `locationRegistry`、runtime `customLocations`、runtime inventory `qtyByCity`、persisted canonical `qtyByLocation` 的邊界。
- 盤點 add、rename、remove、inactive registry、non-empty deletion guard 與 rollback coverage。
- 盤點 custom warehouse UI 目前已完成與未完成項目。
- 盤點 shared resolver、inactive-location UI、custom crafting profile、full component `locationId` adoption 缺口。
- 找出一個 bounded candidate。
- 準備 risk、tests-first boundary 與交接任務包。

不包含：

- 修改 source。
- 修改 tests。
- 修改 storage schema。
- 將 component writer 全面切到 `qtyByLocation`。
- 移除 legacy fallback。
- automatic legacy migration。
- 修改 backup。
- 新增 custom crafting profile。
- Stable Item ID / transaction migration。
- Special Material production implementation。
- version / release work。

完成摘要：

- 已盤點 persisted、runtime、component 與 state API 邊界。
- 已確認 stable custom ID lifecycle、inactive registry、non-empty deletion guard 與 rollback 已有 coverage。
- 已確認 full runtime Location migration 尚未完成。
- 已確認刪除 confirmation copy 與 current safety rule 存在低風險 UX contract mismatch。
- 已選定一個 bounded candidate。

### Completed Checkpoint：Custom warehouse deletion UX contract regression and fix

目標：

- 只處理自訂倉庫刪除 confirmation wording 與目前安全規則不一致的 UI contract。
- 採 tests-first UI contract fix。
- 不改 state、schema、migration、registry lifecycle、backup 或 storage。

不包含：

- 修改 `src/core/state.js`。
- 修改 registry lifecycle。
- 修改 runtime bridge。
- 修改 storage / backup。
- 新增 inactive-location UI。
- 新增 custom crafting profile。
- full component `locationId` adoption。
- legacy fallback removal。
- automatic legacy migration。
- version / release work。

完成摘要：

- 自訂倉庫刪除 confirmation wording 已改為符合 current safety rule：非空倉庫必須先轉移或清空後才能刪除。
- Cancellation path 已受 regression test 保護：取消確認不修改 custom locations、registry、inventory、transactions，也不顯示 success/error toast。
- Confirmed non-empty deletion 仍會被阻擋，保留 registry entry、runtime custom location 與 inventory，並顯示 error toast。
- Confirmed empty deletion 保留既有成功行為：deactivate registry entry、移除 runtime custom location / `qtyByCity` bucket、保留其他庫存，並顯示 success toast。
- Regression coverage 包含 confirmation wording、cancellation no-mutation、confirmed non-empty blocked、confirmed empty success。
- Production source scope 只改 `src/components/inventory.js` confirmation copy。
- 未修改 `src/core/state.js`、registry lifecycle、save/rollback、storage schema、runtime bridge、backup、transaction payload 或 legacy fallback。

### Completed Checkpoint：Special material inventory contract reconciliation

目標：

- 協調 Special Material inventory 的 target contract 衝突。
- Spec Lead 已選 account-total `totalQty`。
- `globalAvgCost` 為 account-wide。
- 不建立 location bucket。
- 不支援 Special Material inventory transfer。
- Location 未來只可作為 transaction metadata，不可作為 inventory bucket。
- Location-based candidate 已改列 rejected historical alternative。
- Storage、transaction、backup、UI 仍待後續設計。

完成摘要：

- `BUSINESS_RULES.md` 與 `SPECIAL_MATERIAL_INVENTORY.md` 已同步為 account-total target。
- Selected target：`totalQty`、account-wide `globalAvgCost`、no location bucket、no transfer。
- Current implementation 仍未建立 formal Special Material inventory。
- Production integration 仍未核准。

不包含：

- 修改 source。
- 新增或修改 tests。
- identity catalog。
- WAC helper。
- inventory helper。
- schemaVersion。
- storage root。
- backup。
- transaction payload。
- Planner / Crafting integration。
- 移除 manual-cost compatibility。
- version / release work。

### Active Checkpoint：Tests-first special-material pure contract

目標：

- 先定義 pure helper 輸入/輸出與失敗語義。
- 先建立 regression contract。
- 不接 production state。

不包含：

- Production source integration。
- Storage root / schemaVersion。
- Catalog implementation。
- Cash / transaction writer。
- Backup。
- UI。
- Crafting integration。
- Special Material transfer。
- Version / release work。

### Completed Baseline：v0.4.4 backup/reset/release stabilization

以下 phase 已屬 completed baseline，不再是 active execution phase：

- Backup/reset contract.
- Tests-first backup regression.
- Pure backup envelope / classification / export service.
- Production v2 export integration.
- Validated atomic v2 import.
- Scoped Factory Reset.
- Manual smoke / rollback / release procedure.
- v0.4.4 release publication.

Completed baseline 只描述已完成的 v0.4.4 範圍，不授權新的 migration、schema switch、service extraction 或 release metadata 修改。

## Approved Next Order

目前 approved sequence：

1. Tests-first special-material pure contract — active.
2. Bounded pure helper implementation — blocked until tests contract review.
3. Production integration — not approved.

只有第一項是 active。第二項仍需 tests contract review；第三項未核准。此清單不代表 production schema/storage、writer/backup/UI、Crafting integration、0.4.5 implementation 或 release work 已開始。

## Phase-1 Refactor Boundary

目標是先抽出可測、可回滾的小型 service boundary，不改使用者可見行為、不改 storage schema、不改 backup format、不改 transaction payload。

候選範圍：

- Inventory purchase / WAC service boundary.
- Inventory transfer service boundary.
- Crafting completion service boundary.
- Shared location validation.
- Selectors / query boundary.
- Structured service result.
- Component 保留 DOM / input / presentation responsibility.

不包含：

- Stable Item ID migration.
- Canonical transaction migration.
- `qtyByLocation` writer/storage migration.
- Legacy fallback removal.
- Special Material production inventory.
- Vite / CSP / SQLite.
- 一次性重寫 `state.js`。

## Historical v0.4.4 Plan：Backup/reset contract

目標：

- 定義 new-schema backup lifecycle。
- 定義 scoped Factory Reset 的 owned-key boundary。
- 定義 legacy backup policy、rollback 與 manual smoke expectations。
- Contract reviewed: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md)。

不包含：

- production export/import 接線。
- reset implementation。
- storage key/schema 修改。

### Historical Phase：Tests-first local regression

目標：

- Tests are written first locally.
- Initial red tests may exist only in the local working tree.
- Red tests must not be committed or pushed independently.
- Immediate scope is limited to envelope, classification, parsing, and repository-based export source.

不包含：

- production service。
- pure module-only merge。
- UI。
- writer/storage switch。
- import storage mutation。
- rollback implementation。
- scoped Factory Reset。

### Historical Phase：Minimum pure backup envelope / classification / export service

目標：

- Minimum pure codec/export service is implemented in the same working checkpoint as Phase 3 tests.
- Phase 3 and Phase 4 together form the first mergeable checkpoint.
- Targeted and full discovered test suites must all pass.
- Do not use `test.todo`, skip, or placeholder behavior to keep the suite green.
- Scope remains limited to envelope, classification, parsing, and repository-based export source.

不包含：

- production UI integration。
- automatic legacy migration。
- transaction payload migration。
- `app.js` / `state.js` / production integration。
- import storage mutation。
- rollback implementation。
- scoped Factory Reset。

### Historical Phase：Export integration

目標：

- 將 validated v2 export path 接入 production。
- 保留 legacy backup policy。
- 建立 manual smoke / rollback procedure。

### Historical Phase：Validated atomic import

目標：

- 將 validated v2 import path 接入 production。
- invalid input 必須 zero mutation。
- write failure 必須 rollback。

### Historical Phase：Scoped Factory Reset

目標：

- Reset only owned Albion Logistics storage keys。
- Preserve unrelated `localStorage` keys。
- 明確區分 active v2 與 explicit legacy mode。

### Historical Phase：Manual smoke / rollback / release procedure

目標：

- 完成 backup/reset manual smoke。
- 完成 rollback procedure。
- 確認 release checklist。

### Historical Phase：Selected bounded service implementation

目標：

- 只在 docs、tests、pure service 與 smoke gates 完成後，才選擇下一個 bounded service implementation。
- 不得一次接入 export/import/reset 全 production path。

## Later / Paused

以下項目目前不是 active workstream：

- Special-material implementation。
- Custom-location crafting profile。
- Stable Item ID migration。
- Canonical transaction migration。
- Account-total product inventory。
- Location service extraction。
- Vite。
- Progressive type checking。
- CSP。
- SQLite。

Later backlog 不等於 active。任何 backlog 項目都需要獨立 approval、tests 與 implementation boundary。
