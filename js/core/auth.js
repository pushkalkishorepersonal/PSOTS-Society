/**
 * auth.js — Session management and auth state.
 *
 * Responsibilities:
 * - Track current user across page loads
 * - Fetch resident record after auth resolves so listeners get real data
 * - Provide route guards (requireAuth, requireAdmin, requireApproved)
 * - Handle sign-out cleanly
 * - Expose reactive onUserChange hook
 */

import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import cache from './cache.js';
import { SUPER_ADMIN, SUPER_ADMIN_TG_UID } from '../config/constants.js';
import residentService from '../services/resident.service.js';

// Current state — kept in memory for fast synchronous access
let _currentUser     = null;
let _currentResident = null;
let _authResolved    = false;
const _listeners = new Set();

function _isSuperAdmin(user) {
  if (!user) return false;
  return user.email === SUPER_ADMIN || user.uid === SUPER_ADMIN_TG_UID;
}

function _notify() {
  const role = !_currentUser ? 'guest'
    : _isSuperAdmin(_currentUser)          ? 'superadmin'
    : _currentResident?.isAdmin            ? 'admin'
    : 'registered';
  _listeners.forEach(fn => fn({ user: _currentUser, resident: _currentResident, role }));
}

// FIX 7: timeout helper — resolves with null after ms (never rejects)
function _timeout(ms) {
  return new Promise(resolve => setTimeout(() => resolve(null), ms));
}

// Boot — cookie-native session first (direct Google OAuth / Worker cookie),
// then fall back to Firebase auth state for the transition period.
async function _bootCookieSession() {
  try {
    const res = await fetch('https://telegram.psots.in/auth/me', { credentials: 'include' });
    if (res.ok) {
      const me = await res.json();
      if (me.ok && me.user) {
        const u = me.user;
        _currentUser = {
          uid: u.uid,
          email: u.email || null,
          displayName: u.name || null,
          cookie: true,
          getIdToken: async () => null
        };
        _currentResident = {
          uid: u.uid,
          residentId: u.uid,
          email: u.email || null,
          name: u.name || null,
          flatNumber: u.flatNumber || null,
          isAdmin: !!u.isAdmin
        };
        _authResolved = true;
        _notify();
        return true;
      }
    }
  } catch (_) { /* no cookie session — fall back to Firebase */ }
  return false;
}

_bootCookieSession().then(hasCookie => {
  if (hasCookie) return; // cookie session wins; ignore Firebase state
  onAuthStateChanged(auth, async user => {
    _currentUser     = user;
    _currentResident = null;

    if (user) {
      try {
        // Race resolveIdentity + member load against 8-second timeout
        // so auth never hangs the page indefinitely.
        _currentResident = await Promise.race([
          (async () => {
            const identity = await residentService.resolveIdentity(user.uid);
            if (identity) {
              return residentService.get(user.uid);
            }
            return null; // no record yet → triggers onboarding
          })(),
          _timeout(8000),
        ]);
      } catch (_) {}
    }

    _authResolved = true;
    _notify();
  });
});

const Auth = {

  /** Current Firebase user (null if signed out) */
  get user() { return _currentUser; },

  /** Current resident record (null if not registered or not yet loaded) */
  get resident() { return _currentResident; },

  /** True once Firebase has resolved initial auth state */
  get resolved() { return _authResolved; },

  /**
   * Subscribe to auth + resident changes.
   * @param {Function} fn — called with { user, resident, role }
   * @returns {Function} unsubscribe
   */
  onChange(fn) {
    _listeners.add(fn);
    if (_authResolved) {
      const role = !_currentUser ? 'guest'
        : _isSuperAdmin(_currentUser)       ? 'superadmin'
        : _currentResident?.isAdmin         ? 'admin'
        : 'registered';
      fn({ user: _currentUser, resident: _currentResident, role });
    }
    return () => _listeners.delete(fn);
  },

  /**
   * Re-fetch the resident record and notify all listeners.
   * Call after a registration or profile update.
   */
  async refreshResident() {
    if (!_currentUser) return;
    try { _currentResident = await residentService.get(_currentUser.uid); } catch (_) {}
    _notify();
  },

  /**
   * Wait for auth to resolve (use on page load).
   * @returns {Promise<user|null>}
   */
  waitForUser() {
    if (_authResolved) return Promise.resolve(_currentUser);
    return new Promise(resolve => {
      const unsub = this.onChange(({ user }) => { unsub(); resolve(user); });
    });
  },

  /**
   * Sign out — clears cache and redirects.
   */
  async signOut() {
    cache.clear();
    try { await fetch('https://telegram.psots.in/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) { /* ignore */ }
    await signOut(auth).catch(() => {});
    window.location.href = '/residents.html';
  },

  /**
   * Guard: redirect to login if not signed in.
   */
  async requireAuth(redirectTo = '/residents.html') {
    const user = await this.waitForUser();
    if (!user) { window.location.href = redirectTo; return null; }
    return user;
  },

  /**
   * Guard: redirect if not an admin.
   */
  async requireAdmin(adminEmails = []) {
    const user = await this.waitForUser();
    if (!user) { window.location.href = '/residents.html'; return null; }
    const isAdmin = user.email === SUPER_ADMIN || adminEmails.includes(user.email);
    if (!isAdmin) { window.location.href = '/'; return null; }
    return user;
  },

  /** Is current user the super admin */
  isSuperAdmin() {
    return _currentUser?.email === SUPER_ADMIN;
  },
};

export default Auth;
