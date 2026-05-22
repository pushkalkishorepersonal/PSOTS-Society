import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../serviceAccount.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'psots-society-25899',
});

const db = admin.firestore();
const contacts = [
  { name: 'Jitendra', category: 'services', subcategory: 'Carpenter', phone: '9739541473', description: 'Experienced carpenter, on-call. Trusted by many PSOTS residents.', rating: 5, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Letricia', category: 'services', subcategory: 'Tailor & Alterations', phone: '9986090300', description: 'Saree alterations and stitching. Available at Flat 16011.', rating: 5, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Pramod', category: 'services', subcategory: 'Agent - DL & Aadhaar', phone: '9916439007', description: 'DL renewal, Aadhaar update, RC transfer. Based at Begur junction.', rating: 5, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Shameem', category: 'services', subcategory: 'Maid', phone: '', description: 'Available 8am-12pm. Speaks Hindi and Kannada. Reliable and regular.', rating: 5, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Radha', category: 'services', subcategory: 'Maid', phone: '', description: 'Available 10:30am and 1:30pm slots. Multilingual. Good with families.', rating: 5, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Anju', category: 'services', subcategory: 'Maid', phone: '', description: 'Morning shift available. Experienced with apartments.', rating: 4, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Nubina', category: 'services', subcategory: 'Maid', phone: '', description: 'Available for morning slots. Speaks Hindi.', rating: 4, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Momina', category: 'services', subcategory: 'Maid', phone: '', description: 'Flexible timing. Good references from PSOTS residents.', rating: 4, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Noorina', category: 'services', subcategory: 'Maid', phone: '', description: 'Available weekday mornings. Reliable and experienced.', rating: 4, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Arzina', category: 'services', subcategory: 'Maid', phone: '', description: 'Available for cooking and cleaning. Flexible hours.', rating: 4, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Babysitter Contact 1', category: 'services', subcategory: 'Nanny & Babysitter', phone: '', description: 'Experienced with young children. Available on request.', rating: 4, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() },
  { name: 'Babysitter Contact 2', category: 'services', subcategory: 'Nanny & Babysitter', phone: '', description: 'Daytime babysitting available. Good with toddlers.', rating: 4, recommendedBy: '15167', status: 'approved', createdAt: new Date().toISOString() }
];

(async () => {
  try {
    console.log(`Deleting old incorrect entries...`);
    const snap = await db.collection('recommendations').get();
    for (const doc of snap.docs) {
      if (doc.data().category === 'Services') await doc.ref.delete();
    }

    console.log(`Seeding ${contacts.length} contacts with correct category format...`);
    for (const contact of contacts) {
      await db.collection('recommendations').add(contact);
      console.log(`✓ ${contact.name}`);
    }
    console.log(`\n✅ Seeded!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
