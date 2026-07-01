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

### Automated Test Baseline

- 指令：`npm.cmd test`
- Current totals 以 `npm test` 和 `PROJECT_HANDOFF.md` 為準。
- 本節只描述 regression suite 的 coverage scope，不保存最新測試總數、checkpoint 或 commit metadata。
- 手測案例中的 `locationId` 是 location-model 對照標記；current persisted v2 已有 `locationRegistry` 與 canonical `qtyByLocation`，但 runtime component 仍透過 `qtyByCity` 與 display-name compatibility 操作。
- Current production v2 baseline: production startup/read-write path, backup export/import, clean initialization, persisted `locationRegistry`, and persisted canonical `qtyByLocation` are integrated.
- 新增 covered scope: Location read-only adapter legacy direct map and `qtyByCity` wrapper normalization.
- 新增 covered scope: Location read-only adapter canonical `qtyByLocation` normalization as reader/normalizer compatibility.
- 新增 covered scope: Location read-only adapter invalid/non-finite unresolved reporting, zero/negative finite preservation, literal/custom key preservation, input immutability, and output copy behavior.
- 新增 covered scope: legacy backup location preservation through import, `loadState`, and adapter read, including multi-item/multi-location `qtyByCity`, custom location string arrays, `globalAvgCost`, and zero quantity preservation.
- Location adapter coverage does not mean runtime components fully adopt stable `locationId`, historical transactions are migrated, resolver UI coverage is complete, automatic legacy backup migration is implemented, or legacy fallback removal has started.
- 新增 covered scope: pure inventory transfer service success through `applyInventoryTransfer()`.
- 新增 covered scope: inventory transfer service input item / `qtyByCity` immutability and total quantity preservation.
- 新增 covered scope: inventory transfer service custom display-name location compatibility.
- 新增 covered scope: inventory transfer service zero/negative quantity rejection, same-location rejection, missing item rejection, selected-source insufficiency rejection, and validation priority.
- Existing inventory transfer integration regressions still cover legacy save path, WAC preservation, cash/debt preservation, transaction preservation, no `qtyByLocation` writer, and no Location Registry creation.
- This does not implement canonical `TRANSFER_ITEM`, transfer transaction writing, `qtyByLocation` writer migration, Location ID migration, save failure rollback for transfer, or storage schema changes.
- 新增 covered scope: Location identity resolver exact system city mapping, `LaborerIsland` to `laborer_island`, residual `Hideout` unresolved with `deprecatedLegacyKey`, explicit custom mapping, unknown/fuzzy unresolved, malformed mapping unresolved, normalized-name conflict detection, immutability, and system mapping precedence.
- Location identity resolver exists and has read-only regression coverage. It does not mean component writers have fully switched to stable `locationId`, historical payload migration is complete, inactive-location UI is complete, shared resolver coverage is complete, automatic legacy backup migration is implemented, or legacy fallback removal has started.
- 新增 covered scope: Location migration validator read-only research / verification utility.
- Selected Location strategy is single-user clean cutover. New-schema persistence, backup, initializer, first-launch, and production read/write are complete. Remaining tests/work should focus on full component stable `locationId` adoption, shared resolver and UI coverage, historical transaction strategy, automatic legacy backup migration, inactive-location UI, custom crafting profiles, legacy fallback removal gates, and future schema / backup compatibility upgrades.
- Full legacy snapshot equality is no longer the selected clean-cutover release gate.
- 新增 covered scope: Custom warehouse deletion UX contract.
- Custom warehouse delete confirmation now mentions the current non-empty deletion guard and directs users to transfer or clear inventory before deletion.
- Cancellation leaves custom locations, registry, inventory, transactions, and toast state unchanged.
- Confirmed non-empty deletion remains blocked, keeps registry entry active, keeps runtime custom location, preserves inventory, and shows an error toast.
- Confirmed empty deletion deactivates the registry entry, removes runtime custom location and `qtyByCity` bucket, preserves unrelated inventory, and shows a success toast.
- Scope: Custom warehouse deletion UX contract. Current status: current master / legacy-compatible UI safety. Test protection status: Tested. Test source: `tests/core-cost-regression.test.js`.
- This does not implement inactive-location UI, full component stable `locationId` adoption, `qtyByLocation` writer migration, automatic legacy migration, or legacy fallback removal.
- 新增 covered scope: Special Material pure inventory/WAC contract.
- Purchase coverage includes first Artifact / Alchemy purchase, positive-inventory WAC, `Math.round`, zero-balance reset, identity mismatch, unknown cost basis, invalid quantity / total cost / entry, structured failure, and error priority.
- Consumption coverage includes fixed integer deduction, consumed cost, insufficient quantity, unknown cost basis, WAC preservation, and zero-balance dormant anchor.
- Boundary coverage includes input immutability, success copy semantics, failure original-entry reference, presentation metadata preservation, location-shaped `qtyByLocation` / `qtyByCity` / `locationId` rejection for identity and entry, public API shape, plain Node execution, and no `window` / `document` / `localStorage` access.
- Scope: Special Material pure inventory/WAC contract. Current status: current master pure service / not production-integrated. Test protection status: Tested. Test source: `tests/special-material-inventory-service.test.js`.
- 新增 covered scope: crafting material planning aggregates expected consumption and safe-start stock by material key + city.
- 新增 covered scope: crafting accounting uses user-entered actual material consumption; blank/invalid actual consumption blocks before mutation.
- 新增 covered scope: purchase and crafting require explicit quality selection and no longer default to `4.0`.
- 新增 covered scope: sale valuation supports P2P reference pricing, actual sale unit/total sync, cost/profit summary, and unknown-cost handling.
- 新增 covered scope: minimal read-only Transaction Reader Adapter mixed legacy/future transaction tolerance.
- 新增 covered scope: minimal Ledger render/display compatibility with normalized transaction reader entries.
- 新增 covered scope: minimal read-only Location Adapter legacy qtyByCity multi-location preservation.
- 新增 covered scope: minimal Inventory render/display compatibility with normalized Location Adapter entries.
- 新增 covered scope: minimal read-only Item Identity Adapter missing legacy item mapping explicit failure.
- 新增 covered scope: Laborer render table displays journal terminology while preserving legacy action key.
- This does not rename the legacy storage key 滿日記本 and does not start Laborer storage migration.
- 新增 covered scope: Transaction Reader preserves current legacy crafted sale transaction compatibility.
- This does not implement canonical SELL_ITEM or migrate transaction payloads.
- 新增 covered scope: Ledger display renders normalized current legacy crafted sale transaction reader entries.
- This does not implement canonical SELL_ITEM, change writers, or migrate transaction payloads.
- 新增 covered scope: Crafted item sale state transition preserves location-specific inventory, cash increase, legacy transaction payload, insertion order, and globalAvgCost.
- This does not implement canonical SELL_ITEM, change writers, or migrate transaction payloads.
- 新增 covered scope: Crafted item sale invalid total is blocked without mutating inventory, cash, transactions, or globalAvgCost.
- This does not implement canonical SELL_ITEM, change writers, or migrate transaction payloads.
- 新增 covered scope: Crafted item sale with insufficient selected-location inventory is blocked without mutating inventory, cash, transactions, or globalAvgCost, and does not consume stock from other locations.
- This does not implement canonical SELL_ITEM, change writers, or migrate transaction payloads.
- 新增 covered scope: Crafted item sale with negative quantity is blocked without mutating inventory, cash, transactions, or globalAvgCost.
- This does not implement canonical SELL_ITEM, change writers, or migrate transaction payloads.
- 新增 covered scope: Transaction Reader preserves current legacy laborer sale transaction compatibility.
- This does not implement a canonical event, change writers, migrate transaction payloads, or rename legacy storage key 滿日記本.
- 新增 covered scope: Ledger display renders normalized current legacy laborer sale transaction reader entries.
- This does not implement a canonical event, change writers, migrate transaction payloads, or rename legacy storage key 滿日記本.
- 新增 covered scope: Laborer sale success state transition preserves legacy payload, transaction insertion order, cash increase, selected inventory deduction, unrelated inventory, and legacy storage key 滿日記本.
- This does not implement a canonical event, change writers, migrate transaction payloads, or rename legacy storage key 滿日記本.
- Adapter / Migration 前置測試規劃見 `ADAPTER_TEST_PLAN.md`。
- `ADAPTER_TEST_PLAN.md` 是 planning matrix，不代表 adapter 或 migration 已開始。

