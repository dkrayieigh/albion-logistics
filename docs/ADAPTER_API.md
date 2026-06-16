# Albion Logistics ERP Adapter API Draft

## 1. 文件定位

本文件是 adapter-first migration 的 future API draft。

本文件不代表 adapter module 已存在，不代表 migration 已開始，也不要求修改 `src`、`tests`、storage key 或 transaction payload。

Current src behavior remains the source of truth。legacy 中文 item key、`qtyByCity`、legacy transaction payload 仍是 supported current legacy-compatible behavior。

Stable ID、`qtyByLocation`、Location Registry 與 canonical event payload 仍是 future target / migration target，不得寫成 current implementation。

## 2. Non-goals

- 不要求 `src` 修改。
- 不要求 `tests` 修改。
- 不新增 adapter module。
- 不新增 migration。
- 不改 storage key。
- 不改 transaction payload。
- 不刪除 legacy fallback。
- 不新增正式 regression test。
- 不新增 `test.todo`。
- 不把 Stable ID、`qtyByLocation`、canonical event payload 寫成 current implementation。

## 3. API Design Rules

- Adapter API 必須是 pure read / normalize boundary，不得直接修改 `state`。
- Adapter API 必須先支援 current legacy-compatible data。
- Adapter API 可以描述 future target input，但不得要求現有 storage 立即改寫。
- Adapter API 回傳值應可被測試比較，避免依賴 UI 字串或隱含 side effect。
- Adapter API 遇到不明確 mapping、衝突 mapping 或無法保證相容的資料時，必須回傳明確錯誤或拋出受控錯誤。
- Adapter API 不得回溯重算 `globalAvgCost`。
- Adapter API 不得物理刪除 legacy transaction、legacy item key、legacy `qtyByCity` 或 legacy backup fallback。

## 4. Item Identity Adapter API

### `resolveItemIdentity(input)`

Future adapter API draft。此 API 尚未存在。

**input**

- legacy item key，例如 `鋼條_6.2`。
- future item identity sample，例如 `{ stableId, itemLevel }`。
- optional mapping table：legacy 中文 key ↔ Stable ID。

**output**

- normalized item identity draft：
```js
{
  legacyItemKey: String,
  stableId: String | null,
  itemLevel: String | null,
  displayName: String | null,
  source: "legacy" | "future"
}
```

**error behavior**

- missing item mapping must fail explicitly。
- mapping 衝突不得靜默覆寫。
- 無法安全解析 `itemLevel` 時必須回傳明確錯誤，不得猜測。

**must not mutate state**

- 不得修改 `state.inventory`。
- 不得改寫 legacy item key。
- 不得建立 Stable ID storage key。

**must support legacy data**

- 必須支援 current legacy 中文 item key。
- 必須支援 current `qtyByCity` 相關流程中的 legacy key。

**future implementation boundary**

- Stable ID 仍是 future target。
- 禁止拆解 `itemKey` 是 migration boundary，不是 current implementation。
- Adapter 建立前，不得要求 current code 停止支援 legacy 中文 key。

## 5. Location Adapter API

### `normalizeLocationMap(input)`

Future adapter API draft。此 API 尚未存在。

**input**

- legacy quantity map，例如 `qtyByCity`。
- future quantity map sample，例如 `qtyByLocation`。
- optional location mapping：custom location name ↔ future locationId。

**output**

- normalized location quantity draft：
```js
{
  sourceFormat: "qtyByCity" | "qtyByLocation",
  quantities: Record<string, number>,
  unresolvedLocations: string[]
}
```

**error behavior**

- 同一實體地點 mapping 到多個 target 時必須報錯。
- 多城市 `qtyByCity` backup 匯入後，任何地點數量遺失都必須視為錯誤。
- 數量不是 finite number 時必須回傳明確錯誤。

**must not mutate state**

- 不得修改 `state.inventory`。
- 不得將 `qtyByCity` 寫回為 `qtyByLocation`。
- 不得新增、刪除或更名 `customLocations`。

**must support legacy data**

- 必須支援 legacy `qtyByCity`。
- 必須支援 custom location name key。
- 必須保留非空自訂倉庫不得刪除的資料安全前提。

**future implementation boundary**

- `qtyByLocation` 與 Location Registry 仍是 future target。
- Location adapter 尚未存在。
- Migration 前後每個 location 物理數量一致，必須等 adapter / migration sample 建立後才可正式測試。

### `resolveLocationQuantity(input)`

Future helper draft，可在 `normalizeLocationMap()` 之上查詢單一地點數量。

**input**

- normalized location quantity draft。
- legacy location name 或 future locationId。

**output**

- `{ quantity: Number, resolvedLocationKey: String, sourceFormat: String }`

**error behavior**

- location 無法對應時必須明確回傳 unresolved 狀態。

**must not mutate state**

- 只讀取 normalized input，不得寫入 inventory。

**must support legacy data**

- 必須能讀取 legacy city/custom location name。

**future implementation boundary**

- 不得因此宣告 `qtyByLocation` 已取代 `qtyByCity`。

## 6. Transaction Reader Adapter API

### `readTransaction(input)`

Future adapter API draft。此 API 尚未存在。

**input**

- legacy transaction，例如含 `type`、`item`、`quality`、`qty`、`total`、`unitPrice`、`location`。
- future canonical event sample，例如含 `action`、`target`、`cashChange`、`assetValue`、`locationId`。

**output**

- normalized ledger entry draft：
```js
{
  sourceFormat: "legacy" | "future",
  displayType: String,
  itemRef: String | null,
  quantity: Number | null,
  cashImpact: Number | null,
  locationRef: String | null,
  raw: Object
}
```

