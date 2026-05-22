#!/usr/bin/env node
/**
 * scripts/fix-flat-17038.js
 * 
 * Add missing flatNumber field to flat 17038
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

async function fixFlat() {
  console.log('\n🔧 Fixing flat 17038...\n');
  
  const flatRef = db.collection('flats').doc('17038');
  const flat = await flatRef.get();
  
  if (!flat.exists) {
    console.log('❌ Flat 17038 does not exist');
    return;
  }
  
  console.log('📄 Current data:', JSON.stringify(flat.data(), null, 2));
  
  // Parse tower, floor, unit from flat number
  const flatNumber = '17038';
  const tower = parseInt(flatNumber.substring(0, 2));  // 17
  const floor = parseInt(flatNumber.substring(2, 4));  // 03
  const unit = parseInt(flatNumber.substring(4, 5));   // 8
  
  console.log(`\n✨ Adding parsed fields:`);
  console.log(`   flatNumber: ${flatNumber}`);
  console.log(`   tower: ${tower}`);
  console.log(`   floor: ${floor}`);
  console.log(`   unit: ${unit}\n`);
  
  await flatRef.update({
    flatNumber: flatNumber,
    tower: tower,
    floor: floor,
    unit: unit
  });
  
  console.log('✅ Flat 17038 fixed!\n');
}

fixFlat().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