### Clean Initialization Covered Regression Scope

The pure `createCleanInitialState()` helper is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- New root state uses `schemaVersion: 1` and writes only to `albion-logistics-v2-state`.
- Existing legacy keys are not auto-migrated by this helper.
- Invalid cash/debt/inventory seed/custom location input returns machine-readable errors.
- Cash/debt validation is covered.
- Fixed registry output is covered.
- Custom ID generation and generator failure boundaries are covered.
- `customLocations[].clientRef` is input-only, trimmed, non-empty, unique, not stored, and not derived from `displayName`.
- `inventorySeeds[].customLocationRef` must reference an input `clientRef`; unknown references fail.
- Each inventory seed must provide exactly one of `locationId` or `customLocationRef`.
- Duplicate `itemKey + resolved locationId` seed is invalid and is not auto-summed.
- Duplicate custom display names and system-name conflicts are invalid.
- Inventory seed validation, duplicate resolved identity, and cross-location cost consistency are covered.
- Deterministic custom ID generation may be injected for tests, but generator output must be `custom:<generated-id>` and must not be user input or stored as generator metadata.
- Successful initialization creates fixed system registry entries, generated custom IDs, seeded inventory only, empty transactions, and user-entered assets.
- Successful initialization creates future canonical `laborerInventory` defaults using `滿日誌`; it must not use the current legacy storage key `滿日記本` in future new schema output.
- Atomic failure, input immutability, and localStorage immutability are covered.
- New backup/export/import accepts only new schema and matching `schemaVersion` in future work; current helper does not implement backup.
- This does not switch writers, mutate legacy state, write `localStorage`, connect backup import/export, connect UI, or start migration.

