#!/usr/bin/env node
/**
 * scripts/export-firestore.js
 * 
 * Export all Firestore collections to JSON files for D1 migration.
 * This is a READ-ONLY script - no data is modified.
 * 
 * Usage:
 *   node scripts/export-firestore.js
 * 
 * Output:
 *   data/firestore-export/*.json (one file per collection)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Collections to export
const COLLECTIONS = [
  'residents',
  'credentials',
  'flats',
  'admins',
  'marketplace_listings',
  'lost_found',
  'carpooling',
  'recommendations',
  'announcements',
  'device_sessions',
  'invites',
  'invite_audit',
  'settings',
  'group_settings',
  'violations',
  'feedback',
  'jobs',
  'tenants',
  'identities',
  'linkedAccounts'
];

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  console.error('Set it with your Firebase service account JSON:');
  console.error('export FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

// Create export directory
const exportDir = path.join(__dirname, '../data/firestore-export');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// Convert Firestore Timestamp to ISO string
function timestampToISO(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value && value._seconds) {
    return new Date(value._seconds * 1000).toISOString();
  }
  return value;
}

// Recursively convert all timestamps in an object
function convertTimestamps(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertTimestamps(item));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = timestampToISO(value);
      if (converted[key] === value && typeof value === 'object') {
        converted[key] = convertTimestamps(value);
      }
    }
    return converted;
  }
  
  return obj;
}

// Export a single collection
async function exportCollection(collectionName) {
  try {
    console.log(`📦 Exporting ${collectionName}...`);
    
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log(`   ⚠️  Empty collection (0 records)`);
      return { collection: collectionName, count: 0, records: [] };
    }
    
    const records = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const converted = convertTimestamps(data);
      records.push({
        id: doc.id,
        ...converted
      });
    });
    
    const outputPath = path.join(exportDir, `${collectionName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
    
    console.log(`   ✅ Exported ${records.length} records to ${collectionName}.json`);
    
    return { collection: collectionName, count: records.length, records };
  } catch (error) {
    console.error(`   ❌ Error exporting ${collectionName}:`, error.message);
    return { collection: collectionName, count: 0, error: error.message };
  }
}

// Main export function
async function exportAll() {
  console.log('\n🚀 Starting Firestore Export\n');
  console.log(`Export directory: ${exportDir}\n`);
  
  const results = [];
  
  for (const collection of COLLECTIONS) {
    const result = await exportCollection(collection);
    results.push(result);
  }
  
  // Summary
  console.log('\n📊 Export Summary:\n');
  let totalRecords = 0;
  
  results.forEach(r => {
    totalRecords += r.count;
    const status = r.error ? '❌' : r.count === 0 ? '⚠️ ' : '✅';
    console.log(`${status} ${r.collection.padEnd(25)} ${r.count} records`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${totalRecords} records exported`);
  console.log('='.repeat(50) + '\n');
  
  // Save summary
  const summaryPath = path.join(exportDir, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalRecords,
    collections: results
  }, null, 2));
  
  console.log(`✅ Export complete! Files saved to: ${exportDir}\n`);
}

// Run export
exportAll().catch(error => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});
