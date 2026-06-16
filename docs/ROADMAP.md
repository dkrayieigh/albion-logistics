# Albion Logistics ERP Roadmap

## 文件定位

本文件用來描述 Albion Logistics ERP 從目前 legacy-compatible implementation 過渡到新版資料模型與事件架構的階段計畫。

本文件不是當前實作規格。  
實際 current implementation 仍以 `src` 與 regression tests 為準。  
若本文件與 `IMPLEMENTATION_GAP.md` 衝突，應先回到 `IMPLEMENTATION_GAP.md` 確認目前差異狀態。

目前 stable regression baseline 請以 `TEST_CASES.md` 的 Stable release baseline 為準。

---

## Phase 0：現況保護與文件同步

### 目標

在不改變 `src` 行為的前提下，先建立目前系統的保護網。

### 已完成

- 建立 `docs/IMPLEMENTATION_GAP.md`
- 建立 Node.js regression tests
- `package.json` 新增 `npm test`
- 覆蓋核心成本規則：
  - 首次採購建立 `globalAvgCost`
  - 跨地點全域 WAC
  - dormant cost anchor
  - 工人匯入成本規則
  - 製作材料消耗與成品 WAC
  - 物流轉移不改成本、不改 cash、不新增 ledger
  - legacy 中文 item key + `qtyByCity` 相容
- 覆蓋 ledger data safety：
  - 採購刪除轉 adjustment
  - 庫存不足時阻擋 reversal
  - 同一筆採購不可 reversal 兩次
- 覆蓋封版資料安全與出售流程：
  - TEST-A07：材料 `globalAvgCost === null` 時阻擋製作
  - 成品出售測試
  - 工人島物資出售測試
  - 備份匯入 / 匯出 regression test
  - 自訂倉庫刪除測試
  - 現金校正 / 注資 / 提領測試

---

## Phase 1：補齊 current implementation 文件

### 目標

把目前 `src` 已存在、但 docs 尚未正式承認的功能補入文件。

### 範圍

- 成品出售
- 工人島物資出售
- 銷售估價工具
- 自訂倉庫更名與刪除
- 現金餘額校正
- 工人島手動管理
- 製作搜尋、分類、購物清單、佇列管理
- 備份匯出 / 匯入
- Factory Reset
- Tauri 視窗控制

### 原則

- 只能描述 current implementation。
- 不得把 Stable ID、`qtyByLocation`、新版 event payload 寫成已完成。
- 遇到舊格式行為，必須標註 `legacy-compatible behavior`。

---

## Phase 2：測試保護補強

### 目標

在開始重構前，補上會影響資料安全的 regression tests。

### 已完成

- TEST-A07：材料 `globalAvgCost === null` 時阻擋製作。
- 成品出售 regression test。
- 工人島物資出售 regression test。
- 備份匯入 / 匯出 regression test。
- 自訂倉庫刪除 regression test。
- 現金校正 / 注資 / 提領 regression test。

### 仍待補強

- Factory Reset regression test。

---

## Phase 3：建立 compatibility layer

### 目標

讓新程式碼可以透過統一介面讀取舊資料。

### 預期處理

- `qtyByCity` / `qtyByLocation`
- 中文 item key / Stable ID
- 字串 `customLocations` / Location Registry
- legacy transaction / 新版 event payload

### 原則

- 不直接破壞舊資料。
- 不一次性全域取代欄位。
- 先讀取相容，再考慮寫入遷移。
- 詳細 migration boundary 請見 `MIGRATION_PLAN.md`。

---

## Phase 4：集中事件與成本規則

### 目標

讓 UI 不再直接修改庫存、cash、ledger，而是提交明確事件。

### 預期事件

- `PURCHASE_ITEM`
- `CRAFT_COMPLETE`
- `LABORER_IMPORT`
- `SELL_ITEM`
- `INVENTORY_TRANSFER`
- `INVENTORY_ADJUSTMENT`
- `CASH_ADJUSTMENT`

### 原則

- `globalAvgCost` 更新規則必須集中。
- 製作只能引用材料成本，不得重算材料成本。
- 物流轉移不得改成本。
- 工人匯入不得稀釋成本。
- 一般庫存調整不得暗中修改成本基準。

---

## Phase 5：資料模型遷移

### 目標

在 adapter、測試與事件入口穩定後，才開始資料模型遷移。

### 遷移項目

- `qtyByCity` → `qtyByLocation`
- 中文 item key → Stable ID
- 字串 `customLocations` → Location Registry
- legacy transaction → 新版 event payload

### 原則

- 必須有 migration 測試。
- 必須可驗證遷移前後：
  - 總庫存一致
  - cash 一致
  - transaction 數量一致
  - `globalAvgCost` 一致
- 必須保留備份與復原方式。
- 詳細 migration track 與 release boundary 請見 `MIGRATION_PLAN.md`。

---

## Phase 6：清除 legacy fallback

### 目標

在至少一個穩定相容版本後，才移除舊格式 fallback。

### 移除前條件

- 所有舊資料樣本可成功遷移。
- regression tests 完整覆蓋。
- UI 不再直接依賴舊欄位。
- 備份匯入可辨識版本。
- 使用者有明確備份方式。