### New-Schema Storage Codec Covered Regression Scope

The pure `encodeNewSchemaState()` / `decodeNewSchemaState()` codec is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Valid encode is covered.
- Valid independent decode is covered.
- Malformed JSON and non-string input rejection are covered.
- `schemaVersion` and root-shape strictness are covered.
- Assets validation is covered.
- Fixed/custom Location Registry validation is covered.
- Reordered fixed object fields are accepted where schema-equivalent.
- `qtyByLocation` inventory and location references are covered.
- Legacy field rejection is covered for `滿日記本`, `qtyByCity`, and `customLocations`.
- JSON-safe transaction/log containers are covered.
- Legal shared references are accepted.
- Direct and indirect cycle rejection is covered.
- Canonical laborer inventory using `滿日誌` is covered.
- Purity, atomicity, and no `localStorage` access are covered.
- This does not implement a storage repository, actual `albion-logistics-v2-state` get/set, startup loading, `state.js` integration, writers, backup import/export, UI, or migration.

### Injected New-Schema Storage Repository Covered Regression Scope

The injected `createNewSchemaStorageRepository(backend)` repository is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Valid fixed-key load is covered.
- Missing load is covered.
- Corrupt or invalid load is covered.
- Backend read failure is covered.
- Valid save is covered.
- Invalid save no-write is covered.
- Backend write failure and no-retry behavior are covered.
- Invalid backend contracts are covered.
- Throwing method getters are covered.
- Backend methods are called with backend `this` binding.
- Promise/thenable rejection behavior is covered.
- Codec error passthrough is covered.
- Legacy key isolation is covered.
- Source isolation from global `localStorage`, startup, `state.js`, writers, backup, UI, and migration is covered.
- This does not implement a global `localStorage` adapter, startup loader, autosave, production state writer, backup repository, or migration runner.

### Browser Storage Backend Covered Regression Scope

