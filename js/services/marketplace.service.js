/**
 * marketplace.service.js — Firestore operations for the resident marketplace.
 * Collection: marketplace_listings
 */

import {
  db, collection, addDoc, getDocs, deleteDoc, doc,
  updateDoc, query, orderBy, serverTimestamp,
  arrayUnion, getDoc,
} from '../core/db.js';

const COL       = 'marketplace_listings';
const RESIDENTS = 'residents';

const REPORTS_TO_HIDE = 3;

const marketplaceService = {

  /**
   * Fetch the resident record for the given UID.
   */
  async getResident(uid) {
    try {
      const snap = await getDoc(doc(db, RESIDENTS, uid));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() };
    } catch (e) {
      throw new Error('Failed to load resident data.');
    }
  },

  /**
   * Fetch all active listings ordered by newest first.
   * Listings with >= REPORTS_TO_HIDE reports are excluded client-side.
   * If collection doesn't exist or is empty, returns empty array.
   */
  async getListings() {
    try {
      const q    = query(collection(db, COL), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => (l.reportCount || 0) < REPORTS_TO_HIDE);
    } catch (e) {
      // Return empty array if collection doesn't exist or other error
      return [];
    }
  },

  /**
   * Create a new listing. Requires the seller to be an approved resident.
   */
  async createListing({ title, price, description, category, telegramUsername }, resident) {
    if (resident.status !== 'approved') {
      throw new Error('Only verified residents can post listings.');
    }
    const tg = telegramUsername.trim().replace(/^@/, '');
    if (!tg) throw new Error('Telegram username is required.');

    try {
      return await addDoc(collection(db, COL), {
        title:           title.trim(),
        price:           parseFloat(price) || 0,
        description:     description.trim(),
        category,
        telegramUsername: tg,
        sellerUid:       resident.uid || resident.id,
        sellerName:      resident.name || 'Resident',
        sellerEmail:     resident.email || null,
        sellerFlat:      resident.flatNumber || null,
        reportCount:     0,
        reportedBy:      [],
        createdAt:       serverTimestamp(),
      });
    } catch (e) {
      throw new Error('Failed to post listing. Please try again.');
    }
  },

  /**
   * Delete a listing. Only the owner can delete their listing.
   */
  async deleteListing(listingId, uid) {
    const ref  = doc(db, COL, listingId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Listing not found.');
    if (snap.data().sellerUid !== uid) throw new Error('You can only delete your own listings.');
    await deleteDoc(ref);
  },

  /**
   * Report a listing. Each user can only report once.
   */
  async reportListing(listingId, uid) {
    const ref  = doc(db, COL, listingId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Listing not found.');
    const data = snap.data();
    if ((data.reportedBy || []).includes(uid)) {
      throw new Error('You have already reported this listing.');
    }
    await updateDoc(ref, {
      reportCount: (data.reportCount || 0) + 1,
      reportedBy:  arrayUnion(uid),
    });
  },
};


export default marketplaceService;
