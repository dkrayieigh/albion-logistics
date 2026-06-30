import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCleanInitialState } from '../src/adapters/cleanInitialState.js';
import {
  decodeNewSchemaState,
  encodeNewSchemaState
} from '../src/adapters/newSchemaStorageCodec.js';
import { createBackup } from '../src/adapters/newSchemaBackupCodec.js';
import { NEW_SCHEMA_STORAGE_KEY } from '../src/adapters/newSchemaStorageRepository.js';
import { restoreBackup } from '../src/services/newSchemaBackupImportService.js';

const EXPORTED_AT = '2026-06-30T00:00:00.000Z';
const LEGACY_KEYS = [
  'albion_crafting_stocks',
  'albion_crafting_assets',
  'albion_crafting_transactions',
  'albion_crafting_laborer_stocks',
  'albion_crafting_laborer_logs',
  'albion_crafting_custom_locs'
];

function makeState() {
  const result = createCleanInitialState(
    {
      cash: 12345,
      debt: 0,
      inventorySeeds: [
        {
          itemKey: '鋼條_6.3',
          locationId: 'thetford',
          quantity: 12,
          globalAvgCost: 100
        }
      ]
    },
    {}
  );
  assert.equal(result.ok, true);
  return result.state;
}

function makeBackupText(state = makeState()) {
  const result = createBackup(state, { exportedAt: EXPORTED_AT });
  assert.equal(result.ok, true);
  return result.backupText;
}

function makeBackend(initialEntries = {}, behavior = {}) {
  const entries = new Map(Object.entries(initialEntries));
  const calls = [];
  const backend = {
    entries,
    calls,
    getItem(key) {
      calls.push({ method: 'getItem', key, thisBound: this === backend });
      if (behavior.getThrow) throw new Error('read failed');
      const value = behavior.getItem ? behavior.getItem.call(this, key) : entries.get(key) ?? null;
      return value;
    },
    setItem(key, value) {
      calls.push({ method: 'setItem', key, value, thisBound: this === backend });
      if (behavior.partialSetBeforeThrow) entries.set(key, String(value));
      if (behavior.setThrow) throw new Error('write failed');
      const result = behavior.setItem ? behavior.setItem.call(this, key, value) : undefined;
      if (!behavior.setItem) entries.set(key, String(value));
      return result;
    },
    removeItem(key) {
      calls.push({ method: 'removeItem', key, thisBound: this === backend });
      if (behavior.removeThrow) throw new Error('remove failed');
      const result = behavior.removeItem ? behavior.removeItem.call(this, key) : undefined;
      if (!behavior.removeItem) entries.delete(key);
      return result;
    }
  };
  return backend;
}

function makeReadBackFailureBackend(initialEntries, readBackValue) {
  let getCount = 0;
  let backend;
  backend = makeBackend(initialEntries, {
    getItem(key) {
      if (key !== NEW_SCHEMA_STORAGE_KEY) return null;
      getCount += 1;
      if (getCount === 1) return initialEntries[NEW_SCHEMA_STORAGE_KEY] ?? null;
      if (getCount > 2) return backend.entries.get(key) ?? null;
      if (readBackValue instanceof Error) throw readBackValue;
      return typeof readBackValue === 'function' ? readBackValue() : readBackValue;
    }
  });
  return backend;
}

function makeOneTimeSetFailureBackend(initialEntries, partialWrite = false) {
  let setCount = 0;
  return makeBackend(initialEntries, {
    setItem(key, value) {
      setCount += 1;
      if (setCount === 1) {
        if (partialWrite) this.entries.set(key, String(value));
        throw new Error('write failed');
      }
      this.entries.set(key, String(value));
    }
  });
}

function assertNoBackendAccess(backend) {
  assert.deepEqual(backend.calls, []);
}

