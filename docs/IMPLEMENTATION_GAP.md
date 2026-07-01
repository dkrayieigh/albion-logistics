# Albion Logistics ERP 實作落差追蹤

## 文件定位與閱讀原則

本文件是目前專案的**現況盤點與差異追蹤**，用來記錄 `src` 實際行為、現有 `docs` 規格，以及未來目標規格之間的落差，作為後續補文件、補測試與重構時的依據。

請依下列原則閱讀：

- 本文件不代表 `src` 必須立即符合目前 `docs`。
- `docs` 中部分內容屬於未來目標規格，尚未在 `src` 完成。
- 「已實作但未完整描述」代表功能已存在，主要缺口在文件或測試。
- 「規格與實作衝突」代表兩者對資料格式或行為有不同定義，不應直接修改其中一方來消除差異。
- 涉及既有使用者資料、成本計算或交易格式的項目，必須先建立相容與驗證方案。

## Regression Test 覆蓋狀態
目前 `package.json` 已建立 Node.js regression tests:
```bash
npm test
```
---

## 1. 已在 src 實作，但 docs 未完整描述的功能

### 1.1 成品出售

- **目前行為：** 從指定倉庫扣除成品庫存、增加現金，並新增一筆 `賣成品` legacy transaction。
- **目前狀態：** 已補 regression test。成品出售成功、庫存不足阻擋、零數量阻擋、cash 增加、`globalAvgCost` 不變已受測試保護。
- **主要實作位置：** `src/components/inventory.js`。
- **測試來源：** `tests/core-cost-regression.test.js`。
- **文件狀態：** `BUSINESS_RULES.md` 已補 current implementation 出售規則；`SELL_ITEM` 仍是 future event model，不代表 current transaction 已完成遷移。
- **風險：** Medium → Low / Docs debt。
- **封版狀態：** 非阻斷。

### 1.2 工人島物資出售

- **目前行為：** 可出售工人島暫存物資，成功時扣除 `laborerInventory`、增加 cash，並新增 `工人島出售` transaction。
- **目前狀態：** 已修復並補 regression test。暫存不足、零數量、無效總額會阻擋並顯示 error toast。
- **主要實作位置：** `src/components/laborer.js`。
- **測試來源：** `tests/core-cost-regression.test.js`。
- **文件狀態：** `BUSINESS_RULES.md` 已補工人島暫存物資出售與 Yield Inventory 零成本原則的 current implementation 說明。
- **風險：** Medium → Low / Docs debt。
- **封版狀態：** 非阻斷。

## Location clean-cutover gaps

- **Current implementation:** production startup/read-write cutover exists for the new-schema runtime path. The app can start from `albion-logistics-v2-state`, project canonical data to runtime `qtyByCity`, hydrate runtime defaults, and route `saveState()` through the new-schema save path when the runtime controller is active.
- **Target behavior:** single-user clean cutover with new Location schema, `albion-logistics-v2-state`, manually initialized inventory/cash/cost basis, empty initial transactions, and external legacy backup archive.
- **Schema contract status:** Location Registry shape, new root state, `qtyByLocation` inventory shape, clean initialization input/output, storage codec validation/serialization, injected repository load/save semantics, explicit browser Storage backend binding semantics, browser new-schema repository composition semantics, startup loader/decision semantics, runtime bridge semantics, runtime controller semantics, state API integration, first-launch confirmation, error codes, and backup boundary are defined. Production startup/read-write cutover is implemented and covered by regression tests.
- **Remaining gaps:** legacy backup is not auto-migrated into v2, legacy-backup user-facing feedback may be unclear, custom location crafting profile is not defined, future schema / backup compatibility upgrades remain design work, and MSI installation smoke is not documented.
Completed clean-cutover safety layers:

- **Current implemented:** schema contract exists, pure `createCleanInitialState()` exists, pure `encodeNewSchemaState()` / `decodeNewSchemaState()` exists, pure `createNewSchemaStorageRepository(backend)` exists, pure `createBrowserStorageBackend(storage)` exists, pure `createBrowserNewSchemaRepository(storage)` exists, pure `loadBrowserNewSchemaState(storage)` exists, pure `resolveBrowserNewSchemaStartup(storage)` exists, pure `projectNewSchemaToRuntime(newSchemaState)` exists, pure `projectRuntimeToNewSchema(runtimeState)` exists, `createBrowserNewSchemaRuntimeController(storage)` exists, `enableNewSchemaRuntime(storage)` exists, `initializeNewSchemaRuntime(storage, input, options)` exists, and these groups have regression coverage.
- **Browser Storage backend covered behavior:** accepts only an explicit Storage-like object, preserves storage method `this`, forwards key/value unchanged, returns `INVALID_BROWSER_STORAGE` for factory validation failure, leaves operation throws to repository classification, and does not scan/delete/inspect unrelated keys.
- **Browser new-schema repository composition covered behavior:** composes explicit Storage-like input through `createBrowserStorageBackend(storage)` and `createNewSchemaStorageRepository(binding.backend)`. Success returns `{ ok: true, repository, errors: [] }`; failure returns `{ ok: false, repository: null, errors: ['INVALID_BROWSER_STORAGE'] }`. Composition itself performs zero storage operations: it does not call load/save, mutate storage, inspect keys, or acquire global `localStorage`.
- **Startup loader/decision covered behavior:** `loadBrowserNewSchemaState(storage)` reads only fixed key `albion-logistics-v2-state` through explicit storage and returns `loaded` / `missing` / `invalid` / `error`. `resolveBrowserNewSchemaStartup(storage)` maps `loaded` to `ready`, `missing` to `initialize`, and `invalid` / `error` to `blocked`; invalid/error paths never create empty data.
- **Runtime bridge covered behavior:** `projectNewSchemaToRuntime(newSchemaState)` converts canonical `qtyByLocation` to runtime `qtyByCity`; `projectRuntimeToNewSchema(runtimeState)` converts runtime `qtyByCity` back to canonical `qtyByLocation`. The bridge maps `laborer_island` ↔ `LaborerIsland` and `滿日誌` ↔ `滿日記本`, preserves `locationRegistry` and custom location IDs, fails the whole projection on unknown or ambiguous mapping, remains pure, does not mutate input, and does not access storage.
- **Runtime controller / production startup covered behavior:** ready reads the new key, projects through the runtime bridge, hydrates runtime defaults, and routes `saveState()` to the new key. Confirmed initialize creates clean canonical state, saves the new key, and activates runtime. Cancelled initialize explicitly uses legacy mode. Blocked invalid/error startup does not silently fall back and does not overwrite with empty data.
- **Custom location current status:** add / rename / remove now uses stable custom location IDs with active/inactive registry behavior. Runtime display includes active custom entries, inactive entries retain their displayName as evidence, re-adding an inactive name creates a new ID, and save failure rollback is covered.
- **Covered behavior:** initializer output uses the new root shape, fixed registry, `qtyByLocation`, future canonical `滿日誌` laborer defaults, ordered/unique errors, atomic failure, and input/localStorage immutability. The codec validates schemaVersion 1, assets, fixed/custom Location Registry, `qtyByLocation`, JSON-safe transactions/logs, canonical laborer inventory, legacy-field rejection, malformed JSON, and purity/atomicity. The repository uses injected synchronous backend access with fixed key `albion-logistics-v2-state`, load statuses `loaded` / `missing` / `invalid` / `error`, save statuses `saved` / `invalid` / `error`, codec error passthrough, invalid-state no-write, backend getter/method/thenable safety, and legacy key isolation.
- **Production boundary:** production startup/read-write integration, canonical v2 backup export, validated atomic v2 import, and scoped Factory Reset exist, but they are not migration. They do not convert legacy backups, do not migrate historical transactions, do not define custom location crafting profiles, and do not remove legacy fallback behavior.
- **Remaining gaps:** legacy backup auto-migration is not implemented, legacy-backup user-facing feedback may be unclear, custom location crafting profile is not defined, future schema / backup compatibility upgrade design remains open, and MSI installation smoke is not documented.

