# Albion Logistics ERP Current Limitations

## 文件定位

本文件記錄目前系統仍存在的限制、技術債與尚未完成的重構項目。

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

## 4. 出售功能尚未正式規格化

目前 src 已有：

- 成品出售
- 工人島物資出售

但 docs 尚未完整定義：

- 收入事件格式
- 稅務處理
- 損益計算
- ledger 欄位
- 是否影響成本基準

因此出售功能目前屬於 current implementation，但尚未完成正式規格化。

---

## 5. 備份與匯入仍缺正式 schema

目前系統支援 JSON 匯出 / 匯入，但尚未正式定義：

- 備份版本
- 必填欄位
- 選填欄位
- 舊備份相容策略
- 匯入失敗時的原子性
- migration 前後驗證規則

---

## 6. 自訂倉庫仍有資料風險

目前自訂倉庫使用名稱字串作為儲存 key。

已知限制：

- 更名可能牽涉庫存 key 搬移
- 刪除倉庫可能造成該地點庫存欄位消失
- 尚未建立穩定 Location ID
- 尚未有完整 regression test 保護

---

## 7. 現金操作尚未完整規格化

目前存在：

- 現金餘額校正
- 注資 / 提領函式

但尚未完整定義：

- `assets.debt` 的正式用途
- 現金校正事件格式
- 注資與提領是否有 UI 入口
- ledger 顯示規則
- 測試保護範圍

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