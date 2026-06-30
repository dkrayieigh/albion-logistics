# New-schema Backup / Reset Contract

Status: Active contract
Authority: Approved data-safety specification
Current implementation: Not implemented
Last reviewed: 2026-06-30

本文件是 active data-safety contract。它定義 new-schema backup / import / reset 的資料安全邊界，不代表 production export、production import、Factory Reset、`app.js` wiring、storage schema、transaction payload 或 UI 已完成。

Implementation order:

```text
docs
-> tests
-> pure service
-> production integration
```

## Current Implementation Baseline

Current implementation facts:

1. Active new-schema storage key: `albion-logistics-v2-state`.
2. Current canonical state uses `schemaVersion === 1`.
3. Current production export still reads legacy localStorage keys.
4. Current production import still validates legacy fields and writes legacy keys.
5. Current Factory Reset uses `localStorage.clear()`.
6. Existing new-schema codec can encode/decode canonical state and validate `schemaVersion`, `assets`, `locationRegistry`, `inventory`, `transactions`, `laborerInventory`, and `laborerLogs`.
7. Existing new-schema repository supports injected `getItem` and `setItem`.
8. Reset / rollback requires a future `removeItem` backend capability.

Future contract language below must not be described as current implementation.

## v2 Backup Envelope

Exact envelope:

```json
{
  "format": "albion-logistics-backup",
  "backupFormatVersion": 1,
  "exportedAt": "2026-06-30T00:00:00.000Z",
  "state": {
    "schemaVersion": 1
  }
}
```

Root keys:

- `format`
- `backupFormatVersion`
- `exportedAt`
- `state`

Rules:

1. `format` must exactly equal `albion-logistics-backup`.
2. `backupFormatVersion` must be integer `1`.
3. `backupFormatVersion` and `state.schemaVersion` are separate:
   - `backupFormatVersion` describes the backup envelope.
   - `schemaVersion` describes the canonical state.
4. `exportedAt` is required, must be a canonical ISO-8601 UTC millisecond string, and is informational metadata only.
5. `state` must be canonical state and must pass the existing new-schema codec.
6. `state` must not be runtime `qtyByCity` projection.
7. `state` must not contain legacy backup fields.
8. Do not add `appVersion`, `deviceId`, `userId`, or similar metadata in this contract.
9. Do not introduce a new `schemaVersion` outside the canonical state root.

## Export Source Contract

Future application service must source v2 export through the injected new-schema repository:

1. Call repository `load()`.
2. Only `ok: true` and `status: loaded` may enter backup codec creation.
3. `missing` returns `BACKUP_SOURCE_MISSING`.
4. `invalid` returns `INVALID_BACKUP_STATE` with inner codec errors where available.
5. `error` returns `STORAGE_READ_FAILED` or repository-derived storage errors.
6. Do not export from runtime state.
7. Do not call `projectRuntimeToNewSchema` as export source.
8. Do not read legacy keys.
9. Do not fallback.

Pure backup codec only receives already-loaded canonical state. Repository orchestration belongs to the future application service layer.

v2 export must use:

- canonical state loaded from the injected new-schema repository
- existing new-schema codec validation

v2 export must not use:

- runtime legacy projection
- `state.inventory` in `qtyByCity` compatibility shape
- any legacy localStorage key
- silent fallback to legacy export

Export flow:

1. Load canonical state through the injected new-schema repository.
2. Validate canonical state.
3. Create backup envelope.
4. Serialize readable JSON.
5. If validation fails, do not create download text and do not start UI write/download behavior.

Pure service returns backup text / result only.

UI integration responsibilities are separate:

- confirm
- Tauri save dialog
- fs write
- browser Blob download
- toast

## exportedAt Contract

Canonical timestamp rule:

- `typeof exportedAt === 'string'`
- `Date.parse(exportedAt)` is finite
- `new Date(exportedAt).toISOString() === exportedAt`

Accepted shape:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

Create-backup rule:

- Pure codec receives explicit `exportedAt` as an option.
- Pure codec must not use ambient current time by itself.
- Production integration may pass `new Date().toISOString()`.

Future tests:

- canonical millisecond UTC timestamp accepted
- UTC string without milliseconds blocked
- date-only string blocked
- invalid date blocked
- timezone offset string blocked even if `Date.parse` accepts it

## Backup Classification

Import must use strict classification and must not guess.

### v2 backup

Required:

- root object
- `format === "albion-logistics-backup"`
- `backupFormatVersion` exists
- `state` exists

### legacy backup

Legacy backup has no v2 format marker and must contain all three required root fields:

- `inventory`
- `assets`
- `transactions`

Common optional legacy fields:

- `laborerInventory`
- `laborerLogs`
- `customLocations`

