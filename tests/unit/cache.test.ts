import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache } from '../../src/core/cache';

describe('MemoryCache Health & Invalidation', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  it('stores and retrieves values within TTL', () => {
    cache.set('tenant:ctx:1', { name: 'Dhaka Model', role: 'admin' }, 60);
    const val = cache.get<{ name: string; role: string }>('tenant:ctx:1');
    expect(val).not.toBeNull();
    expect(val?.name).toBe('Dhaka Model');
    expect(val?.role).toBe('admin');
  });

  it('returns null on cache miss', () => {
    const val = cache.get('nonexistent');
    expect(val).toBeNull();
    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it('expires entries after TTL', async () => {
    // 0.05 seconds TTL
    cache.set('quick:expire', 'temp-data', 0.05);
    expect(cache.get('quick:expire')).toBe('temp-data');

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('quick:expire')).toBeNull();
  });

  it('deletes specific keys correctly', () => {
    cache.set('key1', 'val1', 60);
    expect(cache.del('key1')).toBe(true);
    expect(cache.get('key1')).toBeNull();
    expect(cache.del('key1')).toBe(false);
  });

  it('invalidates entries by prefix', () => {
    cache.set('ctx:user1:inst1', 'session-1', 60);
    cache.set('ctx:user1:inst2', 'session-2', 60);
    cache.set('ctx:user2:inst1', 'session-3', 60);
    cache.set('stats:inst1', 'stats-data', 60);

    const invalidated = cache.invalidatePrefix('ctx:user1:');
    expect(invalidated).toBe(2);

    expect(cache.get('ctx:user1:inst1')).toBeNull();
    expect(cache.get('ctx:user1:inst2')).toBeNull();
    expect(cache.get('ctx:user2:inst1')).toBe('session-3');
    expect(cache.get('stats:inst1')).toBe('stats-data');
  });

  it('clears entire cache and tracks accurate stats', () => {
    cache.set('a', 1, 60);
    cache.set('b', 2, 60);
    cache.get('a'); // hit
    cache.get('missing'); // miss

    const stats = cache.getStats();
    expect(stats.sets).toBe(2);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(2);

    cache.clear();
    expect(cache.getStats().size).toBe(0);
  });
});
