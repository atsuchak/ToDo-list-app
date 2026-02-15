const firebaseConfig = {
    apiKey: "AIzaSyCby41xaHE4PRctNKNV8kB4paeCfRwQgB8",
    authDomain: "tasked-todo-v1-app.web.app",
    projectId: "tasked-todo-v1-app",
    storageBucket: "tasked-todo-v1-app.firebasestorage.app",
    messagingSenderId: "939919890388",
    appId: "1:939919890388:web:d93ced08bf26259a94e841"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const Auth = {
    currentUser: null,

    init() {
        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            if (user) {
                console.log("User logged in:", user.email);

                // If we are on the login page, redirect immediately to index.html
                // We do NOT await syncData here to prevent blocking the redirect.
                // index.html will handle the sync when it loads.
                if (window.location.pathname.includes('login.html') || document.getElementById('loginForm')) {
                    window.location.href = 'index.html';
                    return;
                }

                // If we are on index.html (or other pages), proceed with sync and UI update
                await this.syncData(user);

                if (typeof UI !== 'undefined' && UI.updateAuthParams) UI.updateAuthParams(user);
            } else {
                console.log("User logged out");
                if (typeof UI !== 'undefined' && UI.updateAuthParams) UI.updateAuthParams(null);
            }
        });
    },

    async signup(email, password) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await user.sendEmailVerification();
            UI.showNotification("Account created! Verification email sent.", "blue");
            return user;
        } catch (error) {
            console.error("Signup Error:", error);
            throw error;
        }
    },

    async login(email, password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            UI.showNotification("Welcome back!", "blue");
        } catch (error) {
            console.error("Login Error:", error);
            throw error;
        }
    },

    async loginGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
            UI.showNotification("Signed in with Google", "blue");
        } catch (error) {
            console.error("Google Login Error:", error);
            throw error;
        }
    },

    async resetPassword(email) {
        try {
            // Send Magic Link directly without checking if user exists (faster)
            const actionCodeSettings = {
                // URL you want to redirect back to. The domain (www.example.com) for this
                // URL must be in the authorized domains list in the Firebase Console.
                url: window.location.href.split('?')[0], // Current page (login.html)
                handleCodeInApp: true
            };

            await auth.sendSignInLinkToEmail(email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);

            // The user will receive an email with a link for one-time login.
        } catch (error) {
            console.error("Magic Link Error:", error);
            if (error.code === 'auth/quota-exceeded') {
                throw new Error("Daily login limit reached. Please try again tomorrow.");
            }
            throw error;
        }
    },

    async handleMagicLink() {
        if (auth.isSignInWithEmailLink(window.location.href)) {
            let email = window.localStorage.getItem('emailForSignIn');
            if (!email) {
                email = window.prompt('Please provide your email for confirmation');
            }

            try {
                const result = await auth.signInWithEmailLink(email, window.location.href);
                window.localStorage.removeItem('emailForSignIn');
                return result.user;
            } catch (error) {
                console.error("Magic Link Sign-in Error:", error);
                throw error;
            }
        }
        return null;
    },

    async verifyManualLink(email, link) {
        try {
            if (!auth.isSignInWithEmailLink(link)) {
                throw new Error("Invalid link format.");
            }
            const result = await auth.signInWithEmailLink(email, link);
            window.localStorage.removeItem('emailForSignIn');
            return result.user;
        } catch (error) {
            console.error("Manual Verify Error:", error);
            throw error;
        }
    },

    async logout() {
        try {
            await auth.signOut();
            // Clear local data on logout to avoid mixing user data? 
            // Or maybe keep it as 'guest' data? 
            // Requirement says "Stay functional for guest users". 
            // So we just clear the current view or revert to whatever is in local storage?
            // Actually, we should probably clear the current AppState.db if we want to be clean, 
            // or perform a full reload to reset the app state to default/localstorage.
            localStorage.removeItem('flow_os_v3'); // Clear local cache of user data
            window.location.reload();
        } catch (error) {
            console.error("Logout Error:", error);
            throw error;
        }
    },

    // Sync Logic: LocalStorage -> Firestore (One-way sync on login if local data exists)
    async syncData(user) {
        const localData = localStorage.getItem('flow_os_v3');

        // Check if there is local data that might need syncing (only if it looks like there's data)
        // We only sync if it's "anonymous" data. 
        // For simplicity: If there is data in localStorage, we ask to merge or overwrite?
        // Requirement: "sync that data to Firestore and then clear the local storage."

        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                // Safe check for sessions
                if (parsed && parsed.sessions && Object.keys(parsed.sessions).length > 0) {
                    const userDocRef = db.collection('users').doc(user.uid);

                    try {
                        const doc = await userDocRef.get();
                        let finalData = parsed;

                        if (doc.exists) {
                            const cloudData = doc.data();
                            finalData = {
                                ...cloudData,
                                sessions: { ...cloudData.sessions, ...parsed.sessions },
                                analytics: cloudData.analytics || parsed.analytics,
                                theme: parsed.theme
                            };
                        }

                        await userDocRef.set(finalData, { merge: true });
                        console.log("Data synced to Firestore");
                        localStorage.removeItem('flow_os_v3');
                    } catch (e) {
                        console.error("Sync failed", e);
                    }
                }
            } catch (e) {
                console.error("Invalid local data", e);
            }
        }

        // Always load latest from Firestore into AppState
        await this.loadUserData(user);
    },

    async saveUserData(data) {
        if (!this.currentUser) return;
        try {
            await db.collection('users').doc(this.currentUser.uid).set(data, { merge: true });
        } catch (e) {
            console.error("Save to Firestore failed", e);
        }
    },

    async loadUserData(user) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                // Update Global State
                if (typeof AppState !== 'undefined') {
                    AppState.db = data;
                    // Trigger UI refresh
                    if (typeof UI !== 'undefined') {
                        UI.renderFlow();
                        UI.renderHistory();
                        UI.updateScore();
                        UI.updateStreak();
                        if (UI.updateTags) UI.updateTags();
                        // Also update theme if it changed
                        if (AppState.db.theme && typeof UI.applyTheme === 'function') UI.applyTheme();
                    }
                }
            }
        } catch (e) {
            console.error("Load from Firestore failed", e);
        }
    }
};

Auth.init();
