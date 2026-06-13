
## 0. 📖 領域名詞定義總則 (Domain Glossary)
本系統的變數命名與邏輯必須嚴格遵守 Albion Online 的機制定義。

* **裝備階級索引 (`itemLevel`)：** 系統唯一合法的裝備階級/附魔傳遞字串，格式為 `"4.0"`、`"6.2"`。
  * ⛔ **絕對規則：** UI 與核心狀態模組之間不得使用 `tier`、`enchantment` 或 `quality` 作為裝備階級索引。
  * 裝備階級相關邏輯必須統一由 `itemLevel` 處理，且不得將其拆分為多個獨立欄位。
* **顯示與索引用鍵值 (`itemLevel`)：** 系統中用於 UI 顯示與物件 Key 值的字串表示法（String，例："4.0"、"8.4"）。

## 0.1 🧱 庫存不可分割原則 (Inventory Integer Rule)
- 系統中所有物品與材料的 `quantity` 必須為 Integer。
- 任何計算後的材料消耗量都必須進行向上取整，禁止小數點截斷造成的免費材料漏洞。
- RRR 材料消耗公式：
  * `actualConsume = Math.ceil(baseConsume * (1 - RRR))`
  * 這表示材料消耗採「保守扣除」，確保大量製作時不會少扣材料。

## 1. 💰 成本與現金流分離原則 (Cash vs. Asset)
- 採購行為：只有在向市場購買物資時，才扣除現金 (Cash)。
- 製造行為：裝備製作是資產轉換，材料消耗絕對不扣除現金。只扣除店鋪使用費 (Usage Fee) 與額外的神器/鍊金成本。

## 2. 📊 全域均價計算原則 (Global Average Cost)
- 唯一變動時機：全域均價只會在「產生真實現金交易且入庫」時（如採購），透過公式 (現有庫存總值 + 新入庫總成本) / (現有總數量 + 新入庫數量) 進行加權稀釋。
- 手動變動原則：在全域庫存「手動增加/減少」材料數量時，一律強制套用當下該物品的全域均價。均價絕對不因手動校正而改變。

## 3. 🚚 物流轉移原則 (Transport)
- 純數量平移：將物品在不同地點（Location，如城市或自訂黑區地堡）轉移時，只改變該地點的 qtyBylocation。
- 無價值變動：物流轉移絕對不改變全域均價，不產生現金流變化。

## 4. 👷 工人島產出原則 (Laborer Harvest)
- 零現金成本：工人帶回來的資源不扣除現金，也不計算「日誌」的購買與填滿成本（僅做數量控管）。
- 繼承均價機制：產出物庫存匯入總庫存時，自動繼承該資源當前的「全域均價」。不產生任何價值變化（不稀釋均價）。

## 5. ❌ 歷史紀錄不可逆原則 (No Time-Travel for Averages)
- 編輯與刪除 (Operation Log)：當在日誌刪除或編輯歷史紀錄時，系統只負責將「數量」與「現金」以當下的狀態加回/扣除。
- 禁止回溯均價：系統絕對不允許去還原或重算歷史的全域均價。發生錯誤的均價，只能透過未來的「手動庫存校正」功能來拉平。

## 6. 🧮 庫存成本計價方式 (Inventory Costing Method)
**本系統嚴格採用：加權平均成本法 (Weighted Average Cost)。**
絕不採用 FIFO（先進先出）、LIFO（後進先出）或批次成本追蹤。所有物品僅維護唯一一個 `globalAvgCost` 作為成本參考基準。

- **採購入庫時 (`PURCHASE_ITEM`)：** 重新計算 `globalAvgCost`。此為系統中 **唯一** 允許透過公式改變現有均價的事件。
- **物流轉移時 (`TRANSFER_ITEM`)：** 不改變 `globalAvgCost`。
- **工人產出物匯入時 (`LABORER_IMPORT`)：** 只寫入 `qtyByLocation`，絕對不重新計算 `globalAvgCost`。
- **製作消耗材料時 (`CRAFT_COMPLETE`)：** 引用目前 `globalAvgCost` 計算材料成本，**絕對不**重新計算該材料的 `globalAvgCost`。
- **手動庫存校正：** 強制套用當前 `globalAvgCost`，禁止引發均價變動。

## 7. 👷 工人島產出物與價值轉移原則
* **Yield Inventory (產出物暫存區)：** 屬於純內部的暫存庫存，**僅紀錄數量**。絕對不包含 `globalAvgCost`、資產價值與現金流。
* **零成本產出：** 工人完成工作帶回的物資，不計入日誌等隱含成本。
* **成本基準閘門 (HasCostBasis Gate)：** `LABORER_IMPORT` 絕對禁止建立或修改成本基準，只具有 `qtyByLocation` 的寫入權限。
  * 若 `globalAvgCost !== null`：允許匯入，無論當前全域庫存是否為 0，都沿用現有 `globalAvgCost` 作為市場定錨。
  * 若 `globalAvgCost === null`：嚴格禁止匯入，並回報「缺乏真實交易定錨。請先透過採購入庫（PURCHASE_ITEM）建立該物品的首次成本基準。」

## 8. 🧮 庫存歸零重置原則 (Zero-Balance Reset)
當某物品的全域總數量（Global Quantity）降為 `0` 時，該品項的歷史 `globalAvgCost` 進入「休眠定錨狀態 (Dormant Anchor)」。
- 若此時發生 `LABORER_IMPORT`：只喚醒該定錨，`globalAvgCost` 維持不變。
- 若此時發生 `PURCHASE_ITEM`：徹底捨棄該休眠定錨，並以本次 `總花費 / 數量` 直接覆寫成為新的 `globalAvgCost`，完成成本斷點重啟。
- 系統必須直接將該次採購的 `單價 (總花費 / 數量)` 賦予為全新的 `globalAvgCost`，完成成本斷點重啟。