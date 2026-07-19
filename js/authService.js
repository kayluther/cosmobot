/**
 * CosmoBot Auth — Firebase Authentication + Firestore profiles
 * Schema: { uid, name, email, age, linked_device: null }
 */
const AuthService = (function () {
  let auth = null;
  let db = null;
  let currentUser = null;
  let authReady = false;
  let authReadyResolve;
  const authReadyPromise = new Promise(function (resolve) {
    authReadyResolve = resolve;
  });

  function mapAuthError(error) {
    const messages = {
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-not-found': 'Unrecognized account or incorrect password.',
      'auth/wrong-password': 'Unrecognized account or incorrect password.',
      'auth/invalid-credential': 'Unrecognized account or incorrect password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your connection and try again.',
    };
    return messages[error && error.code] || (error && error.message) || 'An unexpected error occurred.';
  }

  function buildUserRecord(uid, profile) {
    return {
      uid: uid,
      name: (profile && profile.name) || '',
      email: (profile && profile.email) || '',
      age: profile && profile.age != null ? profile.age : null,
      linked_device: profile && profile.linked_device != null ? profile.linked_device : null,
    };
  }

  async function loadProfile(firebaseUser) {
    if (!db || !firebaseUser) return null;
    
    try {
      const snap = await db.collection('users').doc(firebaseUser.uid).get();
      const data = snap.exists ? snap.data() : {};
      return buildUserRecord(firebaseUser.uid, {
        name: data.name || firebaseUser.displayName || '',
        email: data.email || firebaseUser.email || '',
        age: data.age,
        linked_device: data.linked_device,
      });
    } catch (error) {
      // Handle offline and unavailable errors gracefully
      if (error.code === 'unavailable' || 
          error.code === 'failed-precondition' ||
          error.message.includes('offline') ||
          error.message.includes('No network')) {
        // Return basic user data from Firebase Auth when Firestore is unavailable
        return buildUserRecord(firebaseUser.uid, {
          name: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
        });
      }
      // Re-throw other errors for the caller to handle
      throw error;
    }
  }

  function init() {
    if (!window.firebase || !window.COSMOBOT_FIREBASE_CONFIG) return;
    const app = firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(window.COSMOBOT_FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();

    auth.onAuthStateChanged(async function (firebaseUser) {
      try {
        currentUser = firebaseUser ? await loadProfile(firebaseUser) : null;
      } catch (error) {
        console.error('Error loading profile:', error.message);
        currentUser = firebaseUser
          ? buildUserRecord(firebaseUser.uid, {
              name: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
            })
          : null;
      }
      if (!authReady) {
        authReady = true;
        authReadyResolve();
      }
    });
  }

  init();

  return {
    waitForAuth() {
      return authReadyPromise;
    },

    getCurrentUser() {
      return currentUser;
    },

    async registerStudent(formData) {
      if (!auth) {
        return { user: null, error: 'Firebase is not configured.' };
      }

      try {
        const credential = await auth.createUserWithEmailAndPassword(
          formData.email.trim(),
          formData.password
        );
        const firebaseUser = credential.user;
        const profile = {
          uid: firebaseUser.uid,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          age: Number(formData.age),
          linked_device: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        await firebaseUser.updateProfile({ displayName: profile.name });
        await db.collection('users').doc(firebaseUser.uid).set(profile);

        const userRecord = buildUserRecord(firebaseUser.uid, profile);
        await auth.signOut();
        currentUser = null;

        return { user: userRecord, error: null };
      } catch (error) {
        return { user: null, error: mapAuthError(error) };
      }
    },

    async loginStudent(credentials) {
      if (!auth) {
        return { user: null, error: 'Firebase is not configured.' };
      }

      try {
        const credential = await auth.signInWithEmailAndPassword(
          credentials.email.trim(),
          credentials.password
        );
        currentUser = await loadProfile(credential.user);
        return { user: currentUser, error: null };
      } catch (error) {
        return { user: null, error: mapAuthError(error) };
      }
    },

    async resetPassword(email) {
      if (!auth) {
        return { success: false, error: 'Firebase is not configured.', message: null };
      }

      const normalized = email.trim().toLowerCase();
      if (!normalized) {
        return { success: false, error: 'Please enter your email address.', message: null };
      }

      try {
        await auth.sendPasswordResetEmail(normalized);
        return {
          success: true,
          error: null,
          message: 'Password reset link sent. Check your inbox.',
        };
      } catch (error) {
        return { success: false, error: mapAuthError(error), message: null };
      }
    },

    async logoutStudent() {
      if (!auth) return;
      await auth.signOut();
      currentUser = null;
    },
  };
})();