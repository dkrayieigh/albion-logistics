import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCleanInitialState } from '../src/adapters/cleanInitialState.js';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  classifyBackup,
  createBackup,
  parseBackup
} from '../src/adapters/newSchemaBackupCodec.js';
import { createBackupFromRepository } from '../src/services/newSchemaBackupExportService.js';

const EXPORTED_AT = '2026-06-30T00:00:00.000Z';

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

function makeBackup(state = makeState(), exportedAt = EXPORTED_AT) {
  const result = createBackup(state, { exportedAt });
  assert.equal(result.ok, true);
  return result;
}

test('createBackup creates a readable exact v2 envelope from canonical state', () => {
  const state = makeState();
  const result = createBackup(state, { exportedAt: EXPORTED_AT });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'created');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.innerErrors, []);
  assert.deepEqual(Object.keys(result.envelope), [
    'format',
    'backupFormatVersion',
    'exportedAt',
    'state'
  ]);
  assert.equal(result.envelope.format, BACKUP_FORMAT);
  assert.equal(result.envelope.backupFormatVersion, BACKUP_FORMAT_VERSION);
  assert.equal(result.envelope.state.schemaVersion, 1);
  assert.notEqual(result.envelope.state, state);
  assert.match(result.backupText, /\{\n  "format": "albion-logistics-backup"/);
  assert.deepEqual(JSON.parse(result.backupText), result.envelope);
});

test('createBackup accepts only exact ISO exportedAt strings with milliseconds', () => {
  const state = makeState();
  assert.equal(createBackup(state, { exportedAt: EXPORTED_AT }).ok, true);

  for (const exportedAt of [
    undefined,
    1,
    '2026-06-30T00:00:00Z',
    '2026-06-30',
    'invalid date',
    '2026-06-30T08:00:00.000+08:00'
  ]) {
    const result = createBackup(state, { exportedAt });
    assert.equal(result.ok, false);
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.errors, ['INVALID_EXPORTED_AT']);
  }
});

test('createBackup rejects invalid canonical state and preserves inner codec errors', () => {
  const invalid = makeState();
  invalid.schemaVersion = 2;
  const result = createBackup(invalid, { exportedAt: EXPORTED_AT });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.errors, ['INVALID_BACKUP_STATE']);
  assert.deepEqual(result.innerErrors, ['UNSUPPORTED_SCHEMA_VERSION']);
  assert.equal(result.backupText, null);
  assert.equal(result.envelope, null);
});

test('createBackup rejects runtime qtyByCity shape and does not mutate input state', () => {
  const state = makeState();
  const before = JSON.stringify(state);
  state.inventory['鋼條_6.3'] = {
    qtyByCity: { Thetford: 1 },
    globalAvgCost: 100
  };

  const result = createBackup(state, { exportedAt: EXPORTED_AT });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['INVALID_BACKUP_STATE']);
  assert.deepEqual(result.innerErrors, ['INVALID_INVENTORY', 'LEGACY_FIELD_NOT_ALLOWED']);
  delete state.inventory['鋼條_6.3'];
  assert.equal(JSON.stringify(makeState()), before);
});

test('classifyBackup distinguishes v2 legacy and invalid roots', () => {
  const backup = makeBackup();
  assert.deepEqual(classifyBackup(backup.envelope), {
    ok: true,
    status: 'v2',
    errors: [],
    innerErrors: []
  });
  assert.deepEqual(classifyBackup({ inventory: {}, assets: {}, transactions: [] }), {
    ok: true,
    status: 'legacy',
    errors: [],
    innerErrors: []
  });
  assert.deepEqual(
    classifyBackup({
      inventory: {},
      assets: {},
      transactions: [],
      laborerInventory: {},
      laborerLogs: [],
      customLocations: []
    }).status,
    'legacy'
  );

  assert.deepEqual(classifyBackup({ inventory: {}, assets: {} }).errors, ['INVALID_BACKUP_ROOT']);
  assert.deepEqual(classifyBackup(null).errors, ['INVALID_BACKUP_ROOT']);
  assert.deepEqual(classifyBackup([]).errors, ['INVALID_BACKUP_ROOT']);
});

test('classifyBackup rejects ambiguous unsupported and malformed v2 envelopes in stable order', () => {
  const backup = makeBackup().envelope;

  assert.deepEqual(classifyBackup({ ...backup, inventory: {} }).errors, [
    'INVALID_BACKUP_ROOT',
    'AMBIGUOUS_BACKUP_FORMAT'
  ]);
  assert.deepEqual(classifyBackup({ ...backup, format: 'other-format' }).errors, [
    'UNSUPPORTED_BACKUP_FORMAT'
  ]);
  assert.deepEqual(classifyBackup({ ...backup, backupFormatVersion: 2 }).errors, [
    'UNSUPPORTED_BACKUP_VERSION'
  ]);
  assert.deepEqual(classifyBackup({ ...backup, extra: true }).errors, ['INVALID_BACKUP_ROOT']);

  const missing = { ...backup };
  delete missing.state;
  assert.deepEqual(classifyBackup(missing).errors, ['INVALID_BACKUP_ROOT']);
});

