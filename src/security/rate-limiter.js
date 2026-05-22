/**
 * src/security/rate-limiter.js — Sliding-window rate limiter
 *
 * Uses Cloudflare KV (RATE_LIMITS_KV namespace) to track request counts
 * across sliding time windows. Designed to be shared by:
 * - OTP request rate limiting (Sprint 2)
 * - OTP verification attempt limiting (Sprint 2)
 * - Login brute force protection (Sprint 2)
 * - Registration abuse protection (Sprint 2)
 * - Appeal submission cooldown (Sprint 4)
 * - Feedback form spam protection (Sprint 4)
 */

/**
 * Predefined rate limit configurations from IDENTITY_MODEL.md Section 24.
 * Use these constants, don't hardcode numbers elsewhere.
 */
export const RATE_LIMITS = {
  // OTP request limits (Sprint 2 will use these)
  OTP_REQUEST_PER_IP: { limit: 5, windowSeconds: 3600 },         // 5/hour per IP
  OTP_REQUEST_PER_TARGET: { limit: 3, windowSeconds: 3600 },     // 3/hour per email/phone
  OTP_REQUEST_GLOBAL: { limit: 50, windowSeconds: 60 },          // 50/minute globally

  // OTP verification limits
  OTP_VERIFY_PER_OTP: { limit: 5, windowSeconds: 900 },          // 5 attempts per 15-min OTP
  OTP_VERIFY_LOCKOUT: { limit: 3, windowSeconds: 1800 },         // 3 wrong → 30 min lockout

  // Login brute force
  LOGIN_ATTEMPTS_PER_IP: { limit: 10, windowSeconds: 300 },      // 10/5min per IP
  LOGIN_ATTEMPTS_PER_IDENTIFIER: { limit: 5, windowSeconds: 900 }, // 5/15min per user

  // Registration abuse
  REGISTRATION_PER_EMAIL: { limit: 1, windowSeconds: 86400 },    // 1/day per email
  REGISTRATION_PER_FLAT: { limit: 1, windowSeconds: 86400 },     // 1/day per flat+role

  // Appeal submission
  APPEAL_PER_RESIDENT: { limit: 1, windowSeconds: 604800 },      // 1/week per resident (7-day cooldown)
  APPEAL_GLOBAL: { limit: 10, windowSeconds: 3600 },             // 10/hour globally

  // Feedback form
  FEEDBACK_PER_RESIDENT: { limit: 3, windowSeconds: 86400 },     // 3/day per resident

  // Invite creation
  INVITE_CREATE_PER_USER: { limit: 5, windowSeconds: 3600 },     // 5/hour per user
  INVITE_EMAIL_PER_USER: { limit: 10, windowSeconds: 3600 },     // 10/hour per user
};

/**
 * Build a rate limit key with proper namespacing.
 *
 * @param {string} bucket - e.g. "otp_request", "login"
 * @param {string} dimension - e.g. "ip", "target", "resident"
 * @param {string} value - the specific value e.g. IP or email
 * @returns {string}
 */
export function buildKey(bucket, dimension, value) {
  return `ratelim:${bucket}:${dimension}:${value}`;
}

/**
 * Check if an action is allowed under rate limit, and record it if so.
 *
 * @param {Object} params
 * @param {string} params.key - Unique key for this rate limit bucket
 *                              (e.g. "otp_request:ip:103.x.x.x")
 * @param {number} params.limit - Max allowed in window
 * @param {number} params.windowSeconds - Window size in seconds
 * @param {object} params.env - Worker env with RATE_LIMITS_KV binding
 * @returns {Promise<{allowed: boolean, currentCount: number, resetsAt: number}>}
 */
export async function checkAndRecord({ key, limit, windowSeconds, env }) {
  try {
    const kv = env.RATE_LIMITS_KV;
    if (!kv) {
      console.warn('RATE_LIMITS_KV not configured — allowing request');
      return { allowed: true, currentCount: 0, resetsAt: Date.now() + windowSeconds * 1000 };
    }

    const now = Date.now();
    const currentWindow = Math.floor(now / (windowSeconds * 1000));
    const kvKey = `ratelim:${key}`;

    const stored = await kv.get(kvKey, 'json');
    let state = stored || { window: currentWindow, count: 0, prevCount: 0 };

    // If we've moved to a new window, shift counts
    if (state.window < currentWindow) {
      state.prevCount = state.count;
      state.count = 0;
      state.window = currentWindow;
    }

    const totalCount = state.count + state.prevCount;

    if (totalCount >= limit) {
      const resetsAt = (state.window + 1) * windowSeconds * 1000;
      return { allowed: false, currentCount: totalCount, resetsAt };
    }

    // Increment and save
    state.count++;
    const ttl = windowSeconds * 2; // Auto-expire entries after 2 windows
    await kv.put(kvKey, JSON.stringify(state), { expirationTtl: ttl });

    const resetsAt = (state.window + 1) * windowSeconds * 1000;
    return { allowed: true, currentCount: state.count + state.prevCount, resetsAt };
  } catch (err) {
    console.error('rate-limiter error:', err);
    // On error, default to allowing request (fail open)
    return { allowed: true, currentCount: 0, resetsAt: Date.now() + (windowSeconds || 3600) * 1000 };
  }
}

/**
 * Check rate limit without recording (read-only check).
 * Useful for showing remaining quota in UI.
 *
 * @param {Object} params
 * @param {string} params.key
 * @param {number} params.limit
 * @param {number} params.windowSeconds
 * @param {object} params.env
 * @returns {Promise<{allowed: boolean, currentCount: number, resetsAt: number}>}
 */
export async function check({ key, limit, windowSeconds, env }) {
  try {
    const kv = env.RATE_LIMITS_KV;
    if (!kv) {
      return { allowed: true, currentCount: 0, resetsAt: Date.now() + windowSeconds * 1000 };
    }

    const now = Date.now();
    const currentWindow = Math.floor(now / (windowSeconds * 1000));
    const kvKey = `ratelim:${key}`;

    const stored = await kv.get(kvKey, 'json');
    if (!stored) {
      return { allowed: true, currentCount: 0, resetsAt: (currentWindow + 1) * windowSeconds * 1000 };
    }

    const state = stored;
    let totalCount = state.count + state.prevCount;

    // If window has advanced, adjust previous count
    if (state.window < currentWindow) {
      totalCount = state.count; // Previous count expires
    }

    const resetsAt = (state.window + 1) * windowSeconds * 1000;
    return { allowed: totalCount < limit, currentCount: totalCount, resetsAt };
  } catch (err) {
    console.error('rate-limiter check error:', err);
    return { allowed: true, currentCount: 0, resetsAt: Date.now() + windowSeconds * 1000 };
  }
}

/**
 * Reset a rate limit bucket (admin action for manual override).
 *
 * @param {Object} params
 * @param {string} params.key
 * @param {object} params.env
 * @returns {Promise<void>}
 */
export async function reset({ key, env }) {
  try {
    const kv = env.RATE_LIMITS_KV;
    if (!kv) return;

    const kvKey = `ratelim:${key}`;
    await kv.delete(kvKey);
  } catch (err) {
    console.error('rate-limiter reset error:', err);
  }
}
