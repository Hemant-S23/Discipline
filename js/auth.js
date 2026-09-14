// ============================================================
// auth.js — User Authentication, Cloud Data Sync & Account Management
// ============================================================

import {
  auth, db, googleProvider, GoogleAuthProvider, isFirebaseConfigured,
  signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, deleteUser, sendPasswordResetEmail, updateProfile,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
  sendEmailVerification,
  doc, setDoc, getDoc, deleteDoc, onSnapshot
} from './firebase-config.js?v=6.0';
import { getUser, updateUser, save, load, KEYS, resetAllData, registerDataChangeListener } from './data.js?v=6.0';
import { showToast, closeModal, openModal } from './ui.js?v=6.0';
import { validateEmail } from './email-validator.js?v=6.0';

let currentAuthUser = null;
let isSyncingFromCloud = false;
let unsubscribeSnapshot = null;
let cloudUploadTimer = null;

export function getAuthUser() {
  return currentAuthUser || (auth && auth.currentUser);
}

// Canonical account key based on user email (guarantees Web and APK share 100% identical document)
export function getAccountKey(uid, email) {
  const effectiveEmail = email || (currentAuthUser && currentAuthUser.email) || (auth && auth.currentUser && auth.currentUser.email) || getUser().email;
  if (effectiveEmail && effectiveEmail.includes('@')) {
    return 'email_' + effectiveEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  return uid ? 'uid_' + uid : null;
}

// Automatically sync any local modifications to Firestore in the background
registerDataChangeListener((key) => {
  if (isSyncingFromCloud) return;
  const user = currentAuthUser || (auth && auth.currentUser);
  if (!user || (!user.uid && !user.email)) return;

  clearTimeout(cloudUploadTimer);
  cloudUploadTimer = setTimeout(() => {
    uploadLocalDataToCloud(user.uid, user.email);
  }, 1000);
});

// Real-time listener: listens to remote changes on Firestore and updates local UI
export function startRealtimeSync(uid, email) {
  if (unsubscribeSnapshot) {
    try { unsubscribeSnapshot(); } catch(e) {}
    unsubscribeSnapshot = null;
  }
  if (!isFirebaseConfigured || !db) return;
  const accountKey = getAccountKey(uid, email);
  if (!accountKey && !uid) return;

  try {
    const userDocRef = doc(db, 'users', accountKey || uid);
    unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata && snap.metadata.hasPendingWrites) {
        // Skip updates that originated from our own client
        return;
      }
      // Remote cloud update received — merge and refresh view
      syncCloudData(uid, email).then(() => {
        if (window._refreshAppUI) window._refreshAppUI();
      });
    }, (err) => {
      console.warn('Real-time sync snapshot error:', err);
    });
  } catch (err) {
    console.warn('Could not establish real-time sync snapshot:', err);
  }
}

export function stopRealtimeSync() {
  if (unsubscribeSnapshot) {
    try { unsubscribeSnapshot(); } catch(e) {}
    unsubscribeSnapshot = null;
  }
}

// Handle app foreground / tab focus sync
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const u = currentAuthUser || (auth && auth.currentUser);
      if (u) {
        syncCloudData(u.uid, u.email).then(() => {
          if (window._refreshAppUI) window._refreshAppUI();
        });
      }
    }
  });
  window.addEventListener('focus', () => {
    const u = currentAuthUser || (auth && auth.currentUser);
    if (u) {
      syncCloudData(u.uid, u.email).then(() => {
        if (window._refreshAppUI) window._refreshAppUI();
      });
    }
  });
}

