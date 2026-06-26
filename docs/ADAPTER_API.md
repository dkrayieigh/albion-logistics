# Albion Logistics ERP Adapter API Draft

## 1. 文件定位

本文件是 adapter-first migration 的 future API draft。

本文件不代表完整 adapter layer 已存在，不代表 migration 已開始，也不要求修改 storage key 或 transaction payload。

Current src behavior remains the source of truth。legacy 中文 item key、`qtyByCity`、legacy transaction payload 仍是 supported current legacy-compatible behavior。

Stable ID、`qtyByLocation`、Location Registry 與 canonical event payload 仍是 future target / migration target，不得寫成 current implementation。

## 2. Non-goals

- 不要求 `src` 修改。
- 不要求 `tests` 修改。
- 不新增 adapter module。
- 不新增 migration。
- 不改 storage key。
- 不改 transaction payload。
- 不刪除 legacy fallback。
- 不新增正式 regression test。
- 不新增 `test.todo`。
- 不把 Stable ID、`qtyByLocation`、canonical event payload 寫成 current implementation。

## 3. API Design Rules

- Adapter API 必須是 pure read / normalize boundary，不得直接修改 `state`。
- Adapter API 必須先支援 current legacy-compatible data。
- Adapter API 可以描述 future target input，但不得要求現有 storage 立即改寫。
- Adapter API 回傳值應可被測試比較，避免依賴 UI 字串或隱含 side effect。
- Adapter API 遇到不明確 mapping、衝突 mapping 或無法保證相容的資料時，必須回傳明確錯誤或拋出受控錯誤。
- Adapter API 不得回溯重算 `globalAvgCost`。
- Adapter API 不得物理刪除 legacy transaction、legacy item key、legacy `qtyByCity` 或 legacy backup fallback。

## 4. Item Identity Adapter API

### `resolveItemIdentity(input)`

Minimal read-only implementation exists in `src/adapters/itemIdentity.js`.

This does not start Stable ID migration, does not create a Stable ID catalog, does not replace legacy Chinese item keys, and does not require inventory/crafting/laborer writers to use Stable ID yet. Storage keys remain unchanged.

**input**

- legacy item key，例如 `鋼條_6.2`。
- future item identity sample，例如 `{ stableId, itemLevel }`。
- optional mapping table：legacy 中文 key ↔ Stable ID。

**output**

- normalized item identity draft：
```js
{
  legacyItemKey: String,
  stableId: String | null,
  itemLevel: String | null,
  displayName: String | null,
  source: "legacy" | "future"
}
```

**error behavior**

- missing item mapping must fail explicitly。
- mapping 衝突不得靜默覆寫。
- 無法安全解析 `itemLevel` 時必須回傳明確錯誤，不得猜測。

**must not mutate state**

- 不得修改 `state.inventory`。
- 不得改寫 legacy item key。
- 不得建立 Stable ID storage key。

**must support legacy data**

- 必須支援 current legacy 中文 item key。
- 必須支援 current `qtyByCity` 相關流程中的 legacy key。

**future implementation boundary**

- Stable ID 仍是 future target。
- 禁止拆解 `itemKey` 是 migration boundary，不是 current implementation。
- Minimal item identity adapter 已存在，但不得宣告 Stable ID migration、Stable ID catalog、storage key migration 或 legacy item key replacement 已完成。

## 5. Location Adapter API

### `normalizeLocationMap(input)`

Minimal read-only implementation exists in `src/adapters/locationAdapter.js`.

This does not start migration, does not replace `qtyByCity`, and does not require backup import/export to use this adapter yet.
Location Registry remains a future target. `qtyByLocation` remains a future target / sample support only.

Inventory render/display path has minimal compatibility with normalized Location Adapter entries.

This is reader/display compatibility only. The `qtyByCity` writer is unchanged, `qtyByLocation` migration has not started, Location Registry has not been created, purchase / transport writers are unchanged, storage shape remains legacy-compatible, backup import/export paths are unchanged, and `globalAvgCost` behavior is unchanged.

**input**

- legacy quantity map，例如 `qtyByCity`。
- future quantity map sample，例如 `qtyByLocation`。
- optional location mapping：custom location name ↔ future locationId。

