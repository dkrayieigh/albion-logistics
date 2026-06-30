import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEW_SCHEMA_STORAGE_KEY } from '../src/adapters/newSchemaStorageRepository.js';
import {
  ALBION_LOGISTICS_OWNED_STORAGE_KEYS,
  resetOwnedStorage
} from '../src/services/scopedFactoryResetService.js';

const LEGACY_KEYS = [
  'albion_crafting_stocks',
  'albion_crafting_assets',
  'albion_crafting_transactions',
  'albion_crafting_laborer_stocks',
  'albion_crafting_laborer_logs',
  'albion_crafting_custom_locs'
];

const OWNED_KEYS = [
  NEW_SCHEMA_STORAGE_KEY,
  ...LEGACY_KEYS
];

const UNRELATED_ENTRIES = {
  'unrelated-key': 'keep-unrelated',
  'albion-logistics-v2-state-extra': 'keep-v2-like',
  albion_crafting_unknown: 'keep-legacy-like'
};

function makeBackend(initialEntries = {}, behavior = {}) {
  const entries = new Map(Object.entries({
    ...UNRELATED_ENTRIES,
    ...initialEntries
  }));
  const calls = [];
  const backend = {
    entries,
    calls,

    getItem(key) {
      calls.push({ method: 'getItem', key, thisBound: this === backend });
      if (behavior.getItem) return behavior.getItem.call(this, key);
      return entries.has(key) ? entries.get(key) : null;
    },

    setItem(key, value) {
      calls.push({ method: 'setItem', key, value, thisBound: this === backend });
      if (behavior.setItem) return behavior.setItem.call(this, key, value);
      entries.set(key, String(value));
      return undefined;
    },

    removeItem(key) {
      calls.push({ method: 'removeItem', key, thisBound: this === backend });
      if (behavior.removeItem) return behavior.removeItem.call(this, key);
      entries.delete(key);
      return undefined;
    }
  };
  return backend;
}

function makeOwnedEntries(valuePrefix = 'raw') {
  return Object.fromEntries(OWNED_KEYS.map((key, index) => [key, `${valuePrefix}:${index}:${key}`]));
}

function assertResult(result, expected) {
  assert.deepEqual(result, expected);
}

function assertUnrelatedUntouched(backend) {
  for (const [key, value] of Object.entries(UNRELATED_ENTRIES)) {
    assert.equal(backend.entries.get(key), value);
    assert.equal(backend.calls.some(call => call.key === key), false);
  }
}

function assertOwnedSnapshotRestored(backend, snapshot) {
  for (const key of OWNED_KEYS) {
    if (Object.hasOwn(snapshot, key)) assert.equal(backend.entries.get(key), snapshot[key], key);
    else assert.equal(backend.entries.has(key), false, key);
  }
}

function callMethods(backend, methodName) {
  return backend.calls.filter(call => call.method === methodName);
}

test('scoped reset registry is exact frozen unique and uses the shared v2 key', () => {
  assert.deepEqual(ALBION_LOGISTICS_OWNED_STORAGE_KEYS, OWNED_KEYS);
  assert.equal(new Set(ALBION_LOGISTICS_OWNED_STORAGE_KEYS).size, 7);
  assert.equal(Object.isFrozen(ALBION_LOGISTICS_OWNED_STORAGE_KEYS), true);
  assert.equal(ALBION_LOGISTICS_OWNED_STORAGE_KEYS[0], NEW_SCHEMA_STORAGE_KEY);
  assert.equal(ALBION_LOGISTICS_OWNED_STORAGE_KEYS.some(key => /[*^$]|prefix|regex|wildcard/i.test(key)), false);
  assert.throws(() => ALBION_LOGISTICS_OWNED_STORAGE_KEYS.push('extra'), TypeError);
});

test('resetOwnedStorage returns reset-noop after one ordered snapshot and no mutation', () => {
  const backend = makeBackend();
  const result = resetOwnedStorage(backend);

  assertResult(result, {
    ok: true,
    status: 'reset-noop',
    errors: [],
    innerErrors: []
  });
  assert.deepEqual(callMethods(backend, 'getItem').map(call => call.key), OWNED_KEYS);
  assert.deepEqual(callMethods(backend, 'setItem'), []);
  assert.deepEqual(callMethods(backend, 'removeItem'), []);
  assertUnrelatedUntouched(backend);
});

