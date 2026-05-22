/**
 * resident.service.js — All resident data operations.
 * Person-centric architecture: one record per person, not per login.
 *
 * Data lives in:
 *   identities/{uid}                     — maps any Firebase UID to a person
 *   flats/{flatNumber}                   — flat-level record
 *   flats/{flatNumber}/members/{memberId}— per-person record (primary)
 *   linkedAccounts/{uid}                 — legacy UID→flat mapping (kept for compat)
 *   residents/{uid}                      — legacy, kept for backward compat
 */

import { db, doc, getDoc, setDoc, updateDoc, collection,
         query, where, getDocs, serverTimestamp, addDoc,
         arrayUnion, writeBatch }                            from '../core/db.js';
import cache                                                from '../core/cache.js';
import logger                                               from '../core/logger.js';
import { COLLECTIONS, TTL_5_MIN, ACCOUNT_STATUSES,
         MAX_RESIDENTS_PER_FLAT }                           from '../config/constants.js';

const ResidentService = {

  // ── IDENTITY RESOLUTION ───────────────────────────────────

  /**
   * Resolve any Firebase UID to { flatNumber, memberId }.
   * Checks identities → linkedAccounts → residents in order.
   * Returns null if not found anywhere.
   */
  async resolveIdentity(uid) {
    const key = cache.keys.identity(uid);
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      // 1. Check identities/{uid} (new primary)
      const idSnap = await getDoc(doc(db, COLLECTIONS.IDENTITIES, uid));
      if (idSnap.exists()) {
        const { flatNumber, memberId } = idSnap.data();
        const result = { flatNumber, memberId };
        cache.set(key, result, TTL_5_MIN);
        return result;
      }

      // 2. Check linkedAccounts/{uid} (legacy linking)
      const laSnap = await getDoc(doc(db, COLLECTIONS.LINKED_ACCOUNTS, uid));
      if (laSnap.exists()) {
        const { flatNumber } = laSnap.data();
        const result = { flatNumber, memberId: uid };
        cache.set(key, result, TTL_5_MIN);
        return result;
      }

      // 3. Check residents/{uid} (legacy direct)
      const resSnap = await getDoc(doc(db, COLLECTIONS.RESIDENTS, uid));
      if (resSnap.exists()) {
        const { flatNumber } = resSnap.data();
        if (flatNumber) {
          const result = { flatNumber, memberId: uid };
          cache.set(key, result, TTL_5_MIN);
          return result;
        }
      }

      // Clear any stale null cache before returning null
      cache.invalidate(key);
      console.warn('resolveIdentity: no identity found for uid', uid);
      return null;
    } catch (e) {
      console.error('resolveIdentity ERROR for uid', uid, ':', e.code, e.message);
      return null;
    }
  },

  // ── PRIMARY: flats/{flatNumber}/members/{memberId} ────────

  /**
   * Get resident by UID. Resolves identity first, then loads member doc.
   * Falls back to legacy residents/{uid}.
   */
  async get(uid) {
    const key = cache.keys.resident(uid);
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      // Always read status from residents/{uid} first (canonical source)
      let status = null;
      try {
        const resSnap = await getDoc(doc(db, COLLECTIONS.RESIDENTS, uid));
        if (resSnap.exists()) {
          status = resSnap.data().status;
        }
      } catch (_) {}

      // 1. Resolve identity to get flatNumber + memberId
      const identity = await this.resolveIdentity(uid);
      if (identity?.flatNumber && identity?.memberId) {
        const memberSnap = await getDoc(
          doc(db, COLLECTIONS.FLATS, identity.flatNumber, COLLECTIONS.FLAT_MEMBERS, identity.memberId)
        );
        if (memberSnap.exists()) {
          let data = { id: memberSnap.id, memberId: memberSnap.id, ...memberSnap.data() };

          // Override with canonical status from residents/{uid}
          if (status) {
            data.status = status;
          }

          cache.set(key, data, TTL_5_MIN);
          return data;
        }
      }

      // 3. Fall back to legacy residents/{uid}
      const snap = await getDoc(doc(db, COLLECTIONS.RESIDENTS, uid));
      if (!snap.exists()) return null;
      const data = { id: snap.id, ...snap.data() };
      cache.set(key, data, TTL_5_MIN);
      return data;
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.get'));
    }
  },

  /**
   * Create new resident record.
   * ATOMIC: All writes succeed together or none do — no partial state possible.
   * - Checks for flat duplicate BEFORE any write
   * - Uses writeBatch to atomically commit all Firestore writes
   */
  async create(uid, data) {
    try {
      const memberId = data.flatNumber
        ? `${data.flatNumber}_${Date.now()}`
        : uid;

      const record = {
        ...data,
        uid,
        memberId,
        identityUids:     [uid],
        isActive:         false,
        movedOut:         false,
        rejectionCount:   0,
        appealStatus:     'none',
        badges: {
          blueTick:    false,
          goldStar:    false,
          isAdmin:     false,
          nudgePending: false,
        },
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
        memberSince:  serverTimestamp(),
      };

      // PHASE 0 FIX: Duplicate flat guard (check BEFORE any write)
      if (data.flatNumber) {
        const flatRef = doc(db, COLLECTIONS.FLATS, data.flatNumber);
        const flatSnap = await getDoc(flatRef);
        if (flatSnap.exists()) {
          throw new Error(`Flat ${data.flatNumber} is already registered.`);
        }
      }

      // PHASE 0 FIX: Atomic batch write
      const batch = writeBatch(db);

      // 1. Write to legacy residents/{uid}
      batch.set(doc(db, COLLECTIONS.RESIDENTS, uid), record);

      if (data.flatNumber) {
        const flatUpdate = {
          flatNumber:  data.flatNumber,
          tower:       data.tower,
          floor:       data.floor,
          unit:        data.unit,
          status:      ACCOUNT_STATUSES.PENDING,
          primaryUid:  uid,
          createdAt:   serverTimestamp(),
          updatedAt:   serverTimestamp(),
        };

        // 2. Write to flats/{flatNumber}
        batch.set(doc(db, COLLECTIONS.FLATS, data.flatNumber), flatUpdate);

        // 3. Write to flats/{flatNumber}/members/{memberId}
        batch.set(
          doc(db, COLLECTIONS.FLATS, data.flatNumber, COLLECTIONS.FLAT_MEMBERS, memberId),
          record
        );

        // 4. Write identities/{uid}
        batch.set(doc(db, COLLECTIONS.IDENTITIES, uid), {
          uid,
          flatNumber:  data.flatNumber,
          memberId,
          provider:    data.email ? 'google' : 'telegram',
          linkedAt:    serverTimestamp(),
          isPrimary:   true,
        });

        // 5. Write legacy linkedAccounts/{uid}
        batch.set(doc(db, COLLECTIONS.LINKED_ACCOUNTS, uid), {
          uid,
          flatNumber: data.flatNumber,
          memberId,
          provider:   data.email ? 'google' : 'telegram',
          linkedAt:   serverTimestamp(),
        });
      }

      // Commit all writes atomically
      await batch.commit();

      // Cache invalidation after successful commit
      cache.invalidate(cache.keys.identity(uid));
      cache.invalidate(cache.keys.linkedAccount(uid));
      cache.invalidate(cache.keys.resident(uid));
      if (data.flatNumber) {
        cache.invalidate(cache.keys.flat(data.flatNumber));
        cache.invalidate(cache.keys.flatMembers(data.flatNumber));
      }

      logger.audit('registration_submitted', {
        uid,
        memberId,
        flatNumber: data.flatNumber,
        role:       data.role,
        residentType: data.residentType,
      });

      return { ok: true, memberId, data: record };
    } catch (e) {
      return { ok: false, error: e.message || logger.error(e, 'ResidentService.create') };
    }
  },

  /**
   * Update resident fields. Invalidates cache.
   * Writes to both legacy and flat-centric locations.
   */
  async update(uid, changes) {
    try {
      const changes_ = { ...changes, updatedAt: serverTimestamp() };

      // Update legacy
      await updateDoc(doc(db, COLLECTIONS.RESIDENTS, uid), changes_);

      // Resolve identity to find flat + member
      const identity = await this.resolveIdentity(uid);
      if (identity?.flatNumber && identity?.memberId) {
        const memberRef  = doc(db, COLLECTIONS.FLATS, identity.flatNumber, COLLECTIONS.FLAT_MEMBERS, identity.memberId);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          await updateDoc(memberRef, changes_);
          cache.invalidate(cache.keys.flatMember(identity.flatNumber, identity.memberId));
          cache.invalidate(cache.keys.flatMembers(identity.flatNumber));
        }
      }

      cache.invalidate(cache.keys.resident(uid));
      cache.invalidate(cache.keys.identity(uid));
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.update'));
    }
  },

  /**
   * Link a new login method (uid) to an existing person record.
   * Called when same person signs in with a different provider.
   */
  async linkIdentity(uid, flatNumber, memberId, provider = 'google') {
    try {
      // 1. Check if already linked
      const existing = await getDoc(doc(db, COLLECTIONS.IDENTITIES, uid));
      if (existing.exists()) {
        return { ok: true, existing: true, ...existing.data() };
      }

      // 2. Write identities/{uid}
      await setDoc(doc(db, COLLECTIONS.IDENTITIES, uid), {
        uid,
        flatNumber,
        memberId,
        provider,
        linkedAt:  serverTimestamp(),
        isPrimary: false,
      });

      // 3. Add uid to member's identityUids array
      await updateDoc(
        doc(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS, memberId),
        { identityUids: arrayUnion(uid), updatedAt: serverTimestamp() }
      );

      // 4. Copy member data to residents/{uid} so legacy paths still work
      const memberSnap = await getDoc(
        doc(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS, memberId)
      );
      if (memberSnap.exists()) {
        await setDoc(
          doc(db, COLLECTIONS.RESIDENTS, uid),
          { ...memberSnap.data(), uid, linkedFrom: memberId, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }

      // 5. Legacy linkedAccounts
      await setDoc(doc(db, COLLECTIONS.LINKED_ACCOUNTS, uid), {
        uid,
        flatNumber,
        memberId,
        provider,
        linkedAt: serverTimestamp(),
      });

      cache.invalidate(cache.keys.identity(uid));
      cache.invalidate(cache.keys.linkedAccount(uid));
      cache.invalidate(cache.keys.flatMembers(flatNumber));
      cache.invalidate(cache.keys.flatMember(flatNumber, memberId));

      logger.audit('identity_linked', { uid, flatNumber, memberId, provider });
      return { ok: true };
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.linkIdentity'));
    }
  },

  // ── NEW: Flat-centric methods ─────────────────────────────

  /**
   * Get the flat-level record from flats/{flatNumber}.
   * Falls back to residents collection query if flats doc missing.
   */
  async getFlatRecord(flatNumber) {
    const key = cache.keys.flat(flatNumber);
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      const snap = await getDoc(doc(db, COLLECTIONS.FLATS, flatNumber));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        cache.set(key, data, TTL_5_MIN);
        return data;
      }

      // Fallback: query residents collection
      const q = query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('flatNumber', '==', flatNumber)
      );
      const residentsSnap = await getDocs(q);
      if (residentsSnap.empty) return null;
      const first = residentsSnap.docs[0].data();
      const data = {
        id:         flatNumber,
        flatNumber: first.flatNumber,
        tower:      first.tower,
        floor:      first.floor,
        unit:       first.unit,
        status:     first.status || ACCOUNT_STATUSES.PENDING,
        primaryUid: first.uid,
      };
      cache.set(key, data, TTL_5_MIN);
      return data;
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.getFlatRecord'));
    }
  },

  /**
   * Get all members of a flat from flats/{flatNumber}/members.
   * Falls back to residents collection query if subcollection is empty.
   */
  async getMembersForFlat(flatNumber) {
    const key = cache.keys.flatMembers(flatNumber);
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      const snap = await getDocs(
        collection(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS)
      );
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, memberId: d.id, ...d.data() }));
        cache.set(key, list, TTL_5_MIN);
        return list;
      }

      // Fallback: query residents collection
      const q = query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('flatNumber', '==', flatNumber)
      );
      const residentsSnap = await getDocs(q);
      const fallback = residentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const seen = new Set();
      const deduped = fallback.filter(r => {
        const k = r.uid || r.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      cache.set(key, deduped, TTL_5_MIN);
      return deduped;
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.getMembersForFlat'));
    }
  },

  /**
   * Get a specific flat member by memberId.
   */
  async getFlatMember(flatNumber, memberId) {
    const key = cache.keys.flatMember(flatNumber, memberId);
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      const snap = await getDoc(
        doc(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS, memberId)
      );
      if (!snap.exists()) return null;
      const data = { id: snap.id, memberId: snap.id, ...snap.data() };
      cache.set(key, data, TTL_5_MIN);
      return data;
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.getFlatMember'));
    }
  },

  /**
   * Create a link between a UID and a flat (legacy path — delegates to linkIdentity).
   * Kept for backward compat with residents/index.js callers.
   */
  async linkAccount(uid, flatNumber, provider = 'google') {
    try {
      // Find the primary memberId for this flat
      const members = await this.getMembersForFlat(flatNumber);
      const primary = members.find(m => m.role === 'primary') || members[0];
      const memberId = primary?.memberId || primary?.id || uid;

      return await this.linkIdentity(uid, flatNumber, memberId, provider);
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.linkAccount'));
    }
  },

  /**
   * Get the flat linked to a UID (legacy helper).
   */
  async getLinkedFlat(uid) {
    const identity = await this.resolveIdentity(uid);
    if (identity) return identity;

    // Explicit legacy check for callers expecting linkedAccounts shape
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.LINKED_ACCOUNTS, uid));
      if (!snap.exists()) return null;
      return snap.data();
    } catch (_) {
      return null;
    }
  },

  /**
   * Add a family member to a flat (no Firebase account required).
   * Stored under flats/{flatNumber}/members/{memberId} with role: 'family'.
   */
  async addFamilyMember(flatNumber, memberData) {
    try {
      const memberId = `${flatNumber}_fm_${Date.now()}`;
      const record = {
        ...memberData,
        memberId,
        role:      'family',
        status:    ACCOUNT_STATUSES.APPROVED,
        isActive:  true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(
        doc(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS, memberId),
        record
      );
      cache.invalidate(cache.keys.flatMembers(flatNumber));
      logger.audit('family_member_added', { flatNumber, memberId, name: memberData.name });
      return { ok: true, id: memberId, memberId };
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.addFamilyMember'));
    }
  },

  // ── LEGACY helpers (kept for backward compat) ─────────────

  /**
   * Check how many approved/pending residents exist for a flat.
   */
  async countForFlat(flatNumber) {
    try {
      const members = await this.getMembersForFlat(flatNumber);
      if (members.length > 0) {
        return members.filter(m =>
          [ACCOUNT_STATUSES.PENDING, ACCOUNT_STATUSES.PENDING_PRIMARY,
           ACCOUNT_STATUSES.PENDING_OWNER, ACCOUNT_STATUSES.APPROVED].includes(m.status)
        ).length;
      }

      const q = query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('flatNumber', '==', flatNumber),
        where('status', 'in', [
          ACCOUNT_STATUSES.PENDING,
          ACCOUNT_STATUSES.PENDING_PRIMARY,
          ACCOUNT_STATUSES.PENDING_OWNER,
          ACCOUNT_STATUSES.APPROVED,
        ])
      );
      const snap = await getDocs(q);
      return snap.size;
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.countForFlat'));
    }
  },

  /**
   * Get the primary resident of a flat (for secondary approval flow).
   */
  async getPrimaryForFlat(flatNumber) {
    try {
      const members = await this.getMembersForFlat(flatNumber);
      const primary = members.find(m => m.role === 'primary' && m.status === ACCOUNT_STATUSES.APPROVED);
      if (primary) return primary;

      const q = query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('flatNumber', '==', flatNumber),
        where('role',       '==', 'primary'),
        where('status',     '==', ACCOUNT_STATUSES.APPROVED)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.getPrimaryForFlat'));
    }
  },

  /**
   * Get the registered owner of a flat (for tenant validation).
   */
  async getOwnerForFlat(flatNumber) {
    try {
      const members = await this.getMembersForFlat(flatNumber);
      const owner = members.find(m => m.residentType === 'owner' && m.status === ACCOUNT_STATUSES.APPROVED);
      if (owner) return owner;

      const q = query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('flatNumber',   '==', flatNumber),
        where('residentType', '==', 'owner'),
        where('status',       '==', ACCOUNT_STATUSES.APPROVED)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.getOwnerForFlat'));
    }
  },

  /**
   * Check if flat is at max capacity.
   */
  async isFlatFull(flatNumber) {
    const count = await this.countForFlat(flatNumber);
    return count >= MAX_RESIDENTS_PER_FLAT;
  },

  /**
   * Submit appeal for rejected resident.
   */
  async submitAppeal(uid, flatNumber, originalReason, appealText, name) {
    try {
      const q = query(
        collection(db, COLLECTIONS.APPEALS),
        where('residentUid', '==', uid)
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        throw new Error('You have already submitted an appeal. Only one appeal is allowed.');
      }

      await addDoc(collection(db, COLLECTIONS.APPEALS), {
        residentUid:              uid,
        residentName:             name,
        flatNumber,
        originalRejectionReason:  originalReason,
        appealText,
        status:                   'pending',
        isFirstAppeal:            true,
        submittedAt:              serverTimestamp(),
      });

      logger.audit('appeal_submitted', { uid, flatNumber });
    } catch (e) {
      throw new Error(e.message || logger.error(e, 'ResidentService.submitAppeal'));
    }
  },

  /**
   * Request data export before suspension/move-out.
   */
  async requestDataExport(uid, reason = 'user_request') {
    try {
      await setDoc(doc(db, COLLECTIONS.DATA_EXPORTS, uid), {
        uid,
        requestedAt:   serverTimestamp(),
        status:        'pending',
        triggerReason: reason,
        downloadUrl:   null,
        downloadedAt:  null,
      });
      logger.audit('data_export_requested', { uid, reason });
    } catch (e) {
      throw new Error(logger.error(e, 'ResidentService.requestDataExport'));
    }
  },
};

export default ResidentService;
