// Quick test to verify D1 → adapter → parseFirestoreDoc flow
import { firestoreQuery } from './src/db/adapter-d1.js';

// Mock env (you'll need to pass the real env when running in Worker context)
const env = {
  PSOTS_DB: {
    prepare: (sql) => ({
      bind: (...args) => ({
        all: async () => {
          console.log('SQL:', sql);
          console.log('Bindings:', args);
          
          // Simulate D1 response
          return {
            results: [
              {
                resident_id: 'r_15167_test123',
                flat_number: '15167',
                name: 'Pushkal Kishore',
                email: 'pushkal@gmail.com',
                resident_type: 'owner',
                status: 'approved',
                is_admin: 1
              }
            ]
          };
        }
      })
    })
  }
};

// Test the query
const residents = await firestoreQuery('residents', [['flatNumber', '15167']], env);

console.log('\n=== Query Result ===');
console.log('Count:', residents.length);
console.log('First resident:', JSON.stringify(residents[0], null, 2));

if (residents.length > 0) {
  const r = residents[0];
  console.log('\n=== After parseFirestoreDoc ===');
  console.log('status:', r.status);
  console.log('residentType:', r.residentType);
  console.log('resident_type:', r.resident_type);
  console.log('Has residentType?', 'residentType' in r);
  console.log('Match owner?', r.residentType === 'owner');
}
