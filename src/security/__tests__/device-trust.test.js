import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDeviceToken,
  parseDeviceName,
  buildDeviceCookie,
  buildDeviceClearCookie,
  createDeviceSession,
  validateDeviceToken,
} from '../device-trust.js';

vi.mock('../../db/adapter.js', () => ({
  createDeviceSession: vi.fn(async (data) => data),
  getDeviceSession: vi.fn(async (token) => null),
  revokeDeviceSession: vi.fn(async () => {}),
}));

import * as adapter from '../../db/adapter.js';

describe('device-trust: generateDeviceToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('generates 64-char hex string', () => {
    const token = generateDeviceToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates different tokens on each call', () => {
    const token1 = generateDeviceToken();
    const token2 = generateDeviceToken();
    expect(token1).not.toBe(token2);
  });
});

describe('device-trust: parseDeviceName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects Chrome on iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1 Chrome/120.0.0.0';
    expect(parseDeviceName(ua)).toMatch(/Chrome.*iPhone/);
  });

  it('detects Safari on MacBook', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.0 Safari/537.36';
    expect(parseDeviceName(ua)).toMatch(/Safari.*MacBook/);
  });

  it('detects Chrome on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseDeviceName(ua)).toMatch(/Chrome.*Windows/);
  });

  it('detects Chrome on Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(parseDeviceName(ua)).toMatch(/Chrome.*Android/);
  });

  it('detects Firefox on Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
    expect(parseDeviceName(ua)).toMatch(/Firefox.*Linux/);
  });

  it('handles iPad', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
    expect(parseDeviceName(ua)).toMatch(/iPad/);
  });

  it('returns Unknown for empty user agent', () => {
    expect(parseDeviceName('')).toBe('Unknown device');
  });

  it('returns Unknown for null user agent', () => {
    expect(parseDeviceName(null)).toBe('Unknown device');
  });

  it('returns Unknown for unrecognized user agent', () => {
    expect(parseDeviceName('asdfqwerty')).toBe('Unknown device');
  });
});

describe('device-trust: buildDeviceCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats cookie with required attributes', () => {
    const cookie = buildDeviceCookie('abc123def456');
    expect(cookie).toContain('psots_device=abc123def456');
    expect(cookie).toContain('Domain=.psots.in');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=31536000');
  });

  it('sets 1-year max age', () => {
    const cookie = buildDeviceCookie('token');
    expect(cookie).toContain('Max-Age=31536000'); // 365 * 24 * 60 * 60
  });
});

describe('device-trust: buildDeviceClearCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets max-age to 0 for deletion', () => {
    const cookie = buildDeviceClearCookie();
    expect(cookie).toContain('Max-Age=0');
  });

  it('clears token value', () => {
    const cookie = buildDeviceClearCookie();
    expect(cookie).toMatch(/psots_device=;/);
  });

  it('maintains all other attributes', () => {
    const cookie = buildDeviceClearCookie();
    expect(cookie).toContain('Domain=.psots.in');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
  });
});

describe('device-trust: createDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates device token and expires at 1 year', async () => {
    const mockEnv = { RATE_LIMITS_KV: null };
    const result = await createDeviceSession({
      residentId: 'r_123',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2...',
      ipAddress: '103.1.2.3',
      cityHint: 'Bangalore',
      env: mockEnv,
    });

    expect(result).toHaveProperty('deviceToken');
    expect(result.deviceToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result).toHaveProperty('expiresAt');

    // Check expiration is approximately 1 year from now
    const expiresAt = new Date(result.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(364);
    expect(diffDays).toBeLessThan(366);
  });

  it('calls adapter with session data', async () => {
    adapter.createDeviceSession.mockResolvedValueOnce({});
    const mockEnv = { RATE_LIMITS_KV: null };

    await createDeviceSession({
      residentId: 'r_123',
      userAgent: 'Chrome/120',
      ipAddress: '103.1.2.3',
      cityHint: 'Bangalore',
      env: mockEnv,
    });

    expect(adapter.createDeviceSession).toHaveBeenCalledOnce();
    const callArgs = adapter.createDeviceSession.mock.calls[0][0];
    expect(callArgs).toHaveProperty('residentId', 'r_123');
    expect(callArgs).toHaveProperty('deviceName');
    expect(callArgs).toHaveProperty('ipAddress', '103.1.2.3');
    expect(callArgs).toHaveProperty('revoked', false);
  });
});

describe('device-trust: validateDeviceToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when session not found', async () => {
    adapter.getDeviceSession.mockResolvedValueOnce(null);
    const mockEnv = { RATE_LIMITS_KV: null };

    const result = await validateDeviceToken('invalid_token', mockEnv);
    expect(result).toBeNull();
  });

  it('returns null when session is revoked', async () => {
    adapter.getDeviceSession.mockResolvedValueOnce({
      deviceToken: 'valid_token',
      residentId: 'r_123',
      revoked: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const mockEnv = { RATE_LIMITS_KV: null };

    const result = await validateDeviceToken('valid_token', mockEnv);
    expect(result).toBeNull();
  });

  it('returns null when session is expired', async () => {
    adapter.getDeviceSession.mockResolvedValueOnce({
      deviceToken: 'expired_token',
      residentId: 'r_123',
      revoked: false,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const mockEnv = { RATE_LIMITS_KV: null };

    const result = await validateDeviceToken('expired_token', mockEnv);
    expect(result).toBeNull();
  });

  it('returns session data for valid token', async () => {
    const sessionData = {
      deviceToken: 'valid_token',
      residentId: 'r_123',
      deviceName: 'Chrome on MacBook',
      revoked: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    adapter.getDeviceSession.mockResolvedValueOnce(sessionData);
    const mockEnv = { RATE_LIMITS_KV: null };

    const result = await validateDeviceToken('valid_token', mockEnv);
    expect(result).toEqual(sessionData);
  });
});