test('parseBackup parses v2 and legacy payloads without mutation side effects', () => {
  const backup = makeBackup();
  const parsed = parseBackup(backup.backupText);
  const legacyPayload = { inventory: {}, assets: {}, transactions: [] };
  const legacy = parseBackup(JSON.stringify(legacyPayload));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, 'v2');
  assert.deepEqual(parsed.envelope, backup.envelope);
  assert.deepEqual(parsed.state, backup.envelope.state);
  assert.equal(parsed.legacyPayload, null);
  assert.notEqual(parsed.state, backup.envelope.state);

  parsed.state.assets.cash = 999;
  assert.equal(backup.envelope.state.assets.cash, 12345);

  assert.equal(legacy.ok, true);
  assert.equal(legacy.status, 'legacy');
  assert.deepEqual(legacy.legacyPayload, legacyPayload);
  assert.equal(legacy.envelope, null);
  assert.equal(legacy.state, null);
});

test('parseBackup rejects non-string invalid JSON invalid exportedAt and invalid state', () => {
  assert.deepEqual(parseBackup(null).errors, ['INVALID_BACKUP_TEXT']);
  assert.deepEqual(parseBackup('{').errors, ['INVALID_JSON']);

  const backup = makeBackup().envelope;
  assert.deepEqual(parseBackup(JSON.stringify({ ...backup, exportedAt: '2026-06-30' })).errors, [
    'INVALID_EXPORTED_AT'
  ]);

  const invalidState = { ...backup, state: { ...backup.state, schemaVersion: 2 } };
  const parsed = parseBackup(JSON.stringify(invalidState));
  assert.deepEqual(parsed.errors, ['INVALID_BACKUP_STATE']);
  assert.deepEqual(parsed.innerErrors, ['UNSUPPORTED_SCHEMA_VERSION']);
});

test('createBackupFromRepository exports only loaded canonical repository state', () => {
  const state = makeState();
  const repository = {
    load() {
      return { ok: true, status: 'loaded', state, errors: [] };
    }
  };

  const result = createBackupFromRepository(repository, { exportedAt: EXPORTED_AT });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'created');
  assert.equal(result.envelope.state.inventory['鋼條_6.3'].qtyByLocation.thetford, 12);
  assert.equal(Object.hasOwn(result.envelope.state.inventory['鋼條_6.3'], 'qtyByCity'), false);
  assert.deepEqual(parseBackup(result.backupText).state, result.envelope.state);
});

test('createBackupFromRepository maps repository states and failures without fallback', () => {
  assert.deepEqual(createBackupFromRepository({ load: 1 }, { exportedAt: EXPORTED_AT }), {
    ok: false,
    status: 'error',
    backupText: null,
    envelope: null,
    errors: ['INVALID_STORAGE_BACKEND'],
    innerErrors: []
  });
  assert.deepEqual(
    createBackupFromRepository({ load: () => ({ ok: true, status: 'missing', state: null, errors: [] }) }, { exportedAt: EXPORTED_AT }).errors,
    ['BACKUP_SOURCE_MISSING']
  );
  assert.deepEqual(
    createBackupFromRepository({ load: () => ({ ok: false, status: 'invalid', state: null, errors: ['INVALID_INVENTORY'] }) }, { exportedAt: EXPORTED_AT }),
    {
      ok: false,
      status: 'invalid',
      backupText: null,
      envelope: null,
      errors: ['INVALID_BACKUP_STATE'],
      innerErrors: ['INVALID_INVENTORY']
    }
  );
  assert.deepEqual(
    createBackupFromRepository({ load: () => ({ ok: false, status: 'error', state: null, errors: ['INVALID_STORAGE_BACKEND'] }) }, { exportedAt: EXPORTED_AT }).errors,
    ['INVALID_STORAGE_BACKEND']
  );
  assert.deepEqual(
    createBackupFromRepository({ load: () => { throw new Error('read failed'); } }, { exportedAt: EXPORTED_AT }).errors,
    ['STORAGE_READ_FAILED']
  );
  assert.deepEqual(
    createBackupFromRepository({ load: () => Promise.resolve({}) }, { exportedAt: EXPORTED_AT }).errors,
    ['STORAGE_READ_FAILED']
  );
});

test('backup modules remain pure and isolated from production integration surfaces', () => {
  const codec = readFileSync(new URL('../src/adapters/newSchemaBackupCodec.js', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/services/newSchemaBackupExportService.js', import.meta.url), 'utf8');
  const combined = `${codec}\n${service}`;

  assert.match(codec, /from '\.\/newSchemaStorageCodec\.js'/);
  assert.doesNotMatch(combined, /document|window|FileReader|Blob|__TAURI__|tauri/i);
  assert.doesNotMatch(combined, /localStorage|alert|toast|confirm|reload/);
  assert.doesNotMatch(combined, /newSchemaRuntimeBridge|projectRuntimeToNewSchema|projectNewSchemaToRuntime/);
  assert.doesNotMatch(combined, /from ['"].*app\.js|from ['"].*core\/state\.js/);
  assert.doesNotMatch(combined, /albion_crafting|albion-logistics-v2-state/);
  assert.doesNotMatch(combined, /Date\.now|new Date\(\)/);
});