**error behavior**

- ledger reader must tolerate mixed legacy Chinese type values and `INVENTORY_ADJUSTMENT` without crashing。
- 無法辨識的 transaction type 不得造成 ledger crash，必須回傳 unknown / unsupported 狀態。
- 成本基準校正不得被一般 `INVENTORY_ADJUSTMENT` 默認吸收。

**must not mutate state**

- 不得修改 `state.transactions`。
- 不得改寫 legacy transaction 為 canonical event。
- 不得新增 reversal 或 adjustment。

**must support legacy data**

- 必須支援 legacy 中文 transaction type，例如 `買材料`、`製作入庫`、`賣成品`、`工人島出售`。
- 必須支援 mixed `INVENTORY_ADJUSTMENT`。
- 必須支援 legacy `成本校正` fallback 的可讀性。

**future implementation boundary**

- Canonical event payload 仍是 future target。
- `SELL_ITEM` 仍不是 current implementation。
- Reader adapter 尚未存在，不得宣告 ledger 已完成 event payload migration。

### `normalizeLedgerEntry(input)`

Future helper draft，可作為 `readTransaction()` 的 normalized result shape。

**input**

- legacy transaction 或 future event sample。

**output**

- normalized ledger display data。

**error behavior**

- 不得因缺少 optional 欄位造成 crash。

**must not mutate state**

- 只讀取 input，不寫入 ledger。

**must support legacy data**

- 支援 current legacy transaction payload。

**future implementation boundary**

- 不得要求 current writer 改成 canonical event writer。

## 7. Backup Compatibility Adapter API

### `readBackupSnapshot(input)`

Future adapter API draft。此 API 尚未存在。

**input**

- current backup object。
- legacy JSON-string backup。
- future sample backup。

**output**

- normalized backup snapshot draft：
```js
{
  inventory: Object,
  assets: Object,
  transactions: Array,
  customLocations: Array,
  laborerInventory: Object,
  warnings: String[]
}
```

**error behavior**

- 無效 JSON、缺少必要欄位或欄位型別錯誤時必須明確失敗。
- 匯入失敗不得覆寫 `localStorage`。
- rollback path 必須保留 legacy backup 可回復。

**must not mutate state**

- 不得直接寫入 `localStorage`。
- 不得直接呼叫 migration。
- 不得改寫 backup payload。

**must support legacy data**

- 必須支援 legacy 中文 item key。
- 必須支援 legacy `qtyByCity` multi-location inventory。
- 必須支援 `customLocations` 字串陣列。
- 必須支援大量 legacy transactions。

**future implementation boundary**

- Backup adapter 尚未存在。
- Future sample backup 僅作 adapter 測試素材，不代表 migration 已開始。

### `validateBackupCompatibility(input)`

Future helper draft，用於 adapter 前置驗證。

**input**

- normalized backup snapshot draft。

**output**

- compatibility report：
```js
{
  ok: Boolean,
  errors: String[],
  warnings: String[]
}
```

**error behavior**

- inventory quantity、transaction count、cash 或 `globalAvgCost` 無法驗證時必須失敗或警告。

**must not mutate state**

- 只產生 report，不寫入 storage。

**must support legacy data**

- 支援 current backup regression 覆蓋的 object / array 與 legacy JSON-string backup。

**future implementation boundary**

- 不得取代現有 import/export 行為。

## 8. Error Handling Boundary

- Adapter error 必須可區分 malformed input、missing mapping、mapping conflict、unsupported future sample 與 unsafe mutation request。
- Adapter error 不得被靜默轉成空資料。
- Adapter error 不得導致部分寫入。
- Adapter error 不得回溯重算 `globalAvgCost`。
- Adapter error 不得刪除 legacy fallback。

## 9. Test Boundary

D5 test.todo anchors 可作為未來 adapter/migration 前置測試入口，但本文件不新增 test，也不新增 `test.todo`：

- missing item mapping must fail explicitly。
- importing legacy `qtyByCity` multi-location backup must preserve every location quantity。
- ledger reader must tolerate mixed legacy Chinese type values and `INVENTORY_ADJUSTMENT` without crashing。

Covered regression behavior remains authoritative for current stable behavior：

- legacy 中文 item key + `qtyByCity` 仍可用。
- 備份匯出 / 匯入 schema 與原子性仍受測試保護。
- 採購 reversal 保留原始交易並新增 adjustment。
- 核心 `globalAvgCost`、WAC、工人匯入與製作成本規則仍受測試保護。

Adapter-only tests 必須等 adapter module 建立後才能成為正式 regression tests。

## 10. Migration Boundary

- Adapter API draft 不等於 migration plan 已開始執行。
- 任何 migration track 開始前，必須先有 compatibility tests、backup validation 與 rollback boundary。
- 不得直接全域改寫 storage key。
- 不得直接全域改寫 transaction payload。
- 不得在同一 release 移除 legacy fallback。
- Stable ID、`qtyByLocation`、Location Registry 與 canonical event payload 必須維持 future target / migration target 定位，直到 adapter、tests、backup validation 與 release boundary 均完成。

## 11. 不得寫成 Current Implementation

以下內容不得寫成目前已完成：

- Adapter module 已存在。
- Migration 已開始。
- 系統已全面使用 Stable ID。
- 系統已全面使用 `qtyByLocation`。
- `customLocations` 已全面是 Location Registry object。
- Ledger 已全面使用 canonical event payload。
- `SELL_ITEM` 已是 current implementation。
- Legacy 中文 item key 已可移除。
- Legacy `qtyByCity` 已可移除。
- Legacy transaction payload 已可移除。
- Legacy backup fallback 已可移除。
