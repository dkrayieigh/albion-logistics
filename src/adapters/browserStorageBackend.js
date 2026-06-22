function invalidBrowserStorageResult() {
  return {
    ok: false,
    backend: null,
    errors: ['INVALID_BROWSER_STORAGE']
  };
}

function hasRejectedObjectShape(value) {
  try {
    const tag = Object.prototype.toString.call(value);
    return tag === '[object Array]' ||
      tag === '[object Date]' ||
      tag === '[object Map]' ||
      tag === '[object Set]';
  } catch {
    return true;
  }
}

export function createBrowserStorageBackend(storage) {
  if (
    storage === null ||
    (typeof storage !== 'object' && typeof storage !== 'function') ||
    hasRejectedObjectShape(storage)
  ) {
    return invalidBrowserStorageResult();
  }

  let getItem;
  let setItem;

  try {
    getItem = storage.getItem;
    setItem = storage.setItem;
  } catch {
    return invalidBrowserStorageResult();
  }

  if (typeof getItem !== 'function' || typeof setItem !== 'function') {
    return invalidBrowserStorageResult();
  }

  return {
    ok: true,
    backend: {
      getItem(key) {
        return getItem.call(storage, key);
      },

      setItem(key, value) {
        return setItem.call(storage, key, value);
      }
    },
    errors: []
  };
}
