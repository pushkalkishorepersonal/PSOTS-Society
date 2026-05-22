/**
 * flat.service.js — Flat validation and Firestore flat records.
 */

import { db, doc, setDoc, getDoc, serverTimestamp }            from '../core/db.js';
import cache                                               from '../core/cache.js';
import logger                                              from '../core/logger.js';
import { TOWERS, VALID_TOWERS, SKIPPED_FLOORS, COLLECTIONS, TTL_5_MIN } from '../config/constants.js';

const FlatService = {

  /**
   * Validate flat details. Returns { valid, error } or { valid: true, flatNumber }.
   * Flat number format: {tower}{floor_padded_2}{unit}
   * Minimum length: 4 digits (e.g., "1011" = Tower 1, Floor 01, Unit 1)
   */
  validate(tower, floor, unit) {
    const t = parseInt(tower);
    const f = parseInt(floor);
    const u = parseInt(unit);

    if (!VALID_TOWERS.includes(t))    return { valid: false, error: `Tower ${t} does not exist in PSOTS.` };
    if (SKIPPED_FLOORS.includes(f))   return { valid: false, error: `Floor ${f} does not exist in any PSOTS tower.` };

    const cfg = TOWERS[t];
    if (f < 1 || f > cfg.maxFloor)   return { valid: false, error: `Tower ${t} has floors 1–${cfg.maxFloor} (no floor 13).` };
    if (u < 1 || u > cfg.maxUnit)    return { valid: false, error: `Tower ${t} has units 1–${cfg.maxUnit} per floor.` };

    const flatNumber = `${t}${String(f).padStart(2, '0')}${u}`;
    if (flatNumber.length < 4) {
      return { valid: false, error: 'Flat number must be at least 4 digits.' };
    }

    return { valid: true, flatNumber };
  },

  /**
   * Build flat number string from parts.
   * Format: {tower}{floor_padded_2}{unit}
   * Floor is always padded to 2 digits. Unit is never padded.
   * Example: Tower 8, Floor 5, Unit 3 = "8053"
   */
  buildFlatNumber(tower, floor, unit) {
    return `${parseInt(tower)}${String(parseInt(floor)).padStart(2, '0')}${parseInt(unit)}`;
  },

  /**
   * Parse flat number back to components.
   * Format: {tower}{floor_padded_2}{unit}
   * Floor segment is always exactly 2 digits, unit is 1-2 digits depending on tower.
   */
  parseFlatNumber(flatNumber) {
    // Find matching tower by trying valid tower prefixes (longest first)
    const str = String(flatNumber);
    for (const tower of VALID_TOWERS.sort((a,b) => b-a)) {
      const prefix = String(tower);
      if (str.startsWith(prefix)) {
        const remainder = str.slice(prefix.length);
        // remainder is floorUnit: floor is always exactly 2 digits
        if (remainder.length < 3) return null; // needs at least 2 for floor + 1 for unit

        const floor = parseInt(remainder.slice(0, 2));
        const unit  = parseInt(remainder.slice(2));
        return { tower, floor, unit };
      }
    }
    return null;
  },

  /**
   * Get floor options for a tower (skipping floor 13).
   */
  getFloors(tower) {
    const cfg = TOWERS[parseInt(tower)];
    if (!cfg) return [];
    const floors = [];
    for (let f = 1; f <= cfg.maxFloor; f++) {
      if (!SKIPPED_FLOORS.includes(f)) floors.push(f);
    }
    return floors;
  },

  /**
   * Get unit options for a tower.
   */
  getUnits(tower) {
    const cfg = TOWERS[parseInt(tower)];
    if (!cfg) return [];
    return Array.from({ length: cfg.maxUnit }, (_, i) => i + 1);
  },

  /**
   * Upsert flat record in Firestore (create or update).
   * FIX 3: Ensures all required fields are stored; merge:true preserves existing data.
   * Never overwrites createdAt if it already exists.
   */
  async upsert(flatNumber, changes = {}) {
    try {
      const parsed  = this.parseFlatNumber(flatNumber);
      const payload = {
        flatNumber,
        tower:     parsed?.tower      ?? changes.tower,
        floor:     parsed?.floor      ?? changes.floor,
        unit:      parsed?.unit       ?? changes.unit,
        status:    changes.status     ?? 'pending',
        primaryUid: changes.primaryUid ?? null,
        ...changes,
        updatedAt: serverTimestamp(),
      };
      // Only set createdAt when not already present in Firestore (merge:true handles this)
      if (!changes.hasOwnProperty('createdAt')) {
        payload.createdAt = serverTimestamp();
      }
      await setDoc(doc(db, COLLECTIONS.FLATS, flatNumber), payload, { merge: true });
      cache.invalidate(cache.keys.flat(flatNumber));
    } catch (e) {
      // Non-critical — log silently
      logger.log('flat.upsert failed:', e);
    }
  },

  /**
   * Get flat record. Cache-first.
   */
  async get(flatNumber) {
    const key = cache.keys.flat(flatNumber);
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      const snap = await getDoc(doc(db, COLLECTIONS.FLATS, flatNumber));
      if (!snap.exists()) return null;
      const data = { id: snap.id, ...snap.data() };
      cache.set(key, data, TTL_5_MIN);
      return data;
    } catch (e) {
      throw new Error(logger.error(e, 'FlatService.get'));
    }
  },
};

export default FlatService;
