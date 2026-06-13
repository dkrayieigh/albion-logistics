# 🗄️ Albion Logistics ERP 資料模型 (DATA_MODEL.md)
**設計守則：**
* 本專案為 Vanilla JS 環境，為避免 AI 實作時的型別與命名幻覺，所有涉及 state.js（核心狀態中心）的資料讀寫，必須絕對遵守以下的物件結構與命名規範。嚴禁自行新增未經定義的屬性（如 tier、enchantment、cityId 等）。

## 🌳 狀態樹根結構(Root State)
//Root State
{
  "assets": { ... },
  "customLocations": [ ... ],
  "inventory": { ... },
  "laborerInventory": { ... },
  "laborerLogs": [ ... ],
  "transactions": [ ... ]
}

## 💰 資產模型 (Assets)
// state.assets
{
  cash: Number,  // 系統現有資金 (可為負數，視為透支)
  debt: Number   // 歷史注資與提領產生的資本額/債務紀錄
}

## 📦 總庫存模型 (Inventory Item)
**⛔ Inventory Key 組成鐵律：**
* 必須且只能是 ${StableId}_${itemLevel}（例如：METALBAR_6.2 或 WILDFIRE_STAFF_6.2）。
* 絕對禁止將裝備的優劣品質（如傑出、大師）加入 Key 中。相同階級與附魔的物品，無論品質為何，在材料庫存端皆視為同一種資產。
**HasCostBasis 判定規則：**
- `globalAvgCost === null`：尚未建立成本基準。
- `globalAvgCost !== null`：已建立成本基準。
- `globalAvgCost === 0` 不等於「尚未建立」；它代表已建立成本基準且成本值為 0。
// state.inventory["${StableId}_${itemLevel}"]
{
  globalAvgCost: null,      // 全域加權平均成本，預設為 null。只要不是 null，就代表 HasCostBasis === true。
  qtyByLocation: {          // 各地點的物理庫存數量 (Key 必須使用 Location ID)
    "thetford": Number,
    "fort_sterling": Number,
    "hideout_001": Number,
    "laborer_island": Number // 工人島專屬的實體倉庫 (與暫存區不同)
  }
}

## 👷 工人島暫存區模型 (Yield Inventory)
// state.laborerInventory
{
  "METALBAR": {             // Key: Stable ID
    "6.0": Number,         // Sub-key: itemLevel, Value: quantity
    "6.1": Number
  },
  "CLOTH": { ... },
  "FULL_JOURNAL": { ... }
}

* **Stable ID 规范：** `laborerInventory` 第一層 Key 必須使用 Stable ID，而非顯示名稱或中文物品名。
* **匯入對接規則：**
  * `LABORER_IMPORT` payload 必須明確提供 `stableId` 與 `itemLevel`。
  * 系統使用 `stableId` 與 `itemLevel` 定位 `state.laborerInventory[stableId][itemLevel]`。
  * 系統使用 `${stableId}_${itemLevel}` 組合並驗證 `itemKey`。
  * 禁止透過拆解 `itemKey` 反推出 `stableId` 或 `itemLevel`。

## 🧾 作業日誌模型 (Operation Log)
// state.transactions[index]
{
  date: String,        // 交易發生日期 (格式: "YYYY-MM-DD")
  action: String,      // 操作類型 (例: "PURCHASE_ITEM", "CRAFT_COMPLETE", "LABORER_IMPORT")
  target: String,      // 目標物品 Key 或 Stable ID (例: "WILDFIRE_STAFF_6.2")
  qty: Number,         // 異動數量
  cashChange: Number,  // 真正的現金流變動 (例：買材料 -10w, 製作稅金 -5k)
  assetValue: Number,  // 該次操作的總資產規模/成本 (例：買材料 10w, 成品總成本 10.5w)
  locationId: String,  // 發生地點 Location ID，例: "thetford"；全局校正填 "-"
  details: String      // 輕量描述或 JSON 字串，用於 UI 查帳與說明 (例: "消耗鋼條x50, 布料x30")
}

## 🗺️ 自訂日誌模型 (Misc)

// state.laborerLogs
// 用於 UI 顯示工人收成歷史
{
  date: String,      // "YYYY-MM-DD"
  filled: Number,    // 消耗的滿日誌數量
  details: String    // 產出摘要字串 (例: "鋼條(6.0)x300")
}

## ⚠️ Deprecated Draft：舊交易欄位草稿

以下結構是早期文件草稿，不代表目前程式碼實作，也不作為新版正式資料模型。

禁止新程式碼依照此格式寫入 `state.transactions`。

```js
{
  date: String,
  type: String,
  item: String,
  itemLevel: String,
  qty: Number,
  total: Number,
  unitPrice: Number,
  location: String
}
```