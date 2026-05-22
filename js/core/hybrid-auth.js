/**
 * hybrid-auth.js — Firebase Auth helper for Google and Email/Password login.
 */

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, updateDoc, increment, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import residentService from '../services/resident.service.js';

let _currentUser = null;
let _currentResident = null;
let _authResolved = false;
const _listeners = new Set();

function _notify() {
  _listeners.forEach(fn => fn({
    user: _currentUser,
    resident: _currentResident
  }));
}

/**
 * Track login activity for analytics
 */
async function _trackLogin(firebaseUser, residentData) {
  console.log('[hybrid-auth] _trackLogin called with:', {
    firebaseUserUid: firebaseUser?.uid,
    residentData
  });

  try {
    // Skip tracking if no resident data
    // Note: Worker returns 'residentId', not 'uid'
    const residentUid = residentData?.uid || residentData?.residentId;
    if (!residentData || !residentUid) {
      console.warn('[hybrid-auth] ⚠️ No resident data available, skipping login tracking');
      return;
    }

    // Check last login time from localStorage to prevent counting page refreshes as logins
    const lastLoginKey = `psots_last_login_${residentUid}`;
    const lastLoginTime = localStorage.getItem(lastLoginKey);
    const now = Date.now();

    // Only track if last login was more than 1 hour ago (or never)
    if (lastLoginTime) {
      const timeSinceLastLogin = now - parseInt(lastLoginTime);
      const oneHour = 60 * 60 * 1000;

      if (timeSinceLastLogin < oneHour) {
        console.log('[hybrid-auth] ⏭️ Skipping login tracking - last login was less than 1 hour ago');
        return;
      }
    }

    // Get user agent details
    const ua = navigator.userAgent;
    let device = 'Desktop';
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
      device = 'Mobile';
    } else if (/Tablet|iPad/i.test(ua)) {
      device = 'Tablet';
    }

    // Determine login method
    const loginMethod = localStorage.getItem('psots_login_method') ||
                       (firebaseUser.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email');
    const residentRef = doc(db, 'residents', residentUid);

    // Check if document exists first
    const docSnap = await getDoc(residentRef);
    if (docSnap.exists()) {
      await updateDoc(residentRef, {
        lastLogin: new Date().toISOString(),
        loginCount: increment(1),
        lastLoginMethod: loginMethod,
        lastLoginDevice: device
      });

      // Save timestamp to localStorage to prevent duplicate tracking
      localStorage.setItem(lastLoginKey, now.toString());

      console.log('[hybrid-auth] ✅ Login tracked:', { loginMethod, device, uid: residentUid });
    } else {
      console.warn('[hybrid-auth] ⚠️ Resident document not found, cannot track login:', residentUid);
    }
  } catch (err) {
    console.error('[hybrid-auth] Error tracking login:', err);
  }
}

export async function setupHybridAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Don't resolve on first null - wait for Firebase to fully initialize
      if (firebaseUser === null && !_authResolved) {
        setTimeout(async () => {
          if (!_currentUser) {
            _authResolved = true;
            unsubscribe();
            resolve({ user: null, resident: null });
          }
        }, 500);
        return;
      }

      _currentUser = firebaseUser;
      _currentResident = null;

      if (firebaseUser) {
        if (!firebaseUser.email) {
          _authResolved = true;
          _notify();
          unsubscribe();
          resolve({ user: _currentUser, resident: null });
          return;
        }
        try {
          const idToken = await firebaseUser.getIdToken();
          const residentRes = await fetch(
            'https://telegram.psots.in/auth/unified-login',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                type: 'google',
                identifier: firebaseUser.email
              })
            }
          );
          const residentData = await residentRes.json();
          console.log('[hybrid-auth] Resident data from Worker:', residentData);
          console.log('[hybrid-auth] residentData.resident:', residentData.resident);
          console.log('[hybrid-auth] residentData.resident?.uid:', residentData.resident?.uid);
          _currentResident = residentData.resident || null;

          // Track login activity for analytics
          await _trackLogin(firebaseUser, residentData.resident);

          // Don't redirect - just set resident to null if not found
          // Pages can handle this individually
        } catch (err) {
          console.error('[hybrid-auth] Error fetching resident:', err);
        }

        _authResolved = true;
        _notify();
        unsubscribe();
        resolve({ user: _currentUser, resident: _currentResident });
      }
    });
  });
}

export async function requireAuth(redirectTo = '/society/login') {
  await setupHybridAuth();

  if (!_currentUser) {
    window.location.href = redirectTo;
    return null;
  }

  return { user: _currentUser, resident: _currentResident };
}

export async function requireAdmin(redirectTo = '/society/') {
  const { user, resident } = await requireAuth(redirectTo);

  if (!resident?.isAdmin) {
    window.location.href = redirectTo;
    return null;
  }

  return { user, resident };
}

export function onChange(fn) {
  _listeners.add(fn);
  if (_authResolved) {
    fn({ user: _currentUser, resident: _currentResident });
  }
  return () => _listeners.delete(fn);
}

export function getUser() {
  return _currentUser;
}

export function getResident() {
  return _currentResident;
}

export async function signOutUser() {
  localStorage.removeItem('psots_login_method');
  localStorage.removeItem('psots_device_token');
  await signOut(auth).catch(() => {});
  window.location.href = '/society/login';
}
