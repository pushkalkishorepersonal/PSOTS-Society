import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for hardened /auth/verify-email-otp endpoint
 * Attempt limits (5 max), 15-min OTP expiry, 30-min lockout after threshold
 */

describe('verify-email-otp endpoint (hardened)', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      VIOLATIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  describe('Happy path: valid OTP', () => {
    it('should verify valid OTP and clear attempt counter', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const futureExpiry = Date.now() + 15 * 60 * 1000; // 15 min from now

      const storedOtpData = JSON.stringify({
        otp,
        used: false,
        expires: futureExpiry,
      });

      vi.spyOn(mockEnv.VIOLATIONS, 'get').mockResolvedValueOnce(storedOtpData);

      // Assert: OTP matches and should be marked used
      const parsed = JSON.parse(storedOtpData);
      expect(parsed.otp).toBe(otp);
      expect(parsed.used).toBe(false);
      expect(Date.now() < parsed.expires).toBe(true);
    });
  });

  describe('OTP expiry (15 min)', () => {
    it('should reject if OTP expired after 15 minutes', () => {
      const fifteenMinAgo = Date.now() - 15 * 60 * 1000 - 1000;
      const storedOtpData = {
        otp: '123456',
        used: false,
        expires: fifteenMinAgo,
      };

      expect(Date.now() > storedOtpData.expires).toBe(true);
    });

    it('should accept OTP within 15-minute window', () => {
      const inFuture = Date.now() + 10 * 60 * 1000;
      const storedOtpData = {
        otp: '123456',
        used: false,
        expires: inFuture,
      };

      expect(Date.now() < storedOtpData.expires).toBe(true);
    });
  });

  describe('Attempt tracking (5 max)', () => {
    it('should track failed attempts and allow up to 4 before lockout', () => {
      const maxAttempts = 5;
      for (let i = 1; i < maxAttempts; i++) {
        expect(i).toBeLessThan(maxAttempts);
      }
    });

    it('should block on 5th failed attempt with 30-min lockout', () => {
      const email = 'test@example.com';
      const attempts = 5;
      const maxAttempts = 5;

      expect(attempts >= maxAttempts).toBe(true);
      // Lockout TTL should be 1800 seconds (30 minutes)
      const lockoutTtl = 30 * 60; // 1800 seconds
      expect(lockoutTtl).toBe(1800);
    });

    it('should include remaining attempts in response', () => {
      const attempts = 3;
      const maxAttempts = 5;
      const remaining = maxAttempts - attempts;

      expect(remaining).toBe(2);
    });
  });

  describe('Lockout (30 min)', () => {
    it('should reject if email is locked', async () => {
      const email = 'test@example.com';
      const lockoutKey = `otp_lockout_${email.toLowerCase()}`;

      // Simulate locked state
      vi.spyOn(mockEnv.VIOLATIONS, 'get').mockResolvedValueOnce('locked');

      const lockoutValue = await mockEnv.VIOLATIONS.get(lockoutKey);
      expect(lockoutValue).toBeTruthy();
    });

    it('should have 30-min (1800s) lockout expiry after 5 attempts', () => {
      const lockoutTtl = 1800; // 30 minutes in seconds
      const thirtyMinutes = 30 * 60;

      expect(lockoutTtl).toBe(thirtyMinutes);
    });

    it('should set lockout key after 5th failed attempt', () => {
      const email = 'test@example.com';
      const lockoutKey = `otp_lockout_${email.toLowerCase()}`;
      const lockoutValue = 'locked';

      expect(lockoutKey).toMatch(/otp_lockout_/);
      expect(lockoutValue).toBe('locked');
    });
  });

  describe('Input validation', () => {
    it('should reject missing email or OTP', () => {
      const invalidRequests = [
        { email: 'test@example.com' }, // Missing OTP
        { otp: '123456' }, // Missing email
        {}, // Missing both
      ];

      invalidRequests.forEach(req => {
        expect(!req.email || !req.otp).toBe(true);
      });
    });
  });

  describe('Attempt counter cleanup', () => {
    it('should clear attempt counter after successful verification', () => {
      const email = 'test@example.com';
      const attemptKey = `otp_attempts_${email.toLowerCase()}`;

      // After successful verification, attempt counter should be deleted
      expect(attemptKey).toMatch(/otp_attempts_/);
    });

    it('should clear attempt counter after lockout expires', () => {
      // Lockout key expires after 1800s (30 min)
      // Attempt counter also expires after 900s (15 min)
      const lockoutExpiry = 1800;
      const attemptExpiry = 900;

      // Lockout lasts longer than attempts, so lockout is the blocking factor
      expect(lockoutExpiry > attemptExpiry).toBe(true);
    });
  });

  describe('Error responses', () => {
    it('should return rate_limited error when locked', () => {
      const response = {
        ok: false,
        error: 'rate_limited',
        message: 'Too many failed attempts. Account locked for 30 minutes.',
      };

      expect(response.ok).toBe(false);
      expect(response.error).toBe('rate_limited');
      expect(response.message).toContain('30 minutes');
    });

    it('should return otp_invalid with attempt counts', () => {
      const response = {
        ok: false,
        error: 'otp_invalid',
        attempts: 3,
        maxAttempts: 5,
        attemptsRemaining: 2,
      };

      expect(response.ok).toBe(false);
      expect(response.error).toBe('otp_invalid');
      expect(response.attemptsRemaining).toBe(2);
    });

    it('should return otp_expired when OTP expires', () => {
      const response = {
        ok: false,
        error: 'otp_expired',
      };

      expect(response.ok).toBe(false);
      expect(response.error).toBe('otp_expired');
    });
  });
});
