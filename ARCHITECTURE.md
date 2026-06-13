# Albion Logistics ERP 系統架構與邊界規範

## 🎯 專案目標
用於管理 Albion Online 的製造批次、物流庫存、工人島產出與財務流水帳紀錄。
**開發原則：** 嚴格遵守模組關注點分離（Separation of Concerns），各模組僅處理自身業務，禁止跨界修改。

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