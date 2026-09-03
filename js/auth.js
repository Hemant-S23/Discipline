// ============================================================
// auth.js — User Authentication, Cloud Data Sync & Account Management
// ============================================================

import {
  auth, db, googleProvider, isFirebaseConfigured,
  signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser, sendPasswordResetEmail, updateProfile,
  doc, setDoc, getDoc, deleteDoc
} from './firebase-config.js';
import { getUser, updateUser, save, load, KEYS, resetAllData } from './data.js';
import { showToast, closeModal } from './ui.js';

let currentAuthUser = null;

export function getAuthUser() {
  return currentAuthUser;
}

// Called by bootApp() BEFORE any routing — checks if we just came back from Google redirect
export async function handleRedirectResult() {
  if (!isFirebaseConfigured || !auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      currentAuthUser = result.user;
      const name = result.user.displayName || result.user.email.split('@')[0];
      updateUser({
        email: result.user.email,
        name,
        isLoggedIn: true,
        authDone: true,
        nameCustomized: true
      });
      await uploadLocalDataToCloud(result.user.uid);
      showToast('✓ Signed in with Google! 🌐', 'success');
      return result.user;
    }
  } catch (err) {
    const ignoredCodes = [
      'auth/no-redirect-operation-pending',
      'auth/null-user'
    ];
    if (!ignoredCodes.includes(err.code)) {
      console.warn('Redirect result error:', err.code, err.message);
      showToast(getAuthErrorMessage(err.code), 'error');
    }
  }
  return null;
}

export async function initAuth(onUserChange) {
  if (isFirebaseConfigured && auth) {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        currentAuthUser = firebaseUser;
        const user = getUser();
        if (firebaseUser.displayName && !user.nameCustomized) {
          updateUser({ name: firebaseUser.displayName, email: firebaseUser.email, isLoggedIn: true, authDone: true });
        } else {
          updateUser({ email: firebaseUser.email, isLoggedIn: true, authDone: true });
        }
        await syncCloudData(firebaseUser.uid);
      } else {
        currentAuthUser = null;
      }
      if (typeof onUserChange === 'function') onUserChange(currentAuthUser || getUser());
    });
  } else {
    const user = getUser();
    if (typeof onUserChange === 'function') onUserChange(user.email ? user : null);
  }
}

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
      await uploadLocalDataToCloud(uid);
    }
  } catch (e) {
    console.error('Error syncing cloud data:', e);
  }
}

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

export async function loginWithEmail(email, password) {
  if (isFirebaseConfigured && auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      closeModal('modal-auth');
      showToast('✓ Successfully signed in! ☁️', 'success');
      updateUser({ email: cred.user.email, name: cred.user.displayName || email.split('@')[0], isLoggedIn: true, authDone: true });
      if (window._updateAccountUI) window._updateAccountUI(cred.user);
      return cred.user;
    } catch (err) {
      console.warn('Firebase signIn error:', err.code);
      const msg = getAuthErrorMessage(err.code);
      showToast(msg, 'error');
      throw err;
    }
  } else {
    // Local Registered Accounts Validation
    const accounts = load('discipline_accounts', []);
    const existing = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!existing) {
      const errorMsg = '⚠️ No account found with this email. Please switch to Create Account!';
      showToast(errorMsg, 'error');
      throw new Error(errorMsg);
    }

    if (existing.password !== password) {
      const errorMsg = '⚠️ Incorrect password. Please check and try again.';
      showToast(errorMsg, 'error');
      throw new Error(errorMsg);
    }

    updateUser({ email: existing.email, name: existing.name || email.split('@')[0], isLoggedIn: true, authDone: true, nameCustomized: true });
    closeModal('modal-auth');
    showToast(`✓ Welcome back, ${existing.name || email.split('@')[0]}! 🔐`, 'success');
    if (window._updateAccountUI) window._updateAccountUI(getUser());
    return { email: existing.email, displayName: existing.name };
  }
}

