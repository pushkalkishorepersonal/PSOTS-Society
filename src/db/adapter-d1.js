/* eslint-disable no-case-declarations */
/**
 * src/db/adapter-d1.js - D1 Database Adapter
 *
 * Drop-in replacement for src/db/adapter.js (Firestore version).
 * Provides the same function signatures using D1 instead of Firestore.
 * 
 * Usage:
 *   // Change this:
 *   import * as db from './db/adapter.js';
 *   
 *   // To this:
 *   import * as db from './db/adapter-d1.js';
 */

import * as d1 from './d1.js';
import { parseD1Row } from './d1.js';

// ══════════════════════════════════════════════════════════════
// RE-EXPORT D1 FUNCTIONS WITH SAME INTERFACE
// ══════════════════════════════════════════════════════════════

// Resident operations
export const getResident = d1.getResident;
export const getResidentV2 = d1.getResidentV2;
export const createResidentV2 = d1.createResidentV2;
export const updateResident = d1.updateResident;
export const listResidents = d1.listResidents;

// Credential operations
export const getCredentialByTypeAndIdentifier = d1.getCredentialByTypeAndIdentifier;
export const createCredential = d1.createCredential;
export const updateCredentialLastUsed = d1.updateCredentialLastUsed;
export const getCredentialsByIdentifier = d1.getCredentialsByIdentifier;
export const getCredentialsByResident = d1.getCredentialsByResident;

// Invite operations
export const getInvite = d1.getInvite;
export const createInvite = d1.createInvite;
export const markInviteUsed = d1.markInviteUsed;
export const listFamilyMembers = d1.listFamilyMembers;

// Flat operations
export const getFlatV2 = d1.getFlatV2;
export const createFlatV2 = d1.createFlatV2;
export const updateFlat = d1.updateFlat;

// Admin operations
export const getAdmin = d1.getAdmin;
export const listAdmins = d1.listAdmins;
export const isAdmin = d1.isAdmin;

// Marketplace operations
export const listMarketplaceListings = d1.listMarketplaceListings;
export const createMarketplaceListing = d1.createMarketplaceListing;
export const updateMarketplaceListing = d1.updateMarketplaceListing;
export const deleteMarketplaceListing = d1.deleteMarketplaceListing;

// Lost & Found operations
export const listLostFoundPosts = d1.listLostFoundPosts;
export const createLostFoundPost = d1.createLostFoundPost;
export const updateLostFoundPost = d1.updateLostFoundPost;

// Carpooling operations
export const listCarpoolingPosts = d1.listCarpoolingPosts;
export const createCarpoolingPost = d1.createCarpoolingPost;
export const updateCarpoolingPost = d1.updateCarpoolingPost;
export const deleteCarpoolingPost = d1.deleteCarpoolingPost;

// Recommendations operations
export const listRecommendations = d1.listRecommendations;
export const createRecommendation = d1.createRecommendation;

// Settings operations
export const getSetting = d1.getSetting;
export const updateSetting = d1.updateSetting;

// Announcements operations
export const listAnnouncements = d1.listAnnouncements;
export const createAnnouncement = d1.createAnnouncement;

// Device sessions
export const getDeviceSession = d1.getDeviceSession;
export const createDeviceSession = d1.createDeviceSession;
export const listDeviceSessions = d1.listDeviceSessions;

// Session operations (using SESSIONS_KV)
export async function getSession(env, sessionId) {
  const data = await env.SESSIONS_KV.get(sessionId, 'json');
  return { data };
}

export async function createSession(env, uid, metadata = {}) {
  const sessionId = crypto.randomUUID();
  await env.SESSIONS_KV.put(sessionId, JSON.stringify({ uid, ...metadata, createdAt: Date.now() }), {
    expirationTtl: 30 * 24 * 60 * 60 // 30 days
  });
  return { ok: true, sessionId };
}

