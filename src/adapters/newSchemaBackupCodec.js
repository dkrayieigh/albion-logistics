import { encodeNewSchemaState } from './newSchemaStorageCodec.js';

export const BACKUP_FORMAT = 'albion-logistics-backup';
export const BACKUP_FORMAT_VERSION = 1;

const ERROR_ORDER = [
  'INVALID_BACKUP_TEXT',
  'INVALID_JSON',
  'INVALID_BACKUP_ROOT',
  'AMBIGUOUS_BACKUP_FORMAT',
  'UNSUPPORTED_BACKUP_FORMAT',
  'UNSUPPORTED_BACKUP_VERSION',
  'INVALID_EXPORTED_AT',
  'INVALID_BACKUP_STATE',
  'BACKUP_SOURCE_MISSING',
  'INVALID_STORAGE_BACKEND',
  'STORAGE_READ_FAILED'
];

const ENVELOPE_KEYS = ['format', 'backupFormatVersion', 'exportedAt', 'state'];
const LEGACY_REQUIRED_KEYS = ['inventory', 'assets', 'transactions'];
const LEGACY_OPTIONAL_KEYS = ['laborerInventory', 'laborerLogs', 'customLocations'];
const LEGACY_ROOT_KEYS = [...LEGACY_REQUIRED_KEYS, ...LEGACY_OPTIONAL_KEYS];

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function pushError(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function orderedErrors(errors) {
  return ERROR_ORDER.filter(code => errors.includes(code));
}

function resultBase(ok, status, errors = [], innerErrors = []) {
  return { ok, status, errors: orderedErrors(errors), innerErrors };
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function hasLegacyRequiredKeys(value) {
  return LEGACY_REQUIRED_KEYS.every(key => Object.hasOwn(value, key));
}

function hasAnyLegacyRootKey(value) {
  return LEGACY_ROOT_KEYS.some(key => Object.hasOwn(value, key));
}

function isValidExportedAt(value) {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function validateCanonicalState(state) {
  const encoded = encodeNewSchemaState(state);
  if (!encoded.ok) {
    return {
      ok: false,
      state: null,
      innerErrors: encoded.errors
    };
  }

  return {
    ok: true,
    state: JSON.parse(encoded.serialized),
    innerErrors: []
  };
}

export function classifyBackup(value) {
  if (!isPlainObject(value)) {
    return resultBase(false, 'invalid', ['INVALID_BACKUP_ROOT']);
  }

  const hasFormat = Object.hasOwn(value, 'format');

  if (hasFormat) {
    if (hasAnyLegacyRootKey(value)) {
      return resultBase(false, 'invalid', ['AMBIGUOUS_BACKUP_FORMAT']);
    }
    if (value.format !== BACKUP_FORMAT) {
      return resultBase(false, 'invalid', ['UNSUPPORTED_BACKUP_FORMAT']);
    }
    if (value.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
      return resultBase(false, 'invalid', ['UNSUPPORTED_BACKUP_VERSION']);
    }
    if (!hasExactKeys(value, ENVELOPE_KEYS)) {
      return resultBase(false, 'invalid', ['INVALID_BACKUP_ROOT']);
    }
    return resultBase(true, 'v2');
  }

  if (hasLegacyRequiredKeys(value)) return resultBase(true, 'legacy');
  return resultBase(false, 'invalid', ['INVALID_BACKUP_ROOT']);
}

export function createBackup(state, options = {}) {
  const errors = [];
  const exportedAt = options && typeof options === 'object' ? options.exportedAt : undefined;

  if (!isValidExportedAt(exportedAt)) pushError(errors, 'INVALID_EXPORTED_AT');

  const validated = validateCanonicalState(state);
  if (!validated.ok) pushError(errors, 'INVALID_BACKUP_STATE');

  if (errors.length > 0) {
    return {
      ...resultBase(false, 'invalid', errors, validated.innerErrors),
      backupText: null,
      envelope: null
    };
  }

  const envelope = {
    format: BACKUP_FORMAT,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportedAt,
    state: validated.state
  };

  return {
    ...resultBase(true, 'created'),
    backupText: JSON.stringify(envelope, null, 2),
    envelope
  };
}

export function parseBackup(text) {
  if (typeof text !== 'string') {
    return {
      ...resultBase(false, 'invalid', ['INVALID_BACKUP_TEXT']),
      envelope: null,
      state: null,
      legacyPayload: null
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ...resultBase(false, 'invalid', ['INVALID_JSON']),
      envelope: null,
      state: null,
      legacyPayload: null
    };
  }

  const classified = classifyBackup(parsed);
  if (!classified.ok) {
    return {
      ...resultBase(false, 'invalid', classified.errors, classified.innerErrors),
      envelope: null,
      state: null,
      legacyPayload: null
    };
  }

  if (classified.status === 'legacy') {
    return {
      ...resultBase(true, 'legacy'),
      envelope: null,
      state: null,
      legacyPayload: parsed
    };
  }

  const errors = [];
  if (!isValidExportedAt(parsed.exportedAt)) pushError(errors, 'INVALID_EXPORTED_AT');

  const validated = validateCanonicalState(parsed.state);
  if (!validated.ok) pushError(errors, 'INVALID_BACKUP_STATE');

  if (errors.length > 0) {
    return {
      ...resultBase(false, 'invalid', errors, validated.innerErrors),
      envelope: null,
      state: null,
      legacyPayload: null
    };
  }

  const envelope = {
    format: parsed.format,
    backupFormatVersion: parsed.backupFormatVersion,
    exportedAt: parsed.exportedAt,
    state: validated.state
  };

  return {
    ...resultBase(true, 'v2'),
    envelope,
    state: envelope.state,
    legacyPayload: null
  };
}