- **Risk：** High。涉及 storage schema、inventory、cash、backup 與 rollback 行為。
- **Completed prerequisites：** new schema definition, clean initializer, writer / codec / repository regression tests, backup export / validated import tests, manual initialization / first-launch confirmation behavior, v0.4.4 release checklist, and build / installed-app smoke.
- **Remaining dependencies：** full component `locationId` adoption tests, resolver / UI coverage, future schema upgrade compatibility design, historical transaction strategy, fallback removal gates, old backup archive policy, and explicit confirmation before deleting or ignoring legacy local data in any future migration step.

### 1.3 銷售估價工具

- **目前行為：** 支援遊戲估價單價 / 總價同步、90% / 85% P2P 參考價、實售單價 / 總價同步，並顯示 Total Cost、Est. GP、Unit GP 與 GP %；若 `globalAvgCost` unknown，顯示成本未知，不顯示假毛利。Legacy sale writer payload 維持不變。
- **主要實作位置：** `src/components/inventory.js` 的 `onSellEstimateChange()`、`runEstimator()`、`onSellPriceChange()`。
- **穩定版分類：** Known limitation。比例只作為 P2P sale decision reference，不自動寫入正式交易金額；固定 market tax estimate 不再作為 P2P sale popup 的主要資訊。
- **文件狀態：** 已在 `BUSINESS_RULES.md` 與 `TEST_CASES.md` 標註 current implementation 限制。
- **風險：** Low。
- **封版狀態：** 非阻斷。

### 1.4 自訂倉庫更名、刪除與庫存轉移

- **目前行為：** 可新增、更名與刪除自訂倉庫。封版前已加入資料安全限制：非空自訂倉庫不得刪除，使用者必須先轉移或清空庫存；空自訂倉庫仍可刪除。
- **目前狀態：** 資料遺失風險已修復並補 regression test。不進行 Location ID migration。Inventory transfer 行為已完成 bounded pure service extraction，component direct mutation coupling 已在 transfer path 降低。
- **主要實作位置：** `src/services/inventoryTransferService.js`、`src/components/inventory.js`。
- **測試來源：** `tests/inventory-transfer-service.test.js`、`tests/core-cost-regression.test.js`。
- **文件狀態：** `LOCATION_MODEL.md` 與 `TEST_CASES.md` 已同步 current implementation 限制。
- **已完成邊界：** `applyInventoryTransfer()` 已覆蓋 quantity validation、same-location validation、item existence、selected-source sufficiency、`qtyByCity` physical move、immutability 與 total quantity preservation。Transfer service 不再列為 implementation gap。
- **仍保留 gap：** full component stable `locationId` adoption、`qtyByLocation` component writer、shared resolver completion、historical transaction migration、fallback removal gates、transfer transaction / canonical `TRANSFER_ITEM`、save failure rollback 的更完整 service-level boundary。
- **風險：** Medium → Low / Known limitation。
- **封版狀態：** 非阻斷。

### Custom warehouse boundary inventory checkpoint

Current implemented:

- Persisted v2 has `locationRegistry` and canonical `qtyByLocation`.
- Runtime exposes active custom warehouses through `state.customLocations`.
- Runtime inventory still uses display-name `qtyByCity` compatibility.
- Stable custom location add / rename / remove lifecycle is implemented where `locationRegistry` is present.
- Non-empty custom warehouse deletion is blocked with `CUSTOM_LOCATION_HAS_INVENTORY`.
- Empty custom warehouse deletion deactivates the registry entry and preserves inactive registry evidence.
- Save failure rollback is covered.

Completed bounded fix:

- Delete confirmation wording now matches the current safety rule and tells users to transfer or clear inventory before deletion.
- Cancellation leaves custom locations, registry, inventory, transactions, and toast state unchanged.
- Confirmed non-empty deletion remains blocked, preserves registry/runtime/inventory state, and shows an error toast.
- Confirmed empty deletion preserves the successful behavior: inactive registry evidence is kept, runtime custom location / `qtyByCity` bucket are removed, unrelated inventory is preserved, and a success toast is shown.
- Regression coverage exists for confirmation wording, cancellation no-mutation, confirmed non-empty blocked, and confirmed empty success.
- Production source scope changed only `src/components/inventory.js` confirmation copy.
- `src/core/state.js`, registry lifecycle, save/rollback behavior, storage schema, runtime bridge, backup, transaction payload, and legacy fallback remain unchanged.

Deferred gaps:

- Inactive-location management UI.
- Full component stable `locationId` adoption.
- `qtyByLocation` component writer.
- Shared resolver completion.
- Custom crafting profile.
- Historical transaction migration.
- Automatic legacy backup migration.
- Legacy fallback removal.

### 1.5 現金餘額校正、注資與提領函式

- **目前行為：**
  - `adjustCashBalance()` 可將 cash 調整到目標值，並記錄差額。
  - `adjustWallet()` 支援注資與提領，會同步修改 cash / debt。
- **目前狀態：** 已修復並補 regression test。零金額或無效金額會阻擋並顯示 error toast；成功操作不影響 inventory。
- **主要實作位置：** `src/components/ledger.js`。
- **測試來源：** `tests/ledger-data-safety.test.js`。
- **文件狀態：** `BUSINESS_RULES.md` 已補 current semantics。
- **Known limitation：** `adjustWallet()` 目前在 `src/index.html` 找不到明確 UI 綁定，函式雖受測但 UI availability unknown。
- **風險：** Medium → Low / UI availability unknown。
- **封版狀態：** 非阻斷，需 release note 標註。

### 1.6 工人島手動管理與紀錄分頁