test('resetOwnedStorage removes existing owned keys only and verifies all owned keys', () => {
  const backend = makeBackend({
    [NEW_SCHEMA_STORAGE_KEY]: 'v2-raw',
    albion_crafting_transactions: 'legacy-transactions'
  });
  const result = resetOwnedStorage(backend);

  assertResult(result, {
    ok: true,
    status: 'reset-complete',
    errors: [],
    innerErrors: []
  });
  assert.deepEqual(callMethods(backend, 'removeItem').map(call => call.key), [
    NEW_SCHEMA_STORAGE_KEY,
    'albion_crafting_transactions'
  ]);
  assert.deepEqual(callMethods(backend, 'getItem').map(call => call.key), [
    ...OWNED_KEYS,
    ...OWNED_KEYS
  ]);
  for (const key of OWNED_KEYS) assert.equal(backend.entries.has(key), false, key);
  assertUnrelatedUntouched(backend);
});

test('resetOwnedStorage removes all seven owned keys in registry order', () => {
  const backend = makeBackend(makeOwnedEntries('owned'));
  const result = resetOwnedStorage(backend);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'reset-complete');
  assert.deepEqual(callMethods(backend, 'removeItem').map(call => call.key), OWNED_KEYS);
  for (const key of OWNED_KEYS) assert.equal(backend.entries.has(key), false, key);
  assertUnrelatedUntouched(backend);
});

test('resetOwnedStorage validates backend methods safely with zero invocation', () => {
  for (const backend of [
    null,
    1,
    'storage',
    {},
    { setItem() {}, removeItem() {} },
    { getItem() {}, removeItem() {} },
    { getItem() {}, setItem() {} }
  ]) {
    assertResult(resetOwnedStorage(backend), {
      ok: false,
      status: 'error',
      errors: ['INVALID_STORAGE_BACKEND'],
      innerErrors: []
    });
  }

  const getThrow = {};
  Object.defineProperty(getThrow, 'getItem', { get() { throw new Error('get getter'); } });
  getThrow.setItem = () => {};
  getThrow.removeItem = () => {};
  assert.deepEqual(resetOwnedStorage(getThrow).errors, ['INVALID_STORAGE_BACKEND']);

  const setThrow = { getItem() {}, removeItem() {} };
  Object.defineProperty(setThrow, 'setItem', { get() { throw new Error('set getter'); } });
  assert.deepEqual(resetOwnedStorage(setThrow).errors, ['INVALID_STORAGE_BACKEND']);

  const removeThrow = { getItem() {}, setItem() {} };
  Object.defineProperty(removeThrow, 'removeItem', { get() { throw new Error('remove getter'); } });
  assert.deepEqual(resetOwnedStorage(removeThrow).errors, ['INVALID_STORAGE_BACKEND']);

  const backend = makeBackend({ [NEW_SCHEMA_STORAGE_KEY]: 'raw' });
  assert.equal(resetOwnedStorage(backend).ok, true);
  assert.equal(backend.calls.every(call => call.thisBound), true);
});

test('snapshot failures stop before mutation and preserve unrelated keys', () => {
  const cases = [
    {
      label: 'first read throw',
      behavior: {
        getItem(key) {
          if (key === OWNED_KEYS[0]) throw new Error('read failed');
          return this.entries.get(key) ?? null;
        }
      }
    },
    {
      label: 'middle read throw',
      behavior: {
        getItem(key) {
          if (key === OWNED_KEYS[3]) throw new Error('read failed');
          return this.entries.get(key) ?? null;
        }
      }
    },
    {
      label: 'thenable read',
      behavior: {
        getItem(key) {
          if (key === OWNED_KEYS[1]) return { then() {} };
          return this.entries.get(key) ?? null;
        }
      }
    },
    {
      label: 'invalid snapshot type',
      behavior: {
        getItem(key) {
          if (key === OWNED_KEYS[2]) return { raw: true };
          return this.entries.get(key) ?? null;
        }
      }
    }
  ];

  for (const entry of cases) {
    const snapshot = makeOwnedEntries(entry.label);
    const backend = makeBackend(snapshot, entry.behavior);
    const result = resetOwnedStorage(backend);
    assert.equal(result.status, 'error', entry.label);
    assert.deepEqual(result.errors, ['STORAGE_READ_FAILED'], entry.label);
    assert.deepEqual(callMethods(backend, 'setItem'), [], entry.label);
    assert.deepEqual(callMethods(backend, 'removeItem'), [], entry.label);
    assertOwnedSnapshotRestored(backend, snapshot);
    assertUnrelatedUntouched(backend);
  }
});

