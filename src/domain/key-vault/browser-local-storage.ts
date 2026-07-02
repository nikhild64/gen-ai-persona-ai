/**
 * AD-11 — browser-local persistence for BYO keys and settings preferences.
 * All localStorage access is confined to this module (ESLint AD-6 exemption).
 * Legacy sessionStorage values are copied lazily on first access per key.
 */

function migrateKeyFromSession(key: string): void {
  if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession !== null && localStorage.getItem(key) === null) {
      localStorage.setItem(key, fromSession);
    }
    if (fromSession !== null) {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* private mode / blocked storage */
  }
}

export function localStoreGet(key: string): string | null {
  migrateKeyFromSession(key);
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function localStoreSet(key: string, value: string): void {
  migrateKeyFromSession(key);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota exceeded */
  }
}

export function localStoreRemove(key: string): void {
  migrateKeyFromSession(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
