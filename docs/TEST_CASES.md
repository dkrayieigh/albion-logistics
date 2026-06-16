# 🛡️ Albion Logistics ERP 回歸測試檢核表 (TEST_CASES.md)
**測試守則：**  
這份清單是系統的最後防線。每次修改 `src`、成本計算、庫存流程、ledger、資料模型或備份匯入相關邏輯後，必須先執行 `npm test`。  
發布新版本前，仍需依照本文件進行必要 UI 手動測試。  
如果 regression test 或手動測試不符合「預期結果」，一律退回重改。

## 自動化測試狀態
目前 `package.json` 已建立 Node.js regression tests
```bash
npm test
```

### Stable release baseline

- 指令：`npm.cmd test`
- 結果：**37 tests / 36 pass / 0 fail / 1 TODO**
- TODO：材料 `globalAvgCost === null` 時阻擋製作。
- 此基準只描述目前可執行 regression tests，不代表 future data model 或 event payload migration 已完成。

## 🔴 Level A：核心生命線 (每次 Commit 必測)
- 只要這裡有一項沒過，系統就會發生嚴重的財務與庫存災難。

#### TEST-A01：採購入庫 (測試全域均價與現金稀釋)
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 覆蓋首次採購建立 `globalAvgCost`、扣現金、增加庫存與寫入 ledger。

**📥 [前置狀態]**
* 系統現金餘額：0
* T6.2 鋼條（locationId: `thetford`）：庫存 0，globalAvgCost: null

**🧪 [使用者操作]**
* 在採購模組，買入 200 個 T6.2 鋼條。
* 選擇城市：Thetford（locationId: `thetford`）。
* 總花費輸入：5,800,000。

**📤 [預期結果]**
* ✅ 現金變化：0 變成 -5,800,000。
* ✅ 庫存變化：Thetford（locationId: `thetford`） 的 T6.2 鋼條數量從 0 變成 200。
* ✅ 全域均價：T6.2 鋼條的 globalAvgCost 從 null 建立為 29,000。
* ✅ 作業日誌：新增一筆「購買材料」的支出紀錄。

---
#### TEST-A02：物流轉移 (測試物理平移與價值鎖定)
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 覆蓋正常物流轉移與來源庫存不足阻擋。
- 確認物流轉移只移動庫存，不改 `globalAvgCost`、不改 cash、不新增 ledger。

**📥 [前置狀態]**
* 系統現金餘額：-5,800,000
* T6.2 鋼條（Thetford）：庫存 200，全域均價 29.000
* T6.2 鋼條（Bridgewatch）：庫存 0

**🧪 [使用者操作]**
* 在物流模組，選擇轉移 100 個 T6.2 鋼條。
* 起點：Thetford（fromLocationId: `thetford`）➡️ 終點：Bridgewatch（toLocationId: `bridgewatch`）。

**📤 [預期結果]**
* ✅ 庫存變化（來源地）：Thetford（locationId: `thetford`） 數量 200 變成 100。
* ✅ 庫存變化（目的地）：Bridgewatch 數量 0 變成 100。
* ✅ 全域均價（防呆）：T6.2 鋼條均價必須維持 29,000 不變。
* ✅ 財務變化（防呆）：現金必須維持 -5,800,000 不變，作業日誌不新增任何紀錄。

---
#### TEST-A03：製作入庫 (測試資產轉換與成本匯聚)
**Automation：Partial**
- `tests/core-cost-regression.test.js`
- 已覆蓋製作消耗引用材料 `globalAvgCost`、材料 `globalAvgCost` 不變、成品入庫成本計算，以及成品已有庫存時套用 WAC。
- UI 操作流程、RRR 顯示與實際配方選擇仍需手測。

**📥 [前置狀態]**
* 系統現金餘額：10,000,000
* T6.1 鋼條：庫存 100，全域均價 8,000
* T6.1 布料：庫存 50，全域均價 6,000

**🧪 [使用者操作]**
* 在製作模組，選擇製作 10 把需要鋼條（主料）與布料（副料）的武器。
* 選擇城市：Thetford（locationId: `thetford`）。
* 系統預估稅金/使用費：5,000。
* 點擊「開始製作」。

**📤 [預期結果]**
* ✅ 材料庫存：T6.1 鋼條與 T6.1 布料庫存正確減少（需符合扣除 RRR 後的預估消耗量）。
* ✅ 成品庫存：Thetford（locationId: `thetford`） 的該武器庫存增加 10。
* ✅ 現金變化：現金只扣除 5,000（稅金），絕對不扣材料的錢，現金變成 9,995,000。
* ✅ 成品均價：該武器的全域均價被正確計算（計算公式包含消耗的材料均價總和 + 稅金）。
* ✅ 作業日誌：新增一筆「製作入庫」紀錄，且紀錄的總價值為正確的製造成本總和。

---
#### TEST-A04：第二次採購入庫（均價稀釋驗證）
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 覆蓋跨地點全域庫存 WAC。
- 注意：自動測試資料包含 Thetford 與 Bridgewatch 既有庫存，因此期望值與本手測案例不同，但保護的是同一條規則：採購均價必須以全域總庫存計算。

**📥 [前置狀態]**
* T6.2鋼條（Thetford）：庫存 100，全域均價 29.000
* 系統現金餘額：-5,800,000

**🧪 [使用者操作]**
* 在採購模組，買入 100 個 T6.2 鋼條。
* 選擇城市：Thetford。
* 總花費輸入：2,850,000。

**📤 [預期結果]**
* ✅ 現金變化：-5,800,000 變成 -8,650,000。
* ✅ 庫存變化：Thetford 的 T6.2 鋼條數量從 100 變成 200。
* ✅ 全域均價：T6.2 鋼條的均價從 29,000 變成 28,750。計算:(100 × 29000 + 100 × 28500)÷ 200 = 28750
* ✅ 作業日誌：新增一筆「購買材料」的支出紀錄。

---
#### TEST-A05：材料不足阻擋製作
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 覆蓋材料不足時阻擋製作，且不得修改 cash、庫存、transactions 或 craftingQueue。

**📥 [前置狀態]**
* T6.3皮革 (Thetford) :庫存10

**🧪 [使用者操作]**
* 製作需要 :T6.3 皮革，數量 16
* 在製作佇列勾選項目後，點擊「開始製作」按鈕。

**📤 [預期結果]**
* ✅ 製作佇列: 不進入結算
* ✅ 現金變化: 不扣現金
* ✅ 作業日誌: 不新增紀錄
* ✅ 庫存變化: 不新增成品

---
#### TEST-A06：零庫存重新建立均價 (破除幽靈成本)
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 覆蓋零庫存時新採購不得沿用 dormant cost anchor。

**📥 [前置狀態]**
* T6.2 鋼條：全域總庫存 `0`，globalAvgCost 仍為 `29,000`（Dormant Anchor，休眠定錨狀態）
* 系統現金餘額：`5,000,000`

**🧪 [使用者操作]**
* 在採購模組，買入 `50` 個 T6.2 鋼條。
* 選擇城市：Thetford。
* 總花費輸入：`2,000,000`。

**📤 [預期結果]**
* ✅ 全域均價：T6.2 鋼條的均價必須被**直接重設為 `40,000`** (2,000,000 / 50)。
* ❌ 絕對不可：算出 `34,500` 或其他被 `29,000` 污染的奇怪數值。
* ✅ 庫存變化：Thetford 數量變成 `50`。

---
#### TEST-A07：材料 globalAvgCost 為 null 時阻擋製作
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 已由 `tests/core-cost-regression.test.js` 正式覆蓋。
- 覆蓋材料數量充足但必要材料 `globalAvgCost === null` 時，製作必須阻擋。
- 驗證不得消耗材料、不得新增成品、不得扣 cash、不得新增 transaction，且 craftingQueue 必須保留。

**📥 [前置狀態]**
* 製作所需材料庫存數量充足。
* 至少一種必要材料的 `globalAvgCost === null`。
* 成品庫存可為 0 或已有庫存。

**🧪 [使用者操作]**
* 在製作佇列勾選該項目。
* 點擊「開始製作」。

**📤 [預期結果]**
* ✅ 製作必須被阻擋。
* ✅ 不得消耗任何材料。
* ✅ 不得新增成品庫存。
* ✅ 不得扣除 cash。
* ✅ 不得新增 ledger transaction。
* ✅ 必須提示使用者該材料缺少成本基準。
* ✅ 製作佇列應保留原項目，不得因失敗預檢而清空。

## 🟡 Level B：重要功能 (發布新版本前必測)
這些功能影響長期的資料正確性與備份安全。

---
#### TEST-B01：工人島匯入 (無成本繼承)
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 覆蓋 `globalAvgCost === null` 時阻擋工人匯入。
- 覆蓋工人匯入不改 cash、不重算 `globalAvgCost`。
- 覆蓋工人匯入喚醒 dormant cost anchor 時仍維持原成本基準。

**📥 [前置狀態]**
* 暫存區 (Yield Inventory)：T6.2 鋼條 5 個。
* 總庫存 (Thetford)：T6.2 鋼條 100 個，全域均價 29,000。

**🧪 [使用者操作]**
* 在工人島模組點擊「匯入」：
  * stableId: `METALBAR`
  * itemLevel: `"6.2"`
  * itemKey: `METALBAR_6.2`
  * quantity: `5`
  * targetLocationId: `thetford`

**📤 [預期結果]**
* ✅ 暫存區 T6.2 鋼條扣除 5。
* ✅ 總庫存 Thetford 增加 5（變成 105）。
* ✅ 最重要防呆：T6.2 鋼條全域均價必須維持 29,000 不變（不可稀釋）。
* ⚠️ future spec：未來正式事件模型應使用 `stableId` 與 `itemLevel` 扣除暫存區，不得透過拆解 `itemKey` 反推。
* current implementation：目前 regression test 仍保護 legacy 中文 item key 與 `qtyByCity` 可用性，不代表 Stable ID 遷移已完成。

---
#### TEST-B02：歷史作業日誌刪除轉調整紀錄
**Automation：Covered**
- `tests/ledger-data-safety.test.js`
- 覆蓋採購刪除轉 `INVENTORY_ADJUSTMENT`。
- 確認原始採購紀錄保留、庫存扣除、cash 加回、`globalAvgCost` 不回溯重算。

**📥 [前置狀態]**
* 有一筆錯誤的 legacy 採購紀錄：
  * `type: "買材料"`
  * item: T6.1 布料
  * qty: 500
  * total: 3,000,000
  * location: Thetford
* 該筆紀錄仍存在於 `state.transactions`。
* T6.1 布料目前庫存至少 500。

**🧪 [使用者操作]**
* 在作業日誌模組，點擊該筆紀錄的「🗑️ 刪除」。

**📤 [預期結果]**
* ✅ 原始 legacy 採購紀錄不得從 `state.transactions` 移除。
* ✅ 系統新增一筆 `INVENTORY_ADJUSTMENT`。
* ✅ 系統現金加回 3,000,000。
* ✅ T6.1 布料的庫存扣除 500。
* ✅ `globalAvgCost` 不得回溯重算。
* ✅ 新增調整紀錄的 `details` 必須記錄原始交易來源。

---
#### TEST-B03：歷史作業日誌調整與負庫存防禦
**Automation：Covered**
- `tests/ledger-data-safety.test.js`
- 覆蓋庫存不足時阻擋 purchase reversal。
- 確認不新增 adjustment，不修改 cash、inventory 或 transactions。

