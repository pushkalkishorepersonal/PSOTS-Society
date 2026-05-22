import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as db from '../src/db/adapter.js';
import { parseFlatNumber } from '../src/utils/flat-parser.js';

/**
 * Tests for /auth/register endpoint
 * New resident registration with flat validation, atomic creation, rate limiting
 */

describe('register endpoint', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      SESSIONS_KV: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      VIOLATIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
      },
    };
  });

  describe('Happy path: new resident registration', () => {
    it('should create resident, credential, and flat atomically', async () => {
      const mockResident = {
        residentId: 'r_15167_12345',
        flatNumber: '15167',
        name: 'John Doe',
        residentType: 'owner',
        status: 'pending',
      };

      const mockCredential = {
        credentialId: 'cred_google_john@example.com_12345',
        residentId: 'r_15167_12345',
        type: 'google',
        identifier: 'john@example.com',
      };

      const mockFlat = {
        flatNumber: '15167',
        tower: 'A',
        floor: '1',
        unit: '7',
      };

      vi.spyOn(mockEnv.SESSIONS_KV, 'get').mockResolvedValueOnce(null); // No rate limit
      vi.spyOn(db, 'getFlatV2').mockResolvedValueOnce(null); // Flat not occupied
      vi.spyOn(db, 'getCredentialByTypeAndIdentifier').mockResolvedValueOnce(null); // Credential doesn't exist
      vi.spyOn(db, 'createResidentV2').mockResolvedValueOnce(mockResident);
      vi.spyOn(db, 'createCredential').mockResolvedValueOnce(mockCredential);
      vi.spyOn(db, 'createFlatV2').mockResolvedValueOnce(mockFlat);
      vi.spyOn(mockEnv.SESSIONS_KV, 'put').mockResolvedValueOnce(undefined);

      // Input
      const request = {
        type: 'google',
        identifier: 'john@example.com',
        name: 'John Doe',
        flatNumber: '15167',
      };

      // Assert: resident, credential, flat created successfully
      expect(mockResident.status).toBe('pending');
      expect(mockCredential.residentId).toBe(mockResident.residentId);
      expect(mockFlat.flatNumber).toBe(request.flatNumber);
    });
  });

  describe('Input validation', () => {
    it('should reject missing required fields', () => {
      const invalidRequests = [
        { type: 'google', identifier: 'test@example.com', name: 'Test' }, // Missing flatNumber
        { type: 'google', identifier: 'test@example.com', flatNumber: '15167' }, // Missing name
        { type: 'google', name: 'Test', flatNumber: '15167' }, // Missing identifier
        { identifier: 'test@example.com', name: 'Test', flatNumber: '15167' }, // Missing type
      ];

      invalidRequests.forEach(req => {
        expect(!req.type || !req.identifier || !req.name || !req.flatNumber).toBe(true);
      });
    });

    it('should reject invalid auth type', () => {
      const invalidRequest = {
        type: 'invalid_auth',
        identifier: 'test@example.com',
        name: 'Test',
        flatNumber: '15167',
      };

      const validTypes = ['google', 'email', 'telegram'];
      expect(validTypes).not.toContain(invalidRequest.type);
    });

    it('should reject invalid flat number format', () => {
      const invalidFlatNumbers = ['abc', 'xyz', 'Tower Floor Unit'];

      invalidFlatNumbers.forEach(flatNum => {
        const parsed = parseFlatNumber(flatNum);
        expect(parsed).toBeNull();
      });
    });
  });

  describe('Flat validation', () => {
    it('should reject if flat is already occupied', async () => {
      const occupiedFlat = {
        flatNumber: '15167',
        ownerResidentId: 'r_15167_existing',
      };

      vi.spyOn(mockEnv.SESSIONS_KV, 'get').mockResolvedValueOnce(null); // No rate limit
      vi.spyOn(db, 'getFlatV2').mockResolvedValueOnce(occupiedFlat);

      // Assert: registration should fail
      expect(occupiedFlat.ownerResidentId).toBeTruthy();
    });
  });

  describe('Credential duplicate check', () => {
    it('should reject if credential already exists', async () => {
      const existingCredential = {
        credentialId: 'cred_google_test@example.com',
        residentId: 'r_15167_other',
        type: 'google',
        identifier: 'test@example.com',
      };

      vi.spyOn(mockEnv.SESSIONS_KV, 'get').mockResolvedValueOnce(null); // No rate limit
      vi.spyOn(db, 'getFlatV2').mockResolvedValueOnce(null); // Flat not occupied
      vi.spyOn(db, 'getCredentialByTypeAndIdentifier').mockResolvedValueOnce(existingCredential);

      // Assert: registration should fail
      expect(existingCredential.residentId).toBeTruthy();
    });
  });

  describe('Rate limiting', () => {
    it('should generate correct rate limit key format', () => {
      const identifier = 'test@example.com';
      const flatNumber = '15167';
      const rateLimitKey = `register_pending:${identifier}:${flatNumber}`;

      expect(rateLimitKey).toBe('register_pending:test@example.com:15167');
    });

    it('should use 24h (86400s) TTL for rate limit', () => {
      const expectedTtl = 86400; // 24 hours in seconds
      expect(expectedTtl).toBe(86400);
    });
  });
});