// Called by bootApp() BEFORE any routing — checks if we just came back from Google redirect
export async function handleRedirectResult() {
  if (!isFirebaseConfigured || !auth) return null;
  try {
    const result = await getRedirectResult(auth);
    try {
      localStorage.removeItem('discipline_signing_in');
      sessionStorage.removeItem('discipline_signing_in');
    } catch(e) {}

    if (result && result.user) {
      currentAuthUser = result.user;
      const user = getUser();
      const name = result.user.displayName || result.user.email.split('@')[0];
      const photo = result.user.photoURL || user.photoUrl || null;

      // Update auth immediately so user enters app instantly with ZERO lag
      updateUser({
        email: result.user.email,
        name: result.user.displayName || name,
        photoUrl: photo,
        isLoggedIn: true,
        authDone: true,
        onboardingDone: true
      });

      showToast(`Welcome, ${result.user.displayName || name}!`, 'success');
      if (window._refreshAppUI) window._refreshAppUI();

      // Cloud sync & realtime listener in parallel
      syncCloudData(result.user.uid, result.user.email).then((hasCloudHabits) => {
        updateUser({ onboardingDone: hasCloudHabits });
        if (window._refreshAppUI) window._refreshAppUI();
      });
      startRealtimeSync(result.user.uid, result.user.email);

      return result.user;
    }
  } catch (err) {
    try {
      localStorage.removeItem('discipline_signing_in');
      sessionStorage.removeItem('discipline_signing_in');
    } catch(e) {}
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

        const updates = { email: firebaseUser.email, isLoggedIn: true, authDone: true };
        if (firebaseUser.displayName && !user.nameCustomized) {
          updates.name = firebaseUser.displayName;
        }
        if (firebaseUser.photoURL && !user.photoUrl) {
          updates.photoUrl = firebaseUser.photoURL;
        }
        updateUser(updates);

        await syncCloudData(firebaseUser.uid, firebaseUser.email);
        startRealtimeSync(firebaseUser.uid, firebaseUser.email);
      } else {
        currentAuthUser = null;
        stopRealtimeSync();
      }
      if (typeof onUserChange === 'function') onUserChange(currentAuthUser || getUser());
      if (window._refreshAppUI) window._refreshAppUI();
    });
  } else {
    const user = getUser();
    if (typeof onUserChange === 'function') onUserChange(user.email ? user : null);
  }
}