export async function signUpWithEmail(email, password, name) {
  if (isFirebaseConfigured && auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const userName = name || email.split('@')[0];
      await updateProfile(cred.user, { displayName: userName });
      updateUser({ name: userName, email: cred.user.email, isLoggedIn: true, authDone: true, nameCustomized: true });
      await uploadLocalDataToCloud(cred.user.uid);
      closeModal('modal-auth');
      showToast('✓ Account created! Cloud sync activated 🚀', 'success');
      if (window._updateAccountUI) window._updateAccountUI(cred.user);
      return cred.user;
    } catch (err) {
      console.warn('Firebase signUp error:', err.code);
      const msg = getAuthErrorMessage(err.code);
      showToast(msg, 'error');
      throw err;
    }
  } else {
    // Local Account Creation Validation
    const accounts = load('discipline_accounts', []);
    const existing = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      const errorMsg = '⚠️ An account with this email already exists. Please switch to Sign In!';
      showToast(errorMsg, 'error');
      throw new Error(errorMsg);
    }

    const userName = name || email.split('@')[0];
    const newAcc = { email, password, name: userName, createdAt: new Date().toISOString() };
    accounts.push(newAcc);
    save('discipline_accounts', accounts);

    updateUser({ name: userName, email, isLoggedIn: true, authDone: true, nameCustomized: true });
    closeModal('modal-auth');
    showToast(`✓ Account created for ${userName}! 🚀`, 'success');
    if (window._updateAccountUI) window._updateAccountUI(getUser());
    return { email, displayName: userName };
  }
}

export async function loginWithGoogle() {
  if (isFirebaseConfigured && auth) {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const name = cred.user.displayName || cred.user.email.split('@')[0];
      updateUser({ email: cred.user.email, name, isLoggedIn: true, authDone: true, nameCustomized: true });
      await uploadLocalDataToCloud(cred.user.uid);
      showToast('✓ Signed in with Google! 🌐', 'success');
      return cred.user;
    } catch (err) {
      console.warn('Google Sign-In error:', err.code);
      showToast(getAuthErrorMessage(err.code), 'error');
      throw err;
    }
  } else {
    const googleUser = { name: 'Google User', email: 'user.google@gmail.com' };
    updateUser({ name: googleUser.name, email: googleUser.email, isLoggedIn: true, authDone: true, nameCustomized: true });
    showToast('✓ Signed in with Google! 🌐', 'success');
    return googleUser;
  }
}

export async function resetPassword(email) {
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  if (isFirebaseConfigured && auth) {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('✓ Password reset link sent to your email!', 'success');
    } catch (err) {
      showToast(getAuthErrorMessage(err.code), 'error');
    }
  } else {
    showToast(`✓ Password reset email sent to ${email}`, 'success');
  }
}

export async function logoutUser() {
  if (isFirebaseConfigured && auth) {
    try { await signOut(auth); } catch(e) {}
  }
  updateUser({ email: null, isLoggedIn: false, isGuest: false, authDone: false });
  showToast('Logged out. Switched to guest mode 👋', 'info');
  if (window._updateAccountUI) window._updateAccountUI(null);
}

export async function deleteAccountAndData() {
  const user = auth?.currentUser;
  if (user && isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
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
    case 'auth/invalid-email': return '⚠️ Invalid email address format.';
    case 'auth/user-disabled': return '⚠️ This user account has been disabled.';
    case 'auth/user-not-found': return '⚠️ No account found with this email. Please switch to Create Account!';
    case 'auth/wrong-password': return '⚠️ Incorrect password. Please check and try again.';
    case 'auth/invalid-credential': return '⚠️ No account found with these credentials. Please switch to Create Account!';
    case 'auth/email-already-in-use': return '⚠️ An account with this email already exists. Please switch to Sign In!';
    case 'auth/weak-password': return '⚠️ Password should be at least 6 characters.';
    case 'auth/unauthorized-domain': return '⚠️ Domain not authorized. Go to Firebase Console → Authentication → Settings → Authorized Domains and add your site.';
    case 'auth/operation-not-allowed': return '⚠️ This sign-in method is not enabled. Please enable it in Firebase Console.';
    case 'auth/popup-blocked': return '⚠️ Popup was blocked by browser. Redirecting to Google sign-in...';
    case 'auth/popup-closed-by-user': return '⚠️ Sign-in was cancelled. Please try again.';
    case 'auth/cancelled-popup-request': return '⚠️ Sign-in cancelled. Please try again.';
    case 'auth/network-request-failed': return '⚠️ Network error. Please check your internet connection.';
    case 'auth/too-many-requests': return '⚠️ Too many failed attempts. Please try again later.';
    default: return `⚠️ Authentication failed. (${code || 'unknown'}). Please check your credentials or try again.`;
  }
}
