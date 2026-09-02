// ============================================================
// auth.js — User Authentication, Cloud Data Sync & Account Management
// ============================================================

import {
  auth, db, googleProvider, isFirebaseConfigured,
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser, sendPasswordResetEmail, updateProfile,
  doc, setDoc, getDoc, deleteDoc
} from './firebase-config.js';
import { getUser, updateUser, save, load, KEYS, resetAllData } from './data.js';
import { showToast, closeModal } from './ui.js';

let currentAuthUser = null;

export function getAuthUser() {
  return currentAuthUser;
}

/**
 * Initialize Authentication Listener
 */
export function initAuth(onUserChange) {
  if (!isFirebaseConfigured || !auth) {
    console.log('Discipline running in local storage mode (Firebase config pending)');
    return;
  }

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      currentAuthUser = firebaseUser;
      // Sync local profile name
      const user = getUser();
      if (firebaseUser.displayName && !user.nameCustomized) {
        updateUser({ name: firebaseUser.displayName, email: firebaseUser.email });
      } else {
        updateUser({ email: firebaseUser.email });
      }

      // Sync cloud data
      await syncCloudData(firebaseUser.uid);
      showToast(`Welcome back, ${firebaseUser.displayName || user.name}! ☁️`, 'info');
    } else {
      currentAuthUser = null;
      updateUser({ email: null });
    }

    if (typeof onUserChange === 'function') onUserChange(currentAuthUser);
  });
}

/**
 * Sync Cloud Data from Firestore
 */
export async function syncCloudData(uid) {
  if (!isFirebaseConfigured || !db) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const cloudData = snap.data();
      if (cloudData.habits)       save(KEYS.HABITS, cloudData.habits);
      if (cloudData.completions)  save(KEYS.COMPLETIONS, cloudData.completions);
      if (cloudData.checkins)     save(KEYS.CHECKINS, cloudData.checkins);
      if (cloudData.achievements) save(KEYS.ACHIEVEMENTS, cloudData.achievements);
      if (cloudData.rewards)      save(KEYS.REWARDS, cloudData.rewards);
      if (cloudData.userProfile)  save(KEYS.USER, cloudData.userProfile);
    } else {
      // First time cloud sync: Upload current local data to Firestore
      await uploadLocalDataToCloud(uid);
    }
  } catch (e) {
    console.error('Error syncing cloud data:', e);
  }
}

/**
 * Upload Local Storage Data to Cloud
 */
export async function uploadLocalDataToCloud(uid) {
  if (!isFirebaseConfigured || !db) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    const payload = {
      habits: load(KEYS.HABITS, []),
      completions: load(KEYS.COMPLETIONS, []),
      checkins: load(KEYS.CHECKINS, []),
      achievements: load(KEYS.ACHIEVEMENTS, []),
      rewards: load(KEYS.REWARDS, []),
      userProfile: getUser(),
      lastSyncedAt: new Date().toISOString()
    };
    await setDoc(userDocRef, payload, { merge: true });
  } catch (e) {
    console.error('Error uploading data to cloud:', e);
  }
}

/**
 * Login with Email & Password
 */
export async function loginWithEmail(email, password) {
  if (!isFirebaseConfigured || !auth) {
    // Fallback for demo
    updateUser({ email, name: email.split('@')[0] });
    showToast('✓ Logged in (Local Mode)', 'success');
    closeModal('modal-auth');
    return true;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    closeModal('modal-auth');
    showToast('✓ Successfully signed in! ☁️', 'success');
    return cred.user;
  } catch (err) {
    showToast(getAuthErrorMessage(err.code), 'error');
    throw err;
  }
}

/**
 * Sign Up with Email & Password
 */
export async function signUpWithEmail(email, password, name) {
  if (!isFirebaseConfigured || !auth) {
    updateUser({ email, name: name || email.split('@')[0] });
    showToast('✓ Account created (Local Mode)', 'success');
    closeModal('modal-auth');
    return true;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
      updateUser({ name, email, nameCustomized: true });
    }
    await uploadLocalDataToCloud(cred.user.uid);
    closeModal('modal-auth');
    showToast('✓ Account created! Cloud sync activated 🚀', 'success');
    return cred.user;
  } catch (err) {
    showToast(getAuthErrorMessage(err.code), 'error');
    throw err;
  }
}

/**
 * Login with Google 1-Tap Popup
 */
export async function loginWithGoogle() {
  if (!isFirebaseConfigured || !auth) {
    showToast('Firebase Config required for Google Sign-In', 'info');
    return false;
  }

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    closeModal('modal-auth');
    showToast('✓ Signed in with Google! 🌐', 'success');
    return cred.user;
  } catch (err) {
    showToast('Google Sign-in cancelled or failed', 'error');
    throw err;
  }
}

/**
 * Send Password Reset Email
 */
export async function resetPassword(email) {
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  if (!isFirebaseConfigured || !auth) {
    showToast('Password reset email sent (Demo Mode)', 'info');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('✓ Password reset link sent to your email!', 'success');
  } catch (err) {
    showToast(getAuthErrorMessage(err.code), 'error');
  }
}

/**
 * Logout User
 */
export async function logoutUser() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
  updateUser({ email: null });
  showToast('Logged out. Switched to guest mode 👋', 'info');
}

/**
 * Delete User Account & Cloud Data
 */
export async function deleteAccountAndData() {
  const user = auth?.currentUser;
  if (user) {
    try {
      // 1. Delete Firestore Data
      if (db) {
        await deleteDoc(doc(db, 'users', user.uid));
      }
      // 2. Delete Auth Account
      await deleteUser(user);
    } catch (e) {
      console.error('Error deleting cloud account:', e);
    }
  }

  // 3. Reset Local Data
  resetAllData();
  showToast('Account and all data permanently deleted', 'info');
  setTimeout(() => location.reload(), 1000);
}

function getAuthErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email': return 'Invalid email address';
    case 'auth/user-disabled': return 'This user account has been disabled';
    case 'auth/user-not-found': return 'No account found with this email';
    case 'auth/wrong-password': return 'Incorrect password';
    case 'auth/email-already-in-use': return 'An account with this email already exists';
    case 'auth/weak-password': return 'Password should be at least 6 characters';
    default: return 'Authentication failed. Please try again.';
  }
}