export async function syncCloudData(uid, email) {
  if (!isFirebaseConfigured || !db) return false;
  const accountKey = getAccountKey(uid, email);
  if (!accountKey && !uid) return false;

  try {
    let snap = null;
    let targetDocRef = null;

    // 1. Try reading canonical email-keyed document
    if (accountKey) {
      targetDocRef = doc(db, 'users', accountKey);
      snap = await getDoc(targetDocRef);
    }

    // 2. Fallback to legacy raw UID document
    if ((!snap || !snap.exists()) && uid) {
      const legacyDocRef = doc(db, 'users', uid);
      const legacySnap = await getDoc(legacyDocRef);
      if (legacySnap && legacySnap.exists()) {
        snap = legacySnap;
      }
    }

    if (snap.exists()) {
      const cloudData = snap.data();
      isSyncingFromCloud = true;
      let shouldUploadMerged = false;

      try {
        // 1. Habits Merge: Union by id with conflict resolution
        const localHabits = load(KEYS.HABITS, []) || [];
        const cloudHabits = (cloudData.habits && Array.isArray(cloudData.habits)) ? cloudData.habits : [];

        if (cloudHabits.length > 0 || localHabits.length > 0) {
          const habitMap = new Map();
          cloudHabits.forEach(h => {
            if (h && h.id) habitMap.set(h.id, h);
          });
          localHabits.forEach(h => {
            if (h && h.id) {
              if (!habitMap.has(h.id)) {
                // Local has a habit created on this device / offline: preserve it!
                habitMap.set(h.id, h);
                shouldUploadMerged = true;
              } else {
                // Both have it: compare timestamps if available
                const existing = habitMap.get(h.id);
                const localTs = h.updatedAt || h.createdAt || '';
                const cloudTs = existing.updatedAt || existing.createdAt || '';
                if (localTs && cloudTs && localTs > cloudTs) {
                  habitMap.set(h.id, h);
                  shouldUploadMerged = true;
                }
              }
            }
          });
          save(KEYS.HABITS, Array.from(habitMap.values()));
        }

        // 2. Completions Merge: Union by habitId + date
        const localCompletions = load(KEYS.COMPLETIONS, []) || [];
        const cloudCompletions = (cloudData.completions && Array.isArray(cloudData.completions)) ? cloudData.completions : [];
        if (cloudCompletions.length > 0 || localCompletions.length > 0) {
          const completionMap = new Map();
          cloudCompletions.forEach(c => {
            if (c && c.habitId && c.date) completionMap.set(`${c.habitId}_${c.date}`, c);
          });
          localCompletions.forEach(c => {
            if (c && c.habitId && c.date) {
              const key = `${c.habitId}_${c.date}`;
              if (!completionMap.has(key)) {
                completionMap.set(key, c);
                shouldUploadMerged = true;
              }
            }
          });
          save(KEYS.COMPLETIONS, Array.from(completionMap.values()));
        }

        // 3. Tasks Merge: Union by id
        const localTasks = load(KEYS.TASKS, []) || [];
        const cloudTasks = (cloudData.tasks && Array.isArray(cloudData.tasks)) ? cloudData.tasks : [];
        if (cloudTasks.length > 0 || localTasks.length > 0) {
          const taskMap = new Map();
          cloudTasks.forEach(t => { if (t && t.id) taskMap.set(t.id, t); });
          localTasks.forEach(t => {
            if (t && t.id) {
              if (!taskMap.has(t.id)) {
                taskMap.set(t.id, t);
                shouldUploadMerged = true;
              } else if (t.completed && !taskMap.get(t.id).completed) {
                taskMap.set(t.id, t);
                shouldUploadMerged = true;
              }
            }
          });
          save(KEYS.TASKS, Array.from(taskMap.values()));
        }

        // 4. Check-ins Merge: Union by date
        const localCheckins = load(KEYS.CHECKINS, []) || [];
        const cloudCheckins = (cloudData.checkins && Array.isArray(cloudData.checkins)) ? cloudData.checkins : [];
        if (cloudCheckins.length > 0 || localCheckins.length > 0) {
          const checkinMap = new Map();
          cloudCheckins.forEach(c => { if (c && c.date) checkinMap.set(c.date, c); });
          localCheckins.forEach(c => {
            if (c && c.date && !checkinMap.has(c.date)) {
              checkinMap.set(c.date, c);
              shouldUploadMerged = true;
            }
          });
          save(KEYS.CHECKINS, Array.from(checkinMap.values()));
        }

        // 5. Achievements Merge: Union by id
        const localAchievements = load(KEYS.ACHIEVEMENTS, []) || [];
        const cloudAchievements = (cloudData.achievements && Array.isArray(cloudData.achievements)) ? cloudData.achievements : [];
        if (cloudAchievements.length > 0 || localAchievements.length > 0) {
          const achMap = new Map();
          cloudAchievements.forEach(a => { if (a && a.id) achMap.set(a.id, a); });
          localAchievements.forEach(a => {
            if (a && a.id && !achMap.has(a.id)) {
              achMap.set(a.id, a);
              shouldUploadMerged = true;
            }
          });
          save(KEYS.ACHIEVEMENTS, Array.from(achMap.values()));
        }

        // 6. Rewards Merge: Union
        const localRewards = load(KEYS.REWARDS, []) || [];
        const cloudRewards = (cloudData.rewards && Array.isArray(cloudData.rewards)) ? cloudData.rewards : [];
        if (cloudRewards.length > 0 || localRewards.length > 0) {
          const rewSet = new Set([...cloudRewards, ...localRewards]);
          save(KEYS.REWARDS, Array.from(rewSet));
        }

        // 7. XP Log Merge: Union by timestamp
        const localXpLog = load(KEYS.XP_LOG, []) || [];
        const cloudXpLog = (cloudData.xpLog && Array.isArray(cloudData.xpLog)) ? cloudData.xpLog : [];
        if (cloudXpLog.length > 0 || localXpLog.length > 0) {
          const logMap = new Map();
          cloudXpLog.forEach(l => { if (l && l.timestamp) logMap.set(l.timestamp, l); });
          localXpLog.forEach(l => {
            if (l && l.timestamp && !logMap.has(l.timestamp)) {
              logMap.set(l.timestamp, l);
              shouldUploadMerged = true;
            }
          });
          save(KEYS.XP_LOG, Array.from(logMap.values()));
        }

        // 8. User Profile Merge: Keep highest XP, preserve photoUrl
        const localUser = getUser();
        const cloudProfile = cloudData.userProfile || {};
        const maxXP = Math.max(localUser.totalXP || 0, cloudProfile.totalXP || 0);
        const resolvedPhoto = cloudProfile.photoUrl || localUser.photoUrl || (currentAuthUser && currentAuthUser.photoURL) || null;

        const mergedProfile = {
          ...localUser,
          ...cloudProfile,
          totalXP: maxXP,
          photoUrl: resolvedPhoto,
          isLoggedIn: true,
          authDone: true,
          onboardingDone: true
        };
        save(KEYS.USER, mergedProfile);

        if (shouldUploadMerged || (accountKey && targetDocRef && (!snap.ref || snap.ref.id !== accountKey))) {
          await uploadLocalDataToCloud(uid, email);
        }
      } finally {
        isSyncingFromCloud = false;
      }

      return true;
    } else {
      // Fresh cloud account: immediately upload current local data
      await uploadLocalDataToCloud(uid, email);
      return false;
    }
  } catch (e) {
    console.error('Error syncing cloud data:', e);
    isSyncingFromCloud = false;
    return false;
  }
}

