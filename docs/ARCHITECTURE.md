# Albion Logistics ERP 系統架構與邊界規範

## 🎯 專案目標
用於管理 Albion Online 的製造批次、物流庫存、工人島產出與財務流水帳紀錄。
**開發原則：** 嚴格遵守模組關注點分離（Separation of Concerns），各模組僅處理自身業務，禁止跨界修改。

## 📌 Migration Boundary 文件

- `ITEM_ID_MODEL.md`：Item ID / Stable ID migration boundary。
- `TRANSACTION_EVENT_MODEL.md`：legacy transaction 與 future canonical event payload boundary。
- `MIGRATION_PLAN.md`：Item ID、Location、Transaction/Event migration track 與 release boundary。

---

## 📦 核心模組職責邊界

### 1. 製作模組 (Crafting Module)
* **檔案位置：** `components/crafting.js`
* **✅ 負責：**
  * 建立與管理製作佇列（Crafting Queue）。
  * 計算單次製作的材料需求、返還率（RRR）與預估稅金成本。
  * 完成製作流程，並將「結果數據」發送給狀態中心。
* **❌ 絕對不負責：**
  * 財務報表與現金流總額的直接加減。
  * 工人島的管理與產出。
  * 直接操作庫存或庫存寫入。Crafting 僅可透過 State/Utils 的唯讀 selector 查詢可用數量，例如 `inventorySelectors.getAvailableQty(locationId, itemId)`。
  * **禁止直接計算庫存全域均價（globalAvgCost）。**

### 2. 物流庫存模組 (Inventory Module)
* **檔案位置：** `components/inventory.js`
* **✅ 負責：**
  * 處理外部材料採購入庫。
  * 各城市間的庫存轉移（Transport）。
  * 全局與各城市庫存數量的查詢與 UI 渲染。
* **❌ 絕對不負責：**
  * 裝備製作的配方與流程。
  * 工人日誌的成本計算。
  * **禁止直接計算庫存全域均價（globalAvgCost）。**

### 3. 工人島模組 (Laborer Module)
* **檔案位置：** `components/laborer.js`
* **✅ 負責：**
  * 工人收成紀錄與 UI 渲染。
  * 空/滿日誌本的獨立庫存管理。
  * 產出物（資源）轉移至總庫存的流程。
* **⚠️ 特殊規則：**
  * 工人島產出目前 **不參與** 製作成本運算，視為無成本產出或獨立收益。

### 4. 作業日誌模組 (Operation Log Module)
* **檔案位置：** `components/ledger.js`
* **✅ 負責：**
  * 系統現金（Cash）流水帳紀錄與 UI 渲染。
  * 成本與收入的歷史明細管理。
* **❌ 絕對不負責：**
  * 任何物品的「庫存數量」管理與增減邏輯。

---

## 🧠 共用核心與資料庫

### 狀態管理中心 (State)
* **檔案位置：** `core/state.js`
* **✅ 負責：** 全系統資料儲存中心（Single Source of Truth）。
* **管理項目：** `inventory` (庫存), `assets` (資產), `transactions` (交易紀錄)。
* **提供唯讀查詢 API：** 例如 `inventorySelectors.getAvailableQty(locationId, itemId)`，讓 Crafting 只問不寫。
* *(備註：未來將依據 B-lite 漸進式集中化計畫，逐步收攏均價計算與交易寫入的權限。)*

### 靜態資料庫 (Data)
* **`albion_db.js`：** Albion 裝備配方與物品靜態資料庫。
* **`constants.js`：** 系統常數、交易類型枚舉（Enum）與設定值。

### 工具函式 (Utils)
* **`formatters.js`：** 銀幣、數值格式化與 HTML 防注入工具。

---

## 🖥️ Current Implementation / Legacy-Compatible UI Behavior

本節記錄目前 `src` 已存在的低風險 UI 與桌面整合行為，作為現況文件與回歸測試依據。這些行為不代表高風險資料模型或事件格式落差已完成遷移。

### 製作配方搜尋與分類
* 製作模組提供配方分類頁籤與名稱搜尋，使用者可從篩選結果選擇配方。
* 搜尋與分類只影響 UI 顯示及目前選取配方，不修改庫存、現金或交易紀錄。

### 庫存與帳本搜尋
* 庫存搜尋依目前顯示用物品名稱或階級字串篩選各倉庫內容。
* 帳本搜尋依日期、目前交易類型文字或項目文字篩選紀錄。
* 此為 **current implementation / legacy-compatible behavior**；帳本搜尋目前仍相容舊版 transaction 欄位，不代表新版 event payload 已完成。

### 帳本與工人紀錄分頁
* 帳本與工人收成紀錄目前皆以每頁 10 筆顯示，並提供上一頁、下一頁與目前頁數資訊。
* 分頁只影響畫面顯示，不改變紀錄內容、順序或持久化格式。

### 銷售估價參考值
* 成品銷售畫面提供總預估市值的 90% 與 85% 參考值，並顯示目前介面使用的扣除稅額後預估。
* 參考值只供 UI 判斷，不會自動寫入正式交易金額，也不代表 `SELL_ITEM` 正式事件規格已完成。

### 共用數字輸入格式
* `.format-num` 輸入欄位會即時套用千分位格式，並盡量維持使用者輸入位置，避免格式化造成游標跳動。
* 此行為屬 UI 輔助，不改變底層資料格式或成本計算規則。

### `stateUpdated` UI 更新事件
* 狀態中心在載入或儲存後發送 `stateUpdated` DOM 事件。
* `app.js` 接收事件後更新城市下拉選單、儀表板、庫存、工人島庫存與工人收成紀錄。
* 此事件目前只作為 UI 更新通知，不是 `EVENT_CATALOG.md` 定義的業務事件。