The explicit `createBrowserStorageBackend(storage)` binding is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Valid Storage-like object wrapping is covered.
- Original storage method `this` binding is preserved.
- `getItem` / `setItem` key and value arguments are forwarded without transformation.
- Factory validation failures return `INVALID_BROWSER_STORAGE`, while operation throws are left for repository classification.
- Unrelated keys are not scanned, deleted, or inspected.
- Source isolation from global `localStorage`, startup, `state.js`, writers, backup, UI, and migration is covered.
- This helper alone does not represent production bootstrap, state replacement, autosave, writer integration, backup import/export, UI persistence, migration, or legacy fallback removal; production startup coverage is listed separately below.

### Browser New-Schema Runtime Controller Covered Regression Scope

`createBrowserNewSchemaRuntimeController(storage)` is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- `controller.start()` covers ready, initialize, blocked, and projection-error paths.
- `controller.save(runtimeState)` covers runtime-to-canonical projection and new-schema repository save.
- Invalid runtime projection is blocked with `invalid-runtime`.
- Storage/repository errors are returned without silent fallback.
- This is production state persistence boundary coverage, not backup import/export or migration coverage.

### Production New-Schema Startup Covered Regression Scope

Production app startup and state API integration are covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Ready startup reads the new key, projects to runtime state, hydrates defaults, and enables new-schema `saveState()`.
- Confirmed initialize creates clean canonical state, writes the new key, and activates runtime state.
- Cancelled initialize explicitly enters legacy mode.
- Invalid/error startup is blocked and does not fallback or overwrite with empty data.
- `saveState()` writes the new-schema key when runtime controller is active.
- Legacy mode still uses the legacy save path.
- This is not migration and does not update backup import/export.

### Runtime Hydration And Laborer Inventory Covered Regression Scope

Runtime compatibility additions are covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Runtime default hydration preserves active state identity while adding missing inventory defaults.
- Canonical/runtime laborer inventory includes leather support.
- `滿日誌` / `滿日記本` bridge behavior remains covered.
- Laborer form polish includes quality matrix behavior and harvest draft reset.
- This does not complete backup migration, reset lifecycle, or custom location crafting profile.

### UI Quality And Tauri Build Covered Scope

UI quality and build readiness are tracked as current release-prep coverage.

- 5 x 5 quality matrix behavior is covered.
- Laborer form polish is covered.
- Tauri release executable build: pass.
- MSI bundle: pass.
- NSIS bundle: pass.
- This is build/readiness evidence, not a GitHub release or migration step.

### Browser New-Schema Startup Loader Covered Regression Scope

`loadBrowserNewSchemaState(storage)` is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Explicit Storage-like input is required.
- Fixed key `albion-logistics-v2-state` read behavior is covered.
- `loaded` / `missing` / `invalid` / `error` statuses are covered.
- Invalid browser storage and storage read errors are controlled failures.
- Legacy keys are not read, written, scanned, or deleted.
- Global `localStorage` is not read when explicit storage is supplied.
- Input storage and loaded state immutability are covered.
- Source isolation from app state, writer, backup, UI, and migration paths is covered.
- This loader scope alone does not represent production bootstrap, runtime state replacement, canonical save path, backup integration, UI, or migration; production startup coverage is listed separately below.

### Browser New-Schema Startup Decision Covered Regression Scope

`resolveBrowserNewSchemaStartup(storage)` is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- `loaded` maps to `ready`.
- `missing` maps to `initialize`.
- `invalid` maps to `blocked`.
- `error` maps to `blocked`.
- Invalid/error paths never create empty data.
- Loaded state is preserved in ready mode.
- Legacy keys are not read, written, scanned, or deleted.
- Global `localStorage` is not read and input storage is not mutated.
- Source isolation from app state, writer, backup, UI, and migration paths is covered.
- This does not implement first-launch UI, production startup, runtime state replacement, canonical save path, backup integration, or migration.

### New-Schema Runtime Bridge Covered Regression Scope