- **目前行為：**
  - 可手動新增滿日誌。
  - 可直接覆寫工人島庫存數量，UI 稱為「無痕校正」。
  - 工人收成紀錄以每頁 10 筆顯示。
- **主要實作位置：** `src/components/laborer.js` 的 `submitAddFilledJournals()`、`submitEditLabor()`、`renderLaborerLogsTable()`。
- **穩定版分類：** Known limitation。手動新增與「無痕校正」尚無正式稽核事件規格；分頁只影響顯示。
- **測試狀態：** UI / manual only。
- **風險：** 手動新增與無痕校正為 Medium；分頁為 Low。
- **封版狀態：** 非阻斷，日常使用前需了解無痕校正限制。

### 1.7 製作搜尋、分類、購物清單、佇列編輯與部分製作

- **目前行為：**
  - 提供配方分類分頁與名稱搜尋。
  - 製作佇列可編輯數量、刪除項目、全選或個別勾選。
  - 購物清單會彙總勾選項目的材料、神器、鍊金材料與預估現金支出。
  - 材料 planning display 會依 material key + city 彙總 expected consumption 與 safe-start stock；相同 material/city 合併，不同 material/city 分開。
  - 正式 accounting 使用使用者填入的 actual material consumption；planning expected / safe-start 不是扣帳數量。
  - 執行製作時只處理已勾選項目。
- **目前狀態：** `TEST-A07` 已轉為正式 regression test；材料數量充足但缺成本基準時，製作不得消耗材料、不得新增成品、不得扣 cash、不得新增 transaction，且 craftingQueue 必須保留。材料 planning aggregation、safe-start formula、actual consumption accounting、blank/invalid actual consumption no-mutation 與 quality guard 已有 regression coverage。
- **主要實作位置：** `src/components/crafting.js` 的 `openItemSelector()`、`searchItems()`、`updateShoppingListTotal()`、佇列編輯函式與 `submitCraftAll()`。
- **文件狀態：** 搜尋與分類已補 current implementation docs；購物清單 planning/accounting boundary 已文件化。佇列 UI 編輯、部分製作與手動互動流程仍屬 known limitation。
- **風險：** Low；UI layout/manual interaction 仍需手測。購物清單 aggregation 不再列為 high-risk gap。
- **測試狀態：** Partially tested。製作結算的核心成本、材料消耗、成品 WAC、材料不足阻擋、材料缺成本基準阻擋、材料 planning aggregation、safe-start formula、actual consumption accounting、blank/invalid actual consumption no-mutation 與 quality guard 已由 `tests/core-cost-regression.test.js` 保護；搜尋、分類、佇列 UI 編輯與部分製作仍主要依賴手測。
- **封版狀態：** 非阻斷。

### 1.8 搜尋、分頁、Factory Reset 與 Tauri 視窗控制

- **目前行為：**
  - 庫存與帳本搜尋、分頁、Factory Reset、Tauri 視窗控制仍屬 current implementation。
  - Tauri desktop blocking error 已確認由 `src-tauri/target` 舊 build artifact 中殘留絕對路徑造成。
- **目前狀態：** 清除 `src-tauri/target` 後 Tauri dev 可成功啟動，未修改 source code。
- **文件狀態：** `ARCHITECTURE.md` 已標註此為 build artifact cleanup，不是 source patch。
- **風險：** Medium → Low。
- **封版狀態：** 非阻斷。

### 1.9 JSON 備份匯出、匯入驗證與舊備份相容

- **目前行為：** 支援 readable JSON 匯出、新格式 object / array backup 匯入、舊格式 JSON-string backup 匯入。
- **目前狀態：** 已補 `backup-regression.test.js`。壞資料不得覆寫 localStorage；transactions 150 筆完整保留；`assets.debt` fallback 正常。
- **主要實作位置：** `src/app.js`。
- **測試來源：** `tests/backup-regression.test.js`。
- **文件狀態：** `BUSINESS_RULES.md` 已補 current implementation 資料安全規則；正式版本化 backup schema 仍為 docs debt。
- **風險：** Medium → Low / Schema docs debt。
- **封版狀態：** 非阻斷。

### 1.10 工人收成紀錄最多保留 100 筆

- **目前行為：** 每次儲存狀態時，超過 100 筆的 `laborerLogs` 會被截斷。
- **主要實作位置：** `src/core/state.js` 的 `saveState()`。
- **穩定版分類：** Known limitation。只保留最新 100 筆工人收成紀錄。
- **風險：** Medium，因會自動刪除歷史資料。
- **封版狀態：** 非阻斷，需在 release note 明確標註。

### 1.11 全域千分位輸入格式化與游標位置維持

- **目前行為：** 對 `.format-num` 欄位即時加入千分位格式，並計算格式化後的游標位置，避免輸入時游標跳動。
- **主要實作位置：** `src/app.js` 的全域 `input` 事件監聽。
- **文件狀態：** 已補 `ARCHITECTURE.md` 與 `TEST_CASES.md`，現為 docs debt closed。
- **風險：** Low。
- **封版狀態：** 非阻斷。

### 1.12 stateUpdated 事件驅動 UI 更新

- **目前行為：** `saveState()` 與 `loadState()` 觸發 `stateUpdated`，由 `app.js` 統一更新城市下拉選單、儀表板、庫存、工人島資料與紀錄。
- **主要實作位置：** `src/core/state.js` 的 `callUIUpdate()`；`src/app.js` 的 `stateUpdated` 監聽。
- **文件狀態：** 已補 `ARCHITECTURE.md` 與 `TEST_CASES.md`，現為 docs debt closed。
- **風險：** Low。
- **封版狀態：** 非阻斷。

### 1.13 採購物品自動建議城市

- **目前行為：** 選擇鋼條、布料、板材或皮革時，自動將採購城市切換到對應精煉加成城市。
- **主要實作位置：** `src/components/inventory.js` 的 `onBuyItemChange()`。
- **文件狀態：** 已補 `ARCHITECTURE.md` 與 `TEST_CASES.md`；明確標註為可覆寫的 UI 建議值，現為 docs debt closed。
- **風險：** Low。
- **封版狀態：** 非阻斷。

---

## 2. docs 規格與 src 實作衝突

以下項目不是單純缺少文件，而是目前規格與實作對相同資料或行為有不同定義。直接修改可能破壞既有存檔、交易紀錄或成本結果。

Migration boundary 參考文件：`ITEM_ID_MODEL.md`、`TRANSACTION_EVENT_MODEL.md`、`MIGRATION_PLAN.md`、`ADAPTER_API.md`。

### 2.1 `qtyByLocation` 與 `qtyByCity`

