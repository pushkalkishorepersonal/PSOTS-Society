import { describe, it, expect } from 'vitest';
import { cacheGet, cacheSet, cacheDel } from '../../src/db/cache.js';

function mockEnv(bypass = false) {
  const store = new Map();
  return {
    CACHE_BYPASS: bypass ? '1' : undefined,
    CACHE_KV: {
      async get(key) { return store.get(key) || null; },
      async put(key, value) { store.set(key, value); },
      async delete(key) { store.delete(key); }
    },
    _store: store
  };
}

describe('cacheGet', () => {
  it('returns parsed value on hit', async () => {
    const env = mockEnv();
    await cacheSet(env, 'foo', { bar: 1 }, 300);
    expect(await cacheGet(env, 'foo')).toEqual({ bar: 1 });
  });

  it('returns null on miss', async () => {
    expect(await cacheGet(mockEnv(), 'nope')).toBeNull();
  });

  it('returns null when bypassed', async () => {
    const env = mockEnv(true);
    env._store.set('foo', JSON.stringify({ bar: 1 }));
    expect(await cacheGet(env, 'foo')).toBeNull();
  });

  it('returns null when CACHE_KV missing', async () => {
    expect(await cacheGet({}, 'foo')).toBeNull();
  });
});

describe('cacheSet', () => {
  it('stores values as JSON', async () => {
    const env = mockEnv();
    await cacheSet(env, 'x', [1, 2, 3], 300);
    expect(JSON.parse(env._store.get('x'))).toEqual([1, 2, 3]);
  });

  it('skips when bypassed', async () => {
    const env = mockEnv(true);
    await cacheSet(env, 'x', 'value', 300);
    expect(env._store.has('x')).toBe(false);
  });
});

describe('cacheDel', () => {
  it('removes existing key', async () => {
    const env = mockEnv();
    await cacheSet(env, 'x', 'value', 300);
    await cacheDel(env, 'x');
    expect(await cacheGet(env, 'x')).toBeNull();
  });

  it('silent on nonexistent key', async () => {
    const env = mockEnv();
    await expect(cacheDel(env, 'x')).resolves.toBeUndefined();
  });
});