**output**

- normalized location quantity draft：
```js
{
  sourceFormat: "qtyByCity" | "qtyByLocation",
  quantities: Record<string, number>,
  unresolvedLocations: string[]
}
```

**error behavior**

- 同一實體地點 mapping 到多個 target 時必須報錯。
- 多城市 `qtyByCity` backup 匯入後，任何地點數量遺失都必須視為錯誤。
- 數量不是 finite number 時必須回傳明確錯誤。

**must not mutate state**

- 不得修改 `state.inventory`。
- 不得將 `qtyByCity` 寫回為 `qtyByLocation`。
- 不得新增、刪除或更名 `customLocations`。

**must support legacy data**

- 必須支援 legacy `qtyByCity`。
- 必須支援 custom location name key。
- 必須保留非空自訂倉庫不得刪除的資料安全前提。

**future implementation boundary**

- `qtyByLocation` 與 Location Registry 仍是 future target。
- Minimal read-only location adapter exists, but no writer path or migration uses it yet.
- Minimal Inventory render/display compatibility exists, but `qtyByCity` writer, purchase / transport writers, backup import/export, storage shape, Location Registry, `qtyByLocation` migration, and `globalAvgCost` behavior remain unchanged.
- Current adapter normalization coverage does not imply migration readiness；migration 前後每個 location 物理數量一致仍需等 migration sample 或 clean-cutover seed validation 建立後才可正式測試。

### `resolveLocationQuantity(input)`

Future helper draft，可在 `normalizeLocationMap()` 之上查詢單一地點數量。

**input**

- normalized location quantity draft。
- legacy location name 或 future locationId。

**output**

- `{ quantity: Number, resolvedLocationKey: String, sourceFormat: String }`

**error behavior**

- location 無法對應時必須明確回傳 unresolved 狀態。

**must not mutate state**

- 只讀取 normalized input，不得寫入 inventory。

**must support legacy data**

- 必須能讀取 legacy city/custom location name。

**future implementation boundary**

- 不得因此宣告 `qtyByLocation` 已取代 `qtyByCity`。

### `resolveLocationIdentity(input)`

Minimal read-only implementation exists in `src/adapters/locationIdentity.js`.

This remains a future identity API draft and current read-only resolver boundary. It does not persist a Location Registry, does not change `normalizeLocationMap()`, does not connect to current writers, does not change storage keys, does not change backup import/export, and does not start Location Registry migration.

**input**

- legacy location display name，例如 `Thetford` 或 custom location string。
- future registry sample entry，例如 `{ locationId, displayName }`。
- optional mapping table：legacy name ↔ future `locationId`。

**output**

- normalized location identity draft：
```js
{
  sourceName: String,
  locationId: String | null,
  displayName: String | null,
  source: "legacy" | "future",
  unresolved: Boolean,
  deprecatedLegacyKey: Boolean
}
```

**error behavior**

- duplicate/conflicting names must become unresolved。
- unknown names must become unresolved。
- no fuzzy matching。
- no silent custom location creation。
- residual deprecated legacy key `Hideout` must become unresolved / `deprecatedLegacyKey: true`。
- malformed mapping entries must become unresolved。
- system mappings cannot be overridden by custom mapping。
- migration must stop while unresolved mappings remain。

**must not mutate state**

- 不得修改 `state.inventory`。
- 不得修改 `state.customLocations`。
- 不得寫入 `qtyByLocation`。
- 不得建立 Location Registry storage。

**must support legacy data**

- Exact system name maps to fixed future system ID。
- Exact legacy key `LaborerIsland` resolves to future fixed special system ID `laborer_island` in the current read-only resolver。
- Exact custom name maps to existing future custom ID only after a mapping exists。
- Legacy literal names must remain readable before migration。
- Deprecated legacy key `Hideout` must remain readable as legacy compatibility data, but must not resolve to a permanent registry ID。
- Unknown names、fuzzy matches、normalized-name conflicts、malformed mappings must resolve as unresolved。

**future implementation boundary**

