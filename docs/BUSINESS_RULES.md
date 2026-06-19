# Albion Logistics ERP Business Rules

本文件定義成本、現金流、庫存、工人島產出與作業日誌的核心商業規則。

> ⚠️ Current / future boundary：
> 本文件同時包含 current implementation rules 與 future migration boundary。凡涉及 `qtyByLocation`、Stable ID、canonical event name 或新版 event payload 的內容，除非明確標註 current implementation，否則應視為 future target / migration boundary。
> 不得因此改寫 legacy storage key、legacy transaction payload 或移除 legacy fallback。交易事件邊界請見 `TRANSACTION_EVENT_MODEL.md`，遷移順序請見 `MIGRATION_PLAN.md`。

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
- 純數量平移：物流轉移只改變該地點的庫存數量；current implementation 使用 `qtyByCity`，future target 使用 `qtyByLocation`。
- 無價值變動：物流轉移絕對不改變全域均價，不產生現金流變化。

## 4. 👷 工人島產出原則 (Laborer Harvest)
- 零現金成本：工人帶回來的資源不扣除現金，也不計算「日誌」的購買與填滿成本（僅做數量控管）。
- 繼承均價機制：產出物庫存匯入總庫存時，自動繼承該資源當前的「全域均價」。不產生任何價值變化（不稀釋均價）。

## 5. ❌ 歷史紀錄不可逆原則 (No Time-Travel for Averages)
- `state.transactions` 中的原始歷史紀錄不得物理刪除。
- UI 上的「刪除」或「修正」操作，必須被視為新增一筆調整紀錄，而不是移除原始紀錄。
- 系統不得回溯還原或重算歷史 `globalAvgCost`。
- 發生錯誤紀錄時，只能透過 `INVENTORY_ADJUSTMENT` 以當前狀態修正庫存、現金與說明。
- 若調整會導致任一 `qtyByLocation` 小於 0，必須阻擋整個調整。
- 發生錯誤的均價，不得透過刪除歷史紀錄修復，只能透過未來合法事件或手動庫存校正拉平。

## 6. 🧮 庫存成本計價方式 (Inventory Costing Method)
**本系統嚴格採用：加權平均成本法 (Weighted Average Cost)。**
絕不採用 FIFO（先進先出）、LIFO（後進先出）或批次成本追蹤。所有物品僅維護唯一一個 `globalAvgCost` 作為成本參考基準。

詳細事件級成本權限以「Cost Basis 成本基準總則」為準；本節保留高層規則，不取代下方事件級邊界。

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

## Cost Basis 成本基準總則

本系統採用 WAC（Weighted Average Cost，加權平均成本法），所有物品在 `state.inventory[itemKey].globalAvgCost` 中只維護唯一一個全域成本基準。

### 成本基準建立與更新權限

#### 1. `PURCHASE_ITEM`

`PURCHASE_ITEM` 是唯一可以透過「外部真實現金交易」建立或更新成本基準的事件。

適用對象：

* 市場採購材料
* 市場採購可入庫物品
* 任何直接用現金購買並進入總庫存的物品

規則：

* 若該物品全域總庫存為 `0`，本次採購單價直接成為新的 `globalAvgCost`。
* 若該物品全域總庫存大於 `0`，使用 WAC 公式稀釋既有 `globalAvgCost`。
* 此事件會扣除 `state.assets.cash`。
* 此事件會新增 `PURCHASE_ITEM` 作業日誌。

#### 2. `CRAFT_COMPLETE`

`CRAFT_COMPLETE` 可以為「製造成品」建立或更新成本基準。

適用對象：

* 透過配方製作完成並入庫的成品

規則：

* `CRAFT_COMPLETE` 不得修改被消耗材料的 `globalAvgCost`。
* `CRAFT_COMPLETE` 必須引用材料當下既有的 `globalAvgCost` 計算材料成本。
* 若任一必要材料 `globalAvgCost === null`，即使材料數量充足，也必須阻擋製作。
* 阻擋時不得消耗材料、不得新增成品、不得扣 cash、不得新增 transaction，且 craftingQueue 必須保留。
* 成品的本次製造成本為：
```js
mainMaterialCost
+ subMaterialCost
+ usageFee
+ artifactTotalCost
+ alchemyTotalCost
```

* 若成品全域總庫存為 `0`，本次單位製造成本直接成為成品新的 `globalAvgCost`。
* 若成品全域總庫存大於 `0`，使用 WAC 公式更新成品的 `globalAvgCost`。
* 此事件只扣除 `usageFee + artifactTotalCost + alchemyTotalCost` 對應的現金。
* 材料成本屬於資產轉換，不得再次扣除現金。

#### 3. `LABORER_IMPORT`

`LABORER_IMPORT` 不得建立或修改成本基準。

