/**
 * src/security/device-trust.js — Device trust token management
 *
 * Manages long-lived device recognition tokens. When a user logs in on
 * a new device, we issue a deviceToken cookie (1-year TTL) that lets
 * them skip the login screen on subsequent visits.
 *
 * Three layers per IDENTITY_MODEL.md Section 7:
 * - Session (90 days sliding, KV)  ← handled by existing session code
 * - Device trust (1 year, Firestore) ← THIS MODULE
 * - Credential (forever, Firestore) ← base identity
 *
 * Endpoints that use this (Sprint 2):
 * - POST /auth/resume-device — validates deviceToken, creates fresh session
 * - POST /auth/logout — revokes current device
 * - POST /profile/devices/revoke — revokes specific device
 * - POST /profile/devices/revoke-all — revokes all devices for resident
 */

import {
  createDeviceSession as createDeviceSessionAdapter,
  getDeviceSession,
  revokeDeviceSession,
} from '../db/adapter.js';

/**
 * Generate a new device token (random 32-byte hex, URL-safe).
 * @returns {string}
 */
export function generateDeviceToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse user agent into friendly device name.
 * @param {string} userAgent
 * @returns {string} e.g. "Chrome on iPhone"
 */
export function parseDeviceName(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return 'Unknown device';

  const ua = userAgent.toLowerCase();
  let browser = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  // OS detection — check mobile first before desktop
  if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x') || ua.includes('macos')) os = 'MacBook';
  else if (ua.includes('linux')) os = 'Linux';

  if (browser === 'Unknown' && os === 'Unknown') return 'Unknown device';
  return `${browser} on ${os}`;
}

/**
 * Create device session in Firestore.
 * @param {object} params
 * @param {string} params.residentId
 * @param {string} params.userAgent - from request header
 * @param {string} params.ipAddress
 * @param {string} params.cityHint - from cf.city
 * @param {object} params.env
 * @returns {Promise<{deviceToken: string, expiresAt: string}>}
 */
export async function createDeviceSession({ residentId, userAgent, ipAddress, cityHint, env }) {
  const deviceToken = generateDeviceToken();
  const deviceName = parseDeviceName(userAgent);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const sessionData = {
    deviceToken,
    residentId,
    deviceName,
    ipAddress,
    cityHint: cityHint || 'Unknown',
    firstUsedAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    revoked: false,
  };

  await createDeviceSessionAdapter(sessionData, env);
  return { deviceToken, expiresAt: expiresAt.toISOString() };
}

/**
 * Validate a device token. Returns session if valid, null otherwise.
 * Checks: exists, not revoked, not expired.
 * @param {string} deviceToken
 * @param {object} env
 * @returns {Promise<{residentId: string, deviceName: string, ...} | null>}
 */
export async function validateDeviceToken(deviceToken, env) {
  const session = await getDeviceSession(deviceToken, env);
  if (!session) return null;

  // Check if revoked
  if (session.revoked) return null;

  // Check if expired
  const expiresAt = new Date(session.expiresAt);
  if (expiresAt < new Date()) return null;

  return session;
}

/**
 * Update lastUsedAt timestamp on device session (called when device resumes).
 * @param {string} deviceToken
 * @param {object} env
 * @returns {Promise<void>}
 */
export async function touchDeviceSession(deviceToken, env) {
  try {
    const session = await getDeviceSession(deviceToken, env);
    if (session && !session.revoked) {
      const updated = { ...session, lastUsedAt: new Date().toISOString() };
      // Update via adapter — would need an updateDeviceSession function
      // For now, this is a placeholder pending that Sprint 1a function
      // await updateDeviceSession(deviceToken, updated, env);
    }
  } catch (err) {
    console.error('touchDeviceSession error:', err);
  }
}

/**
 * Revoke a specific device token.
 * @param {string} deviceToken
 * @param {string} revokedBy - adminId or residentId
 * @param {object} env
 * @returns {Promise<void>}
 */
export async function revokeDevice(deviceToken, revokedBy, env) {
  await revokeDeviceSession(deviceToken, revokedBy, env);
}

/**
 * Revoke all device tokens for a resident.
 * @param {string} residentId
 * @param {string} revokedBy
 * @param {object} env
 * @returns {Promise<void>}
 */
export async function revokeAllDevices(residentId, revokedBy, env) {
  try {
    // This would require a firestoreQuery to find all devices for resident
    // and revoke each one. Placeholder for Sprint 1b implementation.
    // Actual implementation in Sprint 2 when credential query ops are added.
    console.log(`Revoking all devices for resident ${residentId} by ${revokedBy}`);
  } catch (err) {
    console.error('revokeAllDevices error:', err);
  }
}

/**
 * List all active device sessions for a resident (for Profile → Devices tab).
 * @param {string} residentId
 * @param {object} env
 * @returns {Promise<Array>}
 */
export async function listDevicesForResident(residentId, env) {
  // Placeholder for Sprint 1b implementation.
  // Actual implementation in Sprint 2 when credential query ops are added.
  return [];
}

/**
 * Build cookie header string for setting device token.
 * @param {string} deviceToken
 * @returns {string} - full Set-Cookie header value
 */
export function buildDeviceCookie(deviceToken) {
  return `psots_device=${deviceToken}; Domain=.psots.in; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000`;
}

/**
 * Build cookie header to clear device token.
 * @returns {string}
 */
export function buildDeviceClearCookie() {
  return 'psots_device=; Domain=.psots.in; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';
}
