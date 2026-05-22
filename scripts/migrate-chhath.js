#!/usr/bin/env node
/**
 * Chhath Puja Migration Script
 * Migrates historical Chhath data from Apps Script database to unified Firestore
 *
 * Collections created:
 * - chhath_contributions: ownerUid, ownerName, ownerFlat, amount, date, status, createdAt
 * - chhath_volunteers:    residentUid, residentName, residentFlat, role, joinedAt, status
 * - chhath_subscriptions: ownerUid, ownerEmail, ownerName, subscriptionTier, renewalDate
 * - chhath_announcements: subject, body, sentAt, recipientCount, status
 * - chhath_logs:          action, type, timestamp, details, status
 *
 * Usage:
 *   node scripts/migrate-chhath.js [--dry-run] [--source=file.json]
 *
 * Output: { migrated: N, skipped: M, errors: K, details: [...] }
 */

import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const sourceArg = args.find(a => a.startsWith('--source='));
const sourceFile = sourceArg ? sourceArg.split('=')[1] : null;

const PROJECT_ID = 'psots-society-25899';

const stats = { migrated: 0, skipped: 0, errors: 0, details: [] };

function log(msg) {
  process.stdout.write(msg + '\n');
}

async function initializeFirebase() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return admin.firestore();
}

async function loadSourceData() {
  if (sourceFile && fs.existsSync(sourceFile)) {
    log(`Loading historical data from ${sourceFile}...`);
    return JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  }
  log('No source file provided. Using empty seed structure (dry-run or fresh setup).');
  return { contributions: [], volunteers: [], subscriptions: [], announcements: [] };
}

function validateContribution(record) {
  if (!record.ownerUid) return 'ownerUid required';
  if (!record.amount || Number(record.amount) <= 0) return 'amount must be positive';
  return null;
}

function validateVolunteer(record) {
  if (!record.residentUid) return 'residentUid required';
  if (!record.role) return 'role required';
  return null;
}

function validateSubscription(record) {
  if (!record.ownerUid) return 'ownerUid required';
  if (!record.ownerEmail) return 'ownerEmail required';
  return null;
}

function validateAnnouncement(record) {
  if (!record.subject) return 'subject required';
  if (!record.body) return 'body required';
  return null;
}

async function checkDuplicate(db, collection, docId) {
  const doc = await db.collection(collection).doc(docId).get();
  return doc.exists;
}

async function migrateContributions(db, contributions) {
  log(`\nMigrating ${contributions.length} contributions...`);
  for (const contrib of contributions) {
    const validationError = validateContribution(contrib);
    if (validationError) {
      stats.skipped++;
      stats.details.push({ collection: 'chhath_contributions', id: contrib.id || 'unknown', reason: validationError });
      log(`  SKIP: ${contrib.id || 'unknown'} — ${validationError}`);
      continue;
    }

    const docId = contrib.id || `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!isDryRun) {
      const isDuplicate = await checkDuplicate(db, 'chhath_contributions', docId);
      if (isDuplicate) {
        stats.skipped++;
        stats.details.push({ collection: 'chhath_contributions', id: docId, reason: 'duplicate' });
        log(`  SKIP: ${docId} — duplicate`);
        continue;
      }
    }

    const payload = {
      ownerUid: contrib.ownerUid,
      ownerName: contrib.ownerName || '',
      ownerFlat: contrib.ownerFlat || '',
      amount: Number(contrib.amount),
      date: contrib.date ? new Date(contrib.date).toISOString() : new Date().toISOString(),
      status: contrib.status || 'received',
      createdAt: contrib.createdAt ? new Date(contrib.createdAt).toISOString() : new Date().toISOString(),
    };

    try {
      if (!isDryRun) {
        await db.collection('chhath_contributions').doc(docId).set(payload);
      }
      stats.migrated++;
      log(`  OK: chhath_contributions/${docId}`);
    } catch (err) {
      stats.errors++;
      stats.details.push({ collection: 'chhath_contributions', id: docId, reason: err.message });
      log(`  ERROR: ${docId} — ${err.message}`);
    }
  }
}

async function migrateVolunteers(db, volunteers) {
  log(`\nMigrating ${volunteers.length} volunteers...`);
  for (const vol of volunteers) {
    const validationError = validateVolunteer(vol);
    if (validationError) {
      stats.skipped++;
      stats.details.push({ collection: 'chhath_volunteers', id: vol.id || 'unknown', reason: validationError });
      log(`  SKIP: ${vol.id || 'unknown'} — ${validationError}`);
      continue;
    }

    const docId = vol.id || `volunteer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!isDryRun) {
      const isDuplicate = await checkDuplicate(db, 'chhath_volunteers', docId);
      if (isDuplicate) {
        stats.skipped++;
        stats.details.push({ collection: 'chhath_volunteers', id: docId, reason: 'duplicate' });
        log(`  SKIP: ${docId} — duplicate`);
        continue;
      }
    }

    const payload = {
      residentUid: vol.residentUid,
      residentName: vol.residentName || '',
      residentFlat: vol.residentFlat || '',
      role: vol.role,
      joinedAt: vol.joinedAt ? new Date(vol.joinedAt).toISOString() : new Date().toISOString(),
      status: vol.status || 'active',
    };

    try {
      if (!isDryRun) {
        await db.collection('chhath_volunteers').doc(docId).set(payload);
      }
      stats.migrated++;
      log(`  OK: chhath_volunteers/${docId}`);
    } catch (err) {
      stats.errors++;
      stats.details.push({ collection: 'chhath_volunteers', id: docId, reason: err.message });
      log(`  ERROR: ${docId} — ${err.message}`);
    }
  }
}