**📥 [前置狀態]**
* 歷史紀錄：花費 3,000,000 買了 500 個 T6.1 布料。
* 當前庫存：T6.1 布料僅剩 200 個（已有 300 個被做成裝備）。

**🧪 [使用者操作]**
* 在作業日誌模組，對該筆採購紀錄點擊「🗑️ 刪除」。

**📤 [預期結果]**
* ✅ 系統阻擋：彈出錯誤提示「庫存不足 500，已被消耗無法調整」。
* ✅ 原始歷史紀錄不移除。
* ✅ 不新增 `INVENTORY_ADJUSTMENT`。
* ✅ 現金、庫存、作業日誌皆不發生變動。
* ✅ `globalAvgCost` 不得重算。

---
#### TEST-B04：資料匯出與匯入 (生存確認)
**Automation：Covered**
- `tests/backup-regression.test.js`
- 覆蓋 readable JSON 匯出、新格式匯入、legacy JSON-string backup 相容，以及無效備份不得覆寫既有 `localStorage`。
- 正式版本化 backup schema 仍屬 docs debt，不代表資料格式 migration 已完成。

**🧪 [使用者操作]**
* 點擊「匯出資料」，下載 JSON 檔案。
* 清空瀏覽器快取（或點擊重置系統）。
* 上傳剛剛的 JSON 檔案「匯入」。

**📤 [預期結果]**
* ✅ 所有庫存數量、全域均價、現金流與歷史作業日誌完全一字不差地恢復。

---
#### TEST-B05：Legacy Data Compatibility（舊資料相容）
**Automation：Partial**
- `tests/core-cost-regression.test.js`
- 已覆蓋 legacy 中文 item key + `qtyByCity` 在物流轉移中仍可用。
- 尚未覆蓋完整備份匯入、舊 transaction 顯示、舊 `customLocations` 與完整 migration 流程。

**📥 [前置狀態]：**
* 使用 legacy 中文 item key，例如 `布料_6.1`。
* 庫存仍使用 `qtyByCity`。
* 交易紀錄仍使用目前 legacy transaction 欄位，例如 `type`、`item`、`quality`、`qty`、`total`、`unitPrice`、`location`。

**🧪 [使用者操作]：**
* 執行目前支援 legacy 結構的既有操作，例如物流轉移或 ledger 顯示。
* 不執行 Stable ID / `qtyByLocation` / 新版 event payload migration。

**📤 [預期結果]：**
* ✅ legacy 中文 item key 仍可被正確讀取。
* ✅ `qtyByCity` 庫存仍可被正確操作。
* ✅ legacy transaction 仍可被 Ledger 顯示或查詢。
* ✅ 操作不得破壞現有 `globalAvgCost`。
* ⚠️ 本測試只驗證舊資料相容，不代表 Stable ID、`qtyByLocation` 或新版 event payload 遷移已完成。

---
#### TEST-B06：TODO - LABORER_IMPORT 禁止拆解 itemKey
**Automation：TODO**
- 目前尚未被 regression test 覆蓋。
- 此案例屬 future spec / migration target，不代表 current implementation 已完成。
- 在 Stable ID 與 legacy 中文 key 相容層建立前，不應要求 src 直接改成只接受新版格式。

**📥 [前置狀態]**
* 暫存區存在可匯入項目。
* 事件 payload 同時明確提供：
  * `stableId`
  * `itemLevel`
  * `itemKey`
  * `quantity`
  * `targetLocationId`

**🧪 [使用者操作]**
* 執行未來新版 `LABORER_IMPORT` 事件。

**📤 [預期結果]**
* ✅ 系統使用 `stableId` 與 `itemLevel` 定位暫存區資料。
* ✅ 系統不得使用 `itemKey.split("_")` 反推 `stableId` 或 `itemLevel`。
* ✅ 匯入後不改 cash。
* ✅ 匯入後不重算 `globalAvgCost`。
* ⚠️ 此測試需等 adapter / compatibility layer 建立後再正式落地。