function assertOnlyV2KeyAccess(backend) {
  for (const call of backend.calls) {
    assert.equal(call.key, NEW_SCHEMA_STORAGE_KEY);
  }
  for (const key of LEGACY_KEYS) {
    assert.equal(backend.entries.get(key), `legacy:${key}`);
  }
}

test('restoreBackup commits a valid v2 backup and returns an independent canonical state', () => {
  const state = makeState();
  const backupText = makeBackupText(state);
  const backend = makeBackend(Object.fromEntries(LEGACY_KEYS.map(key => [key, `legacy:${key}`])));
  const result = restoreBackup(backend, backupText);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'committed');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.innerErrors, []);
  assert.deepEqual(result.state, state);
  assert.notEqual(result.state, state);
  assertOnlyV2KeyAccess(backend);
  assert.deepEqual(backend.calls.map(call => call.method), ['getItem', 'setItem', 'getItem']);
  const decoded = decodeNewSchemaState(backend.entries.get(NEW_SCHEMA_STORAGE_KEY));
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.state, state);

  result.state.assets.cash = 999;
  assert.equal(decodeNewSchemaState(backend.entries.get(NEW_SCHEMA_STORAGE_KEY)).state.assets.cash, 12345);
});

test('restoreBackup validates backup text before resolving backend methods', () => {
  const cases = [
    { text: null, errors: ['INVALID_BACKUP_TEXT'] },
    { text: '{', errors: ['INVALID_JSON'] },
    { text: JSON.stringify({ format: 'other', extra: true }), errors: ['UNSUPPORTED_BACKUP_FORMAT'] },
    {
      text: JSON.stringify({
        format: 'albion-logistics-backup',
        backupFormatVersion: 2,
        exportedAt: EXPORTED_AT,
        state: {}
      }),
      errors: ['UNSUPPORTED_BACKUP_VERSION']
    },
    {
      text: JSON.stringify({
        format: 'albion-logistics-backup',
        backupFormatVersion: 1,
        exportedAt: '2026-06-30',
        state: makeState()
      }),
      errors: ['INVALID_EXPORTED_AT']
    },
    {
      text: JSON.stringify({
        format: 'albion-logistics-backup',
        backupFormatVersion: 1,
        exportedAt: EXPORTED_AT,
        state: { ...makeState(), schemaVersion: 2 }
      }),
      errors: ['INVALID_BACKUP_STATE']
    },
    {
      text: JSON.stringify({
        format: 'albion-logistics-backup',
        backupFormatVersion: 1,
        exportedAt: EXPORTED_AT,
        state: makeState(),
        inventory: {}
      }),
      errors: ['AMBIGUOUS_BACKUP_FORMAT']
    }
  ];

  for (const entry of cases) {
    const backend = makeBackend();
    const result = restoreBackup(backend, entry.text);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, entry.errors);
    assert.equal(result.state, null);
    assertNoBackendAccess(backend);
  }
});

test('restoreBackup rejects legacy backups without auto conversion or backend mutation', () => {
  const backend = makeBackend();
  const result = restoreBackup(
    backend,
    JSON.stringify({ inventory: {}, assets: {}, transactions: [] })
  );

  assert.deepEqual(result, {
    ok: false,
    status: 'invalid',
    state: null,
    errors: ['LEGACY_BACKUP_REQUIRES_LEGACY_PATH'],
    innerErrors: []
  });
  assertNoBackendAccess(backend);
});

