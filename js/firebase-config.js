// ============================================================
// firebase-config.js — Firebase modular SDK v10 initialization
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged, deleteUser, sendPasswordResetEmail, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: "AIzaSyAetNpUHgujZ4dm-IzAVdIvsNpgiVLKPwM",
  authDomain: "discipline-59c8a.firebaseapp.com",
  projectId: "discipline-59c8a",
  storageBucket: "discipline-59c8a.firebasestorage.app",
  messagingSenderId: "356781067799",
  appId: "1:356781067799:web:734d6191c54eb4696ed652",
  measurementId: "G-TSDTDTDBKX"
};

let app = null;
let auth = null;
let db = null;
let googleProvider = null;
let isFirebaseConfigured = false;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    isFirebaseConfigured = true;
  }
} catch (e) {
  console.warn('Firebase initialization fallback active:', e);
}

export {
  app, auth, db, googleProvider, isFirebaseConfigured,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser, sendPasswordResetEmail, updateProfile,
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection
};
