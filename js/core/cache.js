/**
 * cache.js — 3-tier cache layer.
 *
 * Tier 1: Memory   — fastest, lost on page refresh
 * Tier 2: Session  — fast, lost on tab close (5 min TTL)
 * Tier 3: Firestore — source of truth (called on miss only)
 *
 * Usage:
 *   cache.set('resident_uid123', data)
 *   cache.get('resident_uid123')      → data or null
 *   cache.invalidate('resident_uid123')
 *   cache.clear()
 */

const TTL_DEFAULT = 5 * 60 * 1000; // 5 minutes

// Tier 1: in-memory store
const memStore = new Map();

const cache = {

  /**
   * Get from cache. Returns null on miss or expiry.
   * Checks memory first, then sessionStorage.
   */
  get(key) {
    // Tier 1: memory
    if (memStore.has(key)) {
      const { value, expires } = memStore.get(key);
      if (Date.now() < expires) return value;
      memStore.delete(key);
    }

    // Tier 2: sessionStorage
    try {
      const raw = sessionStorage.getItem(`psots_${key}`);
      if (raw) {
        const { value, expires } = JSON.parse(raw);
        if (Date.now() < expires) {
          // Promote back to memory
          memStore.set(key, { value, expires });
          return value;
        }
        sessionStorage.removeItem(`psots_${key}`);
      }
    } catch (_) {
      // sessionStorage unavailable (private mode etc.) — ignore
    }

    return null;
  },

  /**
   * Store value in both memory and sessionStorage.
   * @param {string} key
   * @param {*} value
   * @param {number} ttl — milliseconds, default 5 min
   */
  set(key, value, ttl = TTL_DEFAULT) {
    const expires = Date.now() + ttl;

    // Tier 1
    memStore.set(key, { value, expires });

    // Tier 2
    try {
      sessionStorage.setItem(`psots_${key}`, JSON.stringify({ value, expires }));
    } catch (_) {
      // Quota exceeded or unavailable — memory only
    }
  },

  /**
   * Remove a specific key from all tiers.
   */
  invalidate(key) {
    memStore.delete(key);
    try { sessionStorage.removeItem(`psots_${key}`); } catch (_) {}
  },

  /**
   * Remove all PSOTS cache entries.
   */
  clear() {
    memStore.clear();
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('psots_'));
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch (_) {}
  },

  // Cache key helpers — consistent naming
  keys: {
    resident:      uid        => `resident_${uid}`,
    identity:      uid        => `identity_${uid}`,
    flat:          num        => `flat_${num}`,
    flatMembers:   num        => `flat_members_${num}`,
    flatMember:    (num, uid) => `flat_member_${num}_${uid}`,
    linkedAccount: uid        => `linked_${uid}`,
    admins:                   () => 'admins_list',
    rateLimit:     uid        => `rate_${uid}`,
    consent:       uid        => `consent_${uid}`,
  }
};

export default cache;
