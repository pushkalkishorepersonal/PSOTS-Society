/**
 * rateLimit.service.js — Registration attempt rate limiting.
 * Stores attempt timestamps in Firestore per user.
 * Cache reduces reads on repeated checks.
 */

import { db, doc, getDoc, setDoc }                  from '../core/db.js';
import cache                                    from '../core/cache.js';
import { COLLECTIONS, MAX_ATTEMPTS_PER_MIN,
         MAX_ATTEMPTS_PER_HOUR }                from '../config/constants.js';

const RateLimitService = {

  /**
   * Check if user is within rate limits.
   * @returns {{ allowed: boolean, waitSeconds: number }}
   */
  async check(uid) {
    if (!uid) return { allowed: true, waitSeconds: 0 };

    try {
      const snap = await getDoc(doc(db, COLLECTIONS.RATE_LIMITS, uid));
      if (!snap.exists()) return { allowed: true, waitSeconds: 0 };

      const now      = Date.now();
      const attempts = snap.data().attempts || [];

      const perMin  = attempts.filter(t => now - t < 60_000);
      const perHour = attempts.filter(t => now - t < 3_600_000);

      if (perMin.length >= MAX_ATTEMPTS_PER_MIN) {
        const oldest  = Math.min(...perMin);
        const waitMs  = 60_000 - (now - oldest);
        return { allowed: false, waitSeconds: Math.ceil(waitMs / 1000) };
      }

      if (perHour.length >= MAX_ATTEMPTS_PER_HOUR) {
        const oldest  = Math.min(...perHour);
        const waitMs  = 3_600_000 - (now - oldest);
        return { allowed: false, waitSeconds: Math.ceil(waitMs / 1000) };
      }

      return { allowed: true, waitSeconds: 0 };
    } catch (_) {
      // If rate limit check fails, allow through (fail open)
      return { allowed: true, waitSeconds: 0 };
    }
  },

  /**
   * Record an attempt.
   */
  async record(uid) {
    if (!uid) return;

    try {
      const ref  = doc(db, COLLECTIONS.RATE_LIMITS, uid);
      const snap = await getDoc(ref);
      const now  = Date.now();

      // Keep only last hour of attempts
      const existing = (snap.exists() ? snap.data().attempts || [] : [])
        .filter(t => now - t < 3_600_000);

      existing.push(now);
      await setDoc(ref, { attempts: existing, last: now }, { merge: true });
    } catch (_) {
      // Non-critical
    }
  },
};

export default RateLimitService;
