/**
 * admin.service.js — Admin panel operations.
 * Approval, rejection, admin management, audit log reads.
 * Writes to both legacy residents/{uid} AND new flats/{flatNumber}/members/{uid}.
 */

import { db, collection, getDocs, doc, updateDoc, setDoc,
         deleteDoc, onSnapshot, query, orderBy,
         limit, serverTimestamp, addDoc, getDoc }           from '../core/db.js';
import cache                                                from '../core/cache.js';
import logger                                               from '../core/logger.js';
import { COLLECTIONS, TTL_15_MIN, SUPER_ADMIN,
         ACCOUNT_STATUSES }                                 from '../config/constants.js';

// Shorthand for identities collection used in this module
const IDENTITIES = COLLECTIONS.IDENTITIES || 'identities';

/** Helper: update flat member by memberId, and all linked UIDs */
async function _updateFlatMember(uid, flatNumber, changes) {
  if (!flatNumber) return;
  try {
    // Try uid as memberId (legacy)
    const legacyRef  = doc(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS, uid);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      await updateDoc(legacyRef, changes);
      cache.invalidate(cache.keys.flatMember(flatNumber, uid));
      cache.invalidate(cache.keys.flatMembers(flatNumber));
      return;
    }

    // Lookup via identities to get the real memberId
    try {
      const idSnap = await getDoc(doc(db, COLLECTIONS.IDENTITIES, uid));
      if (idSnap.exists()) {
        const { memberId } = idSnap.data();
        if (memberId) {
          const memberRef = doc(db, COLLECTIONS.FLATS, flatNumber, COLLECTIONS.FLAT_MEMBERS, memberId);
          const memberSnap = await getDoc(memberRef);
          if (memberSnap.exists()) {
            await updateDoc(memberRef, changes);
            cache.invalidate(cache.keys.flatMember(flatNumber, memberId));
            cache.invalidate(cache.keys.flatMembers(flatNumber));
          }
        }
      }
    } catch (_) {}
  } catch (_) {
    // Non-fatal
  }
}

/** Helper: update flats/{flatNumber} top-level status */
async function _updateFlatStatus(flatNumber, status, adminEmail) {
  if (!flatNumber) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.FLATS, flatNumber), {
      status,
      approvedBy: adminEmail,
      approvedAt: serverTimestamp(),
      updatedAt:  serverTimestamp(),
    });
    cache.invalidate(cache.keys.flat(flatNumber));
  } catch (_) {}
}