- `locationId` immutable identity、Location Registry 與 `custom:<generated-id>` 都是 future target。
- `custom:<generated-id>` 是 conceptual format；exact UUID / generator implementation remains future design。
- `LaborerIsland` future mapping to `laborer_island` does not mean writer/storage migration has started。
- `Hideout` must not resolve to a permanent registry ID, must not silently create a custom location, and must be reported as unresolved / deprecated legacy key if it remains during future migration validation。
- Current `loadState()` legacy compatibility exceptions must not be generalized into future rename semantics. Future rename must not rewrite historical raw transaction payload。
- Current writers, inventory display, state load/save, backup import/export, `customLocations`, and storage schema do not use `resolveLocationIdentity()`。
- This API draft does not start migration, does not make Location Registry current implementation, and does not make writer/storage readiness pass.

### `validateLocationMigration(input)`

Minimal read-only implementation exists in `src/adapters/locationMigrationValidator.js`.

This implementation is a read-only research / verification utility. It is not a production migration runner, storage writer, or clean-cutover release blocker.

**input**

- before legacy snapshot。
- after future sample snapshot。
- unresolved mapping report。

**output**

- validation report：
```js
{
  ok: Boolean,
  errors: String[],
  unresolvedMappings: String[]
}
```

**error behavior**

- Any mismatch must fail validation。
- Unresolved mappings must fail validation。
- Failure requires rollback to legacy backup。

**must not mutate state**

- 只產生 validation report，不寫入 storage，不執行 migration。

**historical full-migration research scope**

- Historical full-migration research compared legacy `qtyByCity`, custom location strings, `globalAvgCost`, cash and transaction count.
- Clean cutover no longer requires complete legacy snapshot equality as selected release gate.

**future implementation boundary**

- Validation does not imply migration has started.
- Historical full snapshot validation checked inventory item count, each item/location quantity, global quantity totals, `globalAvgCost`, cash, transaction count, custom location count, and unresolved mapping count before any storage mutation.
- Clean cutover supersedes full automatic Location migration as selected strategy；future validator work may become selected seed data validation for manually entered inventory, cash, and reliable cost basis.
- The validator must not mutate state, rewrite backup, write `qtyByLocation`, connect writers, or remove legacy fallback.

## 6. Transaction Reader Adapter API

### `readTransaction(input)`

Minimal read-only implementation exists in `src/adapters/transactionReader.js`.

This does not start migration, does not replace legacy transaction writers, and does not require Ledger UI to use this adapter yet. Canonical event payload remains future target.

Ledger render/display path has minimal compatibility with normalized transaction reader entries.

This is reader/display compatibility only. Ledger writers are unchanged, reversal / adjustment writer is unchanged, transaction payload remains legacy-compatible, and canonical event payload remains future target.

**input**

- legacy transaction，例如含 `type`、`item`、`quality`、`qty`、`total`、`unitPrice`、`location`。
- future canonical event sample，例如含 `action`、`target`、`cashChange`、`assetValue`、`locationId`。

**output**

- normalized ledger entry draft：
```js
{
  sourceFormat: "legacy" | "future",
  displayType: String,
  itemRef: String | null,
  quantity: Number | null,
  cashImpact: Number | null,
  locationRef: String | null,
  raw: Object
}
```

**error behavior**

- ledger reader must tolerate mixed legacy Chinese type values and `INVENTORY_ADJUSTMENT` without crashing。
- 無法辨識的 transaction type 不得造成 ledger crash，必須回傳 unknown / unsupported 狀態。
- 成本基準校正不得被一般 `INVENTORY_ADJUSTMENT` 默認吸收。

**must not mutate state**

- 不得修改 `state.transactions`。
- 不得改寫 legacy transaction 為 canonical event。
- 不得新增 reversal 或 adjustment。

**must support legacy data**

- 必須支援 legacy 中文 transaction type，例如 `買材料`、`製作入庫`、`賣成品`、`工人島出售`。
- 必須支援 mixed `INVENTORY_ADJUSTMENT`。
- 必須支援 legacy `成本校正` fallback 的可讀性。

**future implementation boundary**

- Canonical event payload 仍是 future target。
- `SELL_ITEM` 仍不是 current implementation。
- Minimal reader adapter 已存在，但不得宣告 ledger 已全面使用 adapter 或已完成 event payload migration。
- Minimal Ledger render/display compatibility exists, but writer, reversal, adjustment and storage paths remain legacy-compatible.

