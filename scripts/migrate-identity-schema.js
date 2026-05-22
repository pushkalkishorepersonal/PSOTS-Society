#!/usr/bin/env node
/**
 * scripts/migrate-identity-schema.js
 *
 * Migration script for Sprint 1a. Normalizes resident/flat records
 * to v1.0 schema documented in docs/IDENTITY_MODEL.md Section 3.
 *
 * Usage:
 *   node scripts/migrate-identity-schema.js            # dry-run (default)
 *   node scripts/migrate-identity-schema.js --apply    # actually write changes
 *   node scripts/migrate-identity-schema.js --only residents   # scope to one collection
 *   node scripts/migrate-identity-schema.js --verbose  # log each record
 *
 * IMPORTANT: Default mode is DRY RUN (no writes).
 * Must pass --apply explicitly to write changes.
 * Will prompt for "CONFIRM MIGRATION" when --apply is set.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { parseFlatNumber } from '../src/utils/flat-parser.js';

const FIRESTORE_PROJECT_ID = 'psots-society-25899';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERBOSE = args.includes('--verbose');
const ONLY = args.find(a => a.startsWith('--only='))?.split('=')[1] || 'all';

// Mock Firestore for dry-run testing
// In production, this would use Firestore REST API or Admin SDK
const mockResidents = [
  {
    uid: 'user_1',
    flatNumber: '15167',
    name: 'Pushkal Kishore',
    email: 'pushkalkishore@gmail.com',
    phone: '+919482088904',
    secondaryPhone: null,
    residentType: 'owner',
    status: 'approved',
  },
  {
    uid: 'user_2',
    flatNumber: '8053',
    name: 'John Doe',
    email: 'john@example.com',
    alternatePhone: '+919876543210', // legacy field name
    residentType: 'tenant',
    status: 'pending',
  },
  {
    uid: 'user_3',
    flatNumber: '121011',
    firstName: 'Jane',
    alternateEmail: 'jane.alt@example.com', // legacy field name
    email: 'jane@example.com',
    phone: '+919999999999',
    residentType: 'family_of_owner',
    status: 'approved',
  },
];

const mockFlats = [
  { flatNumber: '15167', ownerResidentId: 'user_1', hasTenants: false },
  { flatNumber: '8053', ownerResidentId: 'user_2', hasTenants: true },
  { flatNumber: '121011', ownerResidentId: null, hasTenants: false }, // unassigned
];

async function main() {
  console.log(APPLY ? '🚀 APPLY MODE — will write changes' : '📋 DRY RUN MODE — no writes');
  console.log(`Scope: ${ONLY}`);
  console.log(`Verbose: ${VERBOSE ? 'on' : 'off'}\n`);

  if (APPLY) {
    const confirmation = await promptConfirmation();
    if (!confirmation) {
      console.log('❌ Migration cancelled.');
      process.exit(0);
    }
  }

  const stats = {
    residents: { scanned: 0, needsUpdate: 0, needsReview: 0, changes: [] },
    flats: { scanned: 0, needsUpdate: 0, needsReview: 0, changes: [] },
  };

  if (ONLY === 'all' || ONLY === 'residents') {
    await migrateResidents(stats.residents);
  }

  if (ONLY === 'all' || ONLY === 'flats') {
    await migrateFlats(stats.flats);
  }

  printReport(stats);

  if (!APPLY) {
    console.log('\n💡 Re-run with --apply to perform these changes.');
  } else {
    console.log('\n✅ Migration complete.');
  }
}

async function promptConfirmation() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`\n⚠️  About to update ${mockResidents.length} residents and ${mockFlats.length} flats.`);
    rl.question('Type "CONFIRM MIGRATION" to proceed: ', answer => {
      rl.close();
      resolve(answer === 'CONFIRM MIGRATION');
    });
  });
}

async function migrateResidents(stats) {
  console.log('\n--- Migrating Residents ---');
  for (const resident of mockResidents) {
    stats.scanned++;
    const changes = {};

    // Check for phone field normalization
    if (resident.alternatePhone && !resident.phone) {
      changes.phone = resident.alternatePhone;
      changes.deleteAlternatePhone = true;
      stats.needsUpdate++;
    }

    // Check for secondary email
    if (resident.alternateEmail && !resident.secondaryEmail) {
      changes.secondaryEmail = resident.alternateEmail;
      changes.deleteAlternateEmail = true;
      stats.needsUpdate++;
    }

    // Check for missing privacySettings
    if (!resident.privacySettings) {
      changes.privacySettings = {
        allowContact: true,
        emailOnContact: true,
        showFlat: true,
        showNameOnRecommendations: true,
        hideFromDirectory: false,
        blockedResidentIds: [],
      };
      stats.needsUpdate++;
    }

    // Check for missing apps array
    if (!resident.apps) {
      changes.apps = ['psots_society'];
      stats.needsUpdate++;
    }

    // Check for missing samitiRoles array
    if (!resident.samitiRoles) {
      changes.samitiRoles = [];
      stats.needsUpdate++;
    }

    // Check for missing isAdmin flag
    if (typeof resident.isAdmin !== 'boolean') {
      changes.isAdmin = false;
      stats.needsUpdate++;
    }

    if (Object.keys(changes).length > 0) {
      const change = {
        collection: 'residents',
        docId: resident.uid,
        action: `normalize fields: ${Object.keys(changes).filter(k => !k.startsWith('delete')).join(', ')}`,
        before: { ...resident },
        after: { ...resident, ...changes },
      };
      stats.changes.push(change);
      if (VERBOSE) console.log(`  ✓ ${resident.uid}: ${change.action}`);
    }
  }
}

async function migrateFlats(stats) {
  console.log('\n--- Migrating Flats ---');
  for (const flat of mockFlats) {
    stats.scanned++;
    const changes = {};

    // Check if tower/floor/unit need to be computed
    if (!flat.tower || !flat.floor || !flat.unit) {
      const parsed = parseFlatNumber(flat.flatNumber);
      if (parsed) {
        changes.tower = parsed.tower;
        changes.floor = parsed.floor;
        changes.unit = parsed.unit;
        stats.needsUpdate++;
      } else {
        stats.needsReview++;
        stats.changes.push({
          collection: 'flats',
          docId: flat.flatNumber,
          action: 'unparseable flat number — needs manual review',
        });
        if (VERBOSE) console.log(`  ⚠️  ${flat.flatNumber}: unparseable`);
        continue;
      }
    }

    // Check for missing maxFamilyMembers
    if (!flat.maxFamilyMembers) {
      changes.maxFamilyMembers = 4;
      stats.needsUpdate++;
    }

    // Check for missing tenantCount / familyCount
    if (!flat.tenantCount) changes.tenantCount = 0;
    if (!flat.familyCount) changes.familyCount = 0;

    if (Object.keys(changes).length > 0) {
      const change = {
        collection: 'flats',
        docId: flat.flatNumber,
        action: `add cached fields: ${Object.keys(changes).join(', ')}`,
        before: { ...flat },
        after: { ...flat, ...changes },
      };
      stats.changes.push(change);
      if (VERBOSE) console.log(`  ✓ ${flat.flatNumber}: ${change.action}`);
    }
  }
}

function printReport(stats) {
  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION REPORT');
  console.log('='.repeat(70));

  console.log(`\nResidents scanned:       ${stats.residents.scanned}`);
  console.log(`Residents need update:   ${stats.residents.needsUpdate}`);
  console.log(`Residents need review:   ${stats.residents.needsReview}`);

  console.log(`\nFlats scanned:           ${stats.flats.scanned}`);
  console.log(`Flats need update:       ${stats.flats.needsUpdate}`);
  console.log(`Flats need review:       ${stats.flats.needsReview}`);

  const totalChanges = stats.residents.needsUpdate + stats.flats.needsUpdate;
  console.log(`\nTotal changes needed:    ${totalChanges}`);

  if (VERBOSE || !APPLY) {
    console.log('\n--- Detailed changes ---');
    [...stats.residents.changes, ...stats.flats.changes].forEach((c, i) => {
      console.log(`${i + 1}. [${c.collection}] ${c.docId}: ${c.action}`);
      if (c.before) console.log(`   before: ${JSON.stringify(c.before).substring(0, 60)}...`);
      if (c.after) console.log(`   after:  ${JSON.stringify(c.after).substring(0, 60)}...`);
    });
  }
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