### 採購物品自動建議城市
* 選擇鋼條、布料、板材或皮革時，採購畫面會自動選擇目前實作對應的精煉加成城市。
* 自動選擇僅為可覆寫的 UI 建議，不限制實際採購地點，也不改變 Location Model。

### Tauri 視窗控制
* 桌面版自訂標題列提供最小化、最大化切換與關閉視窗操作。
* 在沒有 Tauri API 的瀏覽器預覽環境中，視窗控制不執行桌面操作；關閉按鈕僅顯示模擬提示。

### Tauri dev startup note

若 Tauri dev 因舊 workspace 絕對路徑 artifact 發生 blocking error，可清除 `src-tauri/target` 後重新啟動。此問題屬 build artifact，不代表 source code 行為改變。

## v0.4.4 Release Checkpoint Architecture Notes

本節只記錄目前 production implementation 的文件定位，不代表版本號、Tauri config、schema、transaction payload 或 migration 已變更。

### Crafting Planner / Quotation Module

- `src/components/quotation.js` 提供 read-only Planner / quotation calculator。
- Planner 使用 `RECIPES` 與 Crafting 共用 Item Picker。
- Planner 可將明確確認的方案 handoff 到 transient `craftingQueue`。
- Planner 本身不寫入 inventory、cash、transactions 或 storage。
- Planner 不是 order management、customer management、market API 或 persisted quotation system。

### Ledger Presentation Layer

- `src/presenters/ledgerDisplay.js` 是 Ledger category / item display presentation layer。
- `src/components/ledger.js` 透過 presenter 顯示英文 category / item。
- Raw transaction payload 保留原值，display mapping 不等於 transaction migration。
- Alias display deduplication 屬於 presentation/filter/grouping 行為，不改 stored `type`。

### Custom Location State Boundary

- `src/core/state.js` 已提供 stable custom location ID 生命週期：add / rename / remove。
- Active custom locations 會出現在 runtime `customLocations`。
- Removed custom locations 會保留 inactive registry entry 與原 displayName，不直接硬刪 registry evidence。
- Restart round-trip 與 save failure rollback 屬於目前 test-covered safety boundary。
- Backup/reset/migration 與 per-location hideout crafting profile 不在本 checkpoint 範圍。

### Inventory Transfer Service Boundary

- Current master has extracted existing inventory transfer behavior into `src/services/inventoryTransferService.js`.
- `applyInventoryTransfer({ item, quantity, fromLocation, toLocation })` is a pure service boundary. It validates quantity, same-location input, item existence, selected-source sufficiency, and returns a structured transfer result.
- On success, the service returns a copied item with copied `qtyByCity`, subtracts from `fromLocation`, and adds to `toLocation`.
- The service does not mutate global state, touch DOM, show toast, call `saveState()`, access storage, write transactions, change cash/debt, or modify `globalAvgCost`.
- `src/components/inventory.js` remains the component adapter for DOM input, toast messaging, `state.inventory[key]` assignment, `saveState()`, and UI refresh.
- Runtime transfer compatibility still uses legacy `qtyByCity` display-name keys. This extraction does not start Location migration, does not write `qtyByLocation`, and does not implement canonical `TRANSFER_ITEM`.
- This is current master post-release behavior, not a published v0.4.4 release artifact.

## Special Material Inventory Architecture Boundary

特殊材料正式庫存規格見 `SPECIAL_MATERIAL_INVENTORY.md`。該文件是 future architecture target，不代表目前已新增 Artifact / Alchemy inventory root、purchase writer、crafting deduction writer、backup schema 或 transaction payload。

Current implementation 仍只在 recipe metadata、Planner calculation、crafting queue / shopping-list display 與 current crafting cost calculation 中使用 Artifact / Alchemy 資訊。未來若實作，應先建立 bounded service/helper 並以 regression tests 保護後，再接 UI、inventory、cash、ledger 與 storage。
## 0.5.0 Crafting Domain Architecture Boundary

Canonical decision source: [0.5.0 Crafting Domain Model](./CRAFTING_DOMAIN_MODEL.md).

0.5.0 target architecture separates pure domain modules from production component side effects:

1. Requirement Resolver: `resolveCraftRequirements({ recipe, itemLevel, craftQuantity })`
2. Production Bonus Calculator: `calculateProductionBonus({ profile, recipeCategory, eventParameters })`
3. Regional Material Consumption Calculator: `calculateRegionalMaterialConsumption({ baseQuantity, craftQuantity, rrr, override })`
4. Craft Completion Calculator: `calculateCraftCompletion({ requirements, productionBonus, regionalMaterialCosts, specialMaterialCosts, usageFee })`
5. Operation Composer: `prepareCraftCompletionOperation({ calculation, inventories, cash, targetLocationId })`
6. Component Adapter: DOM input, toast, state assignment, queue removal, `saveState()`, and UI refresh.

Currently implemented pure modules:

- Production Bonus Calculator
- Regional Material Consumption Calculator

Boundary:

- Pure modules must not read DOM, mutate state, write storage, call `saveState()`, show toast, or remove queue rows.
- Calculators accept plain data and return structured results.
- Calculators do not read DOM, state, storage, cash, transaction, or queue.
- Component adapters remain responsible for UI and side effects.
- Component adapter wiring is not implemented.
- Requirement Resolver, Craft Completion Calculator, and Operation Composer are not implemented.
- Production Profile remains a target contract only; there is no persisted root or UI.
- Current master has Special Material pure foundations, but production Crafting integration is not implemented.
