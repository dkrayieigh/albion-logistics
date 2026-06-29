# Albion Logistics ERP Transaction Event Model

## 文件定位

本文件定義 transaction / event model 的 migration boundary。它只用來區分 current implementation、future event spec 與 migration boundary，不要求立即改寫 ledger 或 storage。

## Current Implementation

目前系統仍使用 legacy transaction 欄位。

常見欄位：

```js
{
  date: String,
  type: String,
  item: String,
  quality: String,
  qty: Number,
  total: Number,
  unitPrice: Number,
  location: String,
  details: String
}
```

Current transaction type 仍可能是中文，例如：

- `買材料`
- `製作入庫`
- `工人島匯入`
- `賣成品`
- `工人島出售`
- `現金流校正`
- `注資本金`
- `提領利潤`

部分調整紀錄可能已使用 `INVENTORY_ADJUSTMENT`。這是混合狀態，不代表 canonical event payload migration 已完成。

## Future Target

future target 是 canonical event payload。

目標方向：

- 使用穩定 `action` / event name，例如 `PURCHASE_ITEM`、`CRAFT_COMPLETE`、`LABORER_IMPORT`、`INVENTORY_ADJUSTMENT`。
- 使用 canonical item identity，例如 `target`、`itemKey`、`stableId`、`itemLevel`。
- 使用明確 cash / asset 欄位，例如 `cashChange`、`assetValue`。
- 使用 canonical location 欄位，例如 `locationId`、`fromLocationId`、`toLocationId`。
- `details` 可保留為人類可讀說明或 structured metadata，但不得成為唯一資料來源。

此 target 尚未完成 migration。

## SELL_ITEM Boundary

`SELL_ITEM` 目前仍是 future event model，不是 current implementation。

Current implementation：

- 成品出售目前寫入 legacy `賣成品` transaction。
- 工人島物資出售目前寫入 legacy `工人島出售` transaction。
- 目前出售行為已受 regression test 保護，但不代表 canonical `SELL_ITEM` payload 已完成。

Future `SELL_ITEM` 應在 event migration track 中另行定義。

## Cost Adjustment Boundary

Current implementation 仍存在 legacy-compatible 成本校正行為。庫存校正 UI 可能建立 legacy `成本校正` transaction，並直接覆寫該品項的 `globalAvgCost`。

這是 current legacy-compatible behavior，不代表 future canonical event model 已完成。

Migration boundary：

- Future event model 必須把「一般庫存數量調整」與「成本基準調整」分開定義。
- 一般 `INVENTORY_ADJUSTMENT` 不應被假設為可以任意修改 `globalAvgCost`。
- 未來若正式支援成本基準調整，需要獨立事件或明確欄位，例如 `COST_BASIS_ADJUSTMENT` 或等價 future event。
- 不得把目前 legacy `成本校正` 行為直接等同於 future `INVENTORY_ADJUSTMENT` 規格。
- Migration 前不得回溯重算歷史 `globalAvgCost`。
- Migration 前不得刪除 legacy `成本校正` transaction fallback。
- 任何成本基準調整規格都必須先有 regression tests，驗證：
  - 不回溯重算歷史交易。
  - 不破壞既有 `globalAvgCost`。
  - ledger 顯示仍可讀取 legacy `成本校正`。
  - backup import/export 保持相容。

## Ledger Reader Boundary

Migration 前 ledger reader 必須支援 legacy transactions。

原因：

- 現有 localStorage 與 backup 可能保存 legacy transaction 欄位。
- Ledger 搜尋、顯示、採購 reversal 與 regression tests 目前仍依賴 legacy 欄位。
- 直接改寫 payload 會破壞舊資料讀取與歷史紀錄可審查性。

最低要求：

- Reader adapter 能讀取 legacy `type` / `item` / `quality` / `location`。
- Reader adapter 能讀取 future `action` / `target` / `itemLevel` / `locationId`。
- Migration 前後 transaction count、cash impact 與 inventory impact 必須可驗證。

## Migration Preconditions

開始 Transaction/Event migration 前必須具備：

