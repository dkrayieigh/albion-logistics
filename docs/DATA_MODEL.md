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
> Current production implementation 仍使用 legacy root shape。以下 clean-cutover root state 是 future storage target；pure `createCleanInitialState()` helper 已可產生此 shape，但尚未接入 `state.js`、localStorage、writer 或 backup code。
> Pure clean initializer and pure schema codec are implemented. Persistence, startup loading, storage repository, writer and backup integration are not implemented.

### Clean-Cutover Root State — Future Target

```js
{
  schemaVersion: 1,
  assets: {
    cash: Number,
    debt: Number
  },
  inventory: {},
  locationRegistry: {},
  transactions: [],
  laborerInventory: {},
  laborerLogs: []
}
```

Root state rules：

- `schemaVersion` 是 new schema 識別欄位；initial clean-cutover version 為 `1`。
- `customLocations` 不再存在於 new schema stored state。
- 不沿用 legacy storage shape 作為 new root。
- `transactions` 初始為空陣列。
- `assets.cash` 由使用者人工輸入，必須是 finite number。
- `assets.debt` 預設為 `0`，若提供則必須是 finite number。
- `inventory` 只包含人工初始化的 seed items。
- `locationRegistry` 必須包含固定 system entries，並可包含初始化時建立的 custom entries。
- Current `craftingQueue` 是 runtime/UI queue export，不是目前 persisted root state 欄位；clean-cutover schema 不憑空刪除 current runtime queue。若未來要持久化 queue，必須另行定義 writer/storage contract。

### Storage Isolation — Future Target

Clean cutover 使用新的 storage key namespace。正式 key 名稱定為：

```text
albion-logistics-v2-state
```

Storage rules：

- 本文件只定義 future storage key；本任務不修改 localStorage。
- Legacy keys 不得自動刪除。
- New app 第一次啟動先檢查 `albion-logistics-v2-state`。
- New key 不存在時進入 clean initialization flow。
- 不自動讀取 legacy inventory 作 new state。
- Rollback 仍可回舊版 app 讀 legacy keys。

### Clean Initialization Input — Future Target

Future pure initializer API：

```js
createCleanInitialState(input, options?)
```

Optional test dependency injection：

```js
{
  generateCustomLocationId?: () => String
}
```

Initializer API rules：

