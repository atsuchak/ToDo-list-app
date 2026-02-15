const ProfileAuth = {
    init() {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                // Load initial profile data
                this.loadProfile(user);
            } else {
                window.location.href = 'login.html';
            }
        });

        // Listen for Avatar Upload
        document.getElementById('avatarUpload').addEventListener('change', this.uploadAvatar.bind(this));

        // Listen for Username Input (Debounce)
        const usernameInput = document.getElementById('inputUsername');
        let timeout = null;
        usernameInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => this.checkUsername(e.target.value), 500);
        });
    },

    async loadProfile(user) {
        document.getElementById('profileEmail').textContent = user.email;
        document.getElementById('profileName').textContent = user.displayName || 'Task User';
        if (user.photoURL) document.getElementById('profileAvatar').src = user.photoURL;

        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();

                // Populate Inputs
                document.getElementById('inputName').value = data.displayName || user.displayName || '';
                document.getElementById('inputUsername').value = data.username || '';
                document.getElementById('inputInstitution').value = data.institution || '';
                document.getElementById('inputAge').value = data.age || '';

                // Stats
                const sessions = data.sessions || {};
                const totalSessions = Object.keys(sessions).length;
                let taskCount = 0;
                Object.values(sessions).forEach(arr => taskCount += arr.length);

                document.getElementById('statTasks').textContent = taskCount;
                // Streak logic is in app.js, simplistic version here or just use 0 if not calc
                // leveraging the existing data structure
            }
        } catch (e) {
            console.error("Error loading profile:", e);
        }
    },

    async updateGeneral() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const name = document.getElementById('inputName').value;
        const username = document.getElementById('inputUsername').value;
        const institution = document.getElementById('inputInstitution').value;
        const age = document.getElementById('inputAge').value;

        try {
            // Update Auth Profile
            if (name !== user.displayName) {
                await user.updateProfile({ displayName: name });
                document.getElementById('profileName').textContent = name;
            }

            // Update Firestore
            await db.collection('users').doc(user.uid).set({
                displayName: name,
                username: username, // Note: Should strictly validate uniqueness again here in backend rules
                institution: institution,
                age: age
            }, { merge: true });

            UI.showNotification("Profile updated successfully!");
        } catch (e) {
            UI.showNotification("Failed to update profile.", "red");
            console.error(e);
        }
    },

    async checkUsername(username) {
        const statusEl = document.getElementById('usernameStatus');
        if (!username || username.length < 3) {
            statusEl.innerHTML = '';
            return;
        }

        statusEl.innerHTML = '<i data-lucide="loader" class="w-4 h-4 text-slate-500 animate-spin"></i>';
        lucide.createIcons();

        try {
            // Check if username exists (Simple query, requires index potentially)
            // Note: This requires a 'usernames' collection or a composite index on users.username
            // For now, we will query users where username == username
            const snapshot = await db.collection('users').where('username', '==', username).get();

            const isTaken = !snapshot.empty && snapshot.docs[0].id !== firebase.auth().currentUser.uid;

            if (isTaken) {
                statusEl.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4 text-red-500"></i>';
                UI.showNotification("Username is already taken.", "red");
            } else {
                statusEl.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-green-500"></i>';
            }
            lucide.createIcons();
        } catch (e) {
            console.error(e);
            statusEl.innerHTML = '';
        }
    },

    async uploadAvatar(event) {
        const file = event.target.files[0];
        if (!file) return;

        const user = firebase.auth().currentUser;

        try {
            // Create a reference
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`avatars/${user.uid}/${file.name}`);

            UI.showNotification("Uploading avatar...", "blue");

            await fileRef.put(file);
            const url = await fileRef.getDownloadURL();

            // Update Auth Profile
            await user.updateProfile({ photoURL: url });

            // Force image refresh by appending timestamp
            const timestamp = new Date().getTime();
            document.getElementById('profileAvatar').src = `${url}?t=${timestamp}`;

            // Update Firestore
            await db.collection('users').doc(user.uid).set({ photoURL: url }, { merge: true });

            UI.showNotification("Avatar updated!");
        } catch (e) {
            console.error(e);
            alert("Failed to upload avatar: " + (e.message || "Unknown error"));
            UI.showNotification("Failed to upload avatar.", "red");
        }
    },

    async updatePassword() {
        const user = firebase.auth().currentUser;
        const currentPass = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;

        if (!currentPass || !newPass) {
            UI.showNotification("Please fill in both fields.", "red");
            return;
        }

        try {
            // Re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);
            await user.reauthenticateWithCredential(credential);

            // Update
            await user.updatePassword(newPass);
            UI.showNotification("Password changed successfully!");
            document.getElementById('securityForm').reset();
        } catch (e) {
            console.error(e);
            UI.showNotification("Incorrect current password or error.", "red");
        }
    },

    async deleteAccount() {
        const user = firebase.auth().currentUser;
        // Prompt for password
        const password = prompt("Please enter your password to confirm account deletion PERMANENTLY:");
        if (!password) return;

        try {
            // Re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            await user.reauthenticateWithCredential(credential);

            // Delete Firestore Data
            await db.collection('users').doc(user.uid).delete();

            // Delete User
            await user.delete();

            alert("Account deleted. Goodbye.");
            window.location.href = 'index.html';
        } catch (e) {
            console.error(e);
            UI.showNotification("Deletion failed: " + e.message, "red");
        }
    },

    async wipeData() {
        if (!confirm("Are you sure? This will remove ALL tasks and history.")) return;

        const user = firebase.auth().currentUser;
        try {
            await db.collection('users').doc(user.uid).update({
                sessions: {},
                analytics: { totalSeconds: 0 }
            });
            UI.showNotification("All data wiped.", "blue");
            // Refresh logic if needed
        } catch (e) {
            UI.showNotification("Error wiping data.", "red");
        }
    },

    async syncLocalData() {
        const user = firebase.auth().currentUser;
        if (Auth && Auth.syncData) {
            await Auth.syncData(user);
            // Trigger refresh
            this.loadProfile(user);
        }
    }
};

ProfileAuth.init();
