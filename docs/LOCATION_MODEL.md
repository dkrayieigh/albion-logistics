# 🗺️ Albion Logistics ERP 地點與加成模型 (LOCATION_MODEL.md)
**設計守則：**
本文件定義了「實體庫存地點」、「地區加成屬性」與「動態製作變數」的三層分離架構。**絕對禁止**在 `Inventory` 或 `Location Registry` 中直接儲存 RRR（返還率）數值。所有 RRR 必須在 `CRAFT_COMPLETE` 事件發生時，透過 Local Production Bonus (LPB) 公式動態運算。

> ⚠️ Current / migration boundary：production v2 persisted state now includes `locationRegistry` and canonical `qtyByLocation` storage, but runtime components still operate through legacy-compatible `qtyByCity` and display-name location keys.
> This means the persisted v2 contract exists, while full runtime/component `locationId` adoption, historical transaction canonicalization, shared resolver completion, inactive-location management UI, custom crafting profiles, and legacy fallback removal remain future work.
> 不得將本文件解讀為所有 writer、component、transaction 或 legacy mode 已完成 Location ID migration。遷移順序請見 `MIGRATION_PLAN.md`。

## Current Implementation Note

目前 runtime component 仍以顯示名稱字串作為 legacy-compatible key。

Current production v2 persisted state includes `locationRegistry` and canonical `qtyByLocation` inventory. The runtime bridge projects canonical `qtyByLocation` into runtime `qtyByCity`, and the v2 save path projects runtime state back to canonical persisted state.

Current components still display and edit location through display names and runtime `qtyByCity` compatibility. This is why `qtyByLocation` persisted storage does not mean all UI, writer, transaction, backup, or legacy fallback paths have completed canonical Location ID migration.

目前已存在 read-only Location Adapter normalization checkpoint：adapter 可讀取 legacy direct map、legacy `qtyByCity` wrapper 與 `qtyByLocation` wrapper，並輸出 `sourceFormat`、`quantities`、`unresolvedLocations`。此能力只代表 reader/normalizer compatibility，不代表 full component writer migration、historical payload migration、fallback removal、shared resolver completion 或 inactive-location UI 已完成。

Future full-runtime target remains stable `locationId` adoption across components, writers, historical transaction interpretation, backup upgrade, resolver completion, inactive-location UI, custom crafting profile, rollback, and fallback removal gates.

Selected Location strategy is single-user clean cutover, not full automatic legacy storage migration. The v2 persisted root and production startup/read-write path are implemented; automatic legacy backup migration, writer/component full `locationId` adoption, historical transaction migration, custom crafting profile, and fallback removal remain incomplete.

封版前已加入資料安全限制：非空自訂倉庫不得刪除，使用者必須先轉移或清空該倉庫庫存。

空自訂倉庫仍可依 current implementation 刪除，且此行為已有 regression test 保護。

此修復不代表 Location ID migration 已完成。

## 🟢 第一層：庫存儲存鍵值 (Location ID) — Current persisted v2 contract / future full-runtime target
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

## 🟡 第二層：地點實體註冊表 (Location Registry) — Current persisted v2 contract / future full-runtime target
記錄地點的「靜態物理屬性」。皇家城市固定不可變；production v2 persisted registry 已使用 `locationRegistry` object。Runtime/component compatibility 仍可保留 `state.customLocations` 與 display-name based flows。

> Boundary：production v2 persisted state includes `locationRegistry`, but runtime components still use literal city/custom location display names through `qtyByCity` compatibility. Full writer/component Location ID adoption, historical transaction canonicalization, shared resolver completion, inactive-location management UI, custom crafting profile, and legacy fallback removal remain future work.

### Clean-Cutover Location Registry Shape — Current persisted v2 contract / future full-runtime target

Single-user clean cutover 的 new schema 使用 `locationRegistry` object，並以 `locationId` 作為 object key。不得使用 array 作為 registry storage shape。

```js
locationRegistry: {
  thetford: {
    locationId: 'thetford',
    displayName: 'Thetford',
    type: 'system',
    active: true
  },
  martlock: {
    locationId: 'martlock',
    displayName: 'Martlock',
    type: 'system',
    active: true
  },
  bridgewatch: {
    locationId: 'bridgewatch',
    displayName: 'Bridgewatch',
    type: 'system',
    active: true
  },
  lymhurst: {
    locationId: 'lymhurst',
    displayName: 'Lymhurst',
    type: 'system',
    active: true
  },
  fort_sterling: {
    locationId: 'fort_sterling',
    displayName: 'Fort Sterling',
    type: 'system',
    active: true
  },
  caerleon: {
    locationId: 'caerleon',
    displayName: 'Caerleon',
    type: 'system',
    active: true
  },
  brecilien: {
    locationId: 'brecilien',
    displayName: 'Brecilien',
    type: 'system',
    active: true
  },
  laborer_island: {
    locationId: 'laborer_island',
    displayName: 'Laborer Island',
    type: 'system-special',
    active: true
  },
  'custom:<generated-id>': {
    locationId: 'custom:<generated-id>',
    displayName: '自訂倉庫名稱',
    type: 'custom',
    active: true
  }
}
```

