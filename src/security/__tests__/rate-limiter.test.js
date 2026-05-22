import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkAndRecord,
  check,
  reset,
  buildKey,
  RATE_LIMITS,
} from '../rate-limiter.js';

// Mock KV store for testing
function createMockKV() {
  const store = new Map();
  return {
    async get(key, format) {
      const value = store.get(key);
      return value ? (format === 'json' ? JSON.parse(value) : value) : null;
    },
    async put(key, value, opts) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

describe('rate-limiter: buildKey', () => {
  it('formats key correctly', () => {
    const key = buildKey('otp_request', 'ip', '103.1.2.3');
    expect(key).toBe('ratelim:otp_request:ip:103.1.2.3');
  });

  it('handles different bucket/dimension/value combinations', () => {
    const key = buildKey('login', 'email', 'test@example.com');
    expect(key).toBe('ratelim:login:email:test@example.com');
  });
});

describe('rate-limiter: checkAndRecord', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = { RATE_LIMITS_KV: createMockKV() };
  });

  it('allows first request', async () => {
    const result = await checkAndRecord({
      key: 'test:ip:1.2.3.4',
      limit: 5,
      windowSeconds: 3600,
      env: mockEnv,
    });
    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(1);
  });

  it('increments count on subsequent requests', async () => {
    const params = {
      key: 'test:ip:1.2.3.4',
      limit: 5,
      windowSeconds: 3600,
      env: mockEnv,
    };

    let result = await checkAndRecord(params);
    expect(result.currentCount).toBe(1);

    result = await checkAndRecord(params);
    expect(result.currentCount).toBe(2);

    result = await checkAndRecord(params);
    expect(result.currentCount).toBe(3);
  });

  it('denies after limit reached', async () => {
    const params = {
      key: 'test:ip:1.2.3.4',
      limit: 3,
      windowSeconds: 3600,
      env: mockEnv,
    };

    // Fill to limit
    await checkAndRecord(params);
    await checkAndRecord(params);
    await checkAndRecord(params);

    // Next should be denied
    const result = await checkAndRecord(params);
    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(3);
  });

  it('returns resetsAt timestamp', async () => {
    const beforeCall = Date.now();
    const result = await checkAndRecord({
      key: 'test:ip:1.2.3.4',
      limit: 5,
      windowSeconds: 60,
      env: mockEnv,
    });
    const afterCall = Date.now();

    expect(result.resetsAt).toBeGreaterThan(beforeCall);
    expect(result.resetsAt).toBeLessThan(afterCall + 70000); // within 70 seconds
  });

  it('fails gracefully when KV not configured', async () => {
    const result = await checkAndRecord({
      key: 'test:ip:1.2.3.4',
      limit: 5,
      windowSeconds: 3600,
      env: { RATE_LIMITS_KV: null },
    });
    expect(result.allowed).toBe(true);
  });
});

describe('rate-limiter: check (read-only)', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = { RATE_LIMITS_KV: createMockKV() };
  });

  it('does not increment counter', async () => {
    const params = {
      key: 'test:ip:1.2.3.4',
      limit: 5,
      windowSeconds: 3600,
      env: mockEnv,
    };

    // Record one request
    await checkAndRecord(params);

    // Check without recording
    const result = await check(params);
    expect(result.currentCount).toBe(1);

    // Check again — count should still be 1
    const result2 = await check(params);
    expect(result2.currentCount).toBe(1);
  });

  it('returns allowed: false when limit exceeded', async () => {
    const params = {
      key: 'test:ip:1.2.3.4',
      limit: 2,
      windowSeconds: 3600,
      env: mockEnv,
    };

    await checkAndRecord(params);
    await checkAndRecord(params);

    const result = await check(params);
    expect(result.allowed).toBe(false);
  });

  it('returns allowed: true when under limit', async () => {
    const params = {
      key: 'test:ip:1.2.3.4',
      limit: 5,
      windowSeconds: 3600,
      env: mockEnv,
    };

    await checkAndRecord(params);

    const result = await check(params);
    expect(result.allowed).toBe(true);
  });
});

describe('rate-limiter: reset', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = { RATE_LIMITS_KV: createMockKV() };
  });

  it('clears rate limit bucket', async () => {
    const params = {
      key: 'test:ip:1.2.3.4',
      limit: 2,
      windowSeconds: 3600,
      env: mockEnv,
    };

    await checkAndRecord(params);
    await checkAndRecord(params);

    // Should be at limit
    let result = await check(params);
    expect(result.allowed).toBe(false);

    // Reset
    await reset({ key: 'test:ip:1.2.3.4', env: mockEnv });

    // Should allow again
    result = await check(params);
    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(0);
  });
});

describe('rate-limiter: RATE_LIMITS constants', () => {
  it('has OTP_REQUEST_PER_IP config', () => {
    expect(RATE_LIMITS.OTP_REQUEST_PER_IP).toEqual({ limit: 5, windowSeconds: 3600 });
  });

  it('has OTP_REQUEST_PER_TARGET config', () => {
    expect(RATE_LIMITS.OTP_REQUEST_PER_TARGET).toEqual({ limit: 3, windowSeconds: 3600 });
  });

  it('has LOGIN_ATTEMPTS_PER_IP config', () => {
    expect(RATE_LIMITS.LOGIN_ATTEMPTS_PER_IP).toEqual({ limit: 10, windowSeconds: 300 });
  });

  it('has REGISTRATION_PER_EMAIL config', () => {
    expect(RATE_LIMITS.REGISTRATION_PER_EMAIL).toEqual({ limit: 1, windowSeconds: 86400 });
  });

  it('has APPEAL_PER_RESIDENT config (7-day cooldown)', () => {
    expect(RATE_LIMITS.APPEAL_PER_RESIDENT).toEqual({ limit: 1, windowSeconds: 604800 });
  });

  it('has FEEDBACK_PER_RESIDENT config', () => {
    expect(RATE_LIMITS.FEEDBACK_PER_RESIDENT).toEqual({ limit: 3, windowSeconds: 86400 });
  });
});