Missing any required field means invalid, not legacy. Classification does not mean the full legacy validation has already passed.

### ambiguous / invalid

Must reject:

- mixed v2 envelope and legacy root fields
- malformed format marker
- unknown `backupFormatVersion`
- v2 marker without valid `state`
- missing legacy required fields
- array / null / non-object root

Rules:

- Unknown v2 format must not fallback to legacy.
- Legacy backup must not be converted into v2 by classification.
- Shallow merge is forbidden.
- Nested field merge is forbidden.

## Legacy Backup Policy

1. Legacy backup path remains preserved.
2. Legacy backup is not v2 envelope.
3. Legacy backup does not auto-migrate.
4. Explicit legacy mode may continue to use legacy import/export.
5. Active v2 mode encountering legacy backup must:
   - not write v2 key
   - not auto-convert
   - report that legacy backup requires explicit legacy path
6. v2 import must not remove or mutate legacy keys.
7. v2 export must not read legacy keys when v2 state is missing or invalid.
8. Legacy migration remains high-risk future work and is paused.

## v2 Import Validation

Before storage mutation, perform:

1. text type validation
2. JSON parse
3. envelope root exact-key validation
4. format validation
5. `backupFormatVersion` validation
6. `exportedAt` validation
7. `state` validation
8. canonical codec validation

Any failure means:

- zero storage mutation
- zero runtime mutation
- no reload
- no legacy-key mutation

## v2 Import Commit / Atomicity

v2 import writes only:

```text
albion-logistics-v2-state
```

It must not write legacy keys.

Commit flow:

1. Read current v2 raw value as snapshot.
2. Complete all in-memory validation.
3. Encode validated canonical state to storage serialized state.
4. `setItem` v2 key.
5. `getItem` read-back.
6. Decode read-back value.
7. Compare read-back canonical state with import state.
8. Only then report committed.

If `setItem`, read-back, or verification fails:

- restore previous v2 value if it existed
- remove the key if the previous value was absent and a partial write occurred
- do not mutate legacy keys
- do not reload

If rollback itself fails:

- return `ROLLBACK_FAILED`
- do not claim success
- do not reload
- UI must show fatal data-safety error

Do not mutate active runtime object before verified save.

## Reload Timing

Pure service must not call:

- `location.reload()`
- toast
- alert
- confirm

Production UI may follow this rule:

- invalid / cancel / failure: no reload
- successful verified v2 import: may reload once
- successful scoped reset: may reload once
- reload must happen after commit and verification complete

Zero-mutation paths must not reload.

## Owned Storage Keys

Current Albion Logistics owned keys:

1. `albion-logistics-v2-state`
2. `albion_crafting_stocks`
3. `albion_crafting_assets`
4. `albion_crafting_transactions`
5. `albion_crafting_laborer_stocks`
6. `albion_crafting_laborer_logs`
7. `albion_crafting_custom_locs`

Rules:

- Owned keys must be explicit registry entries.
- Do not use prefix wildcard deletion.
- Do not use `localStorage.clear()`.
- Adding a new owned key must update registry and tests.
- Do not delete unknown keys even if they look related.

## Scoped Factory Reset Contract

Factory Reset target:

- remove only Albion Logistics owned keys

Non-goals:

- no mode-specific partial reset in this contract
- no automatic legacy data migration
- no hidden deletion of unrelated origin storage

Reset flow:

1. UI obtains explicit user confirmation.
2. Service snapshots currently existing owned-key raw values.
3. Remove owned keys.
4. Verify owned keys no longer exist.
5. Do not enumerate or inspect unrelated keys.
6. Only then report reset-complete.

If remove or verification fails:

- restore snapshot for all owned keys that existed before reset
- ensure owned keys that did not exist before reset remain absent
- keep unrelated keys unchanged
- return `ROLLBACK_FAILED` if rollback fails
- do not reload

Unrelated-key preservation is verified by tests, not by service enumeration. Tests should seed sentinel unrelated keys and assert:

- sentinel value is unchanged
- sentinel receives no `setItem` call
- sentinel receives no `removeItem` call

Rollback only restores owned keys. It must not infer ownership from names that merely look related or share a prefix.

If no owned key exists:

- return reset-noop success
- do not invent empty state
- reload behavior is a UI decision and should not happen from pure service

## Future Storage Backend Contract

Backup/reset pure service uses an injected synchronous backend:

- `getItem(key)`
- `setItem(key, value)`
- `removeItem(key)`

Rules:

- Do not access global `localStorage`.
- Do not require `keys()`, `length`, `key(index)`, or any storage enumeration API.
- Do not support Promise / thenable backend methods.
- Backend errors map to stable error result.
- Do not depend on DOM, FileReader, Tauri, or Blob.