- `generateCustomLocationId` 只用於 pure implementation 與 deterministic tests。
- Generator 不屬於 user input。
- Generator 不得存入 state。
- Pure initializer and generator injection contract are implemented.
- Production startup/storage integration and production generator selection are not implemented.
- Generator 回傳值必須符合 `custom:<generated-id>` 格式。
- Generator 失敗、回傳重複 ID、或與 fixed system ID 衝突時，initialization 必須整體失敗。
- The initializer must not mutate `input`, must not read or modify legacy state, and must not read or write localStorage.

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

      // 必須剛好提供一個
      locationId?: String,
      customLocationRef?: String,

      quantity: Number,
      globalAvgCost?: Number | null
    }
  ]
}
```

Input validation rules：

- `cash` 必填且必須是 finite number。
- `debt` 可省略，預設為 `0`；若提供則必須是 finite number。
- `inventorySeeds` 可為空。
- `customLocations` 可省略或為空。
- `customLocations[].clientRef` 是 initialization input-only reference。
- `clientRef` 不得存入 new root state 或 Location Registry。
- `clientRef` 不得由 `displayName` 推導。
- `clientRef` trim 後必須是非空字串。
- 同一次 input 中 duplicate `clientRef` 必須失敗。
- `inventorySeeds[].customLocationRef` 必須對應本次 input 中存在的 `clientRef`。
- Unknown `customLocationRef` 必須失敗。
- Inventory seed 必須剛好提供一個：`locationId` 或 `customLocationRef`。兩者同時存在或同時缺少均為 invalid。
- Initializer 建立 custom permanent ID 後，必須透過 `clientRef` 解析 seed。
- Permanent custom ID 不得由 `displayName` 或 `clientRef` 直接推導。
- `inventorySeeds[].quantity` 必須是 finite number。
- `inventorySeeds[].globalAvgCost` 缺省時為 `null`；若提供則必須是 finite number 或 `null`。
- `inventorySeeds[].locationId` 必須存在於 fixed system registry。
- Duplicate seed identity 以 `itemKey + resolved locationId` 判斷；若不同 reference 形式最終解析到同一永久 `locationId`，仍視為 duplicate。
- Duplicate seed 視為 invalid，不自動加總。
- Custom ID 由 new implementation 生成，不由 `displayName` 推導。
- Duplicate custom `displayName` 經 trim + case-insensitive 後視為 conflict。
- Custom name 不得與 system `displayName` 衝突。
- 初始化失敗不得部分建立 state。

### Clean Initialization Output — Future Target

Success result：

```js
{
  ok: true,
  state: {
    schemaVersion: 1,
    assets: {
      cash: Number,
      debt: Number
    },
    inventory: {},
    locationRegistry: {},
    transactions: [],
    laborerInventory: {},
    laborerLogs: []
  },
  errors: []
}
```

Failure result：

```js
{
  ok: false,
  state: null,
  errors: String[]
}
```

Success rules：

- 產生完整 new root state。
- 固定 system registry entries 全部建立。
- Custom registry entries 生成 ID。
- Inventory 只包含人工 seed 的 items。
- Transactions 為空。
- Legacy data 不被讀取或寫入。
- `globalAvgCost` 缺省為 `null`。
- Assets 使用人工輸入值。
- `laborerInventory` 建立 future canonical default shape。
- `laborerLogs` 初始化為空陣列。

Failure rules：

- 不寫入 `albion-logistics-v2-state`。
- 不修改 legacy keys。
- 回傳 machine-readable error codes。
- Errors 使用固定順序。
- 同一 code 最多出現一次。
- 不留下 partial state。
- 不修改 input。
- 不讀取或修改 legacy state。
- 不讀寫 localStorage。

Future `laborerInventory` canonical default shape：

```js
laborerInventory: {
  '鋼條': {
    [supportedQuality]: 0
  },
  '布料': {
    [supportedQuality]: 0
  },
  '板材': {
    [supportedQuality]: 0
  },
  '滿日誌': {
    [supportedQuality]: 0
  }
}
```

Laborer inventory rules：

- Future canonical journal category only accepts `滿日誌`。
- Future target must not use `滿日記本`。
- Current legacy src/storage key remains `滿日記本`; this docs task does not modify it.
- Current legacy key：`滿日記本`；future canonical key：`滿日誌`。
- All supported quality keys initialize to `0`。
- Future tests should obtain supported quality keys from current quality constants or a future shared default builder, not copy a hard-coded list that can drift.
- This Location clean-cutover contract does not redesign laborer accounting or writer semantics.

Suggested future error codes：

```text
INVALID_CASH
INVALID_DEBT
INVALID_CUSTOM_LOCATION_NAME
DUPLICATE_CUSTOM_LOCATION_REF
DUPLICATE_CUSTOM_LOCATION_NAME
SYSTEM_LOCATION_NAME_CONFLICT
CUSTOM_LOCATION_ID_GENERATION_FAILED
INVALID_INVENTORY_SEED
INVALID_LOCATION_REFERENCE
INVALID_CUSTOM_LOCATION_REF
UNKNOWN_LOCATION_ID
DUPLICATE_INVENTORY_SEED
INITIALIZATION_ABORTED
```

Error code boundary：

- `INITIALIZATION_ABORTED` is defined as an overall failure code.
- This docs task does not require every failure to append `INITIALIZATION_ABORTED`; formal tests contract should decide that behavior.
- This docs task does not implement error generation.

### First-Launch Confirmation — Future Target

- New storage 不存在時顯示 clean initialization。
- 若偵測到 legacy keys 存在，必須提示：
  - legacy 資料不會自動遷移。
  - 使用者應先匯出最後一份 legacy backup。
  - 新版使用獨立 storage。
- 使用者明確確認後才建立 new state。
- Cancel 時不得寫任何 new state。
- 不得自動清除 legacy keys。

### Backup Boundary — Future Target

- New backup 只匯出 new schema。
- New importer 只接受 new schema 與對應 `schemaVersion`。
- Legacy backup 不由 new importer 支援。
- Legacy backup 由舊版 app 處理。
- Backup implementation 尚未開始。

## Current Legacy Root State
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
> Location clean-cutover track only changes the Location dimension. It keeps existing legacy `itemKey` identity and does not perform Stable Item ID migration.

**⛔ Inventory Key 組成目標：**
* Future migration target 是 ${StableId}_${itemLevel}（例如：METALBAR_6.2 或 WILDFIRE_STAFF_6.2）；current implementation 仍可能使用中文 item key，不得據此直接改寫 storage。
* Location clean-cutover new schema may still use current legacy `itemKey` while replacing `qtyByCity` with `qtyByLocation`; Stable ID remains a separate future migration track.
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
