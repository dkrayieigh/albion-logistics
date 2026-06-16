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

### 1.3 銷售估價工具

- **目前行為：** 支援成品銷售的單價與總價互算、扣除 6.5% 後的收入預估，以及總預估市值的 90% 與 85% 參考價。
- **主要實作位置：** `src/components/inventory.js` 的 `onSellEstimateChange()`、`runEstimator()`、`onSellPriceChange()`。
- **穩定版分類：** Known limitation。比例只作為 UI 參考，不自動寫入正式交易金額。
- **文件狀態：** 已在 `BUSINESS_RULES.md` 與 `TEST_CASES.md` 標註 current implementation 限制。
- **風險：** Low。
- **封版狀態：** 非阻斷。

### 1.4 自訂倉庫更名、刪除與庫存轉移

- **目前行為：** 可新增、更名與刪除自訂倉庫。封版前已加入資料安全限制：非空自訂倉庫不得刪除，使用者必須先轉移或清空庫存；空自訂倉庫仍可刪除。
- **目前狀態：** 資料遺失風險已修復並補 regression test。不進行 Location ID migration。
- **主要實作位置：** `src/components/inventory.js`。
- **測試來源：** `tests/core-cost-regression.test.js`。
- **文件狀態：** `LOCATION_MODEL.md` 與 `TEST_CASES.md` 已同步 current implementation 限制。
- **風險：** Medium → Low / Known limitation。
- **封版狀態：** 非阻斷。

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
  - 可手動新增滿日記本。
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
  - 執行製作時只處理已勾選項目。
- **目前狀態：** `TEST-A07` 已轉為正式 regression test；材料數量充足但缺成本基準時，製作不得消耗材料、不得新增成品、不得扣 cash、不得新增 transaction，且 craftingQueue 必須保留。
- **主要實作位置：** `src/components/crafting.js` 的 `openItemSelector()`、`searchItems()`、`updateShoppingListTotal()`、佇列編輯函式與 `submitCraftAll()`。
- **文件狀態：** 搜尋與分類已補 current implementation docs；購物清單、佇列 UI 編輯與部分製作仍屬 known limitation。
- **風險：** Low；購物清單與正式成本結算的關係需視為 Medium。
- **測試狀態：** Partially tested。製作結算的核心成本、材料消耗、成品 WAC、材料不足阻擋與材料缺成本基準阻擋已由 `tests/core-cost-regression.test.js` 保護；搜尋、分類、購物清單、佇列 UI 編輯與部分製作仍主要依賴手測。
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

Migration boundary 參考文件：`ITEM_ID_MODEL.md`、`TRANSACTION_EVENT_MODEL.md`、`MIGRATION_PLAN.md`。

### 2.1 `qtyByLocation` 與 `qtyByCity`

- **docs 規格：** `docs/DATA_MODEL.md` 與事件文件統一使用 `qtyByLocation`，Key 必須為 Location ID。
- **src 現況：** `src/core/state.js` 與各業務模組使用 `qtyByCity`，Key 為 `Thetford`、`LaborerIsland` 或自訂倉庫顯示名稱。
- **相容性影響：** 現有 `localStorage`、備份 JSON 與全部庫存讀寫均依賴 `qtyByCity`。
- **直接修改風險：** High。若沒有 adapter 與 migration，舊資料會無法讀取或看似庫存歸零。
- **測試狀態：** Partially tested。`tests/core-cost-regression.test.js` 已保護 legacy `qtyByCity` 在核心庫存、物流與成本流程中仍可用；這是相容性保護，不代表 `qtyByLocation` 遷移已完成。

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
| 物流轉移不改成本、不改 cash、不新增 ledger | current implementation | Tested | `tests/core-cost-regression.test.js` | 驗證物流只做物理庫存平移。 |
| 來源庫存不足時阻擋物流轉移 | current implementation | Tested | `tests/core-cost-regression.test.js` | 驗證物流轉移預檢不造成狀態變更。 |
| legacy 中文 item key + `qtyByCity` 仍可用 | current compatibility behavior | Tested | `tests/core-cost-regression.test.js` | 保護目前舊資料相容，不代表 Stable ID 遷移完成。 |
| 採購刪除轉 adjustment | current implementation | Tested | `tests/ledger-data-safety.test.js` | 原始交易保留，新增調整交易。 |
| 庫存不足時阻擋 purchase reversal | current implementation | Tested | `tests/ledger-data-safety.test.js` | 不新增 adjustment，不改狀態。 |
| 同一筆採購不可 reversal 兩次 | current implementation | Tested | `tests/ledger-data-safety.test.js` | 包含 UI 重新渲染後不再顯示刪除入口。 |
| 備份匯出 / 匯入 schema 與原子性 | current implementation / schema docs debt | Tested | `tests/backup-regression.test.js` | 覆蓋新舊備份相容與無效資料不得覆寫；正式版本化 schema 尚未完成。 |
| Factory Reset | current implementation | Manual only | `docs/TEST_CASES.md` / UI | 尚未有 regression test。 |
| 自訂倉庫刪除 | current implementation / legacy location key | Tested | `tests/core-cost-regression.test.js` | 非空倉庫不得刪除；Location ID migration 尚未完成。 |
| 成品出售 | current implementation / legacy transaction | Tested | `tests/core-cost-regression.test.js` | 正式 `SELL_ITEM` event model 尚未完成。 |
| 工人島物資出售 | current implementation / legacy transaction | Tested | `tests/core-cost-regression.test.js` | 正式出售事件規格尚未完成。 |
| 現金餘額校正 / 注資 / 提領 | current implementation / partial UI binding unknown | Tested | `tests/ledger-data-safety.test.js` | `adjustWallet()` UI 入口仍需確認。 |
| Stable ID / `qtyByLocation` / 新版 event payload 遷移 | future spec | Untested | 無 | 不可寫成 current implementation。 |

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
- 工人島手動新增滿日記本與無痕庫存校正。
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