Current browser storage backend only covers `getItem` / `setItem`. `removeItem` support is future implementation and must not be added by this docs-only task.

## Pure Service Boundary

Future module names may include:

`newSchemaBackupCodec`

- `createBackup(state, options)`
- `parseBackup(text)`
- `classifyBackup(value)`

`newSchemaBackupService`

- `restoreBackup(storageBackend, parsedBackup)`
- `resetOwnedStorage(storageBackend)`

These are future API boundaries, not final function names.

Dependency direction:

```text
UI
-> backup/reset application service
-> backup codec / canonical state codec
-> repository/storage backend
```

UI owns:

- file/dialog interaction
- user confirmation
- toast/error presentation
- reload after successful commit

## Error Contract

Error codes must be ordered, unique, and stable.

Initial error codes:

- `INVALID_BACKUP_TEXT`
- `INVALID_JSON`
- `INVALID_BACKUP_ROOT`
- `AMBIGUOUS_BACKUP_FORMAT`
- `UNSUPPORTED_BACKUP_FORMAT`
- `UNSUPPORTED_BACKUP_VERSION`
- `BACKUP_SOURCE_MISSING`
- `INVALID_EXPORTED_AT`
- `INVALID_BACKUP_STATE`
- `LEGACY_BACKUP_REQUIRES_LEGACY_PATH`
- `INVALID_STORAGE_BACKEND`
- `STORAGE_READ_FAILED`
- `STORAGE_WRITE_FAILED`
- `STORAGE_REMOVE_FAILED`
- `STORAGE_VERIFICATION_FAILED`
- `ROLLBACK_FAILED`

Do not expose raw UI copy through these codes.

Do not duplicate every existing codec inner error. State validation failure may preserve existing codec errors, but backup service top-level error should include `INVALID_BACKUP_STATE`.

## Future Tests-only Contract

The following are future test cases, not implemented tests and not `test.todo`.

Envelope:

1. valid v2 envelope
2. exact format marker
3. unsupported backup version
4. state `schemaVersion` validation
5. canonical millisecond UTC `exportedAt` accepted
6. UTC string without milliseconds blocked
7. date-only `exportedAt` blocked
8. invalid date blocked
9. timezone offset string blocked
10. extra root key blocked
11. missing root key blocked

Classification:

12. v2 identified
13. legacy identified only when `inventory`, `assets`, and `transactions` all exist
14. missing required legacy field is invalid
15. mixed root blocked
16. unknown format does not fallback
17. partial legacy blocked

Export:

18. repository `load()` loaded state is exported
19. repository missing returns `BACKUP_SOURCE_MISSING`
20. repository invalid returns `INVALID_BACKUP_STATE`
21. repository error maps to storage read failure
22. export does not read runtime state
23. export does not call `projectRuntimeToNewSchema`
24. export does not read legacy keys
25. invalid canonical state does not create backup
26. runtime `qtyByCity` shape cannot be v2 export

Import:

27. valid round-trip
28. invalid JSON zero mutation
29. invalid envelope zero mutation
30. invalid canonical state zero mutation
31. legacy backup in v2 path blocked
32. v2 import does not mutate legacy keys
33. successful import writes only v2 key
34. read-back verification

Rollback:

35. `setItem` failure restores old value
36. verification failure restores old value
37. absent previous key failure removes partial write
38. rollback failure reports fatal error

Reset:

39. removes all seven owned keys
40. unrelated sentinel value unchanged
41. unrelated sentinel receives no `setItem` call
42. unrelated sentinel receives no `removeItem` call
43. reset service does not use storage enumeration
44. cancelled UI path zero mutation
45. remove failure rollback
46. verification failure rollback
47. no owned keys returns noop
48. future reset service must not use `localStorage.clear()`

Purity:

49. no DOM
50. no FileReader
51. no Tauri
52. no global `localStorage`
53. no reload / toast / confirm

Do not add `test.todo` or skipped tests from this docs-only contract. Tests require a separate approved task.

## Next Approved Step

Next approved step: **Tests-only new-schema backup/reset regression contract**.

This means a tests-first pure backup codec/service checkpoint. It does not mean the pure service is already implemented.

Allowed scope:

- add regression tests
- create test fixtures
- test future pure service contract
- run targeted tests locally before any test-only checkpoint is considered complete
- run the full discovered test suite before pairing tests with pure module implementation in a later task

Forbidden scope:

- edit `app.js`
- edit `state.js`
- edit production adapter
- write storage
- UI
- real backup format implementation
- new `schemaVersion`
- commit or push failing, skipped, or `test.todo` checkpoints to master
- move into production integration before tests and pure module are complete

Any implementation beyond tests-only requires a new Spec Lead decision.
