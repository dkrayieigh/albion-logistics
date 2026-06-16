# Albion Logistics ERP Adapter Test Plan

## 文件定位

本文件規劃 adapter-first migration 前置測試清單。

本文件不代表 adapter 已存在，不代表 migration 已開始，也不要求修改 `src`、storage key 或 transaction payload。

Stable ID、`qtyByLocation` 與 canonical event payload 仍是 future target / migration target，不得寫成 current implementation。

本文件只作為未來 adapter / migration 前的測試規劃；本階段不新增正式 test，也不新增 `test.todo`。

Adapter API draft is documented in `ADAPTER_API.md`. Tests in this file are planning anchors only and do not imply adapter implementation exists.

## Current Stable Baseline

- 41 tests / 41 pass / 0 fail / 0 TODO。
- 此 baseline 保護 current legacy-compatible implementation。
- 此 baseline 不代表 Stable ID / `qtyByLocation` / canonical event payload migration 已完成。

## Test Status Legend

| 狀態 | 定義 |
|---|---|
| Covered | 已有 regression test 保護。 |
| Docs-only | 目前只記錄在文件中，不新增 test。 |
| Next test.todo | 下一階段可考慮加入 `test.todo`，但本任務不新增。 |
| Adapter-only | 必須等 adapter module 建立後才能寫正式 test。 |

## Item ID Compatibility

| 測試項目 | 狀態 | 風險 | 下一步處理方式 | 備註 |
|---|---|---|---|---|
| legacy 中文 item key + `qtyByCity` 在核心流程仍可用 | Covered | High | 維持現有 regression test。 | 保護 current legacy-compatible implementation。 |
| legacy 中文 key 特殊字元 / 底線不得被錯誤拆解 | Docs-only | High | 先保留為文件風險，待 adapter 設計前再拆成測試案例。 | 目前不得把禁止拆解 `itemKey` 寫成 current implementation。 |
| mapping 缺失必須明確報錯 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 需等 mapping 規格確認後再落地。 |
| mapping 衝突不得靜默覆寫 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 需先定義衝突處理規則。 |
| item identity adapter 雙讀 legacy 中文 key / Stable ID | Adapter-only | High | 等 item identity adapter module 建立後再寫正式 test。 | Adapter 尚未建立。 |
| adapter 取得 `stableId` / `itemLevel`，不直接拆 `itemKey` | Adapter-only | High | 等 adapter API 定義後再寫正式 test。 | 屬 future adapter behavior。 |

## Location Compatibility

| 測試項目 | 狀態 | 風險 | 下一步處理方式 | 備註 |
|---|---|---|---|---|
| legacy `qtyByCity` 可用於核心庫存、物流、成本流程 | Covered | High | 維持現有 regression test。 | 保護 current storage compatibility。 |
| 物流轉移不改 `globalAvgCost` / cash / ledger | Covered | High | 維持現有 regression test。 | 保護物流只做物理數量平移。 |
| 非空自訂倉庫不得刪除 | Covered | High | 維持現有 regression test。 | 保護 legacy custom location name key 下的資料安全。 |
| 多城市 `qtyByCity` backup 匯入後數量不變 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 屬 backup compatibility 擴充測試。 |
| custom location name key 更名後庫存不遺失 | Docs-only | High | 先保留為文件風險，待更名行為邊界確認後再決定測試。 | 目前先記錄風險，不在本任務新增 test。 |
| location adapter 雙讀 `qtyByCity` / `qtyByLocation` | Adapter-only | High | 等 location adapter module 建立後再寫正式 test。 | Adapter 尚未建立。 |
| migration 前後每個 location 物理數量一致 | Adapter-only | High | 等 adapter sample 與 migration plan 具體化後再寫正式 test。 | 需等 migration/adapter sample 建立後才能驗證。 |

## Transaction / Event Compatibility

