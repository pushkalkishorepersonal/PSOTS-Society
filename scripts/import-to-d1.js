#!/usr/bin/env node
/**
 * scripts/import-to-d1.js
 * 
 * Import Firestore JSON exports to Cloudflare D1 database.
 * 
 * Prerequisites:
 *   1. Run scripts/export-firestore.js first
 *   2. Deploy schema: npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote
 * 
 * Usage:
 *   node scripts/import-to-d1.js [--dry-run] [--collection=residents]
 * 
 * Options:
 *   --dry-run        Show SQL without executing
 *   --collection=X   Import only specific collection
 *   --batch-size=N   Batch size for inserts (default: 100)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const USE_LOCAL = args.includes('--local');
const COLLECTION_FILTER = args.find(a => a.startsWith('--collection='))?.split('=')[1];
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '100');

const exportDir = path.join(__dirname, '../data/firestore-export');
const DB_NAME = 'psots-society-db';
const DB_FLAG = USE_LOCAL ? '--local' : '--remote';

console.log('\n🚀 Starting D1 Import\n');
if (DRY_RUN) console.log('🔍 DRY RUN MODE - No data will be written\n');

// Collection import mappings
const IMPORT_MAP = {
  residents: {
    table: 'residents',
    mapper: (r) => ({
      resident_id: r.residentId || r.id,
      flat_number: r.flatNumber,
      name: r.name,
      email: r.email || null,
      phone: r.phone || null,
      secondary_email: r.secondaryEmail || null,
      secondary_phone: r.secondaryPhone || null,
      telegram_username: r.telegramUsername || null,
      resident_type: r.residentType || 'owner',
      role: r.role || 'resident',
      status: r.status || 'pending',
      is_admin: r.isAdmin ? 1 : 0,
      linked_to_resident_id: r.linkedToResidentId || null,
      apps: JSON.stringify(r.apps || ['psots_society']),
      samiti_roles: JSON.stringify(r.samitiRoles || []),
      vendor_id: r.vendorId || null,
      privacy_settings: JSON.stringify(r.privacySettings || {}),
      lease_start_date: r.leaseStartDate || null,
      lease_end_date: r.leaseEndDate || null,
      rent_amount: r.rentAmount || null,
      created_at: r.createdAt,
      approved_at: r.approvedAt || null,
      approved_by: r.approvedBy || null,
      rejected_at: r.rejectedAt || null,
      rejected_by: r.rejectedBy || null,
      rejection_reason: r.rejectionReason || null,
      removed_at: r.removedAt || null,
      removed_by: r.removedBy || null,
      removal_reason: r.removalReason || null,
      invited_by_flat: r.invitedByFlat || null,
      document_verified: r.documentVerified ? 1 : 0,
      registration_method: r.registrationMethod || null,
      updated_at: r.updatedAt || r.createdAt,
      notes: r.notes || null
    })
  },
  
  credentials: {
    table: 'credentials',
    mapper: (c) => ({
      credential_id: c.credentialId || c.id,
      resident_id: c.residentId,
      type: c.type,
      identifier: c.identifier,
      firebase_uid: c.firebaseUid || null,
      verified_at: c.verifiedAt || null,
      last_used_at: c.lastUsedAt || null,
      created_at: c.createdAt
    })
  },
  
  flats: {
    table: 'flats',
    mapper: (f) => {
      const flatNumber = f.flatNumber || f.id;
      // Parse flat number (e.g., "17038" → tower=17, floor=03, unit=8)
      let tower = f.tower;
      let floor = f.floor;
      let unit = f.unit;

      if (!tower && flatNumber && flatNumber.length === 5) {
        tower = parseInt(flatNumber.substring(0, 2));
        floor = parseInt(flatNumber.substring(2, 4));
        unit = parseInt(flatNumber.substring(4, 5));
      }

      return {
        flat_number: flatNumber,
        tower: tower || 0,
        floor: floor || 0,
        unit: unit || 0,
        owner_resident_id: f.ownerResidentId || null,
        has_tenants: f.hasTenants ? 1 : 0,
        max_family_members: f.maxFamilyMembers || 4,
        tenant_count: f.tenantCount || 0,
        family_count: f.familyCount || 0,
        created_at: f.createdAt || new Date().toISOString(),
        updated_at: f.updatedAt || f.createdAt || new Date().toISOString()
      };
    }
  },
  
  admins: {
    table: 'admins',
    mapper: (a) => ({
      admin_id: a.id,
      resident_id: a.residentId || null,
      name: a.name,
      email: a.email,
      phone: a.phone || null,
      flat_number: a.flatNumber || null,
      is_superadmin: a.isSuperadmin ? 1 : 0,
      permissions: JSON.stringify(a.permissions || {}),
      telegram_groups: JSON.stringify(a.telegramGroups || []),
      added_by: a.addedBy || null,
      added_at: a.addedAt
    })
  },
  
  marketplace_listings: {
    table: 'marketplace_listings',
    mapper: (m) => ({
      listing_id: m.id,
      title: m.title,
      price: m.price || 0,
      description: m.description || null,
      category: m.category || null,
      seller_uid: m.sellerUid,
      seller_resident_id: m.sellerResidentId || null,
      seller_name: m.sellerName || null,
      seller_email: m.sellerEmail || null,
      seller_flat: m.sellerFlat || null,
      telegram_username: m.telegramUsername,
      status: m.status || 'active',
      report_count: m.reportCount || 0,
      reported_by: JSON.stringify(m.reportedBy || []),
      created_at: m.createdAt,
      expires_at: m.expiresAt || null
    })
  },

  lost_found: {
    table: 'lost_found',
    mapper: (l) => ({
      post_id: l.id,
      type: l.type,
      category: l.category,
      item_name: l.itemName,
      description: l.description || null,
      location: l.location,
      date: l.date,
      poster_uid: l.posterUid,
      poster_resident_id: l.posterResidentId || null,
      poster_flat: l.posterFlat || null,
      poster_telegram: l.posterTelegram || null,
      status: l.status || 'active',
      created_at: l.createdAt,
      expires_at: l.expiresAt || null
    })
  },

  carpooling: {
    table: 'carpooling',
    mapper: (c) => ({
      post_id: c.id,
      type: c.type,
      from_location: c.from,
      to_location: c.to,
      date: c.date,
      time: c.time,
      seats: c.seats || null,
      recurring: c.recurring || 'one-time',
      notes: c.notes || null,
      poster_uid: c.posterUid,
      poster_resident_id: c.posterResidentId || null,
      poster_flat: c.posterFlat || null,
      poster_telegram: c.posterTelegram || null,
      status: c.status || 'active',
      created_at: c.createdAt
    })
  },

  recommendations: {
    table: 'recommendations',
    mapper: (r) => ({
      recommendation_id: r.id,
      category: r.category,
      vendor_name: r.vendorName,
      vendor_phone: r.vendorPhone,
      description: r.description || null,
      created_by_uid: r.createdByUid,
      created_by_resident_id: r.createdByResidentId || null,
      creator_name: r.creatorName || null,
      creator_flat: r.creatorFlat || null,
      created_at: r.createdAt
    })
  },

  announcements: {
    table: 'announcements',
    mapper: (a) => ({
      announcement_id: a.id,
      title: a.title,
      content: a.content,
      type: a.type || 'general',
      posted_by: a.postedBy,
      posted_at: a.postedAt,
      expires_at: a.expiresAt || null,
      is_active: a.isActive !== false ? 1 : 0
    })
  },

  device_sessions: {
    table: 'device_sessions',
    mapper: (d) => ({
      device_token: d.id || d.deviceToken,
      resident_id: d.residentId || d.uid,
      device_name: d.deviceName || null,
      user_agent: d.userAgent || null,
      ip_address: d.ipAddress || null,
      city_hint: d.cityHint || null,
      fingerprint: d.fingerprint || null,
      created_at: d.createdAt,
      last_used_at: d.lastUsedAt || d.createdAt,
      expires_at: d.expiresAt || null,
      revoked: d.revoked ? 1 : 0,
      revoked_at: d.revokedAt || null,
      revoked_by: d.revokedBy || null
    })
  },

  invites: {
    table: 'invites',
    mapper: (i) => ({
      token: i.id || i.token,
      flat_number: i.flatNumber,
      created_by_uid: i.createdByUid,
      created_by_resident_id: i.createdByResidentId || null,
      type: i.type,
      status: i.status || 'pending',
      created_at: i.createdAt,
      expires_at: i.expiresAt || null,
      used_at: i.usedAt || null,
      used_by_uid: i.usedByUid || null
    })
  },

  feedback: {
    table: 'feedback',
    mapper: (f) => ({
      feedback_id: f.id,
      resident_id: f.residentId || null,
      category: f.category || null,
      message: f.message,
      status: f.status || 'pending',
      admin_response: f.adminResponse || null,
      created_at: f.createdAt,
      updated_at: f.updatedAt || f.createdAt
    })
  },

  jobs: {
    table: 'jobs',
    mapper: (j) => ({
      job_id: j.id,
      title: j.title,
      company: j.company || null,
      description: j.description || null,
      location: j.location || null,
      job_type: j.jobType || null,
      posted_by: j.postedBy,
      posted_at: j.postedAt || j.createdAt,
      expires_at: j.expiresAt || null,
      status: j.status || 'active'
    })
  }
};

// Execute SQL via wrangler
function executeSQL(sql, description, skipErrors = false) {
  if (DRY_RUN) {
    console.log(`\n[DRY RUN] ${description}:`);
    console.log(sql.substring(0, 200) + '...\n');
    return;
  }

  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --command="${sql.replace(/"/g, '\\"')}" ${DB_FLAG}`, {
      stdio: 'pipe'
    });
  } catch (error) {
    if (skipErrors) {
      console.log(`   ⚠️  Skipped due to constraint violation (expected for orphaned records)`);
      return;
    }
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

// Disable/Enable foreign keys
function toggleForeignKeys(enable) {
  const pragma = enable ? 'PRAGMA foreign_keys = ON' : 'PRAGMA foreign_keys = OFF';
  if (!DRY_RUN) {
    execSync(`npx wrangler d1 execute ${DB_NAME} --command="${pragma}" ${DB_FLAG}`, {
      stdio: 'pipe'
    });
  }
}

// Generate INSERT SQL
function generateInsertSQL(table, records) {
  if (records.length === 0) return null;
  
  const columns = Object.keys(records[0]);
  const placeholders = columns.map(() => '?').join(', ');
  
  let sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES\n`;
  
  const values = records.map(record => {
    const vals = columns.map(col => {
      const val = record[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return val;
    });
    return `(${vals.join(', ')})`;
  });
  
  sql += values.join(',\n');
  return sql;
}

// Import a collection
async function importCollection(collectionName) {
  const mapping = IMPORT_MAP[collectionName];
  if (!mapping) {
    console.log(`⚠️  Skipping ${collectionName} (no mapper defined)`);
    return { collection: collectionName, count: 0, skipped: true };
  }
  
  const filePath = path.join(exportDir, `${collectionName}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${collectionName} (file not found)`);
    return { collection: collectionName, count: 0, missing: true };
  }
  
  console.log(`📦 Importing ${collectionName}...`);
  
  const records = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const mapped = records.map(mapping.mapper);
  
  // Batch insert
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    const sql = generateInsertSQL(mapping.table, batch);
    executeSQL(sql, `Batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  }
  
  console.log(`   ✅ Imported ${mapped.length} records\n`);
  return { collection: collectionName, count: mapped.length };
}

// Main
(async () => {
  // Disable foreign keys for import (allows orphaned credentials)
  console.log('🔓 Disabling foreign key constraints for import...\n');
  toggleForeignKeys(false);

  const collectionsToImport = COLLECTION_FILTER
    ? [COLLECTION_FILTER]
    : Object.keys(IMPORT_MAP);

  const results = [];
  for (const collection of collectionsToImport) {
    const result = await importCollection(collection);
    results.push(result);
  }

  // Re-enable foreign keys after import
  console.log('\n🔒 Re-enabling foreign key constraints...');
  toggleForeignKeys(true);

  console.log('\n' + '='.repeat(50));
  console.log('Import Summary:');
  results.forEach(r => {
    const status = r.skipped ? '⚠️ ' : r.missing ? '❌' : '✅';
    console.log(`${status} ${r.collection.padEnd(25)} ${r.count} records`);
  });
  console.log('='.repeat(50) + '\n');
})();