### `normalizeLedgerEntry(input)`

Future helper draft，可作為 `readTransaction()` 的 normalized result shape。

**input**

- legacy transaction 或 future event sample。

**output**

- normalized ledger display data。

**error behavior**

- 不得因缺少 optional 欄位造成 crash。

**must not mutate state**

- 只讀取 input，不寫入 ledger。

**must support legacy data**

- 支援 current legacy transaction payload。

**future implementation boundary**

- 不得要求 current writer 改成 canonical event writer。

## Clean Initialization Adapter API

### `createCleanInitialState(input, options?)`

Minimal pure implementation exists in `src/adapters/cleanInitialState.js`.

This implementation matches the documented input/output contract and is covered by regression tests. It remains isolated: it does not read current state, does not read or write `localStorage`, does not connect to writers, does not connect to backup import/export, does not connect to UI, and does not start migration.

**input**

```js
{
  cash: Number,
  debt?: Number,
  customLocations?: [
    {
      clientRef: String,
      displayName: String
    }
  ],
  inventorySeeds?: [
    {
      itemKey: String,
      locationId?: String,
      customLocationRef?: String,
      quantity: Number,
      globalAvgCost?: Number | null
    }
  ]
}
```

**options**

```js
{
  generateCustomLocationId?: () => String
}
```

**output**

```js
{
  ok: Boolean,
  state: Object | null,
  errors: String[]
}
```

**current implementation status**

- Input/output contract is implemented.
- Fixed registry entries are implemented.
- Future canonical laborer defaults are implemented with `滿日誌`.
- Deterministic generator injection is implemented for pure tests.
- Error codes are returned in documented order and each code appears at most once.
- `INITIALIZATION_ABORTED` is reserved for unclassified internal exception fallback.
- Direct custom generated `locationId` is not accepted as input reference; custom inventory seeds must use `customLocationRef`.

**must not mutate state**

- Does not mutate `input`.
- Does not read or mutate current state.
- Does not read or write `localStorage`.
- Does not write `albion-logistics-v2-state`.
- Does not connect to `state.js`, writers, backup import/export, UI, first-launch flow, or migration.

**future integration boundary**

- Storage adapter boundary remains future work.
- Production startup flow remains future work.
- Production ID generator selection/integration remains future work.
- Writer switch remains future work.
- New backup export/import remains future work.
- UI/manual initialization flow remains future work.

## New-Schema Storage Codec API

### `encodeNewSchemaState(state)`

### `decodeNewSchemaState(serialized)`

Minimal pure implementation exists in `src/adapters/newSchemaStorageCodec.js`.

This codec validates and serializes the documented new schema shape. It is a pure boundary only: it does not read or write `localStorage`, does not connect to global state, does not connect to writers, does not connect to backup import/export, does not connect to UI, does not run startup loading, and does not start migration.

**encode current behavior**

- Validates complete `schemaVersion: 1` state.
- Returns serialized JSON only on success.
- Invalid state returns `serialized: null`.
- Does not fill defaults.
- Does not convert legacy data.
- Does not mutate input.

**decode current behavior**

- Accepts string input only.
- Malformed JSON fails explicitly.
- Parsed state receives full validation.
- Nested JSON-string legacy backup format is not re-parsed.
- Success returns an independent parsed object.
- Invalid state returns `state: null`.

**validation coverage**

- Strict root/model keys.
- Assets validation.
- Fixed/custom Location Registry validation.
- `qtyByLocation` inventory and location references.
- JSON-safe `transactions` and `laborerLogs` containers.
- Canonical laborer categories and qualities.
- Future canonical `滿日誌`.
- Rejects legacy `滿日記本`, `qtyByCity`, and `customLocations`.
- Ordered unique errors.
- `STORAGE_CODEC_ABORTED` is reserved for unclassified internal fallback.

**must not mutate or integrate**

- No `localStorage` access.
- No global state access.
- No writer integration.
- No backup integration.
- No UI integration.
- No startup integration.
- No migration.

**future integration boundary**

