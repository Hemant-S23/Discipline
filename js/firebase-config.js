// ============================================================
// firebase-config.js — Firebase modular SDK v10 initialization
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser,
  sendPasswordResetEmail, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Replace with your Firebase Project Configuration keys from Firebase Console
export const firebaseConfig = {
  apiKey: "AIzaSyDemoConfigKeyForDisciplineAppProject123",
  authDomain: "discipline-app-prod.firebaseapp.com",
  projectId: "discipline-app-prod",
  storageBucket: "discipline-app-prod.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890"
};

let app = null;
let auth = null;
let db = null;
let googleProvider = null;
let isFirebaseConfigured = false;

try {
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('DemoConfigKey')) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    isFirebaseConfigured = true;
  }
} catch (e) {
  console.warn('Firebase initialization fallback active:', e);
}

export {
  app, auth, db, googleProvider, isFirebaseConfigured,
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser, sendPasswordResetEmail, updateProfile,
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection
};
