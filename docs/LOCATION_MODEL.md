# 🗺️ Albion Logistics ERP 地點與加成模型 (LOCATION_MODEL.md)
**設計守則：**
本文件定義了「實體庫存地點」、「地區加成屬性」與「動態製作變數」的三層分離架構。**絕對禁止**在 `Inventory` 或 `Location Registry` 中直接儲存 RRR（返還率）數值。所有 RRR 必須在 `CRAFT_COMPLETE` 事件發生時，透過 Local Production Bonus (LPB) 公式動態運算。

> ⚠️ Migration boundary：Location ID、`qtyByLocation` 與 Location Registry 是 future target / migration target。
> Current implementation 仍使用 legacy `qtyByCity` 與 custom location name key；`customLocations` 尚未全面遷移為 registry object。
> 不得將本文件解讀為 `qtyByLocation` 已取代 `qtyByCity`。遷移順序請見 `MIGRATION_PLAN.md`。

## Current Implementation Note

目前自訂倉庫仍以顯示名稱字串作為 legacy key。

目前庫存地點仍以 literal city/custom location string keys 搭配 `qtyByCity` 儲存。Current implementation 不使用 `qtyByLocation` 作為 storage，也尚未建立 Location Registry object。

目前已存在 read-only Location Adapter normalization checkpoint：adapter 可讀取 legacy direct map、legacy `qtyByCity` wrapper 與 future `qtyByLocation` sample wrapper，並輸出 `sourceFormat`、`quantities`、`unresolvedLocations`。此能力只代表 reader/normalizer compatibility，不代表 writer、storage、backup schema 或 migration 已開始。

Future target 仍是 Location Registry + stable `locationId`。在 Location Registry business rules、system/custom mapping、conflict/rename identity rules、unresolved mapping policy、writer API、backup migration、rollback 與 fallback removal gate 完成前，不得把 future target 寫成 current implementation。

封版前已加入資料安全限制：非空自訂倉庫不得刪除，使用者必須先轉移或清空該倉庫庫存。

空自訂倉庫仍可依 current implementation 刪除，且此行為已有 regression test 保護。

此修復不代表 Location ID migration 已完成。

## 🟢 第一層：庫存儲存鍵值 (Location ID) — Future Target
庫存系統 (`state.inventory.qtyByLocation`) 僅記錄物品的實體存放點。
所有事件 payload 與 state 寫入必須使用 Location ID，不得使用 UI 顯示名稱。

合法欄位命名：

- `locationId`
- `fromLocationId`
- `toLocationId`
- `targetLocationId`

禁止欄位命名：

- `location`
- `fromLocation`
- `toLocation`
- `targetLocation`

範例：

```js
{
  locationId: "thetford"
}
```
- **鍵值規範：** 強制使用小寫與底線的純 ID 格式。
- **合法範例：** `thetford`, `fort_sterling`, `bridgewatch`, `martlock`, `lymhurst`, `hideout_001`, `laborer_island`。
- **⛔ 絕對禁止：** 使用顯示名稱（如 `"紫城"`, `"公會T8地堡"`）或夾帶加成屬性作為 Key。

## 🟡 第二層：地點實體註冊表 (Location Registry) — Future Target
記錄地點的「靜態物理屬性」。皇家城市固定不可變；自訂地堡記錄於 `state.customLocations`。

> D78 boundary：本節是 future target / migration boundary。Current implementation 仍使用 literal city/custom location string keys、`qtyByCity` 與 `customLocations` string array。Location Registry 尚未實作，writer/storage migration 尚未開始。

### Location Registry Business Rules — Future Target

#### Location identity

- `locationId` 是不可變 identity。
- `displayName` 是可變 presentation。
- Rename 必須保留原 `locationId`。
- Future inventory references 必須使用 `locationId`，不得使用 `displayName` 作為持久化 identity。

#### System locations

固定 system location IDs：

- `thetford`
- `martlock`
- `bridgewatch`
- `lymhurst`
- `fort_sterling`
- `caerleon`
- `brecilien`

System locations rules：

- System location 不可刪除。
- System location ID 不可 rename。
- Display labels 可以 localization。
- System location ID 不得從 UI text 動態推導。

#### Custom locations

- Custom location 必須有永久 generated ID，概念格式為 `custom:<generated-id>`。
- ID 只在建立時產生一次。
- ID 不得由 `displayName` 推導。
- Rename 不得改變 ID。
- Exact UUID / generator implementation 仍是 future design。

#### Name conflict rules

- Duplicate `displayName` 不允許。
- Conflict checking 前必須 trim surrounding whitespace。
- Comparison 必須 case-insensitive。
- Custom names 不得與 system city display names 衝突。
- Chinese characters、spaces 與 symbols 仍允許。
- 不得 silent suffixing 或自動 rename。

#### Rename semantics

- `locationId` 不變。
- Inventory quantity 不變。
- `globalAvgCost` 不變。
- Historical raw transaction payload 不回寫、不重寫。
- Display layer 未來可透過 mapping resolve current `displayName`。

