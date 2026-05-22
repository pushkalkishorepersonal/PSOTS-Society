#!/usr/bin/env node
/**
 * Cleanup test account from Firestore
 * Usage: node scripts/cleanup-test-account.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://psots-society-25899.firebaseio.com'
});

const db = admin.firestore();

async function cleanup() {
  console.log('🧹 Cleaning up test account data...\n');

  const flatNumber = '15167';
  const email = 'pushkalkishore@gmail.com';

  try {
    // 1. Delete flat record
    console.log(`1. Deleting flat/${flatNumber}...`);
    await db.doc(`flats/${flatNumber}`).delete();
    console.log('   ✅ Deleted\n');

    // 2. Find and delete all residents for this flat
    console.log(`2. Finding residents for flat ${flatNumber}...`);
    const residentsSnapshot = await db.collection('residents')
      .where('flatNumber', '==', flatNumber)
      .get();
    
    console.log(`   Found ${residentsSnapshot.size} resident(s)`);
    for (const doc of residentsSnapshot.docs) {
      console.log(`   Deleting resident: ${doc.id}`);
      await doc.ref.delete();
    }
    console.log('   ✅ Deleted all residents\n');

    // 3. Find and delete credentials for this email
    console.log(`3. Finding credentials for ${email}...`);
    const credsSnapshot = await db.collection('credentials')
      .where('identifier', '==', email)
      .get();
    
    console.log(`   Found ${credsSnapshot.size} credential(s)`);
    for (const doc of credsSnapshot.docs) {
      console.log(`   Deleting credential: ${doc.id}`);
      await doc.ref.delete();
    }
    console.log('   ✅ Deleted all credentials\n');

    // 4. Check for any old residents with Firebase UID as doc ID
    console.log(`4. Checking for old schema residents...`);
    const allResidents = await db.collection('residents').get();
    let oldCount = 0;
    for (const doc of allResidents.docs) {
      const data = doc.data();
      // If doc ID looks like Firebase UID (not r_flatNumber_timestamp)
      if (!doc.id.startsWith('r_') && (data.email === email || data.flatNumber === flatNumber)) {
        console.log(`   Deleting old resident: ${doc.id}`);
        await doc.ref.delete();
        oldCount++;
      }
    }
    console.log(`   ✅ Deleted ${oldCount} old schema resident(s)\n`);

    console.log('✅ Cleanup complete! You can now register fresh.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanup();
