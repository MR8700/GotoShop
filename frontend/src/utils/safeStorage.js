/**
 * Safe cross-browser storage wrapper with memory fallback.
 * Prevents DOMException / SecurityError crashes in Safari Private Browsing,
 * iOS/Android WebViews (WhatsApp, Facebook, TikTok), and privacy-hardened browsers.
 */
const memoryStore = {};

export const safeStorage = {
  getItem: (key) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // Storage access blocked or restricted
    }
    return memoryStore[key] !== undefined ? memoryStore[key] : null;
  },

  setItem: (key, value) => {
    const stringValue = String(value);
    memoryStore[key] = stringValue;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, stringValue);
      }
    } catch (e) {
      // QuotaExceededError or SecurityError in private mode
    }
  },

  removeItem: (key) => {
    delete memoryStore[key];
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {}
  },

  clear: () => {
    for (const k in memoryStore) {
      delete memoryStore[k];
    }
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (e) {}
  },
};

export default safeStorage;