#### Delete semantics

- System location 不可刪除。
- Non-empty custom location 不可刪除。
- Referenced custom location 不可刪除。
- 只有 empty 且 unreferenced custom location 可刪除。
- 刪除 registry entry 不得刪除 transaction history。

#### Legacy name mapping

- Exact system name maps to fixed system ID。
- Exact custom name maps to existing custom ID。
- Duplicate/conflicting names become unresolved。
- Unknown names become unresolved。
- No fuzzy matching。
- No silent creation of custom locations。
- Migration must stop while unresolved mappings remain。

#### Migration validation invariants

Migration 前後必須比較：

- Inventory item count。
- Each item/location quantity。
- Global quantity totals。
- `globalAvgCost`。
- Cash。
- Transaction count。
- Custom location count。
- Unresolved mapping count。

Any mismatch blocks migration and requires rollback to legacy backup。

#### Compatibility release boundary

第一個 compatible release 只可：

- Add registry model draft。
- Add read-only mapping/adapter。
- Preserve literal legacy names。
- Preserve `qtyByCity`。
- Preserve legacy fallback。

第一個 compatible release 不可：

- Switch purchase/transport writers。
- Write `qtyByLocation`。
- Rewrite `localStorage`。
- Rewrite backup schema。
- Remove fallback。

**資料模型 (`state.customLocations[i]`)：**

JavaScript

```
{
  id: "hideout_001",      // 必須對應第一層的 Location ID
  name: "公會T8地堡",       // UI 顯示用
  type: "HIDEOUT",        // 地點類型
  region: "SWAMP",        // 決定加成哪些武器 (對應 Thetford 加成表)
  regionQuality: 5        // 地圖品質 (1~6)，決定基礎 LPB 加成
  // ⛔ 絕對不存 RRR，也絕對不存 powerLevel
}
```

**Region 裝備加成對照表 (`constants.js` 定義)：**

* `SWAMP` (沼澤/紫城): MACE, NATURE_STAFF, FIRE_STAFF, LEATHER_ARMOR, CLOTH_HELMET
* `FOREST` (森林/綠城): SWORD, BOW, ARCANE_STAFF, LEATHER_HELMET, LEATHER_SHOES
* `MOUNTAIN` (雪地/白城): HAMMER, SPEAR, HOLY_STAFF, PLATE_HELMET, CLOTH_ARMOR
* `HIGHLAND` (高地/藍城): AXE, QUARTERSTAFF, FROST_STAFF, PLATE_SHOES, OFF_HAND
* `STEPPE` (沙漠/黃城): CROSSBOW, DAGGER, CURSED_STAFF, PLATE_ARMOR, CLOTH_SHOES
* `CENTER` (紅城): WAR_GLOVES, SHAPESHIFTER_STAFF
* `MISTS` (迷霧之城): CAPE

JavaScript
```
REGIONS = {
  SWAMP: 'SWAMP',
  FOREST: 'FOREST',
  MOUNTAIN: 'MOUNTAIN',
  HIGHLAND: 'HIGHLAND',
  STEPPE: 'STEPPE',
  CENTER: 'CENTER',
  MISTS: 'MISTS'
}
```

## 🔴 第三層：製作當下的動態變數 (Crafting Event Parameters)
在觸發 `CRAFT_COMPLETE` 時，由 UI 面板動態傳入的環境變數，代表「此時此刻」的加成狀態。

**傳入參數擴充：**

- `focusEnabled`: 是否使用專注點 (Boolean)
- `dailyBonus`: 今日活動加成 (Number: `0`, `0.1`, 或 `0.2`)
- `hideoutPower`: 當下的地堡能量等級加成 (Number: 無能量=`0`, Lv1=`0.13`, Lv2=`0.26` 等，若在皇家城市製作則強制為 `0`)

## 🧮 第四層：LPB 與 RRR 數學引擎 (The Math Engine)
這是計算製作成本的核心大腦。AI 實作 `crafting.js` 時，必須嚴格按照以下步驟解析：

**步驟 1：計算總體局部生產加成 (Total LPB)**

JavaScript

```
Total LPB = 
  Base_LPB +                  // 基礎加成 (系統預設)
  Region_Bonus +              // 地區對該裝備的特化加成 (有對中 Region 才有)
  Region_Quality_Bonus +      // 地圖品質加成 (1~6級對應的趴數，皇家大陸城市為+15%)
  Hideout_Power_Bonus +       // 面板輸入：地堡能量 (0, 0.13, 0.26...)
  Focus_Bonus +               // 由 focusEnabled 決定；true 時套用專注加成，false 時為 0
  Daily_Bonus                 // 面板輸入：今日活動 (0, 0.1, 0.2)
```

**步驟 2：轉換為最終資源返還率 (RRR)**
Albion 官方標準公式，絕對禁止使用其他的自定義加減法來計算 RRR：

JavaScript

```
RRR = 1 - ( 1 / ( 1 + Total_LPB ) )
```

*(算出的 RRR 將直接決定該次製作的 `材料預估消耗量`。)*