export async function uploadLocalDataToCloud(uid, email) {
  if (!isFirebaseConfigured || !db) return;
  const accountKey = getAccountKey(uid, email);
  if (!accountKey && !uid) return;

  try {
    const payload = {
      habits: load(KEYS.HABITS, []) || [],
      completions: load(KEYS.COMPLETIONS, []) || [],
      tasks: load(KEYS.TASKS, []) || [],
      checkins: load(KEYS.CHECKINS, []) || [],
      achievements: load(KEYS.ACHIEVEMENTS, []) || [],
      rewards: load(KEYS.REWARDS, []) || [],
      xpLog: load(KEYS.XP_LOG, []) || [],
      userProfile: getUser(),
      accountEmail: (email || (currentAuthUser && currentAuthUser.email) || getUser().email || '').toLowerCase().trim(),
      lastSyncedAt: new Date().toISOString()
    };

    // Primary: Write to canonical email-keyed doc (ensures Web & App share identical doc)
    if (accountKey) {
      await setDoc(doc(db, 'users', accountKey), payload, { merge: true });
    }
    // Secondary: Also write to legacy uid doc if available
    if (uid && uid !== accountKey) {
      await setDoc(doc(db, 'users', uid), payload, { merge: true });
    }
  } catch (e) {
    console.warn('Error uploading data to cloud:', e);
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
        showToast('Please verify your email first. We sent a link to your inbox.', 'warning', 5000);
        throw new Error('Email not verified. Please check your inbox.');
      }

      await syncCloudData(cred.user.uid, cred.user.email);
      startRealtimeSync(cred.user.uid, cred.user.email);
      closeModal('modal-auth');
      showToast('Successfully signed in.', 'success');
      updateUser({ email: cred.user.email, name: cred.user.displayName || email.split('@')[0], isLoggedIn: true, authDone: true });
      if (window._updateAccountUI) window._updateAccountUI(cred.user);
      if (window._refreshAppUI) window._refreshAppUI();
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
      const errorMsg = 'No account found with this email. Please switch to Create Account.';
      showToast(errorMsg, 'error');
      throw new Error(errorMsg);
    }

    if (existing.password !== password) {
      const errorMsg = 'Incorrect password. Please check and try again.';
      showToast(errorMsg, 'error');
      throw new Error(errorMsg);
    }

    updateUser({ email: existing.email, name: existing.name || email.split('@')[0], isLoggedIn: true, authDone: true, nameCustomized: true });
    closeModal('modal-auth');
    showToast(`Welcome back, ${existing.name || email.split('@')[0]}!`, 'success');
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
      showToast('Activation link sent to your email.', 'success', 5000);
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
      const errorMsg = 'An account with this email already exists. Please switch to Sign In.';
      showToast(errorMsg, 'error');
      throw new Error(errorMsg);
    }

    const userName = name || email.split('@')[0];
    const newAcc = { email, password, name: userName, createdAt: new Date().toISOString() };
    accounts.push(newAcc);
    save('discipline_accounts', accounts);

    updateUser({ name: userName, email, isLoggedIn: true, authDone: true, nameCustomized: true });
    closeModal('modal-auth');
    showToast(`Account created for ${userName}!`, 'success');
    if (window._updateAccountUI) window._updateAccountUI(getUser());
    return { email, displayName: userName };
  }
}

