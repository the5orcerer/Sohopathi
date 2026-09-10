/**
 * In-memory high performance Cache with TTL and prefix invalidation.
 * Protects database health by caching hot tenant contexts, permission mappings,
 * and aggregate dashboard stats.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
  };

  /**
   * Get an item from the cache. Returns null if expired or missing.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set an item with a time-to-live in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.stats.sets++;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete an item by exact key.
   */
  del(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidate all keys starting with a given prefix (e.g., 'ctx:', 'stats:inst-1:').
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    this.stats.invalidations += count;
    return count;
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get current cache health stats.
   */
  getStats() {
    return {
      size: this.store.size,
      ...this.stats,
    };
  }
}

export const appCache = new MemoryCache();

