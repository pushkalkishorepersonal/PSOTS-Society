#!/usr/bin/env node
/**
 * scripts/cleanup-incomplete-data.js
 * 
 * Remove incomplete/invalid data from Firestore before D1 migration
 * 
 * Usage:
 *   node scripts/cleanup-incomplete-data.js [--dry-run]
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

console.log('\n🧹 Firestore Data Cleanup');
if (DRY_RUN) console.log('🔍 DRY RUN MODE - No data will be deleted\n');

// List of incomplete/invalid records to remove
const RECORDS_TO_DELETE = [
  {
    collection: 'residents',
    id: 'r_15166_1778265162584',
    reason: 'Missing required fields: name, flatNumber, residentType'
  },
  {
    collection: 'flats',
    id: '17038',
    reason: 'Missing required fields: flatNumber, tower, floor, unit'
  },
  {
    collection: 'flats',
    id: '15166',
    reason: 'Orphaned flat - owner resident r_15166_1778265162584 was deleted'
  },
  {
    collection: 'residents',
    id: 'r_17038_1777644925054',
    reason: 'Test data - removing to keep only production owner'
  },
  {
    collection: 'credentials',
    id: 'cred_email_test@test.com_1778265162584',
    reason: 'Orphaned credential - resident r_15166_1778265162584 deleted'
  },
  {
    collection: 'credentials',
    id: 'cred_google_abhimbajeet@gmail.com_1777644925317',
    reason: 'Orphaned credential - resident r_17038_1777644925054 deleted'
  },
  {
    collection: 'credentials',
    id: 'cred_google_pushkalk@tekion.com_1777525155891',
    reason: 'Orphaned credential - resident r_15176_1777525155891 does not exist'
  },
  {
    collection: 'credentials',
    id: 'cred_google_rahulsinha@gmail.com_1777529435529',
    reason: 'Orphaned credential - resident r_10021_1777529435529 does not exist'
  },
  {
    collection: 'credentials',
    id: 'cred_google_rakesh@gmail.com_1777528250365',
    reason: 'Orphaned credential - resident r_10011_1777528250365 does not exist'
  },
  {
    collection: 'admins',
    id: 'r_17038_1777644925054',
    reason: 'Orphaned admin - resident r_17038_1777644925054 was deleted'
  }
];

async function deleteRecord(collection, id, reason) {
  try {
    console.log(`\n📦 Collection: ${collection}`);
    console.log(`   ID: ${id}`);
    console.log(`   Reason: ${reason}`);
    
    if (DRY_RUN) {
      console.log('   ⚠️  DRY RUN: Would delete this record');
      return { success: true, dryRun: true };
    }
    
    // Get document to verify it exists
    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('   ⚠️  Document does not exist (already deleted?)');
      return { success: true, notFound: true };
    }
    
    // Show document data before deletion
    console.log('   📄 Document data:', JSON.stringify(doc.data(), null, 2));
    
    // Delete the document
    await docRef.delete();
    console.log('   ✅ Deleted successfully');
    
    return { success: true };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function cleanup() {
  console.log(`\n📋 Found ${RECORDS_TO_DELETE.length} record(s) to clean up\n`);
  
  const results = [];
  
  for (const record of RECORDS_TO_DELETE) {
    const result = await deleteRecord(
      record.collection,
      record.id,
      record.reason
    );
    results.push({ ...record, ...result });
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Cleanup Summary:');
  console.log('='.repeat(60));
  
  const deleted = results.filter(r => r.success && !r.dryRun && !r.notFound).length;
  const notFound = results.filter(r => r.notFound).length;
  const errors = results.filter(r => !r.success).length;
  
  if (DRY_RUN) {
    console.log(`🔍 DRY RUN: Would delete ${RECORDS_TO_DELETE.length} record(s)`);
  } else {
    console.log(`✅ Deleted: ${deleted}`);
    console.log(`⚠️  Not found: ${notFound}`);
    console.log(`❌ Errors: ${errors}`);
  }
  
  console.log('='.repeat(60));
  
  if (errors > 0) {
    console.log('\n❌ Cleanup completed with errors');
    process.exit(1);
  }
  
  if (DRY_RUN) {
    console.log('\n✅ Dry run complete. Run without --dry-run to actually delete.');
  } else {
    console.log('\n✅ Cleanup complete!');
    console.log('\nNext steps:');
    console.log('  1. Re-export Firestore data: node scripts/export-firestore.js');
    console.log('  2. Re-import to D1: node scripts/import-to-d1.js --local');
  }
}

// Run cleanup
cleanup().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
