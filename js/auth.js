// ============================================================
// auth.js — User Authentication, Cloud Data Sync & Account Management
// ============================================================

import {
  auth, db, googleProvider, isFirebaseConfigured,
  signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser, sendPasswordResetEmail, updateProfile,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
  sendEmailVerification,
  doc, setDoc, getDoc, deleteDoc
} from './firebase-config.js?v=4.2';
import { getUser, updateUser, save, load, KEYS, resetAllData } from './data.js?v=4.2';
import { showToast, closeModal, openModal } from './ui.js?v=4.2';
import { validateEmail } from './email-validator.js?v=4.2';

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
        const isPasswordProvider = firebaseUser.providerData && firebaseUser.providerData.some(p => p.providerId === 'password');

        if (isPasswordProvider && !firebaseUser.emailVerified) {
          console.log('Firebase user email is unverified:', firebaseUser.email);
          if (typeof onUserChange === 'function') onUserChange(null);
          return;
        }

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
      const localHabits = load(KEYS.HABITS, []);

      // If cloud has habits, restore them. If cloud is empty but local has habits (e.g. from onboarding), keep local & sync up!
      if (cloudData.habits && Array.isArray(cloudData.habits) && cloudData.habits.length > 0) {
        save(KEYS.HABITS, cloudData.habits);
      } else if (localHabits.length > 0) {
        await uploadLocalDataToCloud(uid);
      }

      if (cloudData.completions && Array.isArray(cloudData.completions) && cloudData.completions.length > 0) {
        save(KEYS.COMPLETIONS, cloudData.completions);
      }
      if (cloudData.checkins && Array.isArray(cloudData.checkins) && cloudData.checkins.length > 0) {
        save(KEYS.CHECKINS, cloudData.checkins);
      }
      if (cloudData.achievements && Array.isArray(cloudData.achievements) && cloudData.achievements.length > 0) {
        save(KEYS.ACHIEVEMENTS, cloudData.achievements);
      }
      if (cloudData.rewards && Array.isArray(cloudData.rewards) && cloudData.rewards.length > 0) {
        save(KEYS.REWARDS, cloudData.rewards);
      }
      if (cloudData.userProfile) {
        save(KEYS.USER, { ...getUser(), ...cloudData.userProfile });
      }
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