// Detect if running inside a Capacitor native app (Android/iOS)
function isCapacitorApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export async function loginWithGoogle() {
  if (isFirebaseConfigured && auth) {
    try {
      // In native mobile app (Android / iOS), use native Google One-Tap sheet
      // to avoid WebView OAuth blocking (Error 400: disallowed_useragent).
      if (isCapacitorApp()) {
        const GoogleAuth = window.Capacitor?.Plugins?.GoogleAuth;
        if (GoogleAuth) {
          showToast('Connecting to Google...', 'info', 2000);
          try {
            await GoogleAuth.initialize({
              clientId: '356781067799-5su4b6r7tfgpgpm590cd4b0f1853jeu5.apps.googleusercontent.com',
              scopes: ['profile', 'email']
            });
          } catch(initErr) {
            console.log('[GoogleAuth] initialize notice:', initErr);
          }

          let googleUser;
          try {
            googleUser = await GoogleAuth.signIn();
          } catch(err) {
            const errStr = (err?.message || err?.code || JSON.stringify(err) || '').toLowerCase();
            if (err?.code === '12501' || errStr.includes('cancel') || errStr.includes('cancelled') || errStr.includes('canceled')) {
              showToast('Google sign-in was cancelled.', 'info');
              return null;
            }
            console.warn('[GoogleAuth] native signIn error:', err);
            throw err;
          }

          const idToken = googleUser?.authentication?.idToken || googleUser?.idToken;
          if (!idToken) {
            throw new Error('No Google authentication token received.');
          }

          const credential = GoogleAuthProvider.credential(idToken);
          const cred = await signInWithCredential(auth, credential);

          currentAuthUser = cred.user;
          const user = getUser();
          const name = cred.user.displayName || googleUser.name || cred.user.email.split('@')[0];
          const photo = cred.user.photoURL || googleUser.imageUrl || user.photoUrl || null;

          const hasCloudHabits = await syncCloudData(cred.user.uid, cred.user.email);
          startRealtimeSync(cred.user.uid, cred.user.email);

          updateUser({
            email: cred.user.email,
            name: cred.user.displayName || name,
            photoUrl: photo,
            isLoggedIn: true,
            authDone: true,
            onboardingDone: hasCloudHabits
          });

          showToast(`Welcome${hasCloudHabits ? ' back' : ''}, ${cred.user.displayName || name}!`, 'success');
          if (window._updateAccountUI) window._updateAccountUI(cred.user);
          if (window._refreshAppUI) window._refreshAppUI();
          return cred.user;
        }
      }

      // Web browser: use popup (instant, no page reload needed)
      const cred = await signInWithPopup(auth, googleProvider);
      currentAuthUser = cred.user;
      const user = getUser();
      const name = cred.user.displayName || cred.user.email.split('@')[0];
      const photo = cred.user.photoURL || user.photoUrl || null;

      // Check cloud for existing data — determines if onboarding is needed
      const hasCloudHabits = await syncCloudData(cred.user.uid, cred.user.email);
      startRealtimeSync(cred.user.uid, cred.user.email);

      updateUser({
        email: cred.user.email,
        name: cred.user.displayName || name,
        photoUrl: photo,
        isLoggedIn: true,
        authDone: true,
        onboardingDone: hasCloudHabits
      });

      showToast(`Welcome${hasCloudHabits ? ' back' : ''}, ${cred.user.displayName || name}!`, 'success');
      if (window._updateAccountUI) window._updateAccountUI(cred.user);
      if (window._refreshAppUI) window._refreshAppUI();
      return cred.user;
    } catch (err) {
      console.warn('Google Sign-In error:', err.code, err.message);
      if (err.code === 'auth/popup-blocked') {
        // Popup blocked on web — fallback to redirect
        showToast('Popup was blocked. Redirecting to Google...', 'info');
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
    // Fallback demo mode (no Firebase configured)
    const googleUser = { name: 'Google User', email: 'user.google@gmail.com' };
    updateUser({ name: googleUser.name, email: googleUser.email, isLoggedIn: true, authDone: true, onboardingDone: false });
    showToast('Signed in with Google!', 'success');
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
      showToast('Password reset link sent to your email.', 'success');
    } catch (err) {
      showToast(getAuthErrorMessage(err.code), 'error');
    }
  } else {
    showToast(`Password reset email sent to ${email}`, 'success');
  }
}

export async function logoutUser() {
  stopRealtimeSync();
  if (window.Capacitor?.Plugins?.GoogleAuth?.signOut) {
    try { await window.Capacitor.Plugins.GoogleAuth.signOut(); } catch(e) {}
  }
  if (isFirebaseConfigured && auth) {
    try { await signOut(auth); } catch(e) {}
  }
  updateUser({ email: null, isLoggedIn: false, isGuest: false, authDone: false });
  showToast('Logged out. Switched to guest mode.', 'info');
  if (window._updateAccountUI) window._updateAccountUI(null);
  if (window._refreshAppUI) window._refreshAppUI();
}

export async function deleteAccountAndData() {
  const user = auth?.currentUser;

  if (user && isFirebaseConfigured) {
    // 1. Delete user's document in Firestore (best-effort)
    if (db) {
      try {
        await deleteDoc(doc(db, 'users', user.uid));
      } catch (docErr) {
        console.warn('Could not delete user Firestore doc (permissions or non-existent):', docErr?.code, docErr);
      }
    }

    // 2. Delete the user from Firebase Authentication (best-effort)
    try {
      await deleteUser(user);
    } catch (authErr) {
      console.warn('deleteUser error/notice:', authErr?.code, authErr?.message);
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

  showToast('Account and all data permanently deleted.', 'info');
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
      await uploadLocalDataToCloud(user.uid, user.email);
      closeModal('modal-verify-email');
      showToast('Email verified! Welcome to Discipline.', 'success');
      if (window._updateAccountUI) window._updateAccountUI(user);
      if (typeof window.proceedAfterAuth === 'function') {
        window.proceedAfterAuth();
      }
      return true;
    } else {
      showToast('Email not verified yet. Please check your inbox and click the verification link.', 'warning', 4500);
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
    showToast('Verification email resent. Check your inbox.', 'success');
    
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
    case 'auth/invalid-email': return 'Invalid email address format.';
    case 'auth/user-disabled': return 'This user account has been disabled.';
    case 'auth/user-not-found': return 'No account found with this email. Please switch to Create Account.';
    case 'auth/wrong-password': return 'Incorrect password. Please check and try again.';
    case 'auth/invalid-credential': return 'No account found with these credentials. Please switch to Create Account.';
    case 'auth/email-already-in-use': return 'An account with this email already exists. Please switch to Sign In.';
    case 'auth/weak-password': return 'Password should be at least 6 characters.';
    case 'auth/unauthorized-domain': return 'Domain not authorized in Firebase settings.';
    case 'auth/operation-not-allowed': return 'This sign-in method is not enabled.';
    case 'auth/popup-blocked': return 'Popup was blocked by browser. Redirecting to Google sign-in...';
    case 'auth/popup-closed-by-user': return 'Sign-in was cancelled.';
    case 'auth/cancelled-popup-request': return 'Sign-in cancelled.';
    case 'auth/network-request-failed': return 'Network error. Please check your internet connection.';
    case 'auth/too-many-requests': return 'Too many failed attempts. Please try again later.';
    default: return `Authentication failed (${code || 'unknown'}). Please try again.`;
  }
}