test('restoreBackup validates backend method contracts safely after backup validation', () => {
  assert.deepEqual(restoreBackup(null, makeBackupText()).errors, ['INVALID_STORAGE_BACKEND']);
  assert.deepEqual(restoreBackup(1, makeBackupText()).errors, ['INVALID_STORAGE_BACKEND']);
  assert.deepEqual(restoreBackup({ getItem() {}, setItem() {} }, makeBackupText()).errors, [
    'INVALID_STORAGE_BACKEND'
  ]);

  const getterThrow = {};
  Object.defineProperty(getterThrow, 'getItem', { get() { throw new Error('getter'); } });
  getterThrow.setItem = () => {};
  getterThrow.removeItem = () => {};
  assert.deepEqual(restoreBackup(getterThrow, makeBackupText()).errors, [
    'INVALID_STORAGE_BACKEND'
  ]);

  const thenable = makeBackend({}, { getItem: () => ({ then() {} }) });
  assert.deepEqual(restoreBackup(thenable, makeBackupText()).errors, ['STORAGE_READ_FAILED']);

  const malformedSnapshot = makeBackend({}, { getItem: () => ({ raw: true }) });
  assert.deepEqual(restoreBackup(malformedSnapshot, makeBackupText()).errors, [
    'STORAGE_READ_FAILED'
  ]);

  const boundBackend = makeBackend();
  const result = restoreBackup(boundBackend, makeBackupText());
  assert.equal(result.ok, true);
  assert.equal(boundBackend.calls.every(call => call.thisBound), true);
});

test('restoreBackup commits only the v2 key and verifies reordered equivalent read-back state', () => {
  const state = makeState();
  const encoded = encodeNewSchemaState(state);
  assert.equal(encoded.ok, true);
  const backend = makeBackend(
    Object.fromEntries(LEGACY_KEYS.map(key => [key, `legacy:${key}`])),
    {
      getItem(key) {
        if (key !== NEW_SCHEMA_STORAGE_KEY) return null;
        const parsed = JSON.parse(encoded.serialized);
        const reordered = {
          transactions: parsed.transactions,
          laborerLogs: parsed.laborerLogs,
          laborerInventory: parsed.laborerInventory,
          inventory: parsed.inventory,
          locationRegistry: parsed.locationRegistry,
          assets: parsed.assets,
          schemaVersion: parsed.schemaVersion
        };
        return JSON.stringify(reordered);
      }
    }
  );

  const result = restoreBackup(backend, makeBackupText(state));

  assert.equal(result.ok, true);
  assert.equal(result.status, 'committed');
  assertOnlyV2KeyAccess(backend);
  assert.deepEqual(backend.calls.filter(call => call.method === 'setItem').map(call => call.key), [
    NEW_SCHEMA_STORAGE_KEY
  ]);
});

test('restoreBackup rolls back existing snapshots after write or verification failures', () => {
  const oldRaw = encodeNewSchemaState(makeState()).serialized;
  const cases = [
    {
      label: 'set throw restores old raw',
      backend: () => makeOneTimeSetFailureBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }),
      expected: ['getItem', 'setItem', 'setItem', 'getItem']
    },
    {
      label: 'partial set throw restores old raw',
      backend: () => makeOneTimeSetFailureBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, true),
      expected: ['getItem', 'setItem', 'setItem', 'getItem']
    },
    {
      label: 'read-back throw restores old raw',
      backend: () => makeReadBackFailureBackend(
        { [NEW_SCHEMA_STORAGE_KEY]: oldRaw },
        new Error('read-back failed')
      ),
      expected: ['getItem', 'setItem', 'getItem', 'setItem', 'getItem']
    },
    {
      label: 'invalid read-back restores old raw',
      backend: () => makeReadBackFailureBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, '{'),
      expected: ['getItem', 'setItem', 'getItem', 'setItem', 'getItem']
    },
    {
      label: 'different read-back restores old raw',
      backend: () => makeReadBackFailureBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, () => {
        const different = makeState();
        different.assets.cash = 999;
        return encodeNewSchemaState(different).serialized;
      }),
      expected: ['getItem', 'setItem', 'getItem', 'setItem', 'getItem']
    }
  ];

  for (const entry of cases) {
    const backend = entry.backend
      ? entry.backend()
      : makeBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, entry.behavior);
    const result = restoreBackup(backend, makeBackupText());
    assert.equal(result.ok, false, entry.label);
    assert.equal(result.status, 'error', entry.label);
    assert.notDeepEqual(result.errors, ['ROLLBACK_FAILED'], entry.label);
    assert.equal(backend.entries.get(NEW_SCHEMA_STORAGE_KEY), oldRaw, entry.label);
    assert.deepEqual(backend.calls.map(call => call.method), entry.expected, entry.label);
  }
});

