/**
 * js/core/db.js — Adapter layer for Firestore client SDK.
 * Wraps Firebase client SDK operations in a consistent interface.
 * All frontend services import from here, not from firebase.js directly.
 */

import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, getDocs, addDoc, onSnapshot,
  where, orderBy, limit, serverTimestamp, arrayUnion, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Firestore Primitives ──────────────────────────────────
// Re-export commonly used Firestore functions
export {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, getDocs, addDoc, onSnapshot,
  where, orderBy, limit, serverTimestamp, arrayUnion, writeBatch
};

// ── Database Instance ─────────────────────────────────────
export { db };