`projectNewSchemaToRuntime(newSchemaState)` and `projectRuntimeToNewSchema(runtimeState)` are covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Canonical `qtyByLocation` projects to runtime `qtyByCity`.
- Runtime `qtyByCity` projects back to canonical `qtyByLocation`.
- `laborer_island` maps to `LaborerIsland`.
- `LaborerIsland` maps back to `laborer_island`.
- `滿日誌` maps to `滿日記本`.
- `滿日記本` maps back to `滿日誌`.
- `locationRegistry` and custom location IDs are preserved.
- Unknown or ambiguous location mappings fail atomically.
- Pure bridge projection still fails when runtime custom location changes no longer match the retained registry; production custom location state APIs are covered separately in the v0.4.4 checkpoint.
- Input immutability, round-trip preservation, and no storage/global access are covered.
- This does not implement formal writer integration, canonical save path, `saveState()` switch, backup import/export, UI, or migration.

### Browser New-Schema Repository Composition Covered Regression Scope

The explicit `createBrowserNewSchemaRepository(storage)` composition helper is covered by regression tests. Current totals remain sourced from `PROJECT_HANDOFF.md`, not duplicated here.

- Valid explicit Storage-like input composes a repository.
- Invalid browser storage binding returns `{ ok: false, repository: null, errors: ['INVALID_BROWSER_STORAGE'] }`.
- Composed repository fixed-key save/load behavior is preserved.
- Explicit storage input does not cause global `localStorage` reads.
- Composition itself does not call load/save or mutate storage.
- Source isolation from startup, `state.js`, writers, backup, UI, migration, global browser storage acquisition, and legacy fallback removal is covered.
- This composition helper alone does not represent production bootstrap, state replacement, autosave, writer integration, backup import/export, UI persistence, migration, or legacy fallback removal; production startup coverage is listed separately above.


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
- 已覆蓋 planning/accounting boundary：預估消耗與 safe-start stock 只作為規劃顯示；正式扣帳使用使用者填入的 actual consumption。
- 已覆蓋 blank/invalid actual consumption 在任何 mutation 前阻擋，不得消耗材料、不得扣 cash、不得新增成品或 transaction。
- 已覆蓋材料規劃彙總：相同 material key + city 合併，順序不影響結果；不同 material/city 分開；未勾選或 invalid qty row 忽略；`actualMainQty` / `actualSubQty` 不影響 planning helper；主料/副料皆受保護；alchemy aggregation 維持既有行為。
- UI 操作流程、RRR 顯示與實際配方選擇仍需手測。

**📥 [前置狀態]**
* 系統現金餘額：10,000,000
* T6.1 鋼條：庫存 100，全域均價 8,000
* T6.1 布料：庫存 50，全域均價 6,000

**🧪 [使用者操作]**
* 在製作模組，選擇製作 10 把需要鋼條（主料）與布料（副料）的武器。
* 選擇城市：Thetford（locationId: `thetford`）。
* 系統預估稅金/使用費：5,000。
* 製作完成後填入實際材料消耗。
* 點擊「開始製作」。

**📤 [預期結果]**
* ✅ 材料規劃：預估消耗與 safe-start stock 只作為備料顯示，不是正式扣帳數量。
* ✅ 材料庫存：T6.1 鋼條與 T6.1 布料庫存依使用者填入的實際消耗正確減少。
* ✅ 成品庫存：Thetford（locationId: `thetford`） 的該武器庫存增加 10。
* ✅ 現金變化：現金只扣除本次製作現金支出（例如店鋪使用費、神器成本、鍊金成本），絕對不再次扣除已在庫存中的材料成本。
* ✅ 成品均價：該武器的全域均價被正確計算（計算公式包含實際消耗材料的均價總和 + 本次製作現金支出）。
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
- 覆蓋 delete confirmation wording 與 current non-empty deletion guard 一致。
- 覆蓋 cancellation no-mutation：custom locations、registry、inventory、transactions 不變，且不顯示 success/error toast。
- 覆蓋 confirmed non-empty deletion blocked：registry entry 維持 active、runtime custom location 保留、inventory 不變，並顯示 error toast。
- 覆蓋 confirmed empty deletion success：registry entry deactivated、runtime custom location 與 `qtyByCity` bucket 移除、unrelated inventory 保留，並顯示 success toast。
- Boundary：這不代表 inactive-location UI、full component stable `locationId` adoption、`qtyByLocation` writer migration、automatic legacy migration 或 legacy fallback removal 已完成。

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
* ✅ 遊戲估價單價與總價互相換算。
* ✅ 90% P2P 參考值顯示 `90,000`。
* ✅ 85% P2P 參考值顯示 `85,000`。
* ✅ 實售單價與實售總價互相換算，且使用者可手動覆寫。
* ✅ 顯示 Total Cost、Est. GP、Unit GP 與 GP %；若 `globalAvgCost` unknown，顯示成本未知，不顯示假毛利。
* ✅ 固定 6.5% market tax estimate 不再作為 P2P sale popup 的主要資訊。
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

