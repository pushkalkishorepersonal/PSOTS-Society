/**
 * CLEANUP SCRIPT - Remove all test data before pilot launch
 * 
 * This script will:
 * 1. List all Firebase Auth users
 * 2. List all Firestore residents  
 * 3. List all credentials
 * 4. Show what will be deleted
 * 5. Ask for confirmation
 * 6. Delete everything
 * 
 * Run with: node scripts/cleanup-test-data.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./psots-v2-firebase-adminsdk.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'psots-v2'
});

const auth = admin.auth();
const db = admin.firestore();

async function listAllUsers() {
  const users = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

async function listAllResidents() {
  const snapshot = await db.collection('residents').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function listAllCredentials() {
  const snapshot = await db.collection('credentials').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function listAllIdentities() {
  const snapshot = await db.collection('identities').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  console.log('🔍 Scanning for test data...\n');

  // List all data
  const [users, residents, credentials, identities] = await Promise.all([
    listAllUsers(),
    listAllResidents(),
    listAllCredentials(),
    listAllIdentities()
  ]);

  console.log('📊 CURRENT DATA:');
  console.log(`  Firebase Auth Users: ${users.length}`);
  console.log(`  Firestore Residents: ${residents.length}`);
  console.log(`  Firestore Credentials: ${credentials.length}`);
  console.log(`  Firestore Identities: ${identities.length}`);
  console.log('');

  // Show details
  console.log('👥 FIREBASE AUTH USERS:');
  users.forEach(user => {
    console.log(`  - ${user.email || user.phoneNumber || user.uid} (created: ${new Date(user.metadata.creationTime).toLocaleDateString()})`);
  });
  console.log('');

  console.log('🏠 FIRESTORE RESIDENTS:');
  residents.forEach(res => {
    console.log(`  - ${res.name} (Flat ${res.flatNumber}) - Status: ${res.status}`);
  });
  console.log('');

  console.log('🔑 FIRESTORE CREDENTIALS:');
  credentials.forEach(cred => {
    console.log(`  - ${cred.identifier} → Resident: ${cred.residentId}`);
  });
  console.log('');

  console.log('🆔 FIRESTORE IDENTITIES:');
  identities.forEach(id => {
    console.log(`  - ${id.id} → Flat: ${id.flatNumber}, Member: ${id.memberId}`);
  });
  console.log('');

  console.log('⚠️  WARNING: This will DELETE ALL DATA above!');
  console.log('');
  console.log('To proceed, run with --confirm flag:');
  console.log('  node scripts/cleanup-test-data.js --confirm');
  console.log('');

  if (!process.argv.includes('--confirm')) {
    console.log('❌ Aborted (no --confirm flag)');
    process.exit(0);
  }

  console.log('🗑️  DELETING ALL DATA...\n');

  // Delete Firebase Auth users
  console.log('Deleting Firebase Auth users...');
  for (const user of users) {
    await auth.deleteUser(user.uid);
    console.log(`  ✅ Deleted user: ${user.email || user.phoneNumber || user.uid}`);
  }

  // Delete Firestore residents
  console.log('\nDeleting Firestore residents...');
  const batch1 = db.batch();
  residents.forEach(res => {
    batch1.delete(db.collection('residents').doc(res.id));
  });
  await batch1.commit();
  console.log(`  ✅ Deleted ${residents.length} residents`);

  // Delete Firestore credentials
  console.log('\nDeleting Firestore credentials...');
  const batch2 = db.batch();
  credentials.forEach(cred => {
    batch2.delete(db.collection('credentials').doc(cred.id));
  });
  await batch2.commit();
  console.log(`  ✅ Deleted ${credentials.length} credentials`);

  // Delete Firestore identities
  console.log('\nDeleting Firestore identities...');
  const batch3 = db.batch();
  identities.forEach(id => {
    batch3.delete(db.collection('identities').doc(id.id));
  });
  await batch3.commit();
  console.log(`  ✅ Deleted ${identities.length} identities`);

  console.log('\n✅ CLEANUP COMPLETE!\n');
  console.log('All test data has been removed. You can now start fresh! 🎉');
  
  process.exit(0);
}

main().catch(console.error);