| 測試項目 | 狀態 | 風險 | 下一步處理方式 | 備註 |
|---|---|---|---|---|
| 採購 reversal 保留原始交易並新增 adjustment | Covered | High | 維持現有 regression test。 | 保護 legacy ledger data safety。 |
| 庫存不足時阻擋 purchase reversal | Covered | High | 維持現有 regression test。 | 阻擋時不得修改 cash、inventory 或 transactions。 |
| 同一筆採購不可 reversal 兩次 | Covered | High | 維持現有 regression test。 | 保護 repeated reversal 防線。 |
| 成品出售 current legacy transaction 行為 | Covered | High | 維持現有 regression test。 | Current behavior 使用 legacy `賣成品` transaction。 |
| 工人島物資出售 current legacy transaction 行為 | Covered | High | 維持現有 regression test。 | Current behavior 使用 legacy `工人島出售` transaction。 |
| legacy 中文 transaction 顯示 / 搜尋 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 目前仍依賴 legacy transaction 欄位相容。 |
| mixed type + `INVENTORY_ADJUSTMENT` ledger 不崩潰 | Covered | High | Covered by `tests/ledger-data-safety.test.js` via read-only transaction reader adapter. | This covers adapter reader tolerance only; it does not migrate ledger writers or canonical event payload. |
| reader adapter 雙讀 legacy transaction / canonical event | Adapter-only | High | 等 ledger reader adapter 建立後再寫正式 test。 | Adapter 尚未建立。 |
| future event sample 可被 reader adapter 正確顯示 | Adapter-only | High | 等 reader adapter API 與 sample event fixture 定義後再寫正式 test。 | 屬 future reader adapter behavior。 |
| `SELL_ITEM` 不得宣告為 current implementation | Docs-only | Medium | 持續以文件邊界與 release note 標註。 | 目前出售是 legacy-compatible behavior。 |

## Backup Compatibility

| 測試項目 | 狀態 | 風險 | 下一步處理方式 | 備註 |
|---|---|---|---|---|
| 備份匯出 / 匯入 schema 與原子性 | Covered | High | 維持現有 regression test。 | 保護 readable JSON 與匯入失敗不覆寫。 |
| 新舊備份相容 | Covered | High | 維持現有 regression test。 | 保護 current backup compatibility。 |
| 無效資料不得覆寫 `localStorage` | Covered | High | 維持現有 regression test。 | 匯入錯誤必須中斷且保留既有資料。 |
| 含 legacy 中文 item key 的 backup 匯入後 inventory / `globalAvgCost` 不變 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 擴充 legacy backup fixture。 |
| 含 legacy `qtyByCity` 多城市庫存的 backup 匯入後各地點數量不變 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 擴充 location compatibility fixture。 |
| 含 `customLocations` 字串陣列的 backup 匯入後自訂倉庫仍可顯示 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 保護 legacy custom location format。 |
| 含大量 legacy transactions 的 backup 匯入後 transaction count 與 ledger 顯示不變 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 保護 ledger reader 與備份相容。 |
| adapter 讀取 legacy backup 與 future sample backup 的比較測試 | Adapter-only | High | 等 adapter module 與 sample backup fixture 建立後再寫正式 test。 | Adapter 尚未建立。 |
| rollback path 可回復 legacy backup | Adapter-only | High | 等 migration/rollback design 完成後再寫正式 test。 | 需等 migration/rollback design 後驗證。 |

## Cost Basis Compatibility

| 測試項目 | 狀態 | 風險 | 下一步處理方式 | 備註 |
|---|---|---|---|---|
| 首次採購建立 `globalAvgCost` | Covered | High | 維持現有 regression test。 | 保護成本基準建立。 |
| 跨地點全域 WAC | Covered | High | 維持現有 regression test。 | 保護全域庫存加權均價。 |
| dormant cost anchor | Covered | High | 維持現有 regression test。 | 保護零庫存後成本定錨規則。 |
| 工人匯入 `globalAvgCost === null` 時阻擋 | Covered | High | 維持現有 regression test。 | 保護 HasCostBasis gate。 |
| 工人匯入不改 cash / 不重算 `globalAvgCost` | Covered | High | 維持現有 regression test。 | 保護工人島匯入不稀釋成本。 |
| 製作消耗引用材料 `globalAvgCost` | Covered | High | 維持現有 regression test。 | 保護材料成本引用規則。 |
| 材料 `globalAvgCost === null` 時阻擋製作 | Covered | High | 維持現有 regression test。 | 保護 TEST-A07。 |
| 物流轉移不改成本、不改 cash、不新增 ledger | Covered | High | 維持現有 regression test。 | 保護物流無財務副作用。 |
| 一般 `INVENTORY_ADJUSTMENT` 不得誤作成本校正 | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 成本基準校正需另依 Cost Adjustment Boundary 定義。 |
| purchase reversal 不得回溯重算 `globalAvgCost` | Next test.todo | High | 下一階段可新增 `test.todo`，但本任務不新增。 | 保護歷史成本不可回溯重算。 |
| adapter 轉譯前後 `globalAvgCost` 不變 | Adapter-only | High | 等 adapter module 建立後再寫正式 test。 | Adapter 尚未建立。 |

## Non-goals

- 不要求 `src` 修改。
- 不要求 `tests` 修改。
- 不要求 migration。
- 不要求 storage key 改寫。
- 不要求 transaction payload 改寫。
- 不要求 adapter 已存在。
- 不移除 legacy fallback。