test('remove failures roll back full snapshots including absent and malformed raw values', () => {
  const malformedRaw = '{not-json';
  const cases = [
    {
      label: 'first remove throw',
      existing: {
        [OWNED_KEYS[0]]: malformedRaw,
        [OWNED_KEYS[1]]: 'raw-one'
      },
      behavior: {
        removeItem(key) {
          if (key === OWNED_KEYS[0]) throw new Error('remove failed');
          this.entries.delete(key);
        }
      }
    },
    {
      label: 'later remove throw after partial remove',
      existing: makeOwnedEntries('remove-later'),
      behavior: {
        removeItem(key) {
          this.entries.delete(key);
          if (key === OWNED_KEYS[4]) throw new Error('remove failed');
        }
      }
    },
    {
      label: 'remove thenable',
      existing: makeOwnedEntries('remove-thenable'),
      behavior: {
        removeItem(key) {
          if (key === OWNED_KEYS[2]) return { then() {} };
          this.entries.delete(key);
        }
      }
    }
  ];

  for (const entry of cases) {
    const backend = makeBackend(entry.existing, entry.behavior);
    const result = resetOwnedStorage(backend);
    assert.equal(result.ok, false, entry.label);
    assert.equal(result.status, 'error', entry.label);
    assert.deepEqual(result.errors, ['STORAGE_REMOVE_FAILED'], entry.label);
    assertOwnedSnapshotRestored(backend, entry.existing);
    assert.equal(backend.entries.get(OWNED_KEYS[0]), entry.existing[OWNED_KEYS[0]], entry.label);
    assertUnrelatedUntouched(backend);
  }
});

test('verification failures roll back the complete snapshot', () => {
  const cases = [
    {
      label: 'removed key reappears',
      behavior: {
        getItem(key) {
          const resetVerification = callMethods(this, 'removeItem').length === 7 &&
            callMethods(this, 'setItem').length === 0;
          if (resetVerification && key === OWNED_KEYS[1]) return 'reappeared';
          return this.entries.has(key) ? this.entries.get(key) : null;
        }
      }
    },
    {
      label: 'verification get throw',
      behavior: {
        getItem(key) {
          const resetVerification = callMethods(this, 'removeItem').length === 7 &&
            callMethods(this, 'setItem').length === 0;
          if (resetVerification && key === OWNED_KEYS[2]) throw new Error('verify failed');
          return this.entries.has(key) ? this.entries.get(key) : null;
        }
      }
    },
    {
      label: 'verification thenable',
      behavior: {
        getItem(key) {
          const resetVerification = callMethods(this, 'removeItem').length === 7 &&
            callMethods(this, 'setItem').length === 0;
          if (resetVerification && key === OWNED_KEYS[3]) return { then() {} };
          return this.entries.has(key) ? this.entries.get(key) : null;
        }
      }
    },
    {
      label: 'verification invalid type',
      behavior: {
        getItem(key) {
          const resetVerification = callMethods(this, 'removeItem').length === 7 &&
            callMethods(this, 'setItem').length === 0;
          if (resetVerification && key === OWNED_KEYS[4]) return { raw: true };
          return this.entries.has(key) ? this.entries.get(key) : null;
        }
      }
    }
  ];

  for (const entry of cases) {
    const snapshot = makeOwnedEntries(entry.label);
    const backend = makeBackend(snapshot, entry.behavior);
    const result = resetOwnedStorage(backend);
    assert.equal(result.status, 'error', entry.label);
    assert.deepEqual(result.errors, ['STORAGE_VERIFICATION_FAILED'], entry.label);
    assertOwnedSnapshotRestored(backend, snapshot);
    assertUnrelatedUntouched(backend);
  }
});

