/**
 * src/db/d1.js - Cloudflare D1 Database Adapter
 *
 * Replaces src/db/firestore.js with D1 SQL queries.
 * Provides the same function signatures for drop-in replacement.
 *
 * Usage:
 *   import * as db from './db/d1.js';
 *   const resident = await db.getResident(residentId, env);
 */

// ══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Parse D1 row to match Firestore document format
 * Converts snake_case to camelCase, parses JSON fields
 */
export function parseD1Row(row) {
  if (!row) return null;

  const parsed = {};

  for (const [key, value] of Object.entries(row)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // Parse JSON strings
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        parsed[camelKey] = JSON.parse(value);
      } catch {
        parsed[camelKey] = value;
      }
    } else {
      parsed[camelKey] = value;
    }
  }

  return parsed;
}

/**
 * Convert camelCase object to snake_case for SQL
 */
function toSnakeCase(obj) {
  const snake = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

    // Stringify objects/arrays for JSON columns
    if (typeof value === 'object' && value !== null) {
      snake[snakeKey] = JSON.stringify(value);
    } else {
      snake[snakeKey] = value;
    }
  }
  return snake;
}

// ══════════════════════════════════════════════════════════════
// RESIDENT OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Get resident by ID
 * @param {string} residentId - Resident ID (e.g., r_15167_abc123)
 * @param {object} env - Worker environment with PSOTS_DB binding
 * @returns {object|null} Resident record or null
 */
export async function getResident(residentId, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM residents WHERE resident_id = ?')
    .bind(residentId)
    .first();

  return parseD1Row(result);
}

/**
 * Get resident by V2 schema (alias for getResident)
 */
export async function getResidentV2(residentId, env) {
  return getResident(residentId, env);
}

/**
 * Create new resident record
 * @param {object} data - Resident data
 * @param {object} env - Worker environment
 * @returns {object|null} Created resident or null
 */
export async function createResidentV2(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO residents (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  if (!result.success) return null;

  return getResident(data.residentId, env);
}

/**
 * Update resident record
 * @param {string} residentId - Resident ID
 * @param {object} updates - Fields to update
 * @param {object} env - Worker environment
 * @returns {boolean} Success status
 */
export async function updateResident(residentId, updates, env) {
  const snake = toSnakeCase(updates);
  const setClauses = Object.keys(snake).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(snake), residentId];

  const result = await env.PSOTS_DB
    .prepare(`UPDATE residents SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE resident_id = ?`)
    .bind(...values)
    .run();

  return result.success;
}

/**
 * List residents with filters
 * @param {object} filters - Filter criteria
 * @param {object} env - Worker environment
 * @returns {array} Array of residents
 */
export async function listResidents(filters = {}, env) {
  let query = 'SELECT * FROM residents WHERE 1=1';
  const bindings = [];

  if (filters.status) {
    query += ' AND status = ?';
    bindings.push(filters.status);
  }

  // Accept both camelCase and snake_case for compatibility
  if (filters.flatNumber || filters.flat_number) {
    query += ' AND flat_number = ?';
    bindings.push(filters.flatNumber || filters.flat_number);
  }

  query += ' ORDER BY created_at DESC';
  if (filters.limit) {
    query += ' LIMIT ?';
    bindings.push(filters.limit);
  }

  const result = await env.PSOTS_DB
    .prepare(query)
    .bind(...bindings)
    .all();

  return result.results.map(parseD1Row);
}

// ══════════════════════════════════════════════════════════════
// FLAT OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Get flat by number
 */
export async function getFlatV2(flatNumber, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM flats WHERE flat_number = ?')
    .bind(flatNumber)
    .first();

  return parseD1Row(result);
}

/**
 * Create new flat record
 */
export async function createFlatV2(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO flats (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return result.success;
}

/**
 * Update flat record
 */
export async function updateFlat(flatNumber, updates, env) {
  const snake = toSnakeCase(updates);
  const setClauses = Object.keys(snake).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(snake), flatNumber];

  const result = await env.PSOTS_DB
    .prepare(`UPDATE flats SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE flat_number = ?`)
    .bind(...values)
    .run();

  return result.success;
}

// ══════════════════════════════════════════════════════════════
// ADMIN OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Get admin by ID
 */
