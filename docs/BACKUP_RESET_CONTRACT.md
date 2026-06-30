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
4. `exportedAt` is required, must be a valid ISO-8601 UTC string, and is informational metadata only.
5. `state` must be canonical state and must pass the existing new-schema codec.
6. `state` must not be runtime `qtyByCity` projection.
7. `state` must not contain legacy backup fields.
8. Do not add `appVersion`, `deviceId`, `userId`, or similar metadata in this contract.
9. Do not introduce a new `schemaVersion` outside the canonical state root.

## Export Source Contract

v2 export must use:

- active canonical state
- existing new-schema codec validation

v2 export must not use:

- runtime legacy projection
- `state.inventory` in `qtyByCity` compatibility shape
- any legacy localStorage key
- silent fallback to legacy export

Export flow:

1. Receive active canonical state.
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

## Backup Classification

Import must use strict classification and must not guess.

### v2 backup

Required:

- root object
- `format === "albion-logistics-backup"`
- `backupFormatVersion` exists
- `state` exists

### legacy backup

Legacy backup has no v2 format marker and may contain legacy required fields:

- `inventory`
- `assets`
- `transactions`

Common optional legacy fields:

- `laborerInventory`
- `laborerLogs`
- `customLocations`

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
5. Verify unrelated keys are preserved.
6. Only then report reset-complete.

If remove or verification fails:

- restore snapshot for all owned keys that existed before reset
- ensure owned keys that did not exist before reset remain absent
- keep unrelated keys unchanged
- return `ROLLBACK_FAILED` if rollback fails
- do not reload

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
5. invalid `exportedAt`
6. extra root key blocked
7. missing root key blocked

Classification:

8. v2 identified
9. legacy identified
10. mixed root blocked
11. unknown format does not fallback
12. partial legacy blocked

Export:

13. canonical state export
14. export does not read legacy keys
15. invalid canonical state does not create backup
16. runtime `qtyByCity` shape cannot be v2 export

Import:

17. valid round-trip
18. invalid JSON zero mutation
19. invalid envelope zero mutation
20. invalid canonical state zero mutation
21. legacy backup in v2 path blocked
22. v2 import does not mutate legacy keys
23. successful import writes only v2 key
24. read-back verification

Rollback:

25. `setItem` failure restores old value
26. verification failure restores old value
27. absent previous key failure removes partial write
28. rollback failure reports fatal error

Reset:

29. removes all seven owned keys
30. preserves unrelated keys
31. cancelled UI path zero mutation
32. remove failure rollback
33. verification failure rollback
34. no owned keys returns noop
35. future reset service must not use `localStorage.clear()`

Purity:

36. no DOM
37. no FileReader
38. no Tauri
39. no global `localStorage`
40. no reload / toast / confirm

Do not add `test.todo` or skipped tests from this docs-only contract. Tests require a separate approved task.

## Next Approved Step

Next approved step: **Tests-only new-schema backup/reset regression contract**.

Allowed scope:

- add regression tests
- create test fixtures
- test future pure service contract

Forbidden scope:

- edit `app.js`
- edit `state.js`
- edit production adapter
- write storage
- UI
- real backup format implementation
- new `schemaVersion`

Any implementation beyond tests-only requires a new Spec Lead decision.
