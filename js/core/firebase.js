/**
 * firebase.js — Single Firebase instance for entire PSOTS platform.
 * Import from here everywhere. Never initialize Firebase twice.
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const CONFIG = {
  apiKey:            'AIzaSyDlPQyaoMArpXp80rkWNCGrVJAY7nEaEUQ',
  authDomain:        'psots-society-25899.firebaseapp.com',
  projectId:         'psots-society-25899',
  storageBucket:     'psots-society-25899.firebasestorage.app',
  messagingSenderId: '425000196275',
  appId:             '1:425000196275:web:7b7498bc72f58a4df178c6'
};

const app  = getApps().length === 0 ? initializeApp(CONFIG) : getApps()[0];
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };
