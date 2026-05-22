import { describe, it, expect } from 'vitest';
import { rateLimit } from '../../src/middleware/ratelimit.middleware.js';

function mockEnv(bypass = false) {
  const store = new Map();
  return {
    RATELIMIT_BYPASS: bypass ? '1' : undefined,
    CACHE_KV: {
      async get(key) { return store.get(key) || null; },
      async put(key, value) { store.set(key, value); },
      async delete(key) { store.delete(key); }
    },
    _store: store
  };
}

describe('rateLimit', () => {
  it('allows requests under the limit', async () => {
    const env = mockEnv();
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(env, 'test', '1.1.1.1', 5);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks requests over the limit', async () => {
    const env = mockEnv();
    for (let i = 0; i < 5; i++) await rateLimit(env, 'test', '1.1.1.1', 5);
    const result = await rateLimit(env, 'test', '1.1.1.1', 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks different identifiers separately', async () => {
    const env = mockEnv();
    for (let i = 0; i < 5; i++) await rateLimit(env, 'test', '1.1.1.1', 5);
    const result = await rateLimit(env, 'test', '2.2.2.2', 5);
    expect(result.allowed).toBe(true);
  });

  it('tracks different buckets separately', async () => {
    const env = mockEnv();
    for (let i = 0; i < 5; i++) await rateLimit(env, 'bucket-a', '1.1.1.1', 5);
    const result = await rateLimit(env, 'bucket-b', '1.1.1.1', 5);
    expect(result.allowed).toBe(true);
  });

  it('fails open on bypass', async () => {
    const env = mockEnv(true);
    env._store.set('rl:test:1.1.1.1:' + Math.floor(Date.now() / 60000), '999');
    const result = await rateLimit(env, 'test', '1.1.1.1', 5);
    expect(result.allowed).toBe(true);
  });

  it('fails open when CACHE_KV missing', async () => {
    const result = await rateLimit({}, 'test', '1.1.1.1', 5);
    expect(result.allowed).toBe(true);
  });

  it('decrements remaining correctly', async () => {
    const env = mockEnv();
    const r1 = await rateLimit(env, 'test', 'x', 5);
    expect(r1.remaining).toBe(4);
    const r2 = await rateLimit(env, 'test', 'x', 5);
    expect(r2.remaining).toBe(3);
  });
});