- Injected storage repository, explicit injected browser Storage backend binding, and explicit browser new-schema repository composition helper exist; production startup now invokes them through the runtime controller/state API.
- Actual application `albion-logistics-v2-state` get/set remains future work.
- Startup load behavior remains future work.
- Missing/corrupt storage handling remains future work.
- Backup export/import remains future work.
- Writer and UI integration remain future work.

## New-Schema Storage Repository API

### `createNewSchemaStorageRepository(backend)`

Minimal injected implementation exists in `src/adapters/newSchemaStorageRepository.js`.

This repository wraps the pure codec with an injected synchronous key-value backend. It is not bound to global `localStorage`, does not connect to startup, does not connect to `state.js`, does not connect to writers, does not connect to backup import/export, does not connect to UI, and does not start migration.

**factory behavior**

- Returns an object with `load()` and `save(state)`.
- Uses the fixed key `albion-logistics-v2-state`.
- Requires an injected backend with synchronous `getItem(key)` and `setItem(key, value)` methods.
- Calls backend methods with the backend as `this`.
- Does not scan, delete, read, or write legacy keys.

**load current behavior**

- `loaded`: fixed key contains valid serialized new-schema state.
- `missing`: fixed key returns `null`; this is not an error and does not create state.
- `invalid`: fixed key contains serialized data that reaches the codec and fails validation; codec errors pass through.
- `error`: invalid backend, throwing backend getter/method, non-string read result, thenable read result, or backend read failure.
- Corrupt data does not trigger fallback, repair, or legacy import.

**save current behavior**

- `saved`: valid state is encoded and written once to the fixed key.
- `invalid`: invalid state returns codec errors and does not write.
- `error`: invalid backend, throwing backend getter/method, backend write failure, or thenable write result.
- Backend write failure does not retry or clear existing storage.

**boundary**

- No global `localStorage`.
- No startup integration.
- No `state.js` integration.
- No writer integration.
- No backup integration.
- No UI integration.
- No migration.

**future integration boundary**

- Explicit browser Storage backend binding and browser new-schema repository composition helper exist, and production startup now reaches them through `createBrowserNewSchemaRuntimeController(storage)` / state API.
- Startup load coordinator remains future work.
- First-launch decision/confirmation remains future work.
- Current state replacement remains future work.
- Writer, backup, and UI integration remain future work.

## Browser Storage Backend Binding API

### `createBrowserStorageBackend(storage)`

Minimal isolated implementation exists in `src/adapters/browserStorageBackend.js`.

This helper binds an explicitly injected browser `Storage`-like object to the repository-compatible key-value backend shape. It does not acquire global `localStorage`, does not run at startup, does not persist application state by itself, and does not connect to `state.js`, writers, backup import/export, UI, or migration.

**input**

- `storage`: an explicit Storage-like object supplied by the caller.
- Required methods: synchronous `getItem(key)` and `setItem(key, value)`.

**output**

- Success: `{ ok: true, backend, errors: [] }`.
- `backend.getItem(key)` delegates to `storage.getItem(key)`.
- `backend.setItem(key, value)` delegates to `storage.setItem(key, value)`.
- Failure: `{ ok: false, backend: null, errors: ['INVALID_BROWSER_STORAGE'] }`.

**error behavior**

- Factory validation failure returns `INVALID_BROWSER_STORAGE`.
- Invalid or throwing method getters are factory validation failures.
- Operation throws from `getItem` / `setItem` are not reclassified here; the repository classifies read/write failures.

**this binding**

- Delegated storage methods are called with the original `storage` object as `this`.

**argument passthrough**

- Keys and values are forwarded unchanged.
- The helper does not transform keys, coerce values, inspect schema, or choose a storage key.

**isolation boundary**

- Does not access `globalThis`, `window`, `document`, or global `localStorage`.
- Does not scan `length`, call `key(index)`, call `removeItem`, delete data, or inspect unrelated keys.
- Does not compose itself with `createNewSchemaStorageRepository(backend)` in production.
- Does not connect startup, `state.js`, writers, autosave, backup import/export, UI, migration, or legacy fallback.

## Browser New-Schema Repository Composition API

### `createBrowserNewSchemaRepository(storage)`