const AdminService = {

  /**
   * Check if an email is an admin (super admin or in admins collection).
   * Cache-first — admin list doesn't change often.
   */
  async isAdmin(email) {
    if (!email) return false;
    if (email === SUPER_ADMIN) return true;
    const admins = await this.getAdmins();
    return admins.some(a => a.email === email);
  },

  /**
   * Get all admins. Cache-first (15 min TTL).
   */
  async getAdmins() {
    const key = cache.keys.admins();
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      const snap = await getDocs(collection(db, COLLECTIONS.ADMINS));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cache.set(key, list, TTL_15_MIN);
      return list;
    } catch (e) {
      throw new Error(logger.error(e, 'AdminService.getAdmins'));
    }
  },

  /**
   * Add a new admin. Super admin only.
   */
  async addAdmin(email, addedByEmail) {
    try {
      await addDoc(collection(db, COLLECTIONS.ADMINS), {
        email,
        addedBy:   addedByEmail,
        addedAt:   serverTimestamp(),
        isActive:  true,
      });
      cache.invalidate(cache.keys.admins());
      logger.audit('admin_added', { name: email, adminEmail: addedByEmail });
    } catch (e) {
      throw new Error(logger.error(e, 'AdminService.addAdmin'));
    }
  },

  /**
   * Remove admin. Super admin only.
   */
  async removeAdmin(adminDocId, email, removedByEmail) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ADMINS, adminDocId));
      cache.invalidate(cache.keys.admins());
      logger.audit('admin_removed', { name: email, adminEmail: removedByEmail });
    } catch (e) {
      throw new Error(logger.error(e, 'AdminService.removeAdmin'));
    }
  },

  /**
   * Approve a resident — updates both legacy and flat-centric collections.
   */
  async approve(uid, name, adminEmail, flatNumber) {
    try {
      const changes = {
        status:            ACCOUNT_STATUSES.APPROVED,
        isActive:          true,
        'badges.blueTick': true,
        approvedAt:        serverTimestamp(),
        approvedBy:        adminEmail,
        rejectionReason:   null,
        updatedAt:         serverTimestamp(),
      };

      // Legacy
      await updateDoc(doc(db, COLLECTIONS.RESIDENTS, uid), changes);
      cache.invalidate(cache.keys.resident(uid));

      // Flat-centric
      await _updateFlatMember(uid, flatNumber, changes);
      await _updateFlatStatus(flatNumber, ACCOUNT_STATUSES.APPROVED, adminEmail);

      logger.audit('approved', { uid, name, flatNumber, adminEmail });
    } catch (e) {
      throw new Error(logger.error(e, 'AdminService.approve'));
    }
  },

  /**
   * Reject a resident with reason — updates both collections.
   */
  async reject(uid, name, adminEmail, flatNumber, reasonCategory, reasonNote = '') {
    try {
      const fullReason = reasonNote.trim()
        ? `${reasonCategory} — ${reasonNote.trim()}`
        : reasonCategory;

      const changes = {
        status:              ACCOUNT_STATUSES.REJECTED,
        isActive:            false,
        'badges.blueTick':   false,
        rejectionReason:     fullReason,
        rejectionCategory:   reasonCategory,
        rejectedAt:          serverTimestamp(),
        rejectedBy:          adminEmail,
        updatedAt:           serverTimestamp(),
      };

      // Legacy
      await updateDoc(doc(db, COLLECTIONS.RESIDENTS, uid), changes);
      cache.invalidate(cache.keys.resident(uid));

      // Flat-centric
      await _updateFlatMember(uid, flatNumber, changes);

      logger.audit('rejected', { uid, name, flatNumber, adminEmail, reason: fullReason });
    } catch (e) {
      throw new Error(logger.error(e, 'AdminService.reject'));
    }
  },

  /**
   * Mark resident as moved out — updates both collections.
   */
  async markMovedOut(uid, name, adminEmail, flatNumber, reason = '') {
    try {
      const changes = {
        status:            ACCOUNT_STATUSES.INACTIVE,
        isActive:          false,
        movedOut:          true,
        movedOutDate:      new Date().toISOString(),
        movedOutReason:    reason,
        'badges.blueTick': false,
        updatedAt:         serverTimestamp(),
      };

      // Legacy
      await updateDoc(doc(db, COLLECTIONS.RESIDENTS, uid), changes);
      cache.invalidate(cache.keys.resident(uid));

      // Flat-centric
      await _updateFlatMember(uid, flatNumber, changes);

      logger.audit('moved_out', { uid, name, flatNumber, adminEmail, reason });
    } catch (e) {
      throw new Error(logger.error(e, 'AdminService.markMovedOut'));
    }
  },

  /**
   * Resolve appeal — approve or reject.
   */
  async resolveAppeal(appealId, residentUid, decision, adminEmail, note = '') {
    try {
      await updateDoc(doc(db, COLLECTIONS.APPEALS, appealId), {
        status:          decision,
        resolvedAt:      serverTimestamp(),
        resolvedBy:      adminEmail,
        adminNote:       note,
      });

      if (decision === 'approved') {
        await updateDoc(doc(db, COLLECTIONS.RESIDENTS, residentUid), {
          status:    ACCOUNT_STATUSES.PENDING,
          updatedAt: serverTimestamp(),
        });
        cache.invalidate(cache.keys.resident(residentUid));
      }

      logger.audit('appeal_resolved', { appealId, residentUid, decision, adminEmail });
    } catch (e) {
      throw new Error(logger.error(e, 'AdminService.resolveAppeal'));
    }
  },

  /**
   * Subscribe to residents collection (realtime).
   * Returns unsubscribe function.
   */
  subscribeResidents(callback) {
    return onSnapshot(collection(db, COLLECTIONS.RESIDENTS), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(list);
    });
  },

  /**
   * Subscribe to admins collection (realtime).
   */
  subscribeAdmins(callback) {
    return onSnapshot(collection(db, COLLECTIONS.ADMINS), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cache.set(cache.keys.admins(), list, TTL_15_MIN);
      callback(list);
    });
  },

  /**
   * Subscribe to audit log (realtime, last 50).
   */
  subscribeAuditLog(callback) {
    const q = query(
      collection(db, COLLECTIONS.AUDIT_LOG),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },
};

export default AdminService;
