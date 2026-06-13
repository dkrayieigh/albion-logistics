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
* `itemKey`: `${StableId}_${itemLevel}` (例：METALBAR_6.0)
* `targetLocation`: 匯入的目的地城市 (例：Thetford)
* `quantity`: 匯入數量 (例：300)

**內部處理規則**
* 執行前必須檢查 `state.inventory[itemKey].globalAvgCost` 是否為 `null`。
* 若 `globalAvgCost === null`：中斷 `LABORER_IMPORT`，並回報錯誤「缺乏真實交易定錨。請先透過採購入庫（PURCHASE_ITEM）建立該物品的首次成本基準。」。
* 若 `globalAvgCost !== null`：允許匯入，`LABORER_IMPORT` 只具有 `qtyByLocation` 的寫入權限，絕對禁止重新計算 `globalAvgCost`。
* ⛔ `LABORER_IMPORT` 禁止直接沖銷；若需要修正庫存/成本，必須使用 `INVENTORY_ADJUSTMENT`。

**📤 [狀態變更結果]**
1. **Yield Inventory (暫存區扣除)**
   * `state.laborerInventory[itemType][itemLevel]` 減少 `quantity`。*(若不足則阻擋)*
2. **Inventory (總庫存增加)**
   * 找到 `targetLocation` 下的 `itemKey`，數量增加 `quantity`。
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
* `location`: 製作地點 (例：Thetford 或 舊黑區地堡)
* `quantity`: 製作批次數量 (例：10)
* `focusEnabled`: 是否使用專注點 (Boolean)
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
   * 找到對應 `location` 的 `mainMaterial`，數量減少預估消耗量（考量 RRR 後）。
   * 若配方有 `subMaterial`，找到對應 `location` 的 `subMaterial`，數量減少預估消耗量（考量 RRR 後）。
   * 約束：材料扣除後不得低於 0，若不足必須在事件觸發前阻擋。
2. **Inventory (成品增加與均價重算)**
   * 找到對應 `location` 的 `recipeId_itemLevel`，數量增加 `quantity`。
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
* `fromLocation`: 來源地點 (例：Fort Sterling)
* `toLocation`: 目的地點 (例：自訂黑區地堡)
* `quantity`: 轉移數量 (例：500)

**📤 [狀態變更結果]**
1. **Inventory (來源地扣除)**
   * 找到 `itemKey` 的物品，在 `fromLocation` 的數量減少 `quantity`。
   * 約束：轉移數量不得大於來源地現有數量，否則阻擋。
   * 約束：`fromLocation` 與 `toLocation` 不得相同。
2. **Inventory (目的地增加)**
   * 找到相同物品，在 `toLocation` 的數量增加 `quantity`。
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
* `location`: 採購與入庫地點 (例：Thetford)
* `quantity`: 採購數量 (例：100)
* `totalCost`: 該批次總花費銀幣 (例：2,850,000)

**📤 [狀態變更結果]**
1. **Cash (扣除現金)**
   * `state.assets.cash` 減少 `totalCost`。
   * *(約束：即使現金變為負數，系統仍允許執行，視為透支/應付帳款，不阻擋採購)*
2. **Inventory (庫存增加與均價重算)**
   * 找到 `location` 下的 `itemKey`，數量增加 `quantity`。
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

#### 事件名稱：INVENTORY_ADJUSTMENT (庫存盤點校正)
**業務目的：** 透過新增一筆校正紀錄修正錯誤庫存與作業日誌差異，保持資料流向單向且不可撤銷。

**適用範圍**
* 適用於修正採購入庫、製作入庫、工人島匯入、城市庫存轉移等事件錯誤。
* 不得用於「時光倒流」式的沖銷操作；系統只允許以新增調整紀錄方式平衡數值。

**📤 [狀態變更結果]**

1. **作業日誌新增**
   * 在 `state.transactions` 頂部新增一筆紀錄，`action` 為 "INVENTORY_ADJUSTMENT"。
2. **庫存調整**
   * 根據校正差異調整對應 `state.inventory[itemKey].qtyByLocation` 的值，並保持各地點數量不可為負。
3. **成本紀錄**
   * 若校正涉及成本基準或現金差異，則此紀錄可同時保留 `cashChange`、`assetValue` 與 `unitPrice`，但不得作為歷史事件的撤銷操作。
