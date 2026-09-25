import safeStorage from "./safeStorage";

/**
 * High-Performance Instant Data Cache & Change State Engine (SWR).
 * Guarantees 0ms instant display across page transitions,
 * eliminates loading spinners on revisited tabs, and updates
 * ONLY when server data has actually changed.
 */

const memoryCache = new Map();
const subscribers = new Map();

/**
 * Fast deep/JSON comparison to detect true data changes without false renders.
 */
export function isDifferent(a, b) {
  if (a === b) return false;
  if (!a || !b) return true;
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

export const dataCache = {
  get(key) {
    if (memoryCache.has(key)) {
      const entry = memoryCache.get(key);
      return entry?.data ?? null;
    }
    // Try localStorage safe fallback
    try {
      const stored = safeStorage.getItem(`gotoshop_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(key, { data: parsed.data, time: parsed.time });
        return parsed.data;
      }
    } catch (e) {}
    return null;
  },

  getWithMeta(key) {
    if (memoryCache.has(key)) {
      return memoryCache.get(key);
    }
    try {
      const stored = safeStorage.getItem(`gotoshop_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(key, parsed);
        return parsed;
      }
    } catch (e) {}
    return null;
  },

  set(key, data, persist = false) {
    const prev = memoryCache.get(key);
    const changed = !prev || isDifferent(prev.data, data);
    
    const entry = { data, time: Date.now() };
    memoryCache.set(key, entry);

    if (persist) {
      try {
        safeStorage.setItem(`gotoshop_cache_${key}`, JSON.stringify(entry));
      } catch (e) {}
    }

    // If data changed, notify all subscribers for this key
    if (changed && subscribers.has(key)) {
      const cbs = subscribers.get(key);
      cbs.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.warn("[Cache] Subscriber callback error:", err);
        }
      });
    }
    return changed;
  },

  invalidate(prefixOrPattern) {
    for (const k of memoryCache.keys()) {
      if (k.startsWith(prefixOrPattern) || k.includes(prefixOrPattern)) {
        memoryCache.delete(k);
        try {
          safeStorage.removeItem(`gotoshop_cache_${k}`);
        } catch (e) {}
      }
    }
  },

  subscribe(key, callback) {
    if (!subscribers.has(key)) {
      subscribers.set(key, new Set());
    }
    subscribers.get(key).add(callback);
    return () => {
      const set = subscribers.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) subscribers.delete(key);
      }
    };
  },

  /**
   * Stale-While-Revalidate executor:
   * Returns cached data immediately (0ms latency),
   * fetches fresh server data in background, and only
   * updates the UI if the server response is genuinely different.
   */
  async swr(key, fetcher, { ttl = 30000, persist = false } = {}) {
    const cachedEntry = this.getWithMeta(key);
    const isFresh = cachedEntry && Date.now() - cachedEntry.time < ttl;

    // Background fetch helper
    const revalidate = async () => {
      try {
        const fresh = await fetcher();
        if (fresh !== undefined && fresh !== null) {
          this.set(key, fresh, persist);
        }
        return fresh;
      } catch (err) {
        return cachedEntry?.data;
      }
    };

    if (cachedEntry && cachedEntry.data) {
      // Revalidate in background if stale
      if (!isFresh) {
        revalidate();
      }
      return cachedEntry.data;
    }

    // Cold load: must wait for fetcher
    return await revalidate();
  },
};

export default dataCache;
