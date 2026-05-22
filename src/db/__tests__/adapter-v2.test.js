import { describe, it, expect, vi } from 'vitest';
import {
  createCredential,
  getCredentialById,
  getCredentialByTypeAndIdentifier,
  getCredentialsByIdentifier,
  getCredentialsByResidentId,
  createResidentV2,
  getResidentV2,
  updateResidentPrivacySettings,
  createFlatV2,
  getFlatV2,
  updateFlatHasTenants,
  updateFlatMaxFamilyMembers,
  createDeviceSession,
  getDeviceSession,
  revokeDeviceSession,
} from '../adapter.js';

// Mock firestore module
vi.mock('../firestore.js', () => ({
  firestoreGet: vi.fn(),
  firestoreSet: vi.fn(),
  firestoreQuery: vi.fn(),
}));

import * as firestore from '../firestore.js';

const mockEnv = { FIREBASE_SA_EMAIL: 'test@test.iam.gserviceaccount.com' };

describe('adapter-v2: Credentials', () => {
  it('createCredential returns credential on success', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    const cred = { credentialId: 'cred_123', type: 'google', identifier: 'test@gmail.com', residentId: 'r_123' };
    const result = await createCredential(cred, mockEnv);
    expect(result).toEqual(cred);
  });

  it('createCredential throws without credentialId', async () => {
    await expect(createCredential({}, mockEnv)).rejects.toThrow('credentialId required');
  });

  it('getCredentialById retrieves credential', async () => {
    const cred = { credentialId: 'cred_123', type: 'google' };
    firestore.firestoreGet.mockResolvedValue(cred);
    const result = await getCredentialById('cred_123', mockEnv);
    expect(result).toEqual(cred);
  });

  it('getCredentialById returns null if not found', async () => {
    firestore.firestoreGet.mockResolvedValue(null);
    const result = await getCredentialById('cred_notfound', mockEnv);
    expect(result).toBeNull();
  });
});

describe('adapter-v2: Residents', () => {
  it('createResidentV2 returns resident on success', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    const resident = { residentId: 'r_123', flatNumber: '15167', name: 'Pushkal' };
    const result = await createResidentV2(resident, mockEnv);
    expect(result).toEqual(resident);
  });

  it('createResidentV2 throws without residentId', async () => {
    await expect(createResidentV2({}, mockEnv)).rejects.toThrow('residentId required');
  });

  it('getResidentV2 retrieves resident', async () => {
    const resident = { residentId: 'r_123', flatNumber: '15167' };
    firestore.firestoreGet.mockResolvedValue(resident);
    const result = await getResidentV2('r_123', mockEnv);
    expect(result).toEqual(resident);
  });

  it('updateResidentPrivacySettings returns true on success', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    const privacy = { allowContact: false, showFlat: true };
    const result = await updateResidentPrivacySettings('r_123', privacy, mockEnv);
    expect(result).toBe(true);
  });
});

describe('adapter-v2: Flats', () => {
  it('createFlatV2 parses flat number and returns parsed components', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    const result = await createFlatV2('15167', 'r_123', mockEnv);
    expect(result).toEqual({ flatNumber: '15167', tower: 15, floor: 16, unit: 7 });
  });

  it('createFlatV2 throws for invalid flat number', async () => {
    await expect(createFlatV2('853', 'r_123', mockEnv)).rejects.toThrow('Invalid flat number');
  });

  it('getFlatV2 retrieves flat', async () => {
    const flat = { flatNumber: '15167', tower: 15, floor: 16, unit: 7 };
    firestore.firestoreGet.mockResolvedValue(flat);
    const result = await getFlatV2('15167', mockEnv);
    expect(result).toEqual(flat);
  });

  it('updateFlatHasTenants updates flag and returns true', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    const result = await updateFlatHasTenants('15167', true, mockEnv);
    expect(result).toBe(true);
  });

  it('updateFlatMaxFamilyMembers enforces 1-8 range', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    await updateFlatMaxFamilyMembers('15167', 4, mockEnv);
    expect(firestore.firestoreSet).toHaveBeenCalled();
  });

  it('updateFlatMaxFamilyMembers rejects invalid values', async () => {
    await expect(updateFlatMaxFamilyMembers('15167', 0, mockEnv)).rejects.toThrow('between 1 and 8');
    await expect(updateFlatMaxFamilyMembers('15167', 9, mockEnv)).rejects.toThrow('between 1 and 8');
    await expect(updateFlatMaxFamilyMembers('15167', 'abc', mockEnv)).rejects.toThrow('between 1 and 8');
  });
});