Minimal isolated implementation exists in `src/adapters/browserNewSchemaRepository.js`.

This helper only composes two existing helpers:

```js
explicit Storage-like object
  -> createBrowserStorageBackend(storage)
  -> createNewSchemaStorageRepository(binding.backend)
```

It does not acquire global `localStorage`, does not call `load()`, does not call `save(state)`, does not run at startup, does not persist application state by itself, and does not connect to `state.js`, writers, backup import/export, UI, migration, or legacy fallback.

**input**

- `storage`: an explicit Storage-like object supplied by the caller.
- Required methods are inherited from `createBrowserStorageBackend(storage)`: synchronous `getItem(key)` and `setItem(key, value)`.

**output**

- Success: `{ ok: true, repository, errors: [] }`.
- `repository` is the result of `createNewSchemaStorageRepository(binding.backend)`.
- Failure: `{ ok: false, repository: null, errors: ['INVALID_BROWSER_STORAGE'] }`.

**error behavior**

- Browser storage binding validation errors pass through unchanged.
- This helper does not create a new storage error taxonomy.
- Repository operation errors remain handled by repository `load()` / `save(state)` calls after composition.

**composition boundary**

- Composition itself performs zero storage operations.
- It does not read from storage, write to storage, inspect keys, call `load()`, call `save(state)`, or mutate the injected storage object.
- It does not read `globalThis`, `window`, `document`, or global `localStorage`.

**production integration boundary**

- Not a startup loader.
- Not production persistence integration.
- Not state replacement.
- Not autosave or writer integration.
- Not backup import/export integration.
- Not migration or legacy fallback removal.

## Browser New-Schema Startup API

### `loadBrowserNewSchemaState(storage)`

已存在最小 isolated implementation，位置為 `src/adapters/browserNewSchemaStartup.js`。

**輸入**

- `storage`: 明確傳入的 Storage-like object。
- 不自行取得 global `localStorage`。

**輸出**

- `loaded`: 固定 key `albion-logistics-v2-state` 內有可解碼的新 schema state。
- `missing`: 固定 key 不存在。
- `invalid`: 固定 key 有資料，但 codec validation 失敗。
- `error`: browser storage binding 或 storage read 失敗。

**隔離邊界**

- 只讀固定 key。
- 不寫入 storage。
- 不掃描、刪除或檢查 legacy keys。
- 不接 app startup、`state.js`、writer/autosave、backup、UI 或 migration。

### `resolveBrowserNewSchemaStartup(storage)`

已存在最小 isolated startup decision helper。

**輸入**

- `storage`: 明確傳入的 Storage-like object。

**輸出**

- `loaded` -> `{ ok: true, mode: 'ready', state, sourceStatus: 'loaded', errors: [] }`。
- `missing` -> `{ ok: true, mode: 'initialize', state: null, sourceStatus: 'missing', errors: [] }`。
- `invalid` / `error` -> `{ ok: false, mode: 'blocked', state: null, sourceStatus, errors }`。

**錯誤邊界**

- `invalid` / `error` 絕不建立空資料。
- 不執行 first-launch UI。
- 不替換 runtime state。
- 不開始 production startup integration。

## New-Schema Runtime Bridge API

### `projectNewSchemaToRuntime(newSchemaState)`

已存在最小 isolated bridge implementation，位置為 `src/adapters/newSchemaRuntimeBridge.js`。

**輸入**

- Canonical new-schema state。

**輸出**

- 成功：`{ ok: true, state, errors: [] }`，其中 runtime `state.inventory` 使用 `qtyByCity`。
- 失敗：`{ ok: false, state: null, errors: ['RUNTIME_LOCATION_MAPPING_FAILED'] }`。

**轉換規則**

- `qtyByLocation` -> `qtyByCity`。
- `laborer_island` -> `LaborerIsland`。
- `滿日誌` -> `滿日記本`。
- 保留 `locationRegistry` 與 custom location ID。

**隔離邊界**

- Pure projection（純轉換）：不 mutate input。
- 不讀寫 storage。
- 不接 `state.js`、writer、backup、UI 或 migration。
- 不是 production state replacement。

### `projectRuntimeToNewSchema(runtimeState)`

已存在最小 isolated reverse bridge implementation。