---
#### TEST-B07：同一採購紀錄不得重複撤銷
**Automation：Covered**
- `tests/ledger-data-safety.test.js`
- 覆蓋同一筆採購不可 reversal 兩次。
- 覆蓋第一次 reversal 後 UI 不再顯示 adjustment 刪除入口。
- 覆蓋直接呼叫刪除流程時仍會被阻擋。

**📥 [前置狀態]**
* 有一筆 `買材料` / 採購入庫紀錄：
  * item: T6.1 布料
  * qty: 500
  * total: 3,000,000
  * location: Thetford
* Thetford 的 T6.1 布料庫存為 1,200，足以撤銷兩次。
* 現金餘額為 0。
* 該筆採購紀錄尚未被 adjustment 處理。

**🧪 [使用者操作]**
1. 第一次在 Ledger 點擊該採購紀錄的「刪除」。
2. 重新渲染 Ledger。
3. 嘗試對同一筆採購紀錄再次執行刪除。

**📤 [預期結果]**

第一次刪除：
* 原始 transaction 保留。
* 新增一筆 `INVENTORY_ADJUSTMENT`。
* 庫存只扣除一次：1,200 → 700。
* 現金只加回一次：0 → 3,000,000。
* `globalAvgCost` 不變。
* adjustment details 必須包含來源資訊，例如 `sourceSignature`。

第二次刪除：
* 已撤銷的採購紀錄不再顯示「刪除」按鈕。
* 若直接觸發 `deleteEditLedger()`，也必須被阻擋。
* 不新增第二筆 adjustment。
* 庫存不再變動。
* 現金不再變動。
* transactions 長度不再增加。
* `globalAvgCost` 不變。

---
#### TEST-B08：自訂倉庫刪除資料安全
**Automation：Covered**
- `tests/core-cost-regression.test.js`
- 覆蓋非空自訂倉庫不得刪除，以及空自訂倉庫可刪除且不影響其他狀態。

**📥 [前置狀態]**
* 建立一個自訂倉庫。
* 分別準備「仍有庫存」與「所有庫存皆為 0 或不存在」兩種情境。

**📤 [預期結果]**
* ✅ 非空自訂倉庫刪除時顯示 error toast，且 `customLocations`、inventory、transactions、assets 均不變。
* ✅ 空自訂倉庫可以刪除。
* ⚠️ 此案例保護 current implementation 的 legacy location name key，不代表 Location ID migration 已完成。

## 🟢 Level C：UI 與體驗 (有空再測)
影響操作體驗，但不會毀滅資料。

#### TEST-C01：切換配方時，主料與副料的需求文字是否正確切換。

#### TEST-C02：自訂黑區地堡新增後，各大下拉式選單是否即時更新。

#### TEST-C03：輸入數字時，千分位逗號不會讓游標亂跳。

**🧪 [使用者操作]**
* 在任一 `.format-num` 數字欄位中間插入或刪除數字。

**📤 [預期結果]**
* ✅ 欄位即時顯示千分位格式。
* ✅ 游標維持在對應輸入位置，不會固定跳到欄位尾端。
* ✅ 此 UI 格式化不改變底層資料格式。

#### TEST-C04：專注點參數命名與 RRR 計算

**📥 [前置狀態]**
* 選擇任一可製作配方。
* 製作地點、日加成、地堡能量皆固定不變。
* 材料庫存充足。

**🧪 [使用者操作]**
* 第一次製作預估：`focusEnabled = false`。
* 第二次製作預估：`focusEnabled = true`。

**📤 [預期結果]**
* ✅ 系統只讀取 `focusEnabled` 作為專注點判斷欄位。
* ✅ `focusEnabled = true` 時，RRR 高於 `focusEnabled = false`。
* ✅ 材料預估消耗量不得出現小數，必須符合 `Math.ceil(baseConsume * (1 - RRR))`。
* ❌ 系統不得依賴或讀取 `focusMode`。