export async function loginWithEmail(rawEmail, password) {
  const validation = validateEmail(rawEmail);
  if (!validation.isValid) {
    showToast(validation.error, 'error', 5000);
    throw new Error(validation.error);
  }
  const email = validation.normalizedEmail;

  if (isFirebaseConfigured && auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      currentAuthUser = cred.user;

      // Check if email is verified for password users
      if (!cred.user.emailVerified) {
        showEmailVerificationModal(cred.user.email);
        showToast('⚠️ Please verify your email first! We sent a link to your inbox.', 'warning', 5000);
        throw new Error('Email not verified. Please check your inbox.');
      }

      await syncCloudData(cred.user.uid);
      closeModal('modal-auth');
      showToast('✓ Successfully signed in! ☁️', 'success');
      updateUser({ email: cred.user.email, name: cred.user.displayName || email.split('@')[0], isLoggedIn: true, authDone: true });
      if (window._updateAccountUI) window._updateAccountUI(cred.user);
      return cred.user;
    } catch (err) {
      console.warn('Firebase signIn error:', err.code);
      if (err.message && err.message.includes('Email not verified')) {
        throw err;
      }
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

export async function signUpWithEmail(rawEmail, password, name) {
  // Validate email with smart format, disposable domain blocker & typo suggestions
  const validation = validateEmail(rawEmail);
  if (!validation.isValid) {
    showToast(validation.error, 'error', 5000);
    throw new Error(validation.error);
  }
  const email = validation.normalizedEmail;

  if (isFirebaseConfigured && auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const userName = name || email.split('@')[0];
      await updateProfile(cred.user, { displayName: userName });
      currentAuthUser = cred.user;

      // Automatically dispatch verification email
      try {
        await sendEmailVerification(cred.user);
      } catch (evErr) {
        console.warn('sendEmailVerification note:', evErr);
      }

      closeModal('modal-auth');
      const landing = document.getElementById('landing-overlay');
      if (landing) landing.classList.add('hidden');

      showEmailVerificationModal(email);
      showToast('✓ Activation link sent to your email! ✉️', 'success', 5000);
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
      await syncCloudData(cred.user.uid);
      showToast('✓ Signed in with Google! 🌐', 'success');
      if (window._updateAccountUI) window._updateAccountUI(cred.user);
      return cred.user;
    } catch (err) {
      console.warn('Google Sign-In error:', err.code, err.message);
      if (err.code === 'auth/popup-blocked') {
        showToast('Popup was blocked by browser. Redirecting to Google...', 'info');
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        showToast('Google sign-in was cancelled.', 'info');
        return null;
      }
      const msg = getAuthErrorMessage(err.code);
      showToast(msg, 'error');
      throw err;
    }
  } else {
    const googleUser = { name: 'Google User', email: 'user.google@gmail.com' };
    updateUser({ name: googleUser.name, email: googleUser.email, isLoggedIn: true, authDone: true, nameCustomized: true });
    showToast('✓ Signed in with Google! 🌐', 'success');
    if (window._updateAccountUI) window._updateAccountUI(getUser());
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

export async function deleteAccountAndData(password = null) {
  const user = auth?.currentUser;

  if (user && isFirebaseConfigured) {
    // If password provided for email user, re-authenticate first to prevent 'auth/requires-recent-login'
    if (password && user.email) {
      try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      } catch (reauthErr) {
        console.warn('Password re-authentication failed:', reauthErr?.code);
        if (reauthErr?.code === 'auth/wrong-password' || reauthErr?.code === 'auth/invalid-credential') {
          throw new Error('Incorrect password. Please verify your password and try again.');
        }
      }
    }

    // 1. Delete user's document in Firestore (best-effort)
    if (db) {
      try {
        await deleteDoc(doc(db, 'users', user.uid));
      } catch (docErr) {
        console.warn('Could not delete user Firestore doc (permissions or non-existent):', docErr?.code, docErr);
      }
    }

    // 2. Delete the user from Firebase Authentication
    try {
      await deleteUser(user);
    } catch (authErr) {
      console.warn('deleteUser error:', authErr?.code, authErr?.message);

      if (authErr?.code === 'auth/requires-recent-login') {
        const isGoogleUser = user.providerData?.some(p => p.providerId === 'google.com');
        if (isGoogleUser) {
          try {
            await reauthenticateWithPopup(user, googleProvider);
            await deleteUser(user);
          } catch (googleReauthErr) {
            console.warn('Google re-auth failed or cancelled:', googleReauthErr?.code);
            throw new Error('Google security verification failed. Please try again.');
          }
        } else if (password) {
          try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            await deleteUser(user);
          } catch (passErr) {
            throw new Error('Incorrect password. Could not delete account.');
          }
        } else {
          throw new Error('Please enter your password to authorize account deletion.');
        }
      }
    }

    // Guarantee Firebase session is signed out so user is never kept logged in
    try {
      await signOut(auth);
    } catch (e) {}
  }

  // Remove from local registered accounts list if stored
  const currentUser = getUser();
  if (currentUser?.email) {
    const accounts = load('discipline_accounts', []).filter(a => a.email.toLowerCase() !== currentUser.email.toLowerCase());
    save('discipline_accounts', accounts);
  }

  // Clear all local app state & active reward
  try {
    localStorage.removeItem('discipline_active_reward');
    localStorage.removeItem('discipline_accounts');
  } catch(e) {}
  resetAllData();
  localStorage.removeItem(KEYS.USER);
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch(e) {}

  showToast('✓ Account and all data permanently deleted.', 'info');
  setTimeout(() => {
    location.hash = '';
    location.reload();
  }, 500);

  return { success: true };
}

export function showEmailVerificationModal(email) {
  const display = document.getElementById('verify-email-display');
  if (display) display.textContent = email || auth?.currentUser?.email || 'your email';
  closeModal('modal-auth');
  const landing = document.getElementById('landing-overlay');
  if (landing) landing.classList.add('hidden');
  openModal('modal-verify-email');
}

export async function checkEmailVerification() {
  if (!auth || !auth.currentUser) {
    showToast('No active session found. Please sign in.', 'error');
    return false;
  }

  try {
    await auth.currentUser.reload();
    const user = auth.currentUser;

    if (user.emailVerified) {
      const userName = user.displayName || user.email.split('@')[0];
      updateUser({
        name: userName,
        email: user.email,
        isLoggedIn: true,
        authDone: true,
        nameCustomized: true
      });
      await uploadLocalDataToCloud(user.uid);
      closeModal('modal-verify-email');
      showToast('✓ Email verified! Welcome to Discipline 🚀', 'success');
      if (window._updateAccountUI) window._updateAccountUI(user);
      if (typeof window.proceedAfterAuth === 'function') {
        window.proceedAfterAuth();
      }
      return true;
    } else {
      showToast('⚠️ Email not verified yet. Please check your inbox and click the verification link.', 'warning', 4500);
      return false;
    }
  } catch (err) {
    console.warn('Error checking verification:', err);
    showToast('Failed to check verification status. Please try again.', 'error');
    return false;
  }
}

let resendCooldown = 0;
export async function resendVerification() {
  if (!auth || !auth.currentUser) {
    showToast('No active session. Please sign in.', 'error');
    return;
  }
  if (resendCooldown > 0) {
    showToast(`Please wait ${resendCooldown}s before resending.`, 'info');
    return;
  }

  try {
    await sendEmailVerification(auth.currentUser);
    showToast('✓ Verification email resent! Check your inbox.', 'success');
    
    resendCooldown = 30;
    const btn = document.getElementById('btn-resend-verification');
    const timer = setInterval(() => {
      resendCooldown--;
      if (btn) {
        btn.textContent = resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email';
        btn.disabled = resendCooldown > 0;
      }
      if (resendCooldown <= 0) clearInterval(timer);
    }, 1000);
  } catch (err) {
    console.warn('Resend verification error:', err);
    if (err.code === 'auth/too-many-requests') {
      showToast('Too many requests. Please check your spam folder or wait a bit.', 'warning');
    } else {
      showToast('Could not resend email. Please try again shortly.', 'error');
    }
  }
}

export async function cancelEmailVerification() {
  if (auth && auth.currentUser) {
    try {
      await signOut(auth);
    } catch (e) {}
  }
  closeModal('modal-verify-email');
  const landing = document.getElementById('landing-overlay');
  const user = getUser();
  if (!user.authDone && landing) {
    landing.classList.remove('hidden');
  }
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