test('rollback failures report ROLLBACK_FAILED keep primary error and continue best effort', () => {
  const existing = makeOwnedEntries('rollback');
  const absentKey = OWNED_KEYS[6];
  delete existing[absentKey];
  const cases = [
    {
      label: 'rollback set throw',
      behavior: {
        removeItem(key) {
          this.entries.delete(key);
          if (key === OWNED_KEYS[3]) throw new Error('primary remove failure');
        },
        setItem(key, value) {
          if (key === OWNED_KEYS[0]) throw new Error('rollback set failed');
          this.entries.set(key, String(value));
        }
      },
      diagnostic: 'STORAGE_WRITE_FAILED'
    },
    {
      label: 'rollback remove throw',
      behavior: {
        removeItem(key) {
          const removeCount = this.calls.filter(call => call.method === 'removeItem').length;
          if (removeCount <= 4) {
            this.entries.delete(key);
            if (key === OWNED_KEYS[3]) throw new Error('primary remove failure');
            return undefined;
          }
          if (key === absentKey) throw new Error('rollback remove failed');
          this.entries.delete(key);
          return undefined;
        }
      },
      diagnostic: 'STORAGE_REMOVE_FAILED'
    },
    {
      label: 'rollback thenable',
      behavior: {
        removeItem(key) {
          this.entries.delete(key);
          if (key === OWNED_KEYS[3]) throw new Error('primary remove failure');
        },
        setItem(key, value) {
          if (key === OWNED_KEYS[0]) return { then() {} };
          this.entries.set(key, String(value));
          return undefined;
        }
      },
      diagnostic: 'STORAGE_WRITE_FAILED'
    },
    {
      label: 'rollback verification mismatch',
      behavior: {
        removeItem(key) {
          this.entries.delete(key);
          if (key === OWNED_KEYS[3]) throw new Error('primary remove failure');
        },
        getItem(key) {
          const rollbackVerificationStarted = this.calls.filter(call => call.method === 'setItem').length >= 6;
          if (rollbackVerificationStarted && key === OWNED_KEYS[1]) return 'mismatch';
          return this.entries.has(key) ? this.entries.get(key) : null;
        }
      },
      diagnostic: 'STORAGE_VERIFICATION_FAILED'
    }
  ];

  for (const entry of cases) {
    const backend = makeBackend(existing, entry.behavior);
    const result = resetOwnedStorage(backend);
    assert.equal(result.ok, false, entry.label);
    assert.equal(result.status, 'rollback-failed', entry.label);
    assert.deepEqual(result.errors, ['ROLLBACK_FAILED'], entry.label);
    assert.equal(result.innerErrors.includes('STORAGE_REMOVE_FAILED'), true, entry.label);
    assert.equal(result.innerErrors.includes(entry.diagnostic), true, entry.label);
    assert.equal(callMethods(backend, 'setItem').some(call => call.key === OWNED_KEYS[5]), true, entry.label);
    assertUnrelatedUntouched(backend);
  }
});

test('result error arrays are defensive ordered unique string copies', () => {
  const first = resetOwnedStorage(null);
  first.errors.push('MUTATED');
  first.innerErrors.push('MUTATED');

  const second = resetOwnedStorage(null);
  assert.deepEqual(second.errors, ['INVALID_STORAGE_BACKEND']);
  assert.deepEqual(second.innerErrors, []);
  assert.equal(second.errors.every(error => typeof error === 'string'), true);
  assert.notEqual(first.errors, second.errors);
  assert.notEqual(first.innerErrors, second.innerErrors);
});

test('scoped reset service source remains pure and isolated', () => {
  const source = readFileSync(
    new URL('../src/services/scopedFactoryResetService.js', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /\blocalStorage\b|\bclear\s*\(|\.length\b|\.key\s*\(|Object\.keys/);
  assert.doesNotMatch(source, /document|window|FileReader|Blob|__TAURI__|tauri|reload|confirm|alert|toast/i);
  assert.doesNotMatch(source, /app\.js|core\/state|newSchemaRuntimeBridge|projectNewSchema/);
  assert.doesNotMatch(source, /prefix|wildcard|RegExp|regex/i);
});