規則：

* 若目標物品 `globalAvgCost === null`，必須阻擋匯入。
* 若目標物品 `globalAvgCost !== null`，允許匯入。
* 匯入只增加 `qtyByLocation` 數量。
* `globalAvgCost` 維持不變。
* 現金維持不變。

#### 4. `TRANSFER_ITEM`

`TRANSFER_ITEM` 不得建立、修改或重算成本基準。

規則：

* 只移動不同 `locationId` 之間的數量。
* 不改變 `globalAvgCost`。
* 不改變現金。
* 不新增財務型作業日誌。

#### 5. 未來 `SELL_ITEM`

若未來加入成品販售事件，`SELL_ITEM` 只能處理：

* 成品庫存扣除
* 現金收入增加
* 銷售收入紀錄
* 以當下 `globalAvgCost` 計算銷貨成本或損益

`SELL_ITEM` 不得回頭修改該物品的 `globalAvgCost`。

---

## Current Implementation Rules（Stable Release）

本節只描述穩定版目前已實作並受 regression test 保護的 legacy-compatible behavior。未來 `SELL_ITEM`、新版 event payload、Stable ID 與 `qtyByLocation` 規格仍屬 migration target，不得將本節解讀為 migration 已完成。

### 成品出售

- 成功出售時，從目前指定倉庫扣除出售數量，增加 `state.assets.cash`，並新增一筆 `賣成品` legacy transaction。
- 出售數量必須大於 0，且不得超過該倉庫目前庫存；不合法時必須阻擋且不得修改狀態。
- 成品出售不得修改該品項的 `globalAvgCost`。
- 銷售估價畫面的遊戲估價單價 / 總價同步、90% / 85% P2P 參考價與實售單價 / 總價同步僅為 UI 參考值，不會自動成為正式交易金額。
- 銷售估價畫面會顯示成本總額、預估毛利、單件毛利與毛利率；若成本基準未知，顯示成本未知，不顯示假毛利。
- 固定 market tax estimate 不得作為 P2P 成品出售彈窗的主要資訊。若未來支援市場出售，應另立 market tax mode。
- 成功出售後的 UI 提示會顯示實際售出總價、單價與預估毛利；若成本基準未知，僅提示成本基準未知，不阻擋出售。

### 製作規劃與正式扣帳邊界

- 製作材料 planning display 與正式 accounting 必須分開理解。
- Planning display 會依 material key + city 彙總勾選佇列項目的材料需求：
  - `groupExpected = sum(row expected)`
  - `groupConservative = sum(row conservative)`
  - `groupSafeStart = groupConservative + max(perCraftMinReturn)`
- 相同 material key + same city 會合併；不同 material 或不同 city 必須分開。
- 未勾選或 invalid qty row 不得進入 planning aggregation。
- `actualMainQty` / `actualSubQty` 不得影響 planning helper；actual consumption 是完成製作後的 accounting input。
- `submitCraftAll()` 正式扣帳使用使用者填入的 actual material consumption，不使用 planning expected / safe-start 值作為扣帳數量。
- Blank 或 invalid actual consumption 必須在任何 mutation 前阻擋；不得消耗材料、不得新增成品、不得扣 cash、不得新增 transaction。
- Alchemy aggregation 維持既有 current implementation 行為。
- Purchase 與 crafting 若未明確選擇 quality 必須阻擋，不得隱含 default `4.0`。

### 工人島物資出售

- 成功出售時，從 `state.laborerInventory` 暫存數量扣除出售數量，增加 cash，並新增一筆 `工人島出售` legacy transaction。
- 出售數量必須大於 0、不得超過暫存數量，且總額必須有效；不合法時必須阻擋且不得修改狀態。
- 此出售是暫存物資套現行為，不會建立或修改總庫存的 `globalAvgCost`。

### 現金校正、注資與提領

- 現金餘額校正將 cash 設為使用者指定目標值，並以差額新增 `現金流校正` legacy transaction；不得修改 inventory 或 debt。
- 注資增加 cash 與 debt；提領減少 cash 與 debt。兩者均不得修改 inventory。
- 零金額或無效金額必須阻擋並顯示錯誤。
- `adjustWallet()` 已存在並受 regression test 保護，但目前 UI 入口可用性仍屬 known limitation。

### 備份資料安全

- 匯出資料使用 readable structured JSON，包含目前庫存、資產、交易、工人島資料與自訂倉庫資料。
- 匯入支援目前 object / array 格式，以及 legacy JSON-string backup。
- 匯入資料缺少必要欄位、欄位型別不符或 JSON 損壞時，必須中斷且不得覆寫既有 `localStorage`。
- 備份相容行為已受 regression test 保護；正式版本化 backup schema 仍屬 docs debt。