- **docs 規格：** `docs/DATA_MODEL.md` 與事件文件統一使用 `qtyByLocation`，Key 必須為 Location ID。
- **src 現況：** `src/core/state.js` 與各業務模組使用 `qtyByCity`，Key 為 `Thetford`、`LaborerIsland` 或自訂倉庫顯示名稱。
- **相容性影響：** 現有 `localStorage`、備份 JSON 與全部庫存讀寫均依賴 `qtyByCity`。
- **直接修改風險：** High。若沒有 adapter 與 migration，舊資料會無法讀取或看似庫存歸零。
- **測試狀態：** Partially tested。`tests/core-cost-regression.test.js` 已保護 legacy `qtyByCity` 在核心庫存、物流與成本流程中仍可用；這是相容性保護，不代表 `qtyByLocation` 遷移已完成。
- **Adapter 狀態：** minimal read-only location adapter exists in `src/adapters/locationAdapter.js`。Legacy `qtyByCity` multi-location normalization tolerance 已有 coverage；不代表 `qtyByLocation` migration、Location Registry migration 或 backup import/export migration 已完成。

### 2.2 Stable ID 與中文品名 key

- **docs 規格：** Inventory Key 與 `laborerInventory` 第一層 Key 必須使用 Stable ID，例如 `METALBAR_6.2`。
- **src 現況：** 多數庫存 Key 使用中文顯示名稱，例如 `鋼條_6.2`；製造成品也使用配方顯示名稱。
- **相容性影響：** 現有存檔、製作材料查詢、工人島匯入、UI 顯示與交易紀錄都依賴中文品名。
- **直接修改風險：** High。需先建立 Stable ID 與舊中文 Key 的雙向映射及衝突處理。
- **測試狀態：** Partially tested。`tests/core-cost-regression.test.js` 已保護 legacy 中文 item key 可用；這是舊資料相容性保護，不代表 Stable ID 遷移已完成。

### 2.3 新版 event payload 與舊版 transaction 格式

- **docs 規格：** 交易紀錄 target model 使用 `action`、`target`、`cashChange`、`assetValue`、`locationId`、`details` 等欄位；舊格式已改列為 current legacy transaction compatibility。
- **src 現況：** 大部分新交易仍寫入 `type`、`item`、`quality`、`qty`、`total`、`unitPrice`、`location`。
- **相容性影響：** Ledger 顯示、搜尋、採購撤銷、備份及測試依賴舊欄位。
- **直接修改風險：** High。需要統一事件寫入點、讀取 adapter 與雙格式測試。
- **測試狀態：** Partially tested。`tests/ledger-data-safety.test.js` 已保護目前 legacy transaction 的採購 reversal 行為；這不代表新版 event payload 已完成。

### 2.4 禁止拆解 itemKey 與 src 仍拆解 itemKey

- **docs 規格：** 禁止以拆解 `itemKey` 的方式反推出 `stableId` 或 `itemLevel`，事件 payload 必須明確提供兩者。
- **src 現況：** 庫存渲染與校正等流程使用 `key.split('_')` 或類似方式取得物品名稱與階級。
- **相容性影響：** 含底線的 Stable ID 或物品名稱可能被錯誤拆解；現有中文 Key 則暫時依賴此行為。
- **直接修改風險：** High。必須先讓資料模型與呼叫介面能明確提供物品識別資料。
- **測試狀態：** Untested / future boundary。未來禁止拆解 `itemKey` 的規格尚未有可執行 regression test；目前不得將此項寫成 current implementation。

### 2.5 一般庫存調整不得修改 globalAvgCost 與 UI 允許直接修改成本

- **docs 規格：** 一般 `INVENTORY_ADJUSTMENT` 預設不得修改 `globalAvgCost`；成本基準變更需要另行定義事件。
- **src 現況：** 庫存校正 UI 可直接輸入新成本，建立 `成本校正` 舊格式交易後覆寫 `globalAvgCost`。
- **相容性影響：** 既有使用者可能已依賴此方式修正成本；移除功能會改變操作流程，保留功能則需正式定義成本校正規則。
- **直接修改風險：** High，涉及成本基準與歷史帳務。

### 2.6 `customLocations` 物件格式與字串陣列

- **docs 規格：** `customLocations` 每筆應包含穩定 `id`、顯示 `name`、`type`、`region` 與 `regionQuality`。
- **src 現況：** `customLocations` 是倉庫名稱字串陣列，顯示名稱同時作為 `qtyByCity` Key。
- **相容性影響：** 更名會改變庫存 Key；舊備份、城市下拉選單與製作地堡判定都依賴字串格式。
- **直接修改風險：** High。需先建立 Location Registry adapter 與 ID 產生、對應及遷移規則。

### 2.7 交易事件名稱混用

- **docs 規格：** 事件名稱應為 `PURCHASE_ITEM`、`CRAFT_COMPLETE`、`LABORER_IMPORT`、`INVENTORY_ADJUSTMENT` 等穩定識別碼。
- **src 現況：** 多數交易使用中文名稱，例如 `買材料`、`製作入庫`、`工人島匯入`、`賣成品`；只有部分調整使用 `INVENTORY_ADJUSTMENT`。
- **相容性影響：** Ledger 顯示、現金方向判定與採購撤銷邏輯會比較中文 `type`。
- **直接修改風險：** High。需要事件名稱正規化與舊資料讀取相容。

## 2.8 Regression Test 保護矩陣

