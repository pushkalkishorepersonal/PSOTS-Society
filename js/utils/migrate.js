/**
 * migrate.js — One-time migration utility (admin-only, not deployed to site).
 *
 * Migrates legacy residents/{uid} documents to the new person-centric schema:
 *   flats/{flatNumber}                    — flat record
 *   flats/{flatNumber}/members/{memberId} — person record (stable memberId)
 *   identities/{uid}                      — UID → memberId mapping
 *
 * Safe: does NOT delete legacy residents/{uid} documents.
 * Idempotent: skips UIDs that already have an identities/{uid} entry.
 */

import { db, collection, getDocs, doc,
         getDoc, setDoc, serverTimestamp } from '../core/db.js';
import { COLLECTIONS }                    from '../config/constants.js';

/**
 * Migrate all residents to flat-centric schema.
 * @param {Function} logFn — called with progress strings (optional)
 */
export async function migrateResidentsToFlatCentric(logFn = console.log) {
  logFn('Starting migration...');

  // 1. Read ALL documents from residents collection
  const residentsSnap = await getDocs(collection(db, COLLECTIONS.RESIDENTS));
  const residents      = residentsSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));

  logFn(`Found ${residents.length} resident documents.`);

  // 2. Group by flatNumber
  const byFlat = {};
  for (const r of residents) {
    if (!r.flatNumber) {
      logFn(`  SKIP ${r._docId} — no flatNumber`);
      continue;
    }
    if (!byFlat[r.flatNumber]) byFlat[r.flatNumber] = [];
    byFlat[r.flatNumber].push(r);
  }

  logFn(`Found ${Object.keys(byFlat).length} distinct flats.`);

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  // 3. For each flat, create flat doc + member docs + identity docs
  for (const [flatNumber, flatResidents] of Object.entries(byFlat)) {
    try {
      // 3a. Upsert flats/{flatNumber}
      const flatRef  = doc(db, COLLECTIONS.FLATS, flatNumber);
      const flatSnap = await getDoc(flatRef);
      if (!flatSnap.exists()) {
        const first = flatResidents[0];
        await setDoc(flatRef, {
          flatNumber,
          tower:     first.tower      || null,
          floor:     first.floor      || null,
          unit:      first.unit       || null,
          status:    first.status     || 'pending',
          primaryUid: first.uid || first._docId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        logFn(`  Created flats/${flatNumber}`);
      }

      // 3b. For each resident in this flat
      for (const r of flatResidents) {
        const uid = r.uid || r._docId;

        // Check if identities/{uid} already exists — skip if so
        const idSnap = await getDoc(doc(db, COLLECTIONS.IDENTITIES, uid));
        if (idSnap.exists()) {
          logFn(`  SKIP identity/${uid} — already migrated`);
          skipped++;
          continue;
        }

        // memberId convention for migration: flatNumber + '_' + uid
        const memberId = `${flatNumber}_${uid}`;

        // 3c. Create flats/{flatNumber}/members/{memberId}
        const memberRef  = doc(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS, memberId);
        const memberSnap = await getDoc(memberRef);
        if (!memberSnap.exists()) {
          const { _docId, ...memberData } = r;
          await setDoc(memberRef, {
            ...memberData,
            uid,
            memberId,
            identityUids: [uid],
            updatedAt:    serverTimestamp(),
          });
        }

        // 3d. Create identities/{uid}
        await setDoc(doc(db, COLLECTIONS.IDENTITIES, uid), {
          uid,
          flatNumber,
          memberId,
          provider:  r.email ? 'google' : 'telegram',
          linkedAt:  serverTimestamp(),
          isPrimary: true,
        });

        logFn(`  Migrated uid=${uid} → memberId=${memberId}`);
        created++;
      }
    } catch (e) {
      logFn(`  ERROR flat=${flatNumber}: ${e.message}`);
      errors++;
    }
  }

  const summary = `Migration complete. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`;
  logFn(summary);
  return { created, skipped, errors };
}