Registry rules：

- `locationId` 是唯一 identity。
- `entry.locationId` 必須與 object key 完全相同。
- `displayName` 只作 UI 顯示，不得作 identity。
- `type` 只能是 `system`、`system-special`、`custom`。
- `active` 必須是 boolean。
- `system` 與 `system-special` 不得刪除。
- `custom` 可依既有 non-empty / referenced safety rules 限制刪除。
- `Hideout` 不建立永久 registry entry。
- 不得從 UI 文字動態生成 `locationId`。

Fixed system registry entries：

| locationId | displayName | type |
|---|---|---|
| `thetford` | `Thetford` | `system` |
| `martlock` | `Martlock` | `system` |
| `bridgewatch` | `Bridgewatch` | `system` |
| `lymhurst` | `Lymhurst` | `system` |
| `fort_sterling` | `Fort Sterling` | `system` |
| `caerleon` | `Caerleon` | `system` |
| `brecilien` | `Brecilien` | `system` |
| `laborer_island` | `Laborer Island` | `system-special` |

### Clean-Cutover Inventory Shape — Current persisted v2 contract / future full-runtime target

Location clean cutover 只切換 Location dimension，不同時做 Stable Item ID migration。

```js
inventory: {
  [itemKey]: {
    qtyByLocation: {
      [locationId]: Number
    },
    globalAvgCost: Number | null
  }
}
```

- `itemKey` 仍保留現有 legacy item key。
- 不同時做中文 item key -> Stable ID。
- `qtyByCity` 不出現在 new schema。
- quantity 必須是 finite number。
- 是否允許 negative quantity 沿用既有 business rule；本文件不擅自改變。
- `globalAvgCost` 仍為 number 或 `null`。

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
- `laborer_island`

System locations rules：

- System location 不可刪除。
- System location ID 不可 rename。
- Display labels 可以 localization。
- System location ID 不得從 UI text 動態推導。

#### Special Legacy Locations

This section defines special legacy location identity boundaries. It describes current legacy-compatible behavior and future Location Registry classification only. It does not change current storage, writers, `SYSTEM_CITIES`, `loadState()`, `initDefaultState()`, `normalizeLocationMap()`, backup import/export, or migration status.

##### `LaborerIsland`

- Current implementation uses exact legacy key `LaborerIsland`.
- Current implementation initializes inventory `qtyByCity` entries with `LaborerIsland: 0`.
- `LaborerIsland` is a current `SYSTEM_CITIES` entry and a reserved legacy `qtyByCity` key.
- `LaborerIsland` is not a current `customLocations` entry.
- Future Location Registry classification is `system-special`.
- Future fixed `locationId` is `laborer_island`.
- It is not a custom location and must not be user-created, renamed, or deleted.
- Display label may be localized in the future, but current storage remains exact legacy key `LaborerIsland`.
- The future `laborer_island` ID does not mean any writer/storage migration has started.

##### `Hideout`

- Current implementation treats `Hideout` as a deprecated legacy compatibility key.
- `Hideout` remains a current `SYSTEM_CITIES` compatibility entry, but it is also a deprecated legacy key handled specially by `loadState()`.
- Current `loadState()` contains a legacy compatibility exception that can normalize old `Hideout` data.
- That `loadState()` exception is current legacy compatibility behavior only.
- Future Location Registry must not assign a permanent fixed `locationId` named `hideout` or `Hideout`.
- `Hideout` must not be treated as a permanent system registry entry.
- Future resolver behavior must not silently create a custom location for residual `Hideout`.
- If residual `Hideout` appears during future registry migration validation, it must be reported as unresolved / deprecated legacy key and block migration until handled.
- The current legacy transaction-location rewrite exception must not be generalized into future rename semantics. Future custom-location rename must not rewrite historical raw transaction payload.

Future fixed ID list includes `laborer_island` and excludes `Hideout`.

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

#### Superseded automatic-compatible release boundary

以下是舊 automatic-compatible strategy 的 boundary，已被 single-user clean cutover selected strategy 取代；保留作為 historical compatibility reference，不是 current selected release plan。

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
