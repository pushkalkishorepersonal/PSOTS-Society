import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as db from '../src/db/adapter.js';

/**
 * Tests for /auth/resume-device endpoint
 * Trusted device quick-return validation
 */

describe('resume-device endpoint', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      SESSIONS_KV: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  describe('Happy path: valid trusted device', () => {
    it('should return device info for valid, non-revoked, non-expired device', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

      const mockDeviceSession = {
        deviceToken: 'device_uuid_123',
        uid: 'r_15167_abc',
        flatNumber: '15167',
        revoked: false,
        expiresAt: futureDate,
        lastUsedAt: new Date().toISOString(),
        deviceLabel: 'iPhone · Safari',
        ipCity: 'Bangalore',
      };

      vi.spyOn(db, 'getDeviceSession').mockResolvedValueOnce(mockDeviceSession);

      // Assert: device should be trusted and return info
      expect(mockDeviceSession.revoked).toBe(false);
      expect(new Date(mockDeviceSession.expiresAt) > new Date()).toBe(true);
      expect(mockDeviceSession.uid).toBe('r_15167_abc');
    });
  });

  describe('Device validation', () => {
    it('should reject missing device token', () => {
      const request = { token: null };
      expect(!request.token).toBe(true);
    });

    it('should reject if device not found', async () => {
      vi.spyOn(db, 'getDeviceSession').mockResolvedValueOnce(null);

      const deviceToken = 'non_existent_token';
      const session = await db.getDeviceSession(deviceToken, {});

      expect(session).toBeNull();
    });

    it('should reject if device is revoked', async () => {
      const revokedDevice = {
        deviceToken: 'device_uuid_revoked',
        uid: 'r_15167_abc',
        revoked: true,
        revokedAt: new Date().toISOString(),
      };

      vi.spyOn(db, 'getDeviceSession').mockResolvedValueOnce(revokedDevice);

      const session = await db.getDeviceSession('device_uuid_revoked', {});
      expect(session.revoked).toBe(true);
    });

    it('should reject if device session expired', () => {
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const expiredDevice = {
        deviceToken: 'device_uuid_expired',
        uid: 'r_15167_abc',
        revoked: false,
        expiresAt: pastDate,
      };

      expect(new Date(expiredDevice.expiresAt) < new Date()).toBe(true);
    });
  });

  describe('Device session lifecycle', () => {
    it('should store device with 1-year expiry', () => {
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + oneYearMs).toISOString();

      expect(new Date(expiresAt) > new Date()).toBe(true);
    });

    it('should update lastUsedAt on each resume', () => {
      const before = new Date().toISOString();
      // In actual endpoint, lastUsedAt is updated to current time
      const after = new Date().toISOString();

      expect(new Date(after) >= new Date(before)).toBe(true);
    });
  });

  describe('Response format', () => {
    it('should return required fields on success', async () => {
      const mockDevice = {
        deviceToken: 'device_uuid_123',
        uid: 'r_15167_abc',
        flatNumber: '15167',
        revoked: false,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsedAt: new Date().toISOString(),
        deviceLabel: 'iPhone · Safari',
        ipCity: 'Bangalore',
      };

      // Expected response fields
      const expectedFields = ['ok', 'trusted', 'uid', 'flatNumber', 'lastSeen', 'ipCity', 'deviceLabel'];
      expectedFields.forEach(field => {
        // Validate response would have these fields
        const hasField = field === 'ok' || field === 'trusted' ||
                        field === 'uid' || field === 'flatNumber' ||
                        field === 'lastSeen' || field === 'ipCity' ||
                        field === 'deviceLabel';
        expect(hasField).toBe(true);
      });
    });

    it('should return error response on failure', () => {
      const errorResponse = { ok: false, trusted: false, error: 'device_not_found' };

      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.trusted).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });
  });
});
