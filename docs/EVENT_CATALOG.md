# Albion Logistics ERP 事件目錄 (Event Catalog)

## 🟢 Level 1：內部事件 (Internal Events)
**權限約束：** 僅限於單一 UI 模組內部運作，**絕對禁止**修改 `Inventory` (總庫存)、`Cash` (現金) 與 `Operation Log` (作業日誌)。也不允許觸發均價重算。

#### 事件名稱：`LABORER_HARVEST` (工人收成至暫存區)
**觸發時機：** 點擊工人面板的「收成」按鈕。
**業務目的：** 結算工人帶回的物資數量，並存入工人島專屬的中繼暫存區。

**📥 [輸入參數]**
* `itemType`: Stable ID (例：METALBAR)
* `itemLevel`: 顯示與索引用鍵值 (例：6.0)
* `quantity`: 帶回的數量 (例：300)

**📤 [狀態變更結果]**
1. **Yield Inventory (暫存區數量增加)**
   * `state.laborerInventory[itemType][itemLevel]` 增加 `quantity`。
2. ⛔ **權限封鎖：** 總庫存、均價、現金、作業日誌皆不得有任何變動。

---

## 🔴 Level 2：跨模組事件 (Cross-Module Events)
**權限約束：** 會影響系統核心狀態，必須嚴格遵守會計與庫存價值變動規則。

#### 事件名稱：`LABORER_IMPORT` (產出物匯入總庫存)
**觸發時機：** 在工人島產出物清單中，點擊「匯入」按鈕。
**業務目的：** 將暫存區的物資正式跨越邊界，注入總庫存系統中，並完成數量轉移。

**📥 [輸入參數]**
* `stableId`: 產出物 Stable ID，例如 `METALBAR`
* `itemLevel`: 顯示與索引用鍵值，例如 `"6.0"`
* `itemKey`: `${stableId}_${itemLevel}`，例如 `METALBAR_6.0`
* `targetLocationId`: 匯入的目的地 Location ID，例如 `thetford`
* `quantity`: 匯入數量，例如 `300`

**內部處理規則**
* 執行前必須檢查 `state.inventory[itemKey].globalAvgCost` 是否為 `null`。
* 系統不得透過拆解 `itemKey` 來反推出 `stableId` 或 `itemLevel`。
* `stableId` 與 `itemLevel` 必須由事件 payload 明確提供。
* `itemKey` 必須等於 `${stableId}_${itemLevel}`。
* 若 `itemKey` 與 `${stableId}_${itemLevel}` 不一致，必須阻擋 `LABORER_IMPORT`。
* 若 `globalAvgCost === null`：中斷 `LABORER_IMPORT`，並回報錯誤「缺乏真實交易定錨。請先透過採購入庫（PURCHASE_ITEM）建立該物品的首次成本基準。」。
* 若 `globalAvgCost !== null`：允許匯入，`LABORER_IMPORT` 只具有 `qtyByLocation` 的寫入權限，絕對禁止重新計算 `globalAvgCost`。
* ⛔ `LABORER_IMPORT` 禁止直接沖銷；若需要修正庫存/成本，必須使用 `INVENTORY_ADJUSTMENT`。

**📤 [狀態變更結果]**
1. **Yield Inventory (暫存區扣除)**
   * `state.laborerInventory[stableId][itemLevel]` 減少 `quantity`。
2. **Inventory (總庫存增加)**
   * `state.inventory[itemKey].qtyByLocation[targetLocationId]` 增加 `quantity`。
   * `globalAvgCost` 維持不變，且不觸發加權重算公式。
3. **Cash (現金不變)**
   * `state.assets.cash` 維持不變。
4. **Operation Log (新增作業日誌)**
   * 在 `state.transactions` 頂部新增一筆紀錄。
   * `action`: "LABORER_IMPORT"。
   * `target`: `itemKey`。
   * `cashChange`: 0。
   * `assetValue`: `該批物資繼承的均價總值`。
   * `details`: `"匯入工人島物資，繼承現有均價"`。

#### 事件名稱：`CRAFT_COMPLETE` (完成製作並入庫)
**觸發時機：** 在製作佇列勾選項目後，點擊「開始製作」按鈕。
**業務目的：** 結算材料消耗、計算返還率、扣除製作成本，並將成品寫入對應地點的庫存。