## Future Test Plan：Account-total Inventory And Ledger English Presentation

本節只列 future test plan，不代表目前已測試，也不代表 `src`、storage schema、transaction payload、runtime bridge、codec、backup 或 migration 已修改。

### Ledger English Presentation（Future）

- Category mapping：legacy stored `type` 可映射到英文 display category。
- Multiple stored aliases map to one Ledger display category，例如 `庫存校正` 與 `INVENTORY_ADJUSTMENT` 顯示為 `Inventory Adjustment`。
- Category filter / grouping deduplicates aliases by display category。
- English recipe item resolution：成品可解析為英文顯示名稱。
- Material English mapping：鋼條、布料、板材、皮革可顯示英文名稱。
- Artifact English item resolution。
- Alchemy English item resolution。
- Unknown special-material item falls back safely。
- Unknown item fallback：未知品項顯示原始值且不 crash。
- Stored transaction unchanged：英文顯示不得改寫 stored transaction payload。

### Product Account-total Inventory（Rejected / Superseded Proposal）

0.5.0 decision: Product Inventory remains location-based. These account-total product tests are retained only as historical proposal context and are not the selected target.

- Crafting output increases product `totalQty`。
- Sale decreases product `totalQty`。
- Crafting city does not create product city bucket。
- Sale city remains metadata and does not select product inventory bucket。
- Product excluded from transport。
- Dashboard valuation uses product `totalQty`。
- Restart round-trip preserves account-total product quantity and cost basis。

### Special Inventory（Future）

- Artifact and alchemy use separate lists under one special material module。
- Artifact / alchemy identity is Tier only；no enchant dimension。
- Purchase supports unit-price entry。
- Purchase supports total-price entry。
- Global WAC is maintained for special materials。
- Manufacturing consumption is fixed and does not apply return rate。
- Special materials do not create regional inventory and cannot be transported。
- Special Material scope is selected as account-total `totalQty`; executable production-integration tests still require separate approval。

## Future Test Plan：0.5.0 Production Bonus / Profile / Consumption Pure Contract

Status: Planned / not yet test-covered.

Canonical decision source: [0.5.0 Crafting Domain Model](./CRAFTING_DOMAIN_MODEL.md).

The next active checkpoint should add pure tests only. These tests must not touch DOM, runtime state, storage, backup, UI, cash, transactions, or production Crafting integration.

Planned coverage:

- Royal city general recipe LPB.
- Royal city specialized recipe LPB.
- Hideout general power-level table parity.
- Hideout specialized `regionQuality` / power-level matrix parity.
- Focus adds `59` LPB percent points.
- Daily bonus accepts `0`, `10`, and `20` percent points.
- Matching vs non-matching region specialization.
- Invalid Production Profile rejected.
- Invalid event parameters rejected.
- RRR formula uses `1 - 1 / (1 + totalLpbPercent / 100)`.
- RRR is not rounded in the domain layer.
- Batch regional material consumption uses `gross - floor(gross * rrr)`.
- Manual override validates non-negative integer input.
- Manual override returns calculated and applied consumption.
- Manual override result shape includes `overrideEnabled`, `calculatedConsumedQuantity`, `appliedConsumedQuantity`, and `consumptionSource: 'manual-override'`.
- Stale override values must not be silently copied to another queue row.
- Special Material receives no RRR and no manual override.
- Input objects remain immutable.
- Results are structured success/failure objects.
- Pure functions do not access DOM, state, storage, backup, UI, cash, transactions, or `saveState()`.

