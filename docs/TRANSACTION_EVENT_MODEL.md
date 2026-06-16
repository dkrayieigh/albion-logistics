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