| 項目 | 目前狀態 | 測試保護狀態 | 測試來源 | 備註 |
|---|---|---|---|---|
| 首次採購建立 `globalAvgCost` | current implementation | Tested | `tests/core-cost-regression.test.js` | 驗證首次採購以 total / qty 建立成本基準。 |
| 跨地點全域庫存 WAC | current implementation | Tested | `tests/core-cost-regression.test.js` | 驗證採購均價以全域總庫存計算，不限單一地點。 |
| 零庫存不沿用 dormant cost anchor | current implementation | Tested | `tests/core-cost-regression.test.js` | 新採購在全域庫存為 0 時直接重建成本基準。 |
| 工人匯入 `globalAvgCost === null` 時阻擋 | current implementation | Tested | `tests/core-cost-regression.test.js` | 防止無成本基準物資進入總庫存。 |
| 工人匯入不改 cash / 不重算 `globalAvgCost` | current implementation | Tested | `tests/core-cost-regression.test.js` | 保護 Yield Inventory 匯入不稀釋成本。 |
| 工人匯入喚醒 dormant cost anchor | current implementation | Tested | `tests/core-cost-regression.test.js` | 庫存從 0 增加時仍沿用既有 dormant 成本基準。 |
| 製作消耗引用材料 `globalAvgCost` | current implementation | Tested | `tests/core-cost-regression.test.js` | 製作成本引用材料目前成本基準。 |
| 製作後材料 `globalAvgCost` 不變 | current implementation | Tested | `tests/core-cost-regression.test.js` | 製作消耗只扣數量，不重算材料成本。 |
| 成品已有庫存時套用 WAC | current implementation | Tested | `tests/core-cost-regression.test.js` | 新製成品與既有成品庫存合併計算 WAC。 |
| 材料不足時阻擋製作 | current implementation | Tested | `tests/core-cost-regression.test.js` | 驗證製作前預檢不可造成部分狀態變更。 |
| 材料 `globalAvgCost === null` 時阻擋製作 | current implementation | Tested | `tests/core-cost-regression.test.js` | `TEST-A07` 已落地，驗證阻擋後不修改材料、成品、cash、transactions 或 craftingQueue。 |
| crafting material planning safe-start aggregation | current implementation / planning display | Tested | `tests/core-cost-regression.test.js` | Same material key + city aggregates expected/conservative/safe-start values; different material/city stays separate; unchecked or invalid qty rows are ignored. Planning values are not accounting quantities. |
| crafting actual material consumption accounting | current implementation / accounting boundary | Tested | `tests/core-cost-regression.test.js` | `submitCraftAll()` deducts user-entered actual material consumption, not planning expected/safe-start values. |
| blank or invalid actual consumption no-mutation | current implementation / failure path | Tested | `tests/core-cost-regression.test.js` | Blank/invalid actual material consumption blocks before mutating materials, crafted output, cash, transactions, or queue state. |
| purchase and crafting explicit quality guard | current implementation / no implicit default | Tested | `tests/core-cost-regression.test.js` | Purchase and crafting block when quality is not explicitly selected; no implicit/default `4.0` is used on blocked paths. |
| 物流轉移不改成本、不改 cash、不新增 ledger | current implementation | Tested | `tests/core-cost-regression.test.js` | 驗證物流只做物理庫存平移。 |
| 來源庫存不足時阻擋物流轉移 | current implementation | Tested | `tests/core-cost-regression.test.js` | 驗證物流轉移預檢不造成狀態變更。 |
| inventory transfer pure service extraction | current master / bounded service extraction | Tested | `tests/inventory-transfer-service.test.js` | `src/services/inventoryTransferService.js` covers success, input immutability, total quantity preservation, custom display-name locations, zero/negative quantity rejection, same-location rejection, missing item rejection, selected-source insufficiency, and validation priority. This is not Location migration, `qtyByLocation` writer migration, canonical `TRANSFER_ITEM`, transaction writer, storage change, backup change, cash/debt change, or `globalAvgCost` change. |
| legacy 中文 item key + `qtyByCity` 仍可用 | current compatibility behavior | Tested | `tests/core-cost-regression.test.js` | 保護目前舊資料相容，不代表 Stable ID 遷移完成。 |
| missing legacy item mapping explicit failure | minimal read-only item identity adapter exists | Tested | `tests/core-cost-regression.test.js` | `src/adapters/itemIdentity.js` 可在缺少 mapping 時明確失敗且不 mutate input；不代表 Stable ID migration、Stable ID catalog、storage key migration 或 legacy item key replacement 已完成。 |
| legacy `qtyByCity` multi-location normalization tolerance | minimal read-only location adapter exists | Tested | `tests/backup-regression.test.js` | `src/adapters/locationAdapter.js` 可保留 legacy 多地點數量且不 mutate input；不代表 `qtyByLocation` migration、Location Registry migration 或 backup import/export migration 已完成。 |
| clean initialization pure helper contract | isolated pure initializer implementation | Tested | `tests/backup-regression.test.js` | `src/adapters/cleanInitialState.js` implements `createCleanInitialState()` for new root shape, fixed registry, `qtyByLocation`, future canonical `滿日誌` laborer defaults, ordered/unique errors, atomic failure, and input/localStorage immutability. This does not connect storage, writer, backup, UI, first-launch flow, or migration. |
| new-schema storage codec contract | isolated pure codec implementation | Tested | `tests/backup-regression.test.js` | `src/adapters/newSchemaStorageCodec.js` implements `encodeNewSchemaState()` / `decodeNewSchemaState()` for strict schemaVersion 1 validation, serialization, independent decode, legacy-field rejection, JSON-safe transaction/log containers, canonical `滿日誌`, and atomic failure. This is not a `localStorage` adapter, storage repository, startup loader, backup serializer, writer integration, or migration runner. |
| injected new-schema storage repository contract | isolated injected repository implementation | Tested | `tests/backup-regression.test.js` | `src/adapters/newSchemaStorageRepository.js` implements `createNewSchemaStorageRepository(backend)` over the fixed `albion-logistics-v2-state` key with injected synchronous backend `getItem` / `setItem`, load/save statuses, codec error passthrough, invalid-state no-write, backend failure safety, this-bound method calls, thenable rejection, source isolation, and legacy key isolation. This is not a global `localStorage` adapter, startup loader, autosave, production state writer, backup repository, or migration runner. |
| browser new-schema repository composition contract | isolated injected composition helper | Tested | `tests/backup-regression.test.js` | `src/adapters/browserNewSchemaRepository.js` implements `createBrowserNewSchemaRepository(storage)` as explicit Storage-like input -> `createBrowserStorageBackend(storage)` -> `createNewSchemaStorageRepository(binding.backend)`. It returns `{ ok: true, repository, errors: [] }` or `{ ok: false, repository: null, errors: ['INVALID_BROWSER_STORAGE'] }`; composition itself performs zero storage operations and does not call load/save, acquire global `localStorage`, inspect keys, mutate storage, start up state, connect writers, backup, UI, migration, or legacy fallback. |
| browser new-schema startup loader and decision boundary | production startup helper implementation | Tested | `tests/backup-regression.test.js` | `src/adapters/browserNewSchemaStartup.js` implements `loadBrowserNewSchemaState(storage)` and `resolveBrowserNewSchemaStartup(storage)`. Loader reads only fixed key `albion-logistics-v2-state` from explicit storage and returns `loaded` / `missing` / `invalid` / `error`; decision maps `loaded` -> `ready`, `missing` -> `initialize`, and `invalid` / `error` -> `blocked` without creating empty data. Production app startup now calls the new-schema runtime path. |
| new-schema runtime bridge contract | isolated bidirectional bridge implementation | Tested | `tests/backup-regression.test.js` | `src/adapters/newSchemaRuntimeBridge.js` implements `projectNewSchemaToRuntime(newSchemaState)` and `projectRuntimeToNewSchema(runtimeState)` for `qtyByLocation` <-> `qtyByCity`, `laborer_island` <-> `LaborerIsland`, and `滿日誌` <-> `滿日記本`. It preserves `locationRegistry` and custom location IDs, fails atomically on unknown/ambiguous mapping, does not mutate input, and does not access storage. Pure bridge projection still requires runtime custom location changes to match the retained registry; production custom location state APIs are covered separately in the v0.4.4 checkpoint. |
| browser new-schema runtime controller | production state persistence boundary | Tested | `tests/backup-regression.test.js` | `src/adapters/browserNewSchemaRuntimeController.js` implements `createBrowserNewSchemaRuntimeController(storage)` with `controller.start()` and `controller.save(runtimeState)`. Ready startup projects canonical state to runtime; save projects runtime state back to canonical and writes the new key. Projection failure blocks rather than falling back. |
| production app startup cutover | production startup integration | Tested | `tests/backup-regression.test.js` | `src/app.js` uses `startApplicationState(localStorage)` and `src/core/state.js` exposes `enableNewSchemaRuntime(storage)` / `initializeNewSchemaRuntime(storage, input, options)`. Ready, confirmed initialize, cancelled initialize legacy mode, and blocked invalid/error startup are covered. This is not migration and does not update backup import/export. |
| runtime default hydration and laborer leather support | production runtime compatibility | Tested | `tests/backup-regression.test.js` / UI regression coverage | Runtime activation hydrates inventory defaults while preserving new-schema state identity. Canonical/runtime laborer inventory includes leather support and preserves `滿日誌` / `滿日記本` bridge behavior. |
| Inventory render/display normalized Location Adapter entry tolerance | minimal reader/display integration | Tested | `tests/core-cost-regression.test.js` | Inventory render/display path 可顯示 normalized Location Adapter entries；不代表 `qtyByCity` writer、`qtyByLocation` migration、Location Registry、storage shape、backup import/export、purchase/transport writers 或 `globalAvgCost` 已完成遷移。 |
| 採購刪除轉 adjustment | current implementation | Tested | `tests/ledger-data-safety.test.js` | 原始交易保留，新增調整交易。 |
| 庫存不足時阻擋 purchase reversal | current implementation | Tested | `tests/ledger-data-safety.test.js` | 不新增 adjustment，不改狀態。 |
| 同一筆採購不可 reversal 兩次 | current implementation | Tested | `tests/ledger-data-safety.test.js` | 包含 UI 重新渲染後不再顯示刪除入口。 |
| 備份匯出 / 匯入 schema 與原子性 | current implementation / schema docs debt | Tested | `tests/backup-regression.test.js` | 覆蓋新舊備份相容與無效資料不得覆寫；正式版本化 schema 尚未完成。 |
| Factory Reset | current implementation | Manual only | `docs/TEST_CASES.md` / UI | 尚未有 regression test。 |
| 自訂倉庫刪除 | current implementation / legacy location key | Tested | `tests/core-cost-regression.test.js` | 非空倉庫不得刪除；Location ID migration 尚未完成。 |
| 成品出售 | current implementation / legacy transaction | Tested | `tests/core-cost-regression.test.js` | 正式 `SELL_ITEM` event model 尚未完成。 |
| sale valuation P2P references and profit display | current implementation / UI reference | Tested | `tests/core-cost-regression.test.js` | Game valuation unit/total sync, 90%/85% P2P references, actual sale unit/total sync, cost/profit summary, and unknown-cost handling are covered. Legacy sale writer payload is unchanged; canonical `SELL_ITEM` is not implemented. |
| crafted item sale state transition regression | current implementation / legacy crafted sale writer behavior | Tested | `tests/core-cost-regression.test.js` | Current crafted sale writer preserves legacy transaction payload and location-specific inventory behavior. This does not implement canonical SELL_ITEM, transaction payload migration, writer migration, or storage migration. |
| crafted item sale invalid total no-mutation regression | current implementation / legacy crafted sale writer failure path | Tested | `tests/core-cost-regression.test.js` | Current crafted sale writer blocks invalid total without mutating inventory, cash, transactions, or globalAvgCost. This does not implement canonical SELL_ITEM, transaction payload migration, writer migration, or storage migration. |
| crafted item sale insufficient selected-location inventory no-mutation regression | current implementation / legacy crafted sale writer failure path | Tested | `tests/core-cost-regression.test.js` | Current crafted sale writer blocks sale when selected-location inventory is insufficient and does not consume stock from other locations. This does not implement canonical SELL_ITEM, transaction payload migration, writer migration, or storage migration. |
| crafted item sale negative quantity no-mutation regression | current implementation / legacy crafted sale writer failure path | Tested | `tests/core-cost-regression.test.js` | Current crafted sale writer blocks negative quantity without mutating inventory, cash, transactions, or globalAvgCost. This does not implement canonical SELL_ITEM, transaction payload migration, writer migration, or storage migration. |
| legacy crafted sale transaction reader compatibility | current implementation / legacy transaction reader compatibility | Tested | `tests/core-cost-regression.test.js` | Legacy type 賣成品 can be read by transactionReader without mutating payload. This does not implement canonical SELL_ITEM, transaction payload migration, writer changes, or storage migration. |
| legacy crafted sale transaction reader entry ledger display compatibility | current implementation / legacy transaction reader-display compatibility | Tested | `tests/ledger-data-safety.test.js` | Ledger can display normalized reader entries derived from legacy type 賣成品 without mutating payload. This does not implement canonical SELL_ITEM, transaction payload migration, writer changes, or storage migration. |
| 工人島物資出售 | current implementation / legacy transaction | Tested | `tests/core-cost-regression.test.js` | 正式出售事件規格尚未完成。 |
| laborer sale legacy transaction reader compatibility | current implementation / legacy transaction reader compatibility | Tested | `tests/core-cost-regression.test.js` | Legacy type 工人島出售 can be read by transactionReader without mutating payload. This does not implement a canonical event, transaction payload migration, writer migration, storage migration, or rename legacy storage key 滿日記本. |
| laborer sale transaction reader entry ledger display compatibility | current implementation / legacy transaction reader-display compatibility | Tested | `tests/ledger-data-safety.test.js` | Ledger can display normalized reader entries derived from legacy type 工人島出售 without mutating payload. This does not implement a canonical event, transaction payload migration, writer migration, storage migration, or rename legacy storage key 滿日記本. |
| laborer sale success state transition regression | current implementation / legacy laborer sale writer behavior | Tested | `tests/core-cost-regression.test.js` | Current laborer sale writer deducts selected laborerInventory, preserves unrelated inventory and legacy storage key 滿日記本, increases cash, writes legacy type 工人島出售 transaction, and preserves transaction insertion order. This does not implement a canonical event, transaction payload migration, writer migration, storage migration, or rename legacy storage key 滿日記本. |
| Laborer render table journal terminology and legacy action key preservation | current implementation / legacy-compatible display | Tested | `tests/core-cost-regression.test.js` | User-facing display uses 日誌, while legacy key 滿日記本 and data-item="滿日記本" remain for compatibility. This does not migrate state shape, backup/import/export, writer keys, or transaction payload. |
| 現金餘額校正 / 注資 / 提領 | current implementation / partial UI binding unknown | Tested | `tests/ledger-data-safety.test.js` | `adjustWallet()` UI 入口仍需確認。 |
| mixed legacy Chinese type + `INVENTORY_ADJUSTMENT` reader tolerance | minimal read-only adapter | Tested | `tests/ledger-data-safety.test.js` | `src/adapters/transactionReader.js` 可讀取混合 legacy / adjustment transactions 且不 mutate input；不代表 ledger writers 或 canonical event payload 已遷移。 |
| Ledger render/display normalized transaction reader entry tolerance | minimal reader/display integration | Tested | `tests/ledger-data-safety.test.js` | Ledger render/display path 可顯示 normalized transaction reader entries；不代表 ledger writer、reversal/adjustment writer、transaction payload 或 canonical event migration 已完成。 |
| Stable ID / `qtyByLocation` / 新版 event payload 遷移 | future spec | Untested | 無 | 不可寫成 current implementation。 |

