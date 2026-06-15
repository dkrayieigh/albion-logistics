# Albion Logistics ERP Current Limitations

## 文件定位
本文件記錄目前系統仍存在的限制、技術債與尚未完成的重構項目。

本文件不是 bug 清單；部分限制是為了維持舊資料相容而刻意保留的 current behavior。

本文件只描述 current implementation 的限制，不代表立即修正計畫。

---

## 1. 資料模型仍為 legacy-compatible implementation

目前 `src` 仍主要使用：

- `qtyByCity`
- 中文 item key，例如 `布料_6.1`
- legacy transaction 欄位：
  - `type`
  - `item`
  - `quality`
  - `qty`
  - `total`
  - `unitPrice`
  - `location`

這些結構仍被 regression tests 保護，因為它們代表目前可用資料與舊備份相容性。

---

## 2. 新版資料模型尚未完成

以下內容屬於 future spec / migration target：

- `qtyByLocation`
- Stable ID
- Location Registry
- 新版 event payload
- 禁止拆解 `itemKey`
- 完整事件中心

目前不得假設這些已經完成。

---

## 3. 成本規則已有部分 regression test 保護

目前已保護：

- 採購入庫建立或更新 `globalAvgCost`
- 全域 WAC
- dormant cost anchor
- 工人匯入不稀釋成本
- 製作引用材料成本
- 製作後材料成本不變
- 成品已有庫存時套用 WAC
- 物流轉移不改成本

目前仍有 TODO：

- 製作材料 `globalAvgCost === null` 時必須阻擋製作

---

## 4. 出售功能為受測的 legacy-compatible behavior

目前 src 已有：

- 成品出售
- 工人島物資出售

穩定版 current implementation 規則已記錄於 `BUSINESS_RULES.md`，且出售成功與主要失敗路徑已有 regression test 保護。

仍未完成：

- 收入事件格式
- 稅務處理
- 損益計算
- ledger 欄位
- 是否影響成本基準

因此出售功能目前可作為 legacy-compatible behavior 使用，但不代表正式 `SELL_ITEM` event model 已完成。

---

## 5. 備份與匯入仍缺正式 schema

目前系統支援 JSON 匯出 / 匯入，新格式、legacy JSON-string backup 與無效資料不得覆寫已有 regression test 保護。

但尚未正式定義：

- 備份版本
- 必填欄位
- 選填欄位
- 舊備份相容策略
- 匯入失敗時的原子性
- migration 前後驗證規則

---

## 6. 自訂倉庫仍使用 legacy location key

目前自訂倉庫使用名稱字串作為儲存 key。

穩定版資料安全限制：

- 非空自訂倉庫不得刪除，必須先轉移或清空庫存。
- 空自訂倉庫仍可刪除。
- 此行為已由 regression test 保護。

Known limitation：

- 更名仍會搬移目前 legacy location name key
- 尚未建立穩定 Location ID
- 尚未完成顯示名稱與儲存 ID 分離

---

## 7. 現金操作尚未完整規格化

目前存在：

- 現金餘額校正
- 注資 / 提領函式

目前 cash / debt 變化、ledger 寫入、無效輸入阻擋與 inventory 不變已有 regression test 保護。

但尚未完整定義：

- `assets.debt` 的正式用途
- 現金校正事件格式
- 注資與提領是否有 UI 入口
- ledger 顯示規則
- `adjustWallet()` 的 UI availability

---

## 8. 本文件的使用方式

當 AI 或開發者準備修改 `src` 前，應先檢查本文件。

若修改涉及以下項目，必須視為高風險：

- 資料模型
- 成本計算
- transaction 格式
- localStorage schema
- 備份匯入
- migration
- 自訂倉庫
- 出售與 cash 流向
