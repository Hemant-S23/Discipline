// ============================================================
// auth.js — User Authentication, Cloud Data Sync & Account Management
// ============================================================

import {
  loadFirebase, isFirebaseConfigured, auth, db, googleProvider,
  firebaseAuth, firebaseFirestore
} from './firebase-config.js';
import { getUser, updateUser, save, load, KEYS, resetAllData } from './data.js';
import { showToast, closeModal } from './ui.js';

let currentAuthUser = null;

export function getAuthUser() {
  return currentAuthUser;
}

export async function initAuth(onUserChange) {
  const ready = await loadFirebase();
  if (!ready || !auth) {
    console.log('Discipline running in local storage mode');
    return;
  }

  firebaseAuth.onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      currentAuthUser = firebaseUser;
      const user = getUser();
      if (firebaseUser.displayName && !user.nameCustomized) {
        updateUser({ name: firebaseUser.displayName, email: firebaseUser.email });
      } else {
        updateUser({ email: firebaseUser.email });
      }

      await syncCloudData(firebaseUser.uid);
      showToast(`Welcome back, ${firebaseUser.displayName || user.name}! ☁️`, 'info');
    } else {
      currentAuthUser = null;
      updateUser({ email: null });
    }

    if (typeof onUserChange === 'function') onUserChange(currentAuthUser);
  });
}

export async function syncCloudData(uid) {
  if (!isFirebaseConfigured || !db) return;
  try {
    const userDocRef = firebaseFirestore.doc(db, 'users', uid);
    const snap = await firebaseFirestore.getDoc(userDocRef);

    if (snap.exists()) {
      const cloudData = snap.data();
      if (cloudData.habits)       save(KEYS.HABITS, cloudData.habits);
      if (cloudData.completions)  save(KEYS.COMPLETIONS, cloudData.completions);
      if (cloudData.checkins)     save(KEYS.CHECKINS, cloudData.checkins);
      if (cloudData.achievements) save(KEYS.ACHIEVEMENTS, cloudData.achievements);
      if (cloudData.rewards)      save(KEYS.REWARDS, cloudData.rewards);
      if (cloudData.userProfile)  save(KEYS.USER, cloudData.userProfile);
    } else {
      await uploadLocalDataToCloud(uid);
    }
  } catch (e) {
    console.error('Error syncing cloud data:', e);
  }
}

export async function uploadLocalDataToCloud(uid) {
  if (!isFirebaseConfigured || !db) return;
  try {
    const userDocRef = firebaseFirestore.doc(db, 'users', uid);
    const payload = {
      habits: load(KEYS.HABITS, []),
      completions: load(KEYS.COMPLETIONS, []),
      checkins: load(KEYS.CHECKINS, []),
      achievements: load(KEYS.ACHIEVEMENTS, []),
      rewards: load(KEYS.REWARDS, []),
      userProfile: getUser(),
      lastSyncedAt: new Date().toISOString()
    };
    await firebaseFirestore.setDoc(userDocRef, payload, { merge: true });
  } catch (e) {
    console.error('Error uploading data to cloud:', e);
  }
}

export async function loginWithEmail(email, password) {
  const ready = await loadFirebase();
  if (!ready || !auth) {
    updateUser({ email, name: email.split('@')[0] });
    showToast('✓ Logged in (Local Mode)', 'success');
    closeModal('modal-auth');
    return true;
  }

  try {
    const cred = await firebaseAuth.signInWithEmailAndPassword(auth, email, password);
    closeModal('modal-auth');
    showToast('✓ Successfully signed in! ☁️', 'success');
    return cred.user;
  } catch (err) {
    showToast(getAuthErrorMessage(err.code), 'error');
    throw err;
  }
}

export async function signUpWithEmail(email, password, name) {
  const ready = await loadFirebase();
  if (!ready || !auth) {
    updateUser({ email, name: name || email.split('@')[0] });
    showToast('✓ Account created (Local Mode)', 'success');
    closeModal('modal-auth');
    return true;
  }

  try {
    const cred = await firebaseAuth.createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await firebaseAuth.updateProfile(cred.user, { displayName: name });
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

export async function loginWithGoogle() {
  const ready = await loadFirebase();
  if (!ready || !auth) {
    showToast('Firebase Config required for Google Sign-In', 'info');
    return false;
  }

  try {
    const cred = await firebaseAuth.signInWithPopup(auth, googleProvider);
    closeModal('modal-auth');
    showToast('✓ Signed in with Google! 🌐', 'success');
    return cred.user;
  } catch (err) {
    showToast('Google Sign-in cancelled or failed', 'error');
    throw err;
  }
}

export async function resetPassword(email) {
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  const ready = await loadFirebase();
  if (!ready || !auth) {
    showToast('Password reset email sent (Demo Mode)', 'info');
    return;
  }
  try {
    await firebaseAuth.sendPasswordResetEmail(auth, email);
    showToast('✓ Password reset link sent to your email!', 'success');
  } catch (err) {
    showToast(getAuthErrorMessage(err.code), 'error');
  }
}

export async function logoutUser() {
  if (isFirebaseConfigured && auth) {
    await firebaseAuth.signOut(auth);
  }
  updateUser({ email: null });
  showToast('Logged out. Switched to guest mode 👋', 'info');
}

export async function deleteAccountAndData() {
  const user = auth?.currentUser;
  if (user) {
    try {
      if (db) {
        await firebaseFirestore.deleteDoc(firebaseFirestore.doc(db, 'users', user.uid));
      }
      await firebaseAuth.deleteUser(user);
    } catch (e) {
      console.error('Error deleting cloud account:', e);
    }
  }

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