Adapter 前置測試缺口詳見 `ADAPTER_TEST_PLAN.md`。Stable ID / `qtyByLocation` / canonical event payload 仍是 future spec，不得寫成 current implementation。

---

## 3. 風險分類

### Low risk：只需補文件，不改程式

這類功能主要是既有 UI 或操作輔助，補充文件通常不會影響資料與帳務：

- 製作配方搜尋與分類。
- 庫存與帳本搜尋。
- 帳本與工人紀錄分頁。
- 銷售估價畫面上的參考值。
- 千分位輸入格式化與游標維持。
- `stateUpdated` UI 更新事件。
- 採購物品自動建議城市。
- Tauri 視窗控制。

### Medium risk：需要補規格與測試後再改

這類功能會寫入狀態、改變現金、刪除資料或影響操作流程，但尚未要求全面更換核心資料模型：

- 成品出售與工人島物資出售。
- 現金餘額校正、注資與提領。
- 工人島手動新增滿日誌與無痕庫存校正。
- 自訂倉庫新增、更名與刪除生命週期。
- Factory Reset。
- JSON 備份匯入、匯出與舊備份相容。
- 舊 `Hideout` 倉庫自動遷移。
- 工人收成紀錄自動截斷為 100 筆。
- 製作購物清單與正式製作結算之間的計算一致性。

