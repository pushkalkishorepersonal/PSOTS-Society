import * as sessions from './sessions.js';
import { cacheGet, cacheSet, cacheDel } from './cache.js';
import { firestoreGet as _firestoreGet, firestoreSet as _firestoreSet, firestoreQuery as _firestoreQuery } from './firestore.js';
import { parseFlatNumber } from '../utils/flat-parser.js';

// Re-export firestore functions for backwards compatibility
export { firestoreGet, firestoreSet, firestoreQuery } from './firestore.js';

// ────────────────────────────────────────────────────────────────
// Sessions (KV-backed) — see src/db/sessions.js
// ────────────────────────────────────────────────────────────────

export const createSession = (env, uid, metadata) => sessions.createSession(env, uid, metadata);
export const getSession = (env, sessionId) => sessions.getSession(env, sessionId);
export const touchSession = (env, sessionId) => sessions.touchSession(env, sessionId);
export const deleteSession = (env, sessionId) => sessions.deleteSession(env, sessionId);

// ────────────────────────────────────────────────────────────────
// NEW (Sprint 1a) — Identity Refactor V2 Schema
// ────────────────────────────────────────────────────────────────
// These functions work with the new schema documented in
// docs/IDENTITY_MODEL.md Section 3. They coexist with legacy functions
// and do NOT replace them until Sprint 2+ migration.

/**
 * Create a new credential record.
 * Used when a resident logs in via a new method (Google, Email, Telegram).
 */
export async function createCredential(credentialData, env) {
  if (!credentialData?.credentialId) throw new Error('credentialId required');
  const path = `credentials/${credentialData.credentialId}`;
  const success = await _firestoreSet(path, {
    ...credentialData,
    createdAt: new Date().toISOString(),
  }, env);
  return success ? credentialData : null;
}

/**
 * Get a credential by ID.
 */
export async function getCredentialById(credentialId, env) {
  const path = `credentials/${credentialId}`;
  const data = await _firestoreGet(path, env);
  return data || null;
}

/**
 * Get a credential by (type, identifier).
 * Powers login Case A: direct credential match.
 */
export async function getCredentialByTypeAndIdentifier(type, identifier, env) {
  // Fetch all credentials and filter in memory (no Firestore index needed)
  const allCreds = await _firestoreQuery('credentials', [], env);
  if (!allCreds || allCreds.length === 0) return null;

  // Filter by both type and identifier
  const matches = allCreds.filter(c => c.type === type && c.identifier === identifier);

  if (matches.length > 1) {
    console.warn(`Multiple credentials for ${type}:${identifier} — data anomaly`);
  }

  return matches[0] || null;
}

/**
 * Get all credentials for a given identifier (email, phone).
 * Powers login Case B: cross-method linking via shared identifier.
 * Returns array of credentials matching the identifier across all methods.
 */
export async function getCredentialsByIdentifier(identifier, env) {
  const results = await _firestoreQuery('credentials', [
    ['identifier', identifier]
  ], env);
  return results || [];
}

/**
 * Get all credentials for a resident (by residentId).
 * Used for Profile → Account tab to show all linked credentials.
 */
export async function getCredentialsByResidentId(residentId, env) {
  const results = await _firestoreQuery('credentials', [
    ['residentId', residentId]
  ], env);
  return results || [];
}

/**
 * Update lastUsedAt timestamp when credential is used for login.
 */
export async function updateCredentialLastUsed(credentialId, env) {
  if (!credentialId) throw new Error('credentialId required');
  const path = `credentials/${credentialId}`;
  // Update only lastUsedAt field using updateMask (don't overwrite entire document)
  return await _firestoreSet(path, {
    lastUsedAt: new Date().toISOString(),
  }, env, ['lastUsedAt']);
}

/**
 * Delete a credential (revoke a login method).
 */
export async function deleteCredential(credentialId, env) {
  // NOTE: Sprint 1a does not support deletion via REST API.
  // Would require Firestore delete endpoint or custom Worker endpoint.
  // Placeholder for Sprint 1b.
  return false;
}

/**
 * Create a resident using new v2 schema.
 * Note: "V2" suffix to distinguish from legacy createResident.
 * Sprint 2 will start using these; legacy createResident stays until Sprint 4.
 */
export async function createResidentV2(residentData, env) {
  if (!residentData?.residentId) throw new Error('residentId required');
  const path = `residents/${residentData.residentId}`;
  const defaults = {
    isAdmin: false,
    apps: ['psots_society'],
    samitiRoles: [],
    privacySettings: {
      allowContact: true,
      emailOnContact: true,
      showFlat: true,
      showNameOnRecommendations: true,
      hideFromDirectory: false,
      blockedResidentIds: [],
    },
    createdAt: new Date().toISOString(),
  };
  const success = await _firestoreSet(path, { ...defaults, ...residentData }, env);
  return success ? residentData : null;
}

/**
 * Get a resident by residentId using v2 schema.
 */
export async function getResidentV2(residentId, env) {
  const path = `residents/${residentId}`;
  const data = await _firestoreGet(path, env);
  return data || null;
}

/**
 * Get a resident by looking up their credential.
 * Powers: given a (type, identifier), find the resident.
 * Case A/B lookup: find the credential first, then the resident.
 */