**📥 [輸入參數]**
* `recipeId`: 配方識別碼 (例：`WILDFIRE_STAFF`)，強制使用 `albion_db` 中的索引鍵。
* `itemLevel`: 裝備階級索引字串 (例：`"4.0"`, `"6.2"`)，唯一合法的品質/階級傳遞。
* `locationId`: 製作地點 locationId ID，例如 `thetford` 或 `hideout_001`
* `quantity`: 製作批次數量 (例：10)
* `focusEnabled`: 是否使用專注點 (Boolean)。此欄位為唯一合法命名，禁止使用 `focusMode`。
* `artifactTotalCost`: 該批次神器總成本 (Number，若無則為 0)
* `alchemyTotalCost`: 該批次鍊金總成本 (Number，若無則為 0)
* `usageFee`: 店鋪使用費總額 (Number，即 Albion 系統的預估費用 ((ItemValue * 0.1125) * Fee) / 100)
* ⛔ 禁止傳遞 `tier`、`enchantment` 或 `quality` 參數；系統必須統一使用 `itemLevel` 作為裝備階級索引字串。

**內部處理規則**
* `crafting.js` 必須統一透過 `albion_db[recipeId].category` 取得分類，並以此向 `Location Registry` 詢問加成判定。
* `CRAFT_COMPLETE` 中不得再傳入 `recipeName` 參數。
* ⛔ `CRAFT_COMPLETE` 禁止直接沖銷；若需要修正庫存/成本，必須使用 `INVENTORY_ADJUSTMENT`。

**📤 [狀態變更結果]**
1. **Inventory (材料扣除)**
   * 找到對應 `locationId` 的 `mainMaterial`，數量減少預估消耗量（考量 RRR 後）。
   * 若配方有 `subMaterial`，找到對應 `locationId` 的 `subMaterial`，數量減少預估消耗量（考量 RRR 後）。
   * 約束：材料扣除後不得低於 0，若不足必須在事件觸發前阻擋。
2. **Inventory (成品增加與均價重算)**
   * 找到對應 `locationId` 的 `recipeId_itemLevel`，數量增加 `quantity`。
   * 觸發 `globalAvgCost` 重算：`(本次總成本 + 歷史總庫存總價值) / (本次數量 + 歷史全局總數量)`。
   * 本次總成本 = (`主料消耗量 × 主料全域均價`) + (`副料消耗量 × 副料全域均價`) + `usageFee` + `artifactTotalCost` + `alchemyTotalCost`。
3. **Cash (扣除現金)**
   * `state.assets.cash` 減少 `usageFee + artifactTotalCost + alchemyTotalCost`。
4. **Operation Log (新增作業日誌)**
   * 在 `state.transactions` 頂部新增一筆紀錄。
   * `action`: "CRAFT_COMPLETE"。
   * `target`: `recipeId_itemLevel`。
   * `cashChange`: `-(usageFee + artifactTotalCost + alchemyTotalCost)`。
   * `assetValue`: `本次製造成本總額`。
   * `details`: `"消耗主料x..., 副料x..."`。

#### 事件名稱：`TRANSFER_ITEM` (城市庫存轉移)
**觸發時機：** 在庫存面板中，選擇起訖地點與數量後，點擊「貨運（轉移）」。
**業務目的：** 單純的物理空間轉移，不產生任何資產價值的增減，不影響現金或作業日誌。

**📥 [輸入參數]**
* `itemKey`: `${StableId}_${itemLevel}` (例：METALBAR_4.0)
* `itemLevel`: 顯示與索引用鍵值 (例：4.0)
* `fromLocationId`: 來源地點 Location ID，例如 `fort_sterling`
* `toLocationId`: 目的地點 Location ID，例如 `hideout_001`
* `quantity`: 轉移數量 (例：500)

**📤 [狀態變更結果]**
1. **Inventory (來源地扣除)**
   * 找到 `itemKey` 的物品，在 `fromLocationId` 的數量減少 `quantity`。
   * 約束：轉移數量不得大於來源地現有數量，否則阻擋。
   * 約束：`fromLocationId` 與 `toLocationId` 不得相同
2. **Inventory (目的地增加)**
   * 找到相同物品，在 `toLocationId` 的數量增加 `quantity`。
3. **Global Average Cost (均價不變)**
   * ⛔ 絕對不觸發 `globalAvgCost` 重新計算。
4. **Cash & Operation Log (財務不變)**
   * `state.assets.cash` 維持不變。
   * `state.transactions` 不新增任何作業日誌紀錄。

* ⛔ `TRANSFER_ITEM` 禁止直接沖銷；若需要修正庫存/成本，必須使用 `INVENTORY_ADJUSTMENT`。

