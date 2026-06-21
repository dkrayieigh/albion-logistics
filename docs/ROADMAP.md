# Albion Logistics ERP Roadmap

## 文件定位

本文件用來描述 Albion Logistics ERP 從目前 legacy-compatible implementation 過渡到新版資料模型與事件架構的階段計畫。

本文件不是當前實作規格。  
實際 current implementation 仍以 `src` 與 regression tests 為準。  
若本文件與 `IMPLEMENTATION_GAP.md` 衝突，應先回到 `IMPLEMENTATION_GAP.md` 確認目前差異狀態。

Current status 與 regression baseline 請以 `PROJECT_HANDOFF.md` 與實際 `npm test` 結果為準。

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
- Adapter API draft is tracked in `ADAPTER_API.md`.
- 已存在 read-only adapters 可作研究與安全層，但不代表 Location writer/storage migration 已開始。
- Selected Location strategy 是 single-user clean cutover，不需要長期 dual-read / dual-write rollout。

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

在 adapter、測試與事件入口穩定後，才開始資料模型遷移。Location dimension、Stable Item ID 與 canonical transaction/event 是分離 tracks，不得一次同時切換三者。

### Track 分離

- Location dimension：selected strategy 是 single-user clean cutover，建立 new Location schema、new storage key 與 clean initialization flow。
- Stable Item ID：仍是獨立 future track。
- Canonical transaction/event：仍是獨立 future track。

### 原則

- Location clean cutover 不要求 automatic legacy migration。
- Location clean cutover 不要求 dual-write。
- Location clean cutover 不要求完整 legacy backup 轉換。
- Location clean cutover 不要求 cash、transaction count 或全部 legacy inventory key 完全一致。
- Location clean cutover 以 manually initialized inventory、cash、reliable cost basis、empty transactions 與 external legacy backup archive 為基準。
- Stable Item ID 與 canonical event migration 不得和 Location clean cutover 同時執行。
- 必須保留備份與復原方式。
- 詳細 migration track 與 release boundary 請見 `MIGRATION_PLAN.md`。

---

## Phase 6：清除 legacy fallback

### 目標

依 track 策略決定 fallback 移除方式。

### 移除前條件

- 「至少一個 compatible release 後才移除 fallback」只適用採 compatibility migration 的 track。
- 這不適用 selected Location clean-cutover strategy。
- Location legacy data 由舊版 app 與 external backup 保留。
- 新版不得自動刪除 legacy storage。
- 任何 fallback removal 都不得由 incidental refactor 發生。