---
#### TEST-C05：製作配方分類與搜尋

**🧪 [使用者操作]**
* 開啟配方選擇器，切換任一分類。
* 輸入可找到配方的名稱關鍵字，再輸入不存在的關鍵字。

**📤 [預期結果]**
* ✅ 分類頁籤只顯示所屬配方。
* ✅ 搜尋結果隨關鍵字更新，不存在的關鍵字顯示空結果。
* ✅ 搜尋與分類不修改庫存、現金或交易紀錄。

---
#### TEST-C06：庫存與帳本搜尋

**前置說明：** 帳本搜尋為 **current implementation / legacy-compatible behavior**，目前依舊版 transaction 顯示欄位運作。

**🧪 [使用者操作]**
* 在庫存搜尋輸入物品名稱或階級。
* 在帳本搜尋輸入日期、目前交易類型文字或項目名稱。
* 清空兩個搜尋欄位。

**📤 [預期結果]**
* ✅ 搜尋期間只顯示符合條件的資料。
* ✅ 清空搜尋後恢復顯示全部資料。
* ✅ 搜尋不修改任何狀態或持久化資料。

---
#### TEST-C07：帳本與工人紀錄分頁

**📥 [前置狀態]**
* 帳本與工人收成紀錄各至少有 11 筆資料。

**🧪 [使用者操作]**
* 在帳本與工人紀錄分別點擊下一頁與上一頁。

**📤 [預期結果]**
* ✅ 每頁最多顯示 10 筆。
* ✅ 頁數資訊正確更新。
* ✅ 翻頁不修改紀錄內容、順序或持久化資料。

---
#### TEST-C08：銷售估價參考值

**前置說明：** 本案例只驗證 UI 參考值，不代表 `SELL_ITEM` 正式事件規格已完成。

**🧪 [使用者操作]**
* 開啟任一成品的估價與銷售畫面。
* 在總預估市值輸入 `100,000`。
* 修改銷售數量、單價或總價。

**📤 [預期結果]**
* ✅ 90% 參考值顯示 `90,000`。
* ✅ 85% 參考值顯示 `85,000`。
* ✅ 單價與總價互相換算，並更新目前介面使用的扣除稅額後預估。
* ✅ 在確認交易前，參考值不修改庫存、現金或交易紀錄。

---
#### TEST-C09：`stateUpdated` UI 更新事件

**🧪 [使用者操作]**
* 執行會呼叫目前 `saveState()` 的既有操作。

**📤 [預期結果]**
* ✅ 狀態中心發送 `stateUpdated`。
* ✅ 城市下拉選單、儀表板、庫存與工人島相關畫面重新顯示目前狀態。
* ✅ `stateUpdated` 只作為 UI 更新通知，不被視為業務交易事件。

---
#### TEST-C10：採購物品自動建議城市

**前置說明：** 此為 **current implementation / legacy-compatible behavior**，只記錄目前 UI 建議值。

**🧪 [使用者操作]**
* 在採購畫面依序選擇鋼條、布料、板材與皮革。
* 自動選擇城市後，手動改選其他城市。

**📤 [預期結果]**
* ✅ 鋼條建議 Thetford、布料建議 Lymhurst、板材建議 Fort Sterling、皮革建議 Martlock。
* ✅ 使用者可以覆寫建議城市。
* ✅ 建議城市不限制正式採購地點。

---
#### TEST-C11：Tauri 視窗控制

**🧪 [使用者操作]**
* 在 Tauri 桌面版依序點擊最小化、最大化切換與關閉按鈕。
* 在瀏覽器預覽環境點擊視窗控制。

**📤 [預期結果]**
* ✅ Tauri 桌面版執行對應視窗操作。
* ✅ 瀏覽器預覽環境不呼叫不存在的 Tauri API。
* ✅ 瀏覽器預覽的關閉按鈕只顯示模擬提示。
