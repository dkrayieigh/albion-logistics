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
  let removeItem;

  try {
    getItem = storage.getItem;
    setItem = storage.setItem;
    removeItem = storage.removeItem;
  } catch {
    return invalidBrowserStorageResult();
  }

  if (typeof getItem !== 'function' || typeof setItem !== 'function') {
    return invalidBrowserStorageResult();
  }

  const backend = {
    getItem(key) {
      return getItem.call(storage, key);
    },

    setItem(key, value) {
      return setItem.call(storage, key, value);
    }
  };

  if (typeof removeItem === 'function') {
    backend.removeItem = function removeBrowserStorageItem(key) {
      return removeItem.call(storage, key);
    };
  }

  return {
    ok: true,
    backend,
    errors: []
  };
}
