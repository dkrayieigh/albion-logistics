# Albion Logistics ERP Current Limitations

## New-schema backup lifecycle

Status: Active
Risk: High
Affected area: Backup / Storage

Current behavior:

- Production export still uses legacy storage keys.
- Production import still writes legacy storage keys.
- Active v2 key is not yet included in a production backup round-trip.
- Existing backup regression coverage mainly protects the legacy path.

Exit conditions:

- v2 backup envelope / version is defined.
- Active v2 state can be exported.
- v2 import is validated.
- Invalid input causes zero mutation.
- Write failure rollback is covered.
- Export/import round-trip regression exists.
- Legacy backup policy is explicitly documented.
- Manual smoke checklist is complete.

This section documents the limitation only. It does not define implementation code or service API.

Contract reference: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md).

## Factory Reset scope

Status: Active
Risk: High
Affected area: Storage / Reset

Current behavior:

- Reset still uses broad `localStorage.clear()`.
- This can affect keys beyond Albion Logistics if the same origin contains unrelated storage.

Exit conditions:

- Albion Logistics owned storage keys are explicitly defined.
- Reset only removes owned keys.
- Unrelated `localStorage` keys are preserved.
- v2 and explicit legacy mode behavior is documented.
- Cancelled / failed reset causes zero mutation.
- Regression tests and manual smoke checklist are complete.

This section documents the limitation only. It does not define implementation code or service API.

Contract reference: [Backup / Reset Contract](./BACKUP_RESET_CONTRACT.md).

## 文件定位
本文件記錄目前系統仍存在的限制、技術債與尚未完成的重構項目。

本文件不是 bug 清單；部分限制是為了維持舊資料相容而刻意保留的 current behavior。

本文件只描述 current implementation 的限制，不代表立即修正計畫。

---

## Current Status Override：production new-schema runtime

本節覆蓋下方第 2 節中較早的 pre-integration wording。若兩者衝突，以本節為準。

- Production startup/read-write cutover 已完成。
- `albion-logistics-v2-state` 是 new-schema runtime active 時的 production storage key。
- Ready startup 會讀取 new key、project canonical state 到 runtime state、hydrate runtime defaults，並讓 active-runtime `saveState()` 寫入 new key。
- Missing storage + user confirmation 會建立 clean canonical state 並寫入 new key。
- Missing storage + user cancellation 會明確進入 legacy mode。
- Invalid/error startup 會 blocked，不 silent fallback，也不覆寫空資料。
- Legacy mode 仍寫 legacy `albion_crafting_*` localStorage keys。
- Backup import/export 仍是 legacy-only。
- Custom location mutations 尚未接 Location Registry / stable custom ID writer integration。
- Factory Reset 仍使用 broad `localStorage.clear()`。
- 這是 production cutover，不是 legacy data automatic migration、backup schema migration 或 transaction payload migration。

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

Location schema contract 已定義為 future target，但尚未實作：


New-schema storage repository boundary:

- Pure codec and injected repository exist.
- Production startup and active-runtime persistence are implemented; backup integration, custom location writer integration, reset scoping, and migration remain incomplete.
- New-schema runtime uses the new key when active; explicit legacy mode still uses legacy keys.
- This means the new storage key is used by the current app only in active new-schema runtime mode.

- `qtyByLocation` 與 Location Registry 仍不是 current implementation。
- `albion-logistics-v2-state` 已是 active new-schema runtime 的 production storage key。
- explicit legacy mode 仍使用 legacy 分散 localStorage keys。
- Clean initialization、runtime projection、active-runtime save path 與 first-launch confirmation 已實作。
- Pure clean initializer 與 pure new-schema storage codec 已實作並受測。
- Backup integration、custom location writer integration、reset scoping 與 migration 尚未實作。
- 這不代表 legacy data automatic migration、backup schema migration 或 transaction payload migration 已完成。

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
- 製作材料 `globalAvgCost === null` 時阻擋製作

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
- canonical sale event 的 COGS / profit / cost-basis reference 尚未定義

Current legacy sale behavior 不修改 `globalAvgCost`。因此出售功能目前可作為 legacy-compatible behavior 使用，但不代表正式 `SELL_ITEM` event model、canonical laborer sale event 或其 COGS / profit / cost-basis reference 已完成。

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

Clean-cutover backup boundary：

- current app 仍支援 current / legacy backup。
- new-schema backup 尚未實作。
- future new importer 不要求支援 legacy backup。
- legacy backup 由舊版 app 處理。

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
- Future registry contract 已定義，但尚未接入 writer/storage。
- Future custom ID 由 implementation 生成，不由 displayName 推導。

---

## 6. 工人島日誌命名仍有 current / future 邊界

- current legacy journal category key 為 `滿日記本`。
- future canonical journal category 只接受 `滿日誌`。
- 尚未實作轉換或 new writer。
- 不得把 future 名稱誤寫成 current behavior。
- 本限制不改 current legacy src/storage key。

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

## Account-total / Ledger English / Cost Adjustment Limitations

本節只描述目前限制，不代表已開始實作或 migration。

- Products are currently still location-based；成品仍可能依 `qtyByCity` / selected city 寫入、出售與估值。
- Product account-total inventory 尚未實作；成品尚未改為只保存 `totalQty`。
- Special materials are not implemented as dedicated artifact / alchemy account-total inventories。
- Artifact / alchemy Tier-only inventory schema 尚未建立。
- Ledger currently displays stored Chinese type/item values in some paths；Ledger English presentation mapping 尚未完成。
- Ledger English mapping 若實作，應為 presentation-only，不得改寫 stored transaction payload。
- Cost adjustment row may appear as cash expenditure although cash is not changed。
- Future cost adjustment 應改為 `cashImpact: 0` + `valuationImpact`，但本限制文件不代表該事件已完成。
- Delete button compact-icon rule accepted but not implemented。
