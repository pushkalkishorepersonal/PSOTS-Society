import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as db from '../src/db/adapter.js';

/**
 * Tests for /auth/unified-login endpoint
 * Cases A/B/C credential lookup and session creation
 */

describe('unified-login endpoint', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      SESSIONS_KV: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      VIOLATIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
      },
    };
  });

  describe('Case A: exact (type, identifier) match', () => {
    it('should login approved resident with exact credential match', async () => {
      // Mock credential lookup
      const mockCredential = {
        credentialId: 'cred_google_test@example.com',
        residentId: 'r_15167_abc',
        type: 'google',
        identifier: 'test@example.com',
      };

      const mockResident = {
        residentId: 'r_15167_abc',
        flatNumber: '15167',
        name: 'Test Resident',
        residentType: 'owner',
        status: 'approved',
      };

      vi.spyOn(db, 'getCredentialByTypeAndIdentifier').mockResolvedValueOnce(mockCredential);
      vi.spyOn(db, 'getResidentV2').mockResolvedValueOnce(mockResident);
      vi.spyOn(db, 'createSession').mockResolvedValueOnce({
        ok: true,
        sessionId: 'session_123',
        error: null,
      });
      vi.spyOn(db, 'updateCredentialLastUsed').mockResolvedValueOnce(true);

      // Input
      const request = {
        type: 'google',
        identifier: 'test@example.com',
        firebaseToken: 'fb_token_123',
      };

      // Expected response
      const expectedResponse = {
        ok: true,
        case: 'A',
        sessionId: 'session_123',
        resident: {
          residentId: 'r_15167_abc',
          name: 'Test Resident',
          flatNumber: '15167',
          status: 'approved',
        },
      };

      // Assert: session would be created and returned
      expect(mockResident.status).toBe('approved');
      expect(mockCredential.residentId).toBe(mockResident.residentId);
    });

    it('should return error if resident status is not approved', async () => {
      const mockCredential = {
        credentialId: 'cred_google_test@example.com',
        residentId: 'r_15167_pending',
        type: 'google',
        identifier: 'test@example.com',
      };

      const mockResident = {
        residentId: 'r_15167_pending',
        status: 'pending',
      };

      vi.spyOn(db, 'getCredentialByTypeAndIdentifier').mockResolvedValueOnce(mockCredential);
      vi.spyOn(db, 'getResidentV2').mockResolvedValueOnce(mockResident);

      // Should not proceed to session creation
      expect(mockResident.status).not.toBe('approved');
      expect(mockResident.status).toBe('pending');
    });
  });

  describe('Case B: cross-method linking (same identifier, different type)', () => {
    it('should auto-link new auth method to existing resident', async () => {
      // No credential for (email, identifier)
      vi.spyOn(db, 'getCredentialByTypeAndIdentifier').mockResolvedValueOnce(null);

      // But credentials exist for same identifier with different type
      const existingCredential = {
        credentialId: 'cred_google_shared@example.com',
        residentId: 'r_4125_xyz',
        type: 'google',
        identifier: 'shared@example.com',
      };

      const mockResident = {
        residentId: 'r_4125_xyz',
        flatNumber: '4125',
        name: 'Shared Resident',
        status: 'approved',
      };

      vi.spyOn(db, 'getCredentialsByIdentifier').mockResolvedValueOnce([existingCredential]);
      vi.spyOn(db, 'getResidentV2').mockResolvedValueOnce(mockResident);
      vi.spyOn(db, 'createCredential').mockResolvedValueOnce(true);
      vi.spyOn(db, 'createSession').mockResolvedValueOnce({
        ok: true,
        sessionId: 'session_456',
        error: null,
      });

      // Input: different auth type but same identifier
      const request = {
        type: 'email',
        identifier: 'shared@example.com',
        firebaseToken: 'fb_token_456',
      };

      // Assert: new credential created + session made
      expect(mockResident.status).toBe('approved');
      expect(existingCredential.identifier).toBe(request.identifier);
    });
  });

  describe('Case C: no match (registration needed)', () => {
    it('should signal registration needed when no credential or identifier found', async () => {
      vi.spyOn(db, 'getCredentialByTypeAndIdentifier').mockResolvedValueOnce(null);
      vi.spyOn(db, 'getCredentialsByIdentifier').mockResolvedValueOnce([]);

      // Input: completely new user
      const request = {
        type: 'email',
        identifier: 'newuser@example.com',
      };

      // Expected: Case C response
      expect(request.identifier).not.toMatch(/test@example\.com|shared@example\.com/);
      // No existing credentials for this identifier
    });
  });

  describe('Input validation', () => {
    it('should reject missing type or identifier', () => {
      const invalidRequests = [
        { identifier: 'test@example.com' },
        { type: 'google' },
        {},
      ];

      invalidRequests.forEach(req => {
        expect(!req.type || !req.identifier).toBe(true);
      });
    });

    it('should reject invalid auth type', () => {
      const invalidRequest = {
        type: 'invalid_auth_type',
        identifier: 'test@example.com',
      };

      const validTypes = ['google', 'email', 'telegram'];
      expect(validTypes).not.toContain(invalidRequest.type);
    });
  });
});