### High risk：涉及資料模型、交易格式、成本計算，不可直接修改

以下項目必須先設計相容層、遷移策略與回歸測試，不可直接以全域取代或一次性重寫處理：

- `qtyByCity` 遷移至 `qtyByLocation`。
- 中文品名 Key 遷移至 Stable ID。
- 舊 transaction 格式遷移至新版 event payload。
- 停止拆解 `itemKey` 並改為明確識別欄位。
- 將 `customLocations` 字串陣列遷移為 Location Registry 物件。
- 集中 `globalAvgCost` 建立、更新與成本校正權限。
- 統一中文交易類型與正式事件名稱。
- 任何會改變既有 `localStorage` 或備份 JSON 格式的調整。

---

## 4. 建議遷移順序

### 階段 1：先補現況文件與行為測試

- 把本文件列出的既有功能補成可驗證的現況規格。
- 為出售、現金操作、倉庫管理、備份與 legacy migration 建立行為測試。
- 建立舊資料樣本，記錄目前載入後的預期狀態與成本結果。
- 此階段不改變現有資料格式與業務行為。

### 階段 2：建立 adapter / compatibility layer

- 建立庫存、地點、物品識別與交易紀錄的統一讀取介面。
- adapter 同時支援目前的 `qtyByCity`、中文 Key、字串 `customLocations` 與舊 transaction 格式。
- 新程式碼優先經由 adapter 讀取，不要求立即重寫全部既有資料。
- 匯入與載入流程必須能辨識資料版本並保留舊資料可用性。

### 階段 3：集中成本與交易事件

- 將採購、製作、工人島匯入、出售、庫存調整與現金調整集中到明確事件入口。
- 集中 `globalAvgCost` 的建立、更新與禁止修改規則。
- 讓 UI 模組只提交事件需求，不直接跨模組修改庫存、現金與交易紀錄。
- 在此階段建立新舊事件格式的映射與回歸測試。

### 階段 4：修改資料模型

- 在 adapter 與事件入口穩定後，才遷移至 `qtyByLocation`、Stable ID、Location Registry 物件與新版 event payload。
- migration 必須可重複執行、可驗證、保留未知欄位，並在失敗時避免部分寫入。
- 遷移前後應比較庫存總量、現金、成本基準與交易筆數。

### 階段 5：驗證舊資料後才清除舊格式

- 使用真實或匿名化舊備份驗證遷移與載入。
- 確認所有 UI、事件與測試不再直接依賴舊欄位。
- 經過至少一個相容版本後，才移除舊格式寫入、adapter fallback 與 legacy migration。
- 清除舊格式前必須提供備份與復原方式。

---

## 5. 後續追蹤原則

- 新增未文件化功能時，應先在本文件記錄，再決定是否提升為正式規格。
- 發現新的 docs/src 衝突時，應記錄現況、相容性影響與風險，不直接假設 docs 或 src 任一方必然正確。
- 修正差異前，應先確認該項目屬於現行必要行為、歷史相容需求，或尚未實作的未來目標。
- 完成遷移後，應將已解決項目移入變更紀錄或正式規格，避免本文件成為新的規格來源。

## Account-total Products / Special Materials / Ledger English Gaps

本節記錄新增 business rules 後的 high-risk gap。這些項目目前只是規格差異與後續計畫，不代表 `src`、storage schema、runtime bridge、codec、backup 或 transaction payload 已修改。

### Product Inventory Transition（High risk）

- Current implementation：products still use `qtyByCity`。
- Current implementation：crafted output writes product inventory by city。
- Current implementation：sale consumes product inventory by selected city。
- Current implementation：product transport remains enabled through location-based inventory behavior。
- Current implementation：dashboard valuation assumes `qtyByCity` quantity aggregation。
- Current implementation：runtime bridge / codec do not yet model account-total products。
- Future target：crafted products become account-total inventory with `totalQty` only; crafting city and sale city remain event metadata, not inventory location.

### Special Material Schema（Resolved target / implementation still pending）

- Special material storage is not implemented as separate artifact / alchemy account-total lists.
- Artifact and alchemy material identity is not yet modeled as Tier-only inventory.
- Special material purchase unit-price / total-price entry is not yet a separate schema path.
- Special materials currently remain part of crafting workflow behavior, not a dedicated persisted inventory module.
- Formal special-material production implementation is not complete. Spec Lead selected account-total `totalQty`, account-wide `globalAvgCost`, no location bucket, and no transfer as the target. Current master now includes a pure Special Material purchase / consumption service, but it is not production-integrated.
- Current recipe / Planner / Crafting support is calculation/display-oriented and does not create special-material inventory, WAC storage, intake transactions, or backup/export fields.

Selected target:

- `totalQty`.
- Account-wide `globalAvgCost`.
- No location bucket.
- No transfer.
- Purchase / craft location may be future transaction metadata only.

Remaining gap:

- identity catalog.
- pure catalog / resolver contract.
- storage root.
- writer.
- cash.
- transaction.
- backup.
- UI.
- formal Crafting integration.
- manual/formal compatibility.