**輸入**

- Runtime-compatible state，包含保留的 `locationRegistry`。

**輸出**

- 成功：`{ ok: true, state, errors: [] }`，其中 canonical `state.inventory` 使用 `qtyByLocation`。
- 失敗：`{ ok: false, state: null, errors: ['RUNTIME_LOCATION_MAPPING_FAILED'] }`。

**轉換規則**

- `qtyByCity` -> `qtyByLocation`。
- `LaborerIsland` -> `laborer_island`。
- `滿日記本` -> `滿日誌`。
- 保留 `locationRegistry` 與 custom location ID。

**失敗邊界**

- Unknown location mapping 會整體失敗。
- Ambiguous display-name mapping 會整體失敗。
- Runtime `customLocations` 若已和 `locationRegistry` 不一致，會整體失敗；因此自訂倉庫 runtime 變更目前尚不能安全反向儲存。

**production integration boundary**

- 不是正式 writer integration。
- 不是 canonical save path。
- 這個 bridge helper 本身不切換 `saveState()`；production state API 會在 runtime controller active 時使用它。
- 不改 backup import/export。
- 不開始 migration。

## Browser New-Schema Runtime Controller API

### `createBrowserNewSchemaRuntimeController(storage)`

已存在 production state persistence boundary implementation，位置為 `src/adapters/browserNewSchemaRuntimeController.js`。

**輸入**

- `storage`: production app 明確傳入的 Storage-like object。
- 透過 `createBrowserNewSchemaRepository(storage)` 建立 repository。

**輸出**

- 成功：`{ ok: true, controller, errors: [] }`。
- 失敗：`{ ok: false, controller: null, errors }`。

**`controller.start()`**

- `loaded` / `ready`: 讀取 `albion-logistics-v2-state`，將 canonical new-schema state project 成 runtime state。
- `missing` / `initialize`: 回傳 initialize decision，不自行建立資料。
- `invalid` / `error`: 回傳 blocked，不 fallback 到 legacy，也不覆寫空資料。
- Projection failure 回傳 `{ ok: false, mode: 'blocked', sourceStatus: 'projection-error', errors }`。

**`controller.save(runtimeState)`**

- 先用 `projectRuntimeToNewSchema(runtimeState)` 將 runtime state 轉回 canonical state。
- Projection 成功後呼叫 repository `save(projected.state)` 寫入新 key。
- Projection 失敗回傳 `status: 'invalid-runtime'`。

**邊界**

- 這是 production state persistence boundary，但不是 backup import/export、migration、transaction payload migration 或 custom location writer migration。
- 不轉換 legacy backup。
- 不移除 legacy fallback。

## Production State API Boundary

### `enableNewSchemaRuntime(storage)`

位於 `src/core/state.js`，已由 production app startup 使用。

- 建立 browser new-schema runtime controller。
- `ready` 時以 runtime bridge 輸出替換 in-memory runtime `state`。
- 執行 runtime default hydration。
- 啟用 `activeNewSchemaRuntimeController`，讓後續 `saveState()` 寫入 new-schema key。
- `blocked` 時不啟用 controller。

### `initializeNewSchemaRuntime(storage, input, options)`

位於 `src/core/state.js`，用於 first-launch confirmed clean initialization。

- 建立 clean canonical state。
- 經 runtime bridge project 到 runtime state。
- 透過 controller save 寫入 `albion-logistics-v2-state`。
- 再次 start 並啟用 runtime controller。
- 初始化失敗或 save 失敗會 blocked，不建立空資料。

### Production startup behavior

位於 `src/app.js` 的 `startApplicationState(storage, dialogs)`。

- ready: 啟用 new-schema runtime。
- initialize + confirm: 建立 clean canonical state，保存 new key，啟用 runtime。
- initialize + cancel: 明確進入 legacy mode。
- blocked: 顯示錯誤，不 fallback，不覆寫空資料。

### `saveState()` boundary

- runtime controller active 時，`saveState()` 透過 controller save 寫入 new-schema key。
- legacy mode 或 controller inactive 時，`saveState()` 仍寫 legacy `albion_crafting_*` keys。
- 這不是 migration，也不代表 backup import/export 已更新。