export async function getResidentByCredential(type, identifier, env) {
  // Case A: exact (type, identifier) match
  const credential = await getCredentialByTypeAndIdentifier(type, identifier, env);
  if (credential && credential.residentId) {
    return await getResidentV2(credential.residentId, env);
  }
  return null;
}

/**
 * Update resident's privacy settings.
 */
export async function updateResidentPrivacySettings(residentId, privacySettings, env) {
  if (!residentId) throw new Error('residentId required');
  const path = `residents/${residentId}`;
  return await _firestoreSet(path, {
    privacySettings: {
      allowContact: privacySettings.allowContact ?? true,
      emailOnContact: privacySettings.emailOnContact ?? true,
      showFlat: privacySettings.showFlat ?? true,
      showNameOnRecommendations: privacySettings.showNameOnRecommendations ?? true,
      hideFromDirectory: privacySettings.hideFromDirectory ?? false,
      blockedResidentIds: privacySettings.blockedResidentIds ?? [],
    },
  }, env);
}

/**
 * Link a new app to a resident's apps array.
 */
export async function linkAppToResident(residentId, appName, env) {
  if (!residentId || !appName) throw new Error('residentId and appName required');
  // NOTE: This requires array append, which Firestore REST API doesn't support directly.
  // Sprint 1a: Placeholder (read, modify in memory, write back).
  // Sprint 1b: Use proper array operations or custom Worker endpoint.
  return false;
}

/**
 * Create a flat using v2 schema with cached tower/floor/unit.
 * Computes tower/floor/unit via parseFlatNumber() on write.
 */
export async function createFlatV2(flatNumber, ownerResidentId, env) {
  if (!flatNumber) throw new Error('flatNumber required');
  const parsed = parseFlatNumber(flatNumber);
  if (!parsed) throw new Error(`Invalid flat number: ${flatNumber}`);

  const { tower, floor, unit } = parsed;
  const path = `flats/${flatNumber}`;
  const success = await _firestoreSet(path, {
    flatNumber,
    tower,
    floor,
    unit,
    ownerResidentId: ownerResidentId || null,
    hasTenants: false,
    maxFamilyMembers: 4,
    tenantCount: 0,
    familyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, env);
  return success ? { flatNumber, tower, floor, unit } : null;
}

/**
 * Get a flat using v2 schema.
 */
export async function getFlatV2(flatNumber, env) {
  if (!flatNumber) throw new Error('flatNumber required');
  const path = `flats/${flatNumber}`;
  const data = await _firestoreGet(path, env);
  return data || null;
}

/**
 * Update whether a flat has tenants.
 */
export async function updateFlatHasTenants(flatNumber, hasTenants, env) {
  if (!flatNumber) throw new Error('flatNumber required');
  const path = `flats/${flatNumber}`;
  return await _firestoreSet(path, {
    hasTenants: Boolean(hasTenants),
    updatedAt: new Date().toISOString(),
  }, env);
}

/**
 * Update maxFamilyMembers for a flat.
 * Enforces: 1 <= maxMembers <= 8 (default 4, ceiling per locked decision).
 */
export async function updateFlatMaxFamilyMembers(flatNumber, maxMembers, env) {
  if (!flatNumber) throw new Error('flatNumber required');
  const max = parseInt(maxMembers, 10);
  if (isNaN(max) || max < 1 || max > 8) {
    throw new Error('maxFamilyMembers must be between 1 and 8');
  }
  const path = `flats/${flatNumber}`;
  return await _firestoreSet(path, {
    maxFamilyMembers: max,
    updatedAt: new Date().toISOString(),
  }, env);
}

/**
 * Create a device session record.
 * Schema only for Sprint 1a; endpoints come in Sprint 1b.
 */
export async function createDeviceSession(sessionData, env) {
  if (!sessionData?.deviceToken) throw new Error('deviceToken required');
  const path = `device_sessions/${sessionData.deviceToken}`;
  const success = await _firestoreSet(path, {
    ...sessionData,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    revoked: false,
  }, env);
  return success ? sessionData : null;
}

/**
 * Get a device session by token.
 */
export async function getDeviceSession(deviceToken, env) {
  if (!deviceToken) throw new Error('deviceToken required');
  const path = `device_sessions/${deviceToken}`;
  const data = await _firestoreGet(path, env);
  return data || null;
}

/**
 * Get all device sessions for a resident.
 * Note: Requires query support (Sprint 1b).
 */
export async function getDeviceSessionsForResident(residentId, env) {
  // NOTE: Placeholder for Sprint 1b with query support.
  return [];
}

/**
 * Revoke a device session (set revoked=true).
 */
export async function revokeDeviceSession(deviceToken, revokedBy, env) {
  if (!deviceToken) throw new Error('deviceToken required');
  const path = `device_sessions/${deviceToken}`;
  return await _firestoreSet(path, {
    revoked: true,
    revokedAt: new Date().toISOString(),
    revokedBy: revokedBy || null,
  }, env);
}

/**
 * Revoke all device sessions for a resident.
 * Note: Requires query support (Sprint 1b).
 */
export async function revokeAllDeviceSessionsForResident(residentId, env) {
  // NOTE: Placeholder for Sprint 1b. Would query all sessions for residentId
  // and set revoked=true on each.
  return false;
}