### Ledger English Presentation Mapping（Current / Low–Medium implementation risk）

- Ledger English category / item presentation mapping is implemented and test-covered.
- Raw transaction payload remains unchanged; presentation mapping does not rewrite stored `type` or `item`.
- Raw stored Chinese values can map to English display for render/search.
- Multiple stored aliases such as `庫存校正` and `INVENTORY_ADJUSTMENT` can map to one display category without changing stored values.
- This remains presentation only and is not canonical transaction migration.

### Cost Adjustment Canonical Event（High risk）

- Current cost adjustment may display full new valuation as cash out even when cash is not changed.
- Future cost adjustment model must use `cashImpact: 0` and record `valuationImpact`, `oldUnitCost`, `newUnitCost`, and `quantityBasis`.
- This requires event semantics, Ledger display, regression tests, and backup compatibility before any writer change.

### Risk Split

- English display mapping：Low–Medium implementation risk because it is presentation-only and currently test-covered, but it still affects Ledger filtering/grouping and user interpretation.
- Product inventory transition：High risk because it changes inventory shape, crafting output, sale consumption, transport eligibility, dashboard valuation, runtime bridge, codec, and backup expectations.
- Special material pure helper/tests：Completed current-master pure boundary. `src/services/specialMaterialInventoryService.js` and `tests/special-material-inventory-service.test.js` cover purchase, consumption, WAC, dormant anchor, validation, location-shaped input rejection, input immutability, error priority, structured results, and public API isolation.
- Special material catalog docs/tests/pure resolver：Low–Medium implementation risk because it is still non-production catalog/resolver work.
- Special material production schema/writer/backup integration：High risk because it introduces new persisted inventory classes, purchase/costing rules, transactions, backup shape, and Crafting integration.
- Cost adjustment canonical event：High risk because it affects cost basis, valuation, Ledger display, transaction semantics, and historical interpretation.

## v0.4.4 Release Checkpoint Scope

本節是 docs-only release checkpoint，不代表正式 release 已建立，也不代表 version metadata、package、Tauri config、storage schema 或 transaction payload 已修改。

### Current / Test-covered Scope

- Crafting Planner / quotation calculator exists as read-only planning UI.
- Planner supports manual material estimates, shop fee, game estimate unit/batch, 90% / 85% references, custom quote, and 8% / 10% target gross-margin references.
- Planner can hand off explicit user selections into transient `craftingQueue`.
- Planner does not mutate inventory, cash, transactions, or storage unless the user later executes normal crafting flow.
- Crafting and Planner share the Item Picker sourced from `RECIPES`.
- Long numeric input stability, autocomplete policy, and Crafting Location wording are included in this checkpoint.
- Ledger English category / item presentation, raw-value search, alias display deduplication, and raw-payload preservation are covered as presentation behavior.
- Custom location stable ID add / rename / remove, active/inactive registry behavior, restart round-trip, and save failure rollback are covered.

### Completed v0.4.4 Baseline

- Production v2 startup/read-write.
- Canonical v2 backup export.
- Validated atomic v2 import.
- Invalid input zero mutation.
- Write / verification failure rollback.
- Scoped Factory Reset using owned Albion Logistics keys.
- v0.4.4 release publication.

### Remaining Implementation Gaps

- Legacy backup auto-migration.
- Legacy-backup user-facing feedback.
- Future schema / backup compatibility upgrade design.
- MSI installation smoke evidence.
- Account-total product inventory.
- Formal special-material inventory.
- Cost adjustment semantic correction.
- Custom location crafting profile, including per-location hideout map bonus / focus RRR metadata.
- Canonical transaction payload.
- Migration and legacy fallback removal.

### Historical v0.4.4 Planning Checkpoint

This section records historical release-note planning text. It is superseded by `RELEASE_NOTES_0.4.4.md` and must not be read as current release status.

### v0.4.4 Release Notes Draft Scope

Suggested title: `Crafting Planner & Ledger Presentation Update`.

Added:
- Planner.
- Queue handoff.
- Ledger English presentation/search.
- Custom location consistency improvements.

Improved:
- Shared Item Picker.
- Long numeric input stability.
- Autocomplete policy.
- Crafting Location wording.
- Inactive custom location handling.

Known limitations at the time of the historical draft:
- No new-schema backup/reset lifecycle. This is superseded by the completed v0.4.4 baseline above.
- No persisted quotation history.
- No per-location hideout profile.
- No account-total product inventory.
- No formal special-material inventory.
- Cost-adjustment semantics pending.

## Special Material Inventory Gap

主規格狀態：Spec Lead reconciliation complete。Selected target is account-total `totalQty`, account-wide `globalAvgCost`, no location bucket, and no transfer. This is still not current production implementation.

Current behavior:

- Recipes can carry `artifactName`、`artifactQty` and `alchemyName` metadata。
- Alchemy requirement can vary by Tier。
- Planner can estimate Artifact / Alchemy cost manually。
- Crafting queue / shopping list can show Artifact / Alchemy cost components。
- Current crafting cost can include manually entered Artifact / Alchemy cost。

Current gaps:

- No formal `artifactInventory` root。
- No formal `alchemyInventory` root。
- No formal special-material quantity storage。
- No special-material `globalAvgCost` storage。
- No special-material purchase / intake writer。
- No formal special-material deduction from inventory during crafting。
- No backup/export schema for special-material inventory。
- No canonical transaction payload for special-material purchase or consumption。

Current-master pure boundary:

- `src/services/specialMaterialInventoryService.js` implements `applySpecialMaterialPurchase()` and `applySpecialMaterialConsumption()`。
- `tests/special-material-inventory-service.test.js` protects account-total `totalQty`, account-wide `globalAvgCost`, purchase WAC, zero-balance reset, fixed-quantity consumption, insufficient quantity rejection, unknown cost rejection, dormant anchor, input immutability, structured result contract, error priority, metadata preservation, public API isolation, and plain Node execution。
- The service rejects location-shaped identity / entry fields: `qtyByLocation`, `qtyByCity`, and `locationId`。
- Exact-file ESLint coverage includes the service and test file。
- This is not production wiring and does not touch state, storage, cash, transactions, save, backup, UI, or Crafting。

Selected target:

- `totalQty`。
- Account-wide `globalAvgCost`。
- No location bucket。
- No transfer。
- Purchase / craft location may be future transaction metadata only。

Risk:

- High。Formal special-material inventory affects identity, inventory quantity, WAC, cash, crafting cost, transaction semantics, backup/export and rollback。

Remaining implementation decisions / gates:

- Production writer / UI / storage integration order。
- Stable special-material ID format。
- Identity catalog。
- Pure catalog / resolver contract。
- Storage root。
- Cash / transaction / backup integration。
- Formal Crafting integration。
- Compatibility period between manual-cost crafting and formal inventory。
- Backup/export and rollback strategy。
