// ============================================================
// firebase-config.js — Safe, Resilient Firebase SDK v10 Loader
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDemoConfigKeyForDisciplineAppProject123",
  authDomain: "discipline-app-prod.firebaseapp.com",
  projectId: "discipline-app-prod",
  storageBucket: "discipline-app-prod.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890"
};

export let app = null;
export let auth = null;
export let db = null;
export let googleProvider = null;
export let isFirebaseConfigured = false;

export let firebaseAuth = {};
export let firebaseFirestore = {};

/**
 * Lazy Load Firebase SDK dynamically without blocking app startup
 */
export async function loadFirebase() {
  if (isFirebaseConfigured) return true;
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('DemoConfigKey')) {
    return false;
  }
  try {
    const firebaseApp = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const authMod     = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const dbMod       = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

    app = firebaseApp.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = dbMod.getFirestore(app);
    googleProvider = new authMod.GoogleAuthProvider();
    firebaseAuth = authMod;
    firebaseFirestore = dbMod;
    isFirebaseConfigured = true;
    return true;
  } catch (e) {
    console.warn('Firebase network fallback active:', e);
    return false;
  }
}