## 7. Backup Compatibility Adapter API

### `readBackupSnapshot(input)`

Future adapter API draft。此 API 尚未存在。

**input**

- current backup object。
- legacy JSON-string backup。
- future sample backup。

**output**

- normalized backup snapshot draft：
```js
{
  inventory: Object,
  assets: Object,
  transactions: Array,
  customLocations: Array,
  laborerInventory: Object,
  warnings: String[]
}
```

**error behavior**

- 無效 JSON、缺少必要欄位或欄位型別錯誤時必須明確失敗。
- 匯入失敗不得覆寫 `localStorage`。
- rollback path 必須保留 legacy backup 可回復。

**must not mutate state**

- 不得直接寫入 `localStorage`。
- 不得直接呼叫 migration。
- 不得改寫 backup payload。

**must support legacy data**

- 必須支援 legacy 中文 item key。
- 必須支援 legacy `qtyByCity` multi-location inventory。
- 必須支援 `customLocations` 字串陣列。
- 必須支援大量 legacy transactions。

**future implementation boundary**

- Backup adapter 尚未存在。
- Future sample backup 僅作 adapter 測試素材，不代表 migration 已開始。

### `validateBackupCompatibility(input)`

Future helper draft，用於 adapter 前置驗證。

**input**

- normalized backup snapshot draft。

**output**

- compatibility report：
```js
{
  ok: Boolean,
  errors: String[],
  warnings: String[]
}
```

**error behavior**

- inventory quantity、transaction count、cash 或 `globalAvgCost` 無法驗證時必須失敗或警告。

**must not mutate state**

- 只產生 report，不寫入 storage。

**must support legacy data**

- 支援 current backup regression 覆蓋的 object / array 與 legacy JSON-string backup。

**future implementation boundary**

- 不得取代現有 import/export 行為。

## 8. Error Handling Boundary

- Adapter error 必須可區分 malformed input、missing mapping、mapping conflict、unsupported future sample 與 unsafe mutation request。
- Adapter error 不得被靜默轉成空資料。
- Adapter error 不得導致部分寫入。
- Adapter error 不得回溯重算 `globalAvgCost`。
- Adapter error 不得刪除 legacy fallback。

## 9. Test Boundary

Test planning anchors 可作為未來 adapter/migration 前置測試入口，但本文件不新增 test，也不新增 `test.todo`：

- missing item mapping must fail explicitly。
- importing legacy `qtyByCity` multi-location backup must preserve every location quantity。
- ledger reader must tolerate mixed legacy Chinese type values and `INVENTORY_ADJUSTMENT` without crashing。

Covered regression behavior remains authoritative for current stable behavior：

- legacy 中文 item key + `qtyByCity` 仍可用。
- 備份匯出 / 匯入 schema 與原子性仍受測試保護。
- 採購 reversal 保留原始交易並新增 adjustment。
- 核心 `globalAvgCost`、WAC、工人匯入與製作成本規則仍受測試保護。

Adapter-only tests 必須等 adapter module 建立後才能成為正式 regression tests。

## 10. Migration Boundary

- Adapter API draft 不等於 migration plan 已開始執行。
- 任何 migration track 開始前，必須先有 compatibility tests、backup validation 與 rollback boundary。
- 不得直接全域改寫 storage key。
- 不得直接全域改寫 transaction payload。
- 不得在同一 release 移除 legacy fallback。
- Stable ID、`qtyByLocation`、Location Registry 與 canonical event payload 必須維持 future target / migration target 定位，直到 adapter、tests、backup validation 與 release boundary 均完成。

## 11. 不得寫成 Current Implementation

以下內容不得寫成目前已完成：

- Adapter module 已存在。
- Migration 已開始。
- 系統已全面使用 Stable ID。
- 系統已全面使用 `qtyByLocation`。
- `customLocations` 已全面是 Location Registry object。
- Ledger 已全面使用 canonical event payload。
- `SELL_ITEM` 已是 current implementation。
- Legacy 中文 item key 不再需要相容保護。
- Legacy `qtyByCity` 不再需要相容保護。
- Legacy transaction payload 不再需要相容保護。
- Legacy backup fallback 不再需要相容保護。