async function migrateSubscriptions(db, subscriptions) {
  log(`\nMigrating ${subscriptions.length} subscriptions...`);
  for (const sub of subscriptions) {
    const validationError = validateSubscription(sub);
    if (validationError) {
      stats.skipped++;
      stats.details.push({ collection: 'chhath_subscriptions', id: sub.id || 'unknown', reason: validationError });
      log(`  SKIP: ${sub.id || 'unknown'} — ${validationError}`);
      continue;
    }

    const docId = sub.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!isDryRun) {
      const isDuplicate = await checkDuplicate(db, 'chhath_subscriptions', docId);
      if (isDuplicate) {
        stats.skipped++;
        stats.details.push({ collection: 'chhath_subscriptions', id: docId, reason: 'duplicate' });
        log(`  SKIP: ${docId} — duplicate`);
        continue;
      }
    }

    const payload = {
      ownerUid: sub.ownerUid,
      ownerEmail: sub.ownerEmail,
      ownerName: sub.ownerName || '',
      subscriptionTier: sub.subscriptionTier || 'basic',
      renewalDate: sub.renewalDate ? new Date(sub.renewalDate).toISOString() : null,
    };

    try {
      if (!isDryRun) {
        await db.collection('chhath_subscriptions').doc(docId).set(payload);
      }
      stats.migrated++;
      log(`  OK: chhath_subscriptions/${docId}`);
    } catch (err) {
      stats.errors++;
      stats.details.push({ collection: 'chhath_subscriptions', id: docId, reason: err.message });
      log(`  ERROR: ${docId} — ${err.message}`);
    }
  }
}

async function migrateAnnouncements(db, announcements) {
  log(`\nMigrating ${announcements.length} announcements...`);
  for (const ann of announcements) {
    const validationError = validateAnnouncement(ann);
    if (validationError) {
      stats.skipped++;
      stats.details.push({ collection: 'chhath_announcements', id: ann.id || 'unknown', reason: validationError });
      log(`  SKIP: ${ann.id || 'unknown'} — ${validationError}`);
      continue;
    }

    const docId = ann.id || `announce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!isDryRun) {
      const isDuplicate = await checkDuplicate(db, 'chhath_announcements', docId);
      if (isDuplicate) {
        stats.skipped++;
        stats.details.push({ collection: 'chhath_announcements', id: docId, reason: 'duplicate' });
        log(`  SKIP: ${docId} — duplicate`);
        continue;
      }
    }

    const payload = {
      subject: ann.subject,
      body: ann.body,
      sentAt: ann.sentAt ? new Date(ann.sentAt).toISOString() : new Date().toISOString(),
      recipientCount: ann.recipientCount || 0,
      status: ann.status || 'sent',
    };

    try {
      if (!isDryRun) {
        await db.collection('chhath_announcements').doc(docId).set(payload);
      }
      stats.migrated++;
      log(`  OK: chhath_announcements/${docId}`);
    } catch (err) {
      stats.errors++;
      stats.details.push({ collection: 'chhath_announcements', id: docId, reason: err.message });
      log(`  ERROR: ${docId} — ${err.message}`);
    }
  }
}

async function writeMigrationLog(db) {
  const logEntry = {
    action: 'migration_completed',
    type: 'data_migration',
    timestamp: new Date().toISOString(),
    status: isDryRun ? 'dry_run' : 'completed',
    details: {
      script: 'migrate-chhath.js',
      migrated: stats.migrated,
      skipped: stats.skipped,
      errors: stats.errors,
      dryRun: isDryRun,
    },
  };

  if (!isDryRun) {
    await db.collection('chhath_logs').add(logEntry);
  }
}

async function main() {
  log('Chhath Puja Migration Script');
  log(`Project: ${PROJECT_ID}`);
  log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be written)' : 'LIVE (writing to Firestore)'}\n`);

  const db = await initializeFirebase();
  const data = await loadSourceData();

  await migrateContributions(db, data.contributions || []);
  await migrateVolunteers(db, data.volunteers || []);
  await migrateSubscriptions(db, data.subscriptions || []);
  await migrateAnnouncements(db, data.announcements || []);
  await writeMigrationLog(db);

  log('\n--- Migration Report ---');
  log(`migrated: ${stats.migrated}`);
  log(`skipped:  ${stats.skipped}`);
  log(`errors:   ${stats.errors}`);

  if (stats.details.length > 0) {
    log('\nDetails:');
    for (const d of stats.details) {
      log(`  [${d.collection}] ${d.id}: ${d.reason}`);
    }
  }

  log(JSON.stringify({ migrated: stats.migrated, skipped: stats.skipped, errors: stats.errors, details: stats.details }));

  if (isDryRun) {
    log('\nDry run complete. Run without --dry-run to write changes to Firestore.');
  } else {
    log('\nMigration complete.');
  }

  if (stats.errors > 0) process.exit(1);
  process.exit(0);
}

main().catch(err => {
  process.stderr.write('Fatal error: ' + err.message + '\n');
  process.exit(1);
});
