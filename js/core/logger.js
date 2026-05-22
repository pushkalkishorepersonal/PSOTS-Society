/**
 * logger.js — Centralised error logging and audit trail.
 *
 * - Never shows raw Firebase errors to users
 * - All errors go through here
 * - Audit trail writes to Firestore audit_log collection
 * - Console.log stripped in production
 */

import { db, collection, addDoc, serverTimestamp } from './db.js';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// User-friendly error messages mapped from Firebase codes
const ERROR_MAP = {
  'auth/invalid-phone-number':    'Invalid phone number. Use format +919876543210',
  'auth/too-many-requests':       'Too many attempts. Please wait a few minutes.',
  'auth/code-expired':            'OTP expired. Please request a new one.',
  'auth/invalid-verification-code': 'Wrong OTP. Please try again.',
  'auth/popup-closed-by-user':    'Sign-in cancelled.',
  'auth/network-request-failed':  'Network error. Check your connection.',
  'permission-denied':            'You don\'t have permission to do this.',
  'unavailable':                  'Service temporarily unavailable. Try again.',
  'not-found':                    'Record not found.',
  'already-exists':               'This record already exists.',
  'deadline-exceeded':            'Request timed out. Please retry.',
};

const logger = {

  /**
   * Log an error. Returns user-friendly message.
   * @param {Error|string} error
   * @param {string} context — where it happened
   * @returns {string} — user-friendly message
   */
  error(error, context = '') {
    const code    = error?.code || '';
    const message = ERROR_MAP[code] || 'Something went wrong. Please try again.';

    if (IS_DEV) {
      console.error(`[PSOTS Error] ${context}:`, error);
    }

    return message;
  },

  /**
   * Dev-only log. Silent in production.
   */
  log(...args) {
    if (IS_DEV) console.log('[PSOTS]', ...args);
  },

  /**
   * Write to Firestore audit log.
   * Non-blocking — failures are silently swallowed.
   * @param {string} action
   * @param {object} meta
   */
  async audit(action, meta = {}) {
    try {
      await addDoc(collection(db, 'audit_log'), {
        action,
        ...meta,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent.substring(0, 100),
      });
    } catch (_) {
      // Audit log failure must never break the main flow
      if (IS_DEV) console.warn('[PSOTS] Audit log failed silently:', action);
    }
  },
};

export default logger;