### Cost Adjustment（Future）

- Cost adjustment causes no cash change。
- Cost adjustment records valuation delta。
- Cost adjustment preserves old/new cost evidence。
- Cost adjustment records quantity basis。
- Ledger must not show cost adjustment as false cash-out display。
- Stored legacy cost-adjustment fallback remains readable until an approved event migration exists。

## v0.4.4 Release Checkpoint Coverage

本節記錄 v0.4.4 checkpoint 的 docs-only 測試狀態同步。使用者提供的 checkpoint baseline：`354 pass / 0 fail`。本次文件同步不執行 `npm test`，也不修改 tests。

### Planner / Quotation Covered Scope

- Planner is a read-only quotation calculator.
- Planner does not mutate inventory, cash, transactions, or storage.
- Explicit queue handoff can add a transient crafting plan into `craftingQueue`.
- Queue handoff is not crafting completion and does not perform accounting mutation.
- Planner supports manual material estimates, shop fee, game estimate unit/batch, 90% / 85% references, custom quote, and 8% / 10% target gross-margin references.
- Planner discount controls include 0% / 5% / 6% / 7%.
- Crafting and Planner share the Item Picker sourced from `RECIPES`.
- Planner does not directly use `ALBION_DB` as product selector source.

### Ledger Presentation Covered Scope

- Ledger category display maps stored raw values to English display categories.
- Ledger item display maps recipe/material/special/laborer values to English display names where possible.
- Raw transaction payload remains unchanged.
- Search can match raw stored value and display value.
- Alias display deduplication maps multiple raw aliases to one display category.
- This coverage does not implement canonical transaction migration.
- Cost Adjustment cash-impact semantics remain pending.

### Custom Location Covered Scope

- Custom location add / rename / remove uses stable custom location IDs.
- Active entries appear in runtime custom location display.
- Inactive entries keep their original `displayName`.
- Re-adding an inactive display name creates a new ID.
- Runtime display excludes inactive custom entries.
- Restart round-trip and save failure rollback are covered.
- This does not define per-location hideout crafting profile, map bonus / focus RRR metadata, backup/reset lifecycle, or migration.

## Future Test Plan：Special Material Formal Inventory

本節只列 future test plan / not yet implemented。正式測試必須等 `SPECIAL_MATERIAL_INVENTORY.md` 的 target scope、identity contract、writer boundary、backup/rollback 與 compatibility mode 決策完成後再落地。

### Purchase / Intake

1. Artifact purchase success。
2. Alchemy purchase success。
3. Quantity increases。
4. WAC updates。
5. Cash decreases。
6. Purchase transaction is created。
7. Save failure rollback restores inventory, cash, transaction and storage effects。
8. Invalid quantity / price / material / location blocks before mutation。

### Crafting

9. Artifact requirement validation。
10. Alchemy Tier requirement validation。
11. No return rate is applied to special materials。
12. Insufficient special material blocks before mutation。
13. Crafted output cost includes special-material cost。
14. Crafted output cost uses special-material WAC in formal inventory mode。
15. Manual cost input does not silently mix with formal inventory cost。
16. Transaction / inventory / cash atomicity。

### Location

17. Purchase / craft location may be recorded as metadata only and must not create a Special Material inventory bucket。
18. Active custom location behavior。
19. Inactive custom location is blocked。
20. Custom location rename does not affect Special Material account-total quantity。

### Compatibility

21. Manual-cost legacy path remains available during compatibility period。
22. Formal mode does not read manual estimate as inventory evidence。
23. Backup round-trip。
24. Unknown material ID blocks。
25. No silent migration。