#### 事件名稱：`PURCHASE_ITEM` (採購入庫)
**觸發時機：** 在採購面板輸入物品、數量、總花費與地點後，點擊「採購」。
**業務目的：** 系統的資產源頭（Root Event）。將現金轉換為實體庫存資產，並且是系統中**唯一**合法稀釋/重算 `globalAvgCost` 的外部事件。

**📥 [輸入參數]**
* `itemKey`: `${StableId}_${itemLevel}` (例：METALBAR_6.2)
* `itemLevel`: 顯示與索引用鍵值 (例：6.2)
* `locationId`: 採購與入庫地點 (例：thetford)
* `quantity`: 採購數量 (例：100)
* `totalCost`: 該批次總花費銀幣 (例：2,850,000)

**📤 [狀態變更結果]**
1. **Cash (扣除現金)**
   * `state.assets.cash` 減少 `totalCost`。
   * *(約束：即使現金變為負數，系統仍允許執行，視為透支/應付帳款，不阻擋採購)*
2. **Inventory (庫存增加與均價重算)**
   * 找到 `locationId` 下的 `itemKey`，數量增加 `quantity`。
   * **觸發均價重算 (`globalAvgCost`)：**
     * 【條件 A：若原全域總數量 = 0】：`globalAvgCost = totalCost / quantity`。
     * 【條件 B：若原全域總數量 > 0】：`globalAvgCost = (歷史全域總價值 + totalCost) / (歷史全域總數量 + quantity)`。
   * 【補充說明：即便此時 `globalAvgCost` 為 null，條件 A 也會直接以本次採購單價建立成本基準。】
4. **Operation Log (新增作業日誌)**
   * 在 `state.transactions` 頂部新增一筆紀錄。
   * `action`: "PURCHASE_ITEM"。
   * `target`: `itemKey`。
   * `cashChange`: `-totalCost`。
   * `assetValue`: `totalCost`。
   * `details`: `"購買材料 ${itemKey} x ${quantity}"`。

#### 事件名稱：`INVENTORY_ADJUSTMENT` (庫存盤點校正 / 歷史紀錄調整)
**業務目的：** 透過新增一筆調整紀錄修正錯誤庫存、現金或作業日誌差異，保持資料流向單向且不可撤銷。
**適用範圍**
* 修正採購入庫、製作入庫、工人島匯入、城市庫存轉移等事件造成的錯誤。
* UI 上的「刪除歷史紀錄」不得物理刪除原始紀錄，必須轉換為新增 `INVENTORY_ADJUSTMENT`。
* 不得用於時光倒流式沖銷。
* 不得回溯重算或還原歷史 `globalAvgCost`。

**📥 [輸入參數]**
* `sourceTransactionId`: 被修正的原始作業日誌 ID，若為純盤點校正可為 `null`
* `itemKey`: `${stableId}_${itemLevel}`，例如 `METALBAR_6.2`
* `locationId`: 發生校正的 Location ID，例如 `thetford`；若為全局現金校正可填 `"-"`
* `quantityDelta`: 庫存修正差異，可為正數或負數
* `cashDelta`: 現金修正差異，可為正數、負數或 `0`
* `assetValue`: 本次調整涉及的資產價值紀錄，可為 `0`
* `reason`: 調整原因描述

**📤 [狀態變更結果]**
1. **Operation Log**
   * 在 `state.transactions` 頂部新增一筆紀錄。
   * `action`: `"INVENTORY_ADJUSTMENT"`。
   * `target`: `itemKey`。
   * `qty`: `quantityDelta`。
   * `cashChange`: `cashDelta`。
   * `assetValue`: `assetValue`。
   * `locationId`: `locationId`。
   * `details`: 必須包含 `sourceTransactionId` 與 `reason`。
2. **Inventory**
   * 若 `itemKey` 與 `locationId` 有效，則調整 `state.inventory[itemKey].qtyByLocation[locationId] += quantityDelta`。
   * 調整後數量不得小於 `0`。
   * 若調整會導致負庫存，必須阻擋，且現金與作業日誌不得變動。
3. **Cash**
   * `state.assets.cash += cashDelta`。
4. **Global Average Cost**
   * `INVENTORY_ADJUSTMENT` 不得回溯重算歷史均價。
   * 預設不得修改 `globalAvgCost`。
   * 若未來需要校正成本基準，必須在文件中另行定義明確的成本校正事件，不得混入一般庫存調整。

若目前交易紀錄尚未具備唯一 ID，`sourceTransactionId` 可暫以原始紀錄索引或快照資訊表示；是否導入正式 transaction id，待程式碼審查後決定。