- Legacy transaction reader adapter。
- Canonical event writer boundary。
- Legacy ↔ canonical event mapping。
- Regression tests 覆蓋採購、製作、工人匯入、出售、現金校正、採購 reversal。
- Backup validation，確認舊備份匯入後 ledger 可讀。
- Rollback strategy，保留舊 transactions 並可回復 legacy backup。

## Adapter-First Rule

不得直接全域改寫 `state.transactions` payload。

正確順序：

1. 建立 ledger reader adapter。
2. 保留 legacy transaction 寫入。
3. 新增 canonical event writer 的受控入口。
4. 以 tests 驗證 legacy 與 canonical reader 行為一致。
5. 再規劃資料遷移與 legacy fallback 移除。

## 不得寫成 Current Implementation

以下內容不得寫成目前已完成：

- 系統已全面使用 canonical event payload。
- `SELL_ITEM` 已是 current implementation。
- legacy `type` / `item` / `quality` / `location` 欄位已可移除。
- Ledger reader 已只需要支援 future payload。
- 所有 transaction type 已改為英文 canonical action。
- 所有 backup 已完成 event payload migration。

## Ledger English Presentation Boundary（Future Presentation Layer）

本節只定義 Ledger 顯示層的英文 presentation mapping。Stored legacy/current transaction payload 可保持原值；不得為了顯示英文而重寫歷史 transaction、backup 或 localStorage。

### Stored Payload Boundary

- Stored `type` / `item` / `quality` / `qty` / `total` / `unitPrice` / `location` 可維持 current legacy-compatible payload。
- Ledger Category display 使用 English mapping。
- Ledger Item display 使用 item resolver。
- English display 是 presentation mapping，不是 transaction payload migration。
- Historical transactions 不得因顯示需求被批次覆寫。

### Initial Ledger Category English Mapping

| Stored type / alias | Ledger Category display |
| --- | --- |
| `買材料` | `Material Purchase` |
| `製作入庫` | `Crafting Output` |
| `賣成品` | `Product Sale` |
| `成本校正` | `Cost Adjustment` |
| `庫存刪除` | `Inventory Removal` |
| `現金流校正` | `Cash Balance Adjustment` |
| `注資本金` | `Capital Injection` |
| `提領利潤` | `Profit Withdrawal` |
| `工人島出售` | `Laborer Output Sale` |
| `庫存校正` | `Inventory Adjustment` |
| `INVENTORY_ADJUSTMENT` | `Inventory Adjustment` |

`Inventory Adjustment` 的 source aliases 包含 `庫存校正` 與 `INVENTORY_ADJUSTMENT`。Ledger filter / grouping future behavior 應以 display category 去重，但不得改寫 stored `type`。

### Ledger Item Display Resolver Fallback

Ledger Item display resolver 應依序嘗試：

1. Stable item ID mapping。
2. `ALBION_DB` 的 `enName`。
3. 固定材料英文 mapping。
4. 已經是英文的 source value。
5. 原始值 fallback。

未知品項必須安全 fallback，不得造成 Ledger render crash，也不得 mutate transaction payload。

## Future Cost Adjustment Event Model

Current implementation 仍可能使用 legacy `成本校正` transaction 並直接覆寫 `globalAvgCost`。以下是 future target，不是 current implementation：

```js
{
  type: 'INVENTORY_COST_ADJUSTMENT',
  cashImpact: 0,
  valuationImpact,
  oldUnitCost,
  newUnitCost,
  quantityBasis
}
```

Future model 必須明確區分 cash impact 與 valuation impact：

- `cashImpact` 應為 `0`，因成本基準校正不應表示現金支出。
- `valuationImpact` 記錄資產估值變動。
- `oldUnitCost` / `newUnitCost` / `quantityBasis` 必須保留成本校正證據。
- 這不代表 `INVENTORY_ADJUSTMENT` 已可任意修改 `globalAvgCost`。
- 本階段不修改 stored transaction payload，不回溯重算歷史 `globalAvgCost`，也不移除 legacy `成本校正` fallback。