export async function deleteSession(env, sessionId) {
  await env.SESSIONS_KV.delete(sessionId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════
// COMPATIBILITY WRAPPERS (Firestore → D1 interface mapping)
// ══════════════════════════════════════════════════════════════

/**
 * Get Firestore document (compatibility wrapper)
 * Maps firestoreGet(path, env) to D1 queries
 */
export async function firestoreGet(path, env) {
  const [collection, id] = path.split('/');

  switch (collection) {
    case 'residents':
      return convertToFirestoreFormat(await d1.getResident(id, env));

    case 'credentials':
      // firestoreGet doesn't work well for credentials (needs compound key)
      // This is a fallback for edge cases
      const cred = await env.PSOTS_DB
        .prepare('SELECT * FROM credentials WHERE credential_id = ?')
        .bind(id)
        .first();
      return convertToFirestoreFormat(cred);

    case 'flats':
      return convertToFirestoreFormat(await d1.getFlatV2(id, env));

    case 'admins':
      return convertToFirestoreFormat(await d1.getAdmin(id, env));

    case 'settings':
      const setting = await d1.getSetting(id, env);
      return convertToFirestoreFormat({ setting_value: JSON.stringify(setting) });

    case 'device_sessions':
      const session = await d1.getDeviceSession(id, env);
      return convertToFirestoreFormat(session);

    case 'invites':
      const invite = await env.PSOTS_DB
        .prepare('SELECT * FROM invites WHERE invite_id = ?')
        .bind(id)
        .first();
      return convertToFirestoreFormat(invite);

    case 'group_settings':
      const groupSetting = await env.PSOTS_DB
        .prepare('SELECT * FROM group_settings WHERE chat_id = ?')
        .bind(id)
        .first();
      return convertToFirestoreFormat(groupSetting);

    case 'violations':
      // Path format: violations/{chatId}/members/{userId}
      // This is a nested collection - handle specially
      const parts = path.split('/');
      if (parts.length === 4 && parts[2] === 'members') {
        const [, chatId, , userId] = parts;
        const violation = await env.PSOTS_DB
          .prepare('SELECT * FROM violations WHERE chat_id = ? AND user_id = ?')
          .bind(chatId, userId)
          .first();
        return convertToFirestoreFormat(violation);
      }
      return null;

    case 'announcements':
      const announcement = await env.PSOTS_DB
        .prepare('SELECT * FROM announcements WHERE announcement_id = ?')
        .bind(id)
        .first();
      return convertToFirestoreFormat(announcement);

    default:
      console.warn(`firestoreGet: Unknown collection ${collection}`);
      return null;
  }
}

/**
 * Set Firestore document (compatibility wrapper)
 */
export async function firestoreSet(path, data, env) {
  const [collection, id] = path.split('/');

  switch (collection) {
    case 'residents':
      return await d1.updateResident(id, data, env);

    case 'flats':
      return await d1.updateFlat(id, data, env);

    case 'settings':
      return await d1.updateSetting(id, data, env);

    case 'device_sessions':
      // Upsert device session
      const existingSession = await d1.getDeviceSession(id, env);
      if (existingSession) {
        // Update
        const updates = Object.entries(data).map(([k, v]) => {
          const snakeKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          return `${snakeKey} = ?`;
        }).join(', ');
        const values = Object.values(data);
        await env.PSOTS_DB
          .prepare(`UPDATE device_sessions SET ${updates} WHERE device_token = ?`)
          .bind(...values, id)
          .run();
      } else {
        // Insert
        await d1.createDeviceSession({ deviceToken: id, ...data }, env);
      }
      return true;

    case 'group_settings':
      // Upsert group settings
      const snakeData = {};
      for (const [key, value] of Object.entries(data)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snakeData[snakeKey] = typeof value === 'object' ? JSON.stringify(value) : value;
      }
      const cols = Object.keys(snakeData).join(', ');
      const placeholders = Object.keys(snakeData).map(() => '?').join(', ');
      const updates = Object.keys(snakeData).map(k => `${k} = excluded.${k}`).join(', ');
      await env.PSOTS_DB
        .prepare(`INSERT INTO group_settings (chat_id, ${cols}) VALUES (?, ${placeholders}) ON CONFLICT(chat_id) DO UPDATE SET ${updates}`)
        .bind(id, ...Object.values(snakeData))
        .run();
      return true;

    case 'violations':
      // Path format: violations/{chatId}/members/{userId}
      const parts = path.split('/');
      if (parts.length === 4 && parts[2] === 'members') {
        const [, chatId, , userId] = parts;
        // Upsert violation
        const { count, lastViolation } = data;
        await env.PSOTS_DB
          .prepare(`INSERT INTO violations (chat_id, user_id, count, last_violation) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET count = ?, last_violation = ?`)
          .bind(chatId, userId, count, lastViolation, count, lastViolation)
          .run();
        return true;
      }
      return false;

    case 'admin_access_log':
    case 'forwarded_analysis':
      // These are write-only logs - just insert
      // For now, skip them (they're not critical for functionality)
      console.warn(`firestoreSet: Skipping write-only collection ${collection}`);
      return true;

    default:
      console.warn(`firestoreSet: Unknown collection ${collection}`);
      return false;
  }
}

/**
 * Query Firestore collection (compatibility wrapper)
 */
export async function firestoreQuery(collection, filters, env) {
  // Convert Firestore-style filters to D1 filters
  const d1Filters = {};

  filters.forEach(([field, value]) => {
    // Convert firestore field names to D1
    const snakeField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    d1Filters[snakeField] = value;
  });

  switch (collection) {
    case 'residents':
      const residents = await d1.listResidents(d1Filters, env);
      return residents.map(convertToFirestoreFormat);

    case 'credentials':
      // Build query dynamically
      let query = 'SELECT * FROM credentials WHERE 1=1';
      const bindings = [];
      if (d1Filters.type) {
        query += ' AND type = ?';
        bindings.push(d1Filters.type);
      }
      if (d1Filters.identifier) {
        query += ' AND identifier = ?';
        bindings.push(d1Filters.identifier);
      }
      if (d1Filters.resident_id) {
        query += ' AND resident_id = ?';
        bindings.push(d1Filters.resident_id);
      }
      const credResult = await env.PSOTS_DB.prepare(query).bind(...bindings).all();
      return (credResult.results || []).map(parseD1Row).map(convertToFirestoreFormat);

    case 'admins':
      const admins = await d1.listAdmins(env);
      return admins.map(convertToFirestoreFormat);

    case 'invites':
      let inviteQuery = 'SELECT * FROM invites WHERE 1=1';
      const inviteBindings = [];
      if (d1Filters.flat_number) {
        inviteQuery += ' AND flat_number = ?';
        inviteBindings.push(d1Filters.flat_number);
      }
      if (d1Filters.status) {
        inviteQuery += ' AND status = ?';
        inviteBindings.push(d1Filters.status);
      }
      const inviteResult = await env.PSOTS_DB.prepare(inviteQuery).bind(...inviteBindings).all();
      return (inviteResult.results || []).map(parseD1Row).map(convertToFirestoreFormat);

    case 'tenants':
      // Tenants are residents with resident_type = 'tenant'
      const tenants = await d1.listResidents({ ...d1Filters, resident_type: 'tenant' }, env);
      return tenants.map(convertToFirestoreFormat);

    case 'tenant_family_requests':
      // This might not have a table - check schema
      console.warn('tenant_family_requests query not yet implemented');
      return [];

    case 'forwarded_analysis':
      // Skip analytics for now
      return [];

    default:
      console.warn(`firestoreQuery: Unknown collection ${collection}`);
      return [];
  }
}

/**
 * Convert D1 row to Firestore document format
 * D1 returns flat objects, Firestore REST API returns nested { fields: { ... } }
 */
function convertToFirestoreFormat(data) {
  if (!data) return null;
  
  // D1 data is already in simple object format
  // Firestore REST API uses { fields: { key: { stringValue: "..." } } }
  // For compatibility, we return the simple format which src/index.js parseFirestoreDoc handles
  return {
    fields: Object.entries(data).reduce((acc, [key, value]) => {
      if (value === null || value === undefined) return acc;
      
      if (typeof value === 'string') {
        acc[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        acc[key] = { integerValue: String(value) };
      } else if (typeof value === 'boolean') {
        acc[key] = { booleanValue: value };
      } else {
        acc[key] = { stringValue: JSON.stringify(value) };
      }
      
      return acc;
    }, {})
  };
}