test('restoreBackup removes partial v2 writes when no prior snapshot existed', () => {
  const setFailure = makeBackend({}, { partialSetBeforeThrow: true, setThrow: true });
  const writeResult = restoreBackup(setFailure, makeBackupText());
  assert.deepEqual(writeResult.errors, ['STORAGE_WRITE_FAILED']);
  assert.equal(setFailure.entries.get(NEW_SCHEMA_STORAGE_KEY), undefined);
  assert.deepEqual(setFailure.calls.map(call => call.method), ['getItem', 'setItem', 'removeItem', 'getItem']);

  const verificationFailure = makeReadBackFailureBackend({}, () => {
      const different = makeState();
      different.assets.cash = 999;
      return encodeNewSchemaState(different).serialized;
  });
  const verifyResult = restoreBackup(verificationFailure, makeBackupText());
  assert.deepEqual(verifyResult.errors, ['STORAGE_VERIFICATION_FAILED']);
  assert.equal(verificationFailure.entries.get(NEW_SCHEMA_STORAGE_KEY), undefined);
  assert.deepEqual(verificationFailure.calls.map(call => call.method), ['getItem', 'setItem', 'getItem', 'removeItem', 'getItem']);
});

test('restoreBackup reports rollback-failed when rollback cannot be verified', () => {
  const oldRaw = encodeNewSchemaState(makeState()).serialized;
  let mismatchReadCount = 0;
  const cases = [
    makeBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, { setThrow: true, removeThrow: true }),
    makeBackend({}, {
      partialSetBeforeThrow: true,
      setThrow: true,
      removeItem() {
        return { then() {} };
      }
    }),
    makeBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, {
      setItem() {
        throw new Error('commit and rollback write failed');
      }
    }),
    makeBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, {
      setItem() {
        return { then() {} };
      }
    }),
    makeBackend({}, { partialSetBeforeThrow: true, setThrow: true, removeThrow: true }),
    makeBackend({ [NEW_SCHEMA_STORAGE_KEY]: oldRaw }, {
      setItem(key, value) {
        this.entries.set(key, String(value));
        throw new Error('commit write failed');
      },
      getItem() {
        mismatchReadCount += 1;
        return mismatchReadCount === 1 ? oldRaw : 'not-old-raw';
      }
    })
  ];

  for (const backend of cases) {
    const result = restoreBackup(backend, makeBackupText());
    assert.equal(result.ok, false);
    assert.equal(result.status, 'rollback-failed');
    assert.deepEqual(result.errors, ['ROLLBACK_FAILED']);
    assert.equal(result.innerErrors.includes('STORAGE_WRITE_FAILED'), true);
    result.errors.push('MUTATED');
    result.innerErrors.push('MUTATED');
    assert.notDeepEqual(result.errors, ['ROLLBACK_FAILED']);
  }
});

test('restoreBackup source remains pure and isolated from production integration', () => {
  const source = readFileSync(
    new URL('../src/services/newSchemaBackupImportService.js', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /document|window|FileReader|Blob|__TAURI__|tauri|reload|confirm|toast/i);
  assert.doesNotMatch(source, /\blocalStorage\b/);
  assert.doesNotMatch(source, /app\.js|core\/state|newSchemaRuntimeBridge|projectNewSchema/);
  for (const key of LEGACY_KEYS) assert.doesNotMatch(source, new RegExp(key));

  const text = makeBackupText();
  const before = `${text}`;
  const result = restoreBackup(makeBackend(), text);
  assert.equal(result.ok, true);
  assert.equal(text, before);
});