describe('adapter-v2: Device Sessions', () => {
  it('createDeviceSession returns session data on success', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    const session = { deviceToken: 'dev_xyz', residentId: 'r_123', deviceName: 'Chrome' };
    const result = await createDeviceSession(session, mockEnv);
    expect(result).toEqual(session);
  });

  it('getDeviceSession retrieves session', async () => {
    const session = { deviceToken: 'dev_xyz', residentId: 'r_123' };
    firestore.firestoreGet.mockResolvedValue(session);
    const result = await getDeviceSession('dev_xyz', mockEnv);
    expect(result).toEqual(session);
  });

  it('revokeDeviceSession returns true on success', async () => {
    firestore.firestoreSet.mockResolvedValue(true);
    const result = await revokeDeviceSession('dev_xyz', 'admin_456', mockEnv);
    expect(result).toBe(true);
  });

  it('getDeviceSession returns null if not found', async () => {
    firestore.firestoreGet.mockResolvedValue(null);
    const result = await getDeviceSession('dev_notfound', mockEnv);
    expect(result).toBeNull();
  });
});

describe('adapter-v2: Credential Queries', () => {
  it('getCredentialByTypeAndIdentifier finds exact match', async () => {
    const cred = { credentialId: 'cred_456', type: 'google', identifier: 'test@example.com', residentId: 'r_123' };
    firestore.firestoreQuery.mockResolvedValue([cred]);
    const result = await getCredentialByTypeAndIdentifier('google', 'test@example.com', mockEnv);
    expect(result).toEqual(cred);
  });

  it('getCredentialByTypeAndIdentifier returns null if not found', async () => {
    firestore.firestoreQuery.mockResolvedValue([]);
    const result = await getCredentialByTypeAndIdentifier('google', 'notfound@example.com', mockEnv);
    expect(result).toBeNull();
  });

  it('getCredentialByTypeAndIdentifier logs warning on multiple matches', async () => {
    const creds = [
      { credentialId: 'cred_1', type: 'email', identifier: 'test@example.com' },
      { credentialId: 'cred_2', type: 'email', identifier: 'test@example.com' },
    ];
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    firestore.firestoreQuery.mockResolvedValue(creds);
    const result = await getCredentialByTypeAndIdentifier('email', 'test@example.com', mockEnv);
    expect(result).toEqual(creds[0]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('getCredentialsByIdentifier returns all credentials for email', async () => {
    const creds = [
      { credentialId: 'cred_google', type: 'google', identifier: 'test@example.com' },
      { credentialId: 'cred_email', type: 'email', identifier: 'test@example.com' },
    ];
    firestore.firestoreQuery.mockResolvedValue(creds);
    const result = await getCredentialsByIdentifier('test@example.com', mockEnv);
    expect(result).toEqual(creds);
    expect(result.length).toBe(2);
  });

  it('getCredentialsByIdentifier returns empty array if none found', async () => {
    firestore.firestoreQuery.mockResolvedValue([]);
    const result = await getCredentialsByIdentifier('notfound@example.com', mockEnv);
    expect(result).toEqual([]);
  });

  it('getCredentialsByResidentId returns all credentials for resident', async () => {
    const creds = [
      { credentialId: 'cred_google', type: 'google', residentId: 'r_123' },
      { credentialId: 'cred_telegram', type: 'telegram', residentId: 'r_123' },
    ];
    firestore.firestoreQuery.mockResolvedValue(creds);
    const result = await getCredentialsByResidentId('r_123', mockEnv);
    expect(result).toEqual(creds);
  });

  it('getCredentialsByResidentId returns empty array for resident with no credentials', async () => {
    firestore.firestoreQuery.mockResolvedValue([]);
    const result = await getCredentialsByResidentId('r_notfound', mockEnv);
    expect(result).toEqual([]);
  });
});
