### 📜 Albion Logistics ERP 配方與分類模型 (RECIPE_MODEL.md)
**設計守則：**

本文件定義了「物品配方」的唯一資料標準。系統中任何與「配方查詢」、「成本計算」、「加成判定」相關的邏輯，**絕對禁止**使用配方的名稱（`name` 或 `id`）進行字串比對，必須嚴格依賴本模型定義的分類屬性（`category`）。

#### 1. 🗃️ 靜態資料庫結構 (The Recipe Entity)
{
  id: "Wildfire Staff",     // 系統內部唯一英文識別碼
  name: "野火法杖",           // UI 顯示名稱
  category: "FIRE_STAFF",   // 🎯 統一的穩定識別碼 (Stable ID)
  // ...其他材料欄位不變...
}

#### 2. 🌉 跨模組加成映射鐵律 (Category Mapping Rule)
由於 `LOCATION_MODEL` 與 `RECIPE_MODEL` 的底層資料已全面統一採用「穩定英文 ID (Stable ID)」，系統中**不再需要**維護任何中英對照字典，一切以 ID 絕對吻合為準。

**運算引擎（Math Engine）標準作業流程：**
1. 玩家在 UI 選擇製作「野火法杖」。
2. `crafting.js` 從 `albion_db.js` 取出該配方實體，得知其 `category` 為 `"FIRE_STAFF"`。
3. `crafting.js` 拿著 `"FIRE_STAFF"` 直接去詢問 `Location Registry`：*「請問我現在所在的地點，它的 Region 屬性陣列中是否包含 'FIRE_STAFF'？」*
4. `Location Registry` 進行字串全等比對，回傳 `true` 或 `false`。
5. 將結果帶入 LPB 公式中計算出最終 RRR。

#### 3. ⛔ 絕對禁止事項 (Anti-Patterns)

- **禁止硬編碼名稱：** 絕對不允許出現 `if(recipeName === "野火法杖")` 或 `recipeName.indexOf("火") > -1` 的邏輯。
- **禁止模組越權：** `crafting.js` 只負責問問題（丟出 `category`）與算數學（LPB 公式），絕對不能自己維護各類別的加成對照表。
