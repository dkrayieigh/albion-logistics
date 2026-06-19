# 🗄️ Albion Logistics ERP 資料模型 (DATA_MODEL.md)
**設計守則：**
* 本專案為 Vanilla JS 環境，為避免 AI 實作時的型別與命名幻覺，所有涉及 state.js（核心狀態中心）的資料讀寫，必須絕對遵守以下的物件結構與命名規範。嚴禁自行新增未經定義的屬性（如 tier、enchantment、cityId 等）。
> ⚠️ 本文件描述 target data model / migration target。
> Stable ID、`qtyByLocation` 與 canonical transaction payload 都是 future target / migration target。
> Current implementation 仍保留 legacy `qtyByCity`、中文 item key 與 legacy transaction 欄位；不得解讀為已全面使用 Stable ID、`qtyByLocation` 或 `action` / `target` / `cashChange` / `locationId`。
> 本文件不是 current implementation 的完整快照，不得據此直接重寫現有存檔或 production code。
> 修改 src 前必須先參考 `IMPLEMENTATION_GAP.md`、`CURRENT_LIMITATIONS.md`、`TEST_CASES.md`、`ITEM_ID_MODEL.md`、`TRANSACTION_EVENT_MODEL.md` 與 `MIGRATION_PLAN.md`。
> 配方加成判斷應優先依賴 category，不應依賴 UI 顯示名稱字串比對

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
> Future target / migration target：本節保留 Stable ID 與 `qtyByLocation` 目標模型。current implementation 仍使用 legacy 中文 item key 與 `qtyByCity`。

**⛔ Inventory Key 組成目標：**
* Future migration target 是 ${StableId}_${itemLevel}（例如：METALBAR_6.2 或 WILDFIRE_STAFF_6.2）；current implementation 仍可能使用中文 item key，不得據此直接改寫 storage。
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
> Future target / migration target：Stable ID payload 與禁止拆解 `itemKey` 是 migration boundary；current implementation 仍需維持 legacy 中文 key 相容。

// state.laborerInventory
{
  "METALBAR": {             // Key: Stable ID
    "6.0": Number,         // Sub-key: itemLevel, Value: quantity
    "6.1": Number
  },
  "CLOTH": { ... },
  "FULL_JOURNAL": { ... }
}

* **Stable ID 目標：** Future migration target 是讓 `laborerInventory` 第一層 Key 使用 Stable ID，而非顯示名稱或中文物品名；current implementation 仍需支援 legacy 中文 item key 與既有內部 key。
* **匯入對接規則：**
  * `LABORER_IMPORT` payload 必須明確提供 `stableId` 與 `itemLevel`。
  * 系統使用 `stableId` 與 `itemLevel` 定位 `state.laborerInventory[stableId][itemLevel]`。
  * 系統使用 `${stableId}_${itemLevel}` 組合並驗證 `itemKey`。
  * 禁止透過拆解 `itemKey` 反推出 `stableId` 或 `itemLevel`。

## 🧾 作業日誌模型 (Operation Log)
> Future target / migration target：本節描述 canonical transaction payload。current transactions 尚未全面使用 `action` / `target` / `cashChange` / `locationId`。

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

## ⚠️ Current Legacy Transaction Compatibility

以下 legacy 欄位仍是 current legacy-compatible implementation。Ledger 顯示、搜尋、reversal、備份匯入與既有 localStorage 仍可能依賴這些欄位。

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

這不是 future canonical transaction payload。新增 migration 前不得刪除 legacy `type` / `item` / `quality` / `qty` / `total` / `unitPrice` / `location` 相容讀取與 fallback；交易事件邊界請見 `TRANSACTION_EVENT_MODEL.md`，整體遷移順序請見 `MIGRATION_PLAN.md`。