export async function getAdmin(adminId, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM admins WHERE admin_id = ?')
    .bind(adminId)
    .first();

  return parseD1Row(result);
}

/**
 * List all admins
 */
export async function listAdmins(env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM admins ORDER BY added_at DESC')
    .all();

  return result.results.map(parseD1Row);
}

/**
 * Check if user is admin
 */
export async function isAdmin(uid, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT 1 FROM admins WHERE admin_id = ? LIMIT 1')
    .bind(uid)
    .first();

  return !!result;
}

// ══════════════════════════════════════════════════════════════
// MARKETPLACE OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * List marketplace listings
 */
export async function listMarketplaceListings(filters = {}, env) {
  let query = 'SELECT * FROM marketplace_listings WHERE status = ?';
  const bindings = [filters.status || 'active'];

  if (filters.category) {
    query += ' AND category = ?';
    bindings.push(filters.category);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(filters.limit || 100);

  const result = await env.PSOTS_DB
    .prepare(query)
    .bind(...bindings)
    .all();

  return result.results.map(parseD1Row);
}

/**
 * Create marketplace listing
 */
export async function createMarketplaceListing(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO marketplace_listings (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return result.success;
}

/**
 * Update marketplace listing
 */
export async function updateMarketplaceListing(listingId, updates, env) {
  const snake = toSnakeCase(updates);
  const setClauses = Object.keys(snake).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(snake), listingId];

  const result = await env.PSOTS_DB
    .prepare(`UPDATE marketplace_listings SET ${setClauses} WHERE listing_id = ?`)
    .bind(...values)
    .run();

  return result.success;
}

/**
 * Delete marketplace listing
 */
export async function deleteMarketplaceListing(listingId, env) {
  const result = await env.PSOTS_DB
    .prepare('DELETE FROM marketplace_listings WHERE listing_id = ?')
    .bind(listingId)
    .run();

  return result.success;
}

// ══════════════════════════════════════════════════════════════
// LOST & FOUND OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * List lost & found posts
 */
export async function listLostFoundPosts(filters = {}, env) {
  let query = 'SELECT * FROM lost_found WHERE status = ?';
  const bindings = [filters.status || 'active'];

  if (filters.type) {
    query += ' AND type = ?';
    bindings.push(filters.type);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(filters.limit || 100);

  const result = await env.PSOTS_DB
    .prepare(query)
    .bind(...bindings)
    .all();

  return result.results.map(parseD1Row);
}

/**
 * Create lost & found post
 */
export async function createLostFoundPost(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO lost_found (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return result.success;
}

export async function updateLostFoundPost(postId, updates, env) {
  const snake = toSnakeCase(updates);
  const setClauses = Object.keys(snake).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(snake), postId];

  const result = await env.PSOTS_DB
    .prepare(`UPDATE lost_found SET ${setClauses} WHERE id = ?`)
    .bind(...values)
    .run();

  return { success: result.success };
}

// ══════════════════════════════════════════════════════════════
// CARPOOLING OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * List carpooling posts
 */
export async function listCarpoolingPosts(filters = {}, env) {
  let query = 'SELECT * FROM carpooling WHERE status IN (?, ?)';
  const bindings = ['active', 'full'];

  if (filters.type) {
    query += ' AND type = ?';
    bindings.push(filters.type);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(filters.limit || 100);

  const result = await env.PSOTS_DB
    .prepare(query)
    .bind(...bindings)
    .all();

  return result.results.map(parseD1Row);
}

export async function createCarpoolingPost(data, env) {
  const snake = toSnakeCase(data);
  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO carpooling (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return { id: result.meta.last_row_id };
}

export async function updateCarpoolingPost(postId, updates, env) {
  const snake = toSnakeCase(updates);
  const setClauses = Object.keys(snake).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(snake), postId];

  const result = await env.PSOTS_DB
    .prepare(`UPDATE carpooling SET ${setClauses} WHERE id = ?`)
    .bind(...values)
    .run();

  return { success: result.success };
}

export async function deleteCarpoolingPost(postId, env) {
  const result = await env.PSOTS_DB
    .prepare('DELETE FROM carpooling WHERE id = ?')
    .bind(postId)
    .run();

  return { success: result.success };
}

// ══════════════════════════════════════════════════════════════
// RECOMMENDATIONS OPERATIONS
// ══════════════════════════════════════════════════════════════

export async function listRecommendations(filters = {}, env) {
  let query = 'SELECT * FROM recommendations';
  const bindings = [];

  if (filters.category) {
    query += ' WHERE category = ?';
    bindings.push(filters.category);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(filters.limit || 1000);

  const { results } = await env.PSOTS_DB
    .prepare(query)
    .bind(...bindings)
    .all();

  return results.map(parseD1Row);
}

export async function createRecommendation(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO recommendations (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return result.success;
}

// ══════════════════════════════════════════════════════════════
// SETTINGS OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Get setting by key
 */
export async function getSetting(key, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT setting_value FROM settings WHERE setting_key = ?')
    .bind(key)
    .first();

  if (!result) return null;

  try {
    return JSON.parse(result.setting_value);
  } catch {
    return result.setting_value;
  }
}

/**
 * Update setting
 */
export async function updateSetting(key, value, env) {
  const jsonValue = typeof value === 'object' ? JSON.stringify(value) : value;

  const result = await env.PSOTS_DB
    .prepare('INSERT OR REPLACE INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
    .bind(key, jsonValue)
    .run();

  return result.success;
}

// ══════════════════════════════════════════════════════════════
// ANNOUNCEMENTS OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * List active announcements
 */
export async function listAnnouncements(env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM announcements WHERE is_active = 1 ORDER BY posted_at DESC LIMIT 50')
    .all();

  return result.results.map(parseD1Row);
}

/**
 * Create announcement
 */
export async function createAnnouncement(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO announcements (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return result.success;
}

// ══════════════════════════════════════════════════════════════
// DEVICE SESSIONS OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Get device session by token
 */
export async function getDeviceSession(deviceToken, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM device_sessions WHERE device_token = ? AND revoked = 0')
    .bind(deviceToken)
    .first();

  return parseD1Row(result);
}

/**
 * Create device session
 */
export async function createDeviceSession(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO device_sessions (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return result.success;
}

/**
 * List device sessions for resident
 */
export async function listDeviceSessions(residentId, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM device_sessions WHERE resident_id = ? ORDER BY last_used_at DESC')
    .bind(residentId)
    .all();

  return result.results.map(parseD1Row);
}

// ══════════════════════════════════════════════════════════════
// QUERY HELPERS (for migration compatibility)
// ══════════════════════════════════════════════════════════════

/**
 * Query residents by flat number (Firestore compatibility)
 */
export async function queryResidentsByFlat(flatNumber, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM residents WHERE flat_number = ?')
    .bind(flatNumber)
    .all();

  return result.results.map(parseD1Row);
}

// ══════════════════════════════════════════════════════════════
// CREDENTIAL OPERATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Get credential by type and identifier (for login)
 * @param {string} type - Credential type (google, email, telegram)
 * @param {string} identifier - Email or phone
 * @param {object} env - Worker environment
 * @returns {object|null} Credential record or null
 */
export async function getCredentialByTypeAndIdentifier(type, identifier, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM credentials WHERE type = ? AND identifier = ?')
    .bind(type, identifier)
    .first();

  return parseD1Row(result);
}

/**
 * Create new credential
 */
export async function createCredential(data, env) {
  const snake = toSnakeCase(data);

  const columns = Object.keys(snake).join(', ');
  const placeholders = Object.keys(snake).map(() => '?').join(', ');
  const values = Object.values(snake);

  const result = await env.PSOTS_DB
    .prepare(`INSERT INTO credentials (${columns}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return result.success;
}

/**
 * Get all credentials by identifier (for cross-method linking)
 */
export async function getCredentialsByIdentifier(identifier, env) {
  const result = await env.PSOTS_DB
    .prepare('SELECT * FROM credentials WHERE identifier = ?')
    .bind(identifier)
    .all();

  return result.results.map(parseD1Row);
}

/**
 * Update credential last_used_at timestamp
 */
export async function updateCredentialLastUsed(credentialId, env) {
  const result = await env.PSOTS_DB
    .prepare('UPDATE credentials SET last_used_at = CURRENT_TIMESTAMP WHERE credential_id = ?')
    .bind(credentialId)
    .run();

  return result.success;
}
