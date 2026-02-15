const AppState = {
    db: JSON.parse(localStorage.getItem('flow_os_v3')) || {
        sessions: {},
        analytics: { totalSeconds: 0 },
        theme: 'dark'
    },
    currentDate: new Date().toISOString().split('T')[0],
    timer: { interval: null, seconds: 0 },

    save() {
        localStorage.setItem('flow_os_v3', JSON.stringify(this.db));
        if (document.getElementById('scorePercentage')) UI.updateScore();
        if (document.getElementById('tagList')) UI.updateTags();
        UI.updateStreak();

        // Sync with Firestore if logged in
        if (typeof Auth !== 'undefined' && Auth.currentUser) {
            Auth.saveUserData(this.db);
        }
    }
};

const UI = {
    init() {
        // Initialize potentially independent components first
        Clock.start();
        lucide.createIcons();

        const topicInput = document.getElementById('topicInput');
        if (topicInput) {
            topicInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') Logic.add();
            });
        }

        const descInput = document.getElementById('descInput');
        if (descInput) {
            descInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') Logic.add();
            });
        }

        // Theme and Sidebar
        this.applyTheme();
        this.toggleSidebarIndicator(false);

        // Render Data Dependent Components
        this.renderFlow();
        if (document.getElementById('scorePercentage')) this.updateScore();
        this.updateStreak();
        if (document.getElementById('tagList')) this.updateTags();

        if (dateLabel) {
            dateLabel.textContent = new Date().toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            });
        }

        // Check for Auth state that might have been set before app.js loaded
        if (typeof Auth !== 'undefined' && Auth.currentUser) {
            console.log("UI Init: Found existing user session");
            this.updateAuthParams(Auth.currentUser);
            if (Auth.loadUserData) Auth.loadUserData(Auth.currentUser);
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const isVisible = sidebar.classList.contains('sidebar-visible');

        if (isVisible) {
            // Close sidebar
            sidebar.classList.remove('sidebar-visible');
            this.toggleSidebarIndicator(false);
            // Remove the global click listener
            document.removeEventListener('click', UI.handleOutsideClick);
        } else {
            // Open sidebar
            sidebar.classList.add('sidebar-visible');
            this.toggleSidebarIndicator(true);

            // Add the global click listener after a tiny delay to avoid 
            // the current click event triggering the close logic immediately
            setTimeout(() => {
                document.addEventListener('click', UI.handleOutsideClick);
            }, 10);
        }
    },

    handleOutsideClick(event) {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle-btn');

        // If the click is NOT on the sidebar and NOT on the toggle button, close the sidebar
        if (sidebar && !sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
            UI.toggleSidebar();
        }
    },

    toggleSidebarIndicator(visible) {
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        if (!toggleBtn) return;
        visible ? toggleBtn.classList.remove('sidebar-hidden-indicator') : toggleBtn.classList.add('sidebar-hidden-indicator');
    },

    toggleTheme() {
        AppState.db.theme = AppState.db.theme === 'dark' ? 'light' : 'dark';
        AppState.save();
        this.applyTheme();
    },

    applyTheme() {
        const isDark = AppState.db.theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('light', !isDark);

        const icon = document.getElementById('themeIcon');
        if (icon) icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
        lucide.createIcons();
    },

    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.toggle('show');
    },

    switchView(viewId) {
        if (viewId === 'history') {
            window.location.href = 'history.html';
        } else if (viewId === 'flow') {
            window.location.href = 'index.html';
        }
    },

    updateScore() {
        const items = AppState.db.sessions[AppState.currentDate] || [];
        const total = items.length;
        const done = items.filter(i => i.done).length;
        const score = total === 0 ? 0 : Math.round((done / total) * 100);
        const scorePerc = document.getElementById('scorePercentage');
        const scoreFill = document.getElementById('scoreFill');
        if (scorePerc) scorePerc.textContent = `${score}%`;
        if (scoreFill) scoreFill.style.width = `${score}%`;
    },

    updateStreak() {
        const streakDisplay = document.getElementById('streakDisplay');
        if (!streakDisplay) return;
        const streak = Logic.getStreak();
        streakDisplay.textContent = `${streak} Day${streak !== 1 ? 's' : ''}`;
    },

    updateAuthParams(user) {
        const container = document.getElementById('authContainer');
        if (!container) return;

        if (user) {
            // Logged In State
            container.innerHTML = `
                <div class="relative" id="userMenuContainer">
                    <button onclick="UI.toggleUserMenu()" class="p-1.5 pl-2 pr-1.5 glass rounded-full hover:bg-white/10 transition-all flex items-center gap-3 group border border-transparent">
                        <span class="hidden md:inline font-medium text-sm text-slate-300 group-hover:text-white pl-2">${user.displayName || 'User'}</span>
                        <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-bold overflow-hidden border-2 border-white/10">
                            ${user.photoURL ? `<img src="${user.photoURL}" class="w-full h-full object-cover" />` : (user.email ? user.email[0].toUpperCase() : 'U')}
                        </div>
                    </button>
                    
                <!-- Dropdown -->
                    <div id="userDropdown" class="user-menu-dropdown">
                        <div class="px-4 py-3 border-b border-white/5 dark:border-white/5 border-slate-200 mb-1">
                            <p class="text-sm font-bold text-slate-900 dark:text-white truncate">${user.displayName || 'Tasked User'}</p>
                            <p class="text-xs text-slate-500 truncate">${user.email}</p>
                        </div>
                        <a href="profile.html" class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors">
                            <i data-lucide="user" class="w-4 h-4"></i> Profile
                        </a>
                        <button onclick="UI.switchView('history')" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors text-left">
                            <i data-lucide="archive" class="w-4 h-4"></i> Archive
                        </button>
                        <div class="px-3 py-2 text-sm text-blue-500 font-bold flex items-center gap-2 border-t border-slate-200 dark:border-white/5 mt-1">
                            <i data-lucide="flame" class="w-4 h-4 fill-current"></i> ${Logic.getStreak()} Day Streak
                        </div>
                        <button onclick="Auth.logout()" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 rounded-lg transition-colors text-left">
                            <i data-lucide="log-out" class="w-4 h-4"></i> Logout
                        </button>
                    </div>
                </div>
            `;

            // Add click outside listener specific to this menu if not already added generally
            setTimeout(() => {
                document.addEventListener('click', (e) => {
                    const container = document.getElementById('userMenuContainer');
                    const dropdown = document.getElementById('userDropdown');
                    if (container && !container.contains(e.target) && dropdown && dropdown.classList.contains('show')) {
                        dropdown.classList.remove('show');
                    }
                });
            }, 100);
        } else {
            // Guest State - Show similar dropdown but with different options
            container.innerHTML = `
                <div class="relative" id="userMenuContainer">
                    <button onclick="UI.toggleUserMenu()" class="p-1.5 pl-2 pr-1.5 glass rounded-full hover:bg-white/10 transition-all flex items-center gap-3 group border border-transparent">
                        <span class="hidden md:inline font-medium text-sm text-slate-300 group-hover:text-white pl-2">Guest</span>
                        <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-bold overflow-hidden border-2 border-white/10">
                            <i data-lucide="user" class="w-4 h-4 text-slate-400"></i>
                        </div>
                    </button>
                    
                <!-- Dropdown -->
                    <div id="userDropdown" class="user-menu-dropdown">
                        <div class="px-4 py-3 border-b border-white/5 dark:border-white/5 border-slate-200 mb-1">
                            <p class="text-sm font-bold text-slate-900 dark:text-white truncate">Guest User</p>
                            <p class="text-xs text-slate-500 truncate">Not synced</p>
                        </div>
                        <button onclick="UI.openLoginModal()" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors text-left">
                            <i data-lucide="user" class="w-4 h-4"></i> Profile
                        </button>
                        <button onclick="UI.switchView('history')" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors text-left">
                            <i data-lucide="archive" class="w-4 h-4"></i> Archive
                        </button>
                        <a href="login.html" class="flex items-center gap-2 px-3 py-2 text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                            <i data-lucide="log-in" class="w-4 h-4"></i> Login / Signup
                        </a>
                    </div>
                </div>
            `;

            // Add click listener for guest mode too
            setTimeout(() => {
                document.addEventListener('click', (e) => {
                    const container = document.getElementById('userMenuContainer');
                    const dropdown = document.getElementById('userDropdown');
                    if (container && !container.contains(e.target) && dropdown && dropdown.classList.contains('show')) {
                        dropdown.classList.remove('show');
                    }
                });
            }, 100);
        }
        lucide.createIcons();
    },

    updateTags() {
        const tagList = document.getElementById('tagList');
        if (!tagList) return;
        const items = AppState.db.sessions[AppState.currentDate] || [];
        const tags = [...new Set(items.flatMap(item => item.text.match(/#\w+/g) || []))];
        tagList.innerHTML = tags.length ? '' : '<p class="text-xs text-slate-600 px-2 italic">No context tags used.</p>';
        tags.forEach(tag => {
            const div = document.createElement('div');
            div.className = "flex items-center gap-2 px-2 py-1 text-sm text-slate-400";
            div.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> ${tag}`;
            tagList.appendChild(div);
        });
    },

    showNotification(message, type = "blue") {
        const container = document.getElementById('notification-container');
        if (!container) return;

        let colorClass, iconColor, iconBg, iconName, title;

        switch (type) {
            case "red":
                colorClass = "border-red-500";
                iconColor = "text-red-400";
                iconBg = "bg-red-500/20";
                iconName = "trash-2";
                title = "Removed";
                break;
            case "green":
                colorClass = "border-green-500";
                iconColor = "text-green-400";
                iconBg = "bg-green-500/20";
                iconName = "check-circle-2";
                title = "Completed";
                break;
            case "orange":
                colorClass = "border-orange-500";
                iconColor = "text-orange-400";
                iconBg = "bg-orange-500/20";
                iconName = "undo-2";
                title = "Task Undone";
                break;
            default: // blue
                colorClass = "border-blue-500";
                iconColor = "text-blue-400";
                iconBg = "bg-blue-500/20";
                iconName = "plus-circle";
                title = "Success";
        }

        const toast = document.createElement('div');
        toast.className = `glass px-6 py-4 rounded-2xl border-l-4 ${colorClass} flex items-center gap-3 shadow-2xl toast-fade-in pointer-events-auto`;
        toast.innerHTML = `
            <div class="w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center">
                <i data-lucide="${iconName}" class="w-5 h-5 ${iconColor}"></i>
            </div>
            <div>
                <p class="text-sm font-bold text-white">${title}</p>
                <p class="text-xs text-slate-400">${message}</p>
            </div>
        `;

        container.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => {
            toast.classList.replace('toast-fade-in', 'toast-fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    },

    renderFlow() {
        const list = document.getElementById('flowList');
        if (!list) return;
        const items = AppState.db.sessions[AppState.currentDate] || [];
        list.innerHTML = items.length ? '' : `<div class="p-8 md:p-12 text-center text-slate-500 border-2 border-dashed border-white/5 rounded-[2rem]">Ready to focus? Add your first topic.</div>`;

        const sortedItems = [...items]
            .map((item, originalIdx) => ({ ...item, originalIdx }))
            .sort((a, b) => a.done - b.done);

        sortedItems.forEach((item) => {
            const el = document.createElement('div');
            el.className = `glass p-4 md:p-6 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${item.done ? 'opacity-40' : 'hover:bg-white/5'}`;
            el.setAttribute('onclick', `Logic.toggle(${item.originalIdx})`);
            el.innerHTML = `
                <div class="flex items-center gap-3 md:gap-4 overflow-hidden">
                    <div class="flex-shrink-0 w-8 h-8 rounded-xl border-2 border-blue-500/30 flex items-center justify-center transition-colors ${item.done ? 'bg-blue-600 border-blue-600' : ''}">
                        ${item.done ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-lg font-medium truncate ${item.done ? 'line-through text-slate-500 dark:text-slate-500' : 'text-slate-900 dark:text-slate-200'}">${item.text}</span>
                        ${item.desc ? `<span class="text-xs text-slate-500 truncate">${item.desc}</span>` : ''}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); Logic.remove(${item.originalIdx})" class="p-2 text-slate-600 hover:text-red-400">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>`;
            list.appendChild(el);
        });
        lucide.createIcons();
    },

    renderHistory() {
        this.renderAnalytics(); // Render charts first

        const container = document.getElementById('historyGrid');
        if (!container) return;

        container.innerHTML = '';
        const sessions = Object.keys(AppState.db.sessions).sort().reverse();

        const statsEl = document.getElementById('totalSessions');
        if (statsEl) statsEl.textContent = `${sessions.length} ${sessions.length === 1 ? 'Session' : 'Sessions'}`;

        if (sessions.length === 0) {
            container.innerHTML = `<div class="col-span-full p-20 text-center glass rounded-[3rem] border-dashed border-2 border-white/5 text-slate-500 italic text-lg">Your focus archive is empty.</div>`;
            return;
        }

        sessions.forEach(date => {
            const items = AppState.db.sessions[date];
            const doneCount = items.filter(i => i.done).length;
            const percentage = items.length === 0 ? 0 : Math.round((doneCount / items.length) * 100);

            const card = document.createElement('div');
            card.className = "glass p-6 rounded-[2.5rem] flex flex-col h-full hover:border-blue-500/40 transition-all cursor-pointer group border border-white/5";
            card.setAttribute('onclick', `UI.openModal('${date}')`);
            card.innerHTML = `
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <p class="text-[10px] uppercase font-bold text-blue-500 tracking-widest mb-1">${date}</p>
                        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">${percentage}% Done</h3>
                    </div>
                    <i data-lucide="maximize-2" class="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-blue-400"></i>
                </div>
                <div class="space-y-2 flex-1 overflow-hidden">
                    ${items.slice(0, 7).map(i => `
                        <div class="flex items-center gap-2 text-sm">
                            <div class="w-1 h-1 rounded-full ${i.done ? 'bg-blue-500' : 'bg-slate-400 dark:bg-slate-800'}"></div>
                            <span class="truncate ${i.done ? 'text-slate-500 line-through opacity-50' : 'text-slate-700 dark:text-slate-300'}">${i.text}</span>
                        </div>
                    `).join('')}
                    ${items.length > 7 ? `<p class="text-[10px] text-blue-500 font-bold mt-2">+ ${items.length - 7} MORE TOPICS</p>` : ''}
                </div>
                <div class="mt-6 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-between items-center">
                    <span class="text-[10px] text-slate-500 font-bold uppercase">${items.length} Topics</span>
                    <button onclick="event.stopPropagation(); Logic.deleteSession('${date}')" class="text-slate-500 hover:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`;
            container.appendChild(card);
        });
        lucide.createIcons();
    },

    renderAnalytics() {
        const stats = Logic.getAnalytics();
        if (!stats) return;

        // 1. Stats Cards
        const statCompleted = document.getElementById('statTotalCompleted');
        const statSuccess = document.getElementById('statSuccessRate');
        const statStreak = document.getElementById('statBestStreak');

        if (statCompleted) statCompleted.textContent = stats.totalCompleted;
        if (statSuccess) statSuccess.textContent = `${stats.successRate}%`;
        if (statStreak) statStreak.textContent = `${stats.bestStreak} Days`;

        // 2. Weekly Chart
        const chartContainer = document.getElementById('weeklyChart');
        if (chartContainer) {
            chartContainer.innerHTML = '';
            const maxVal = Math.max(...stats.weekly.map(d => d.count), 1); // Avoid div by zero

            stats.weekly.forEach(day => {
                const height = (day.count / maxVal) * 100;
                const bar = document.createElement('div');
                bar.className = "flex flex-col items-center gap-2 flex-1 h-full justify-end group";
                bar.innerHTML = `
                    <div class="w-full max-w-[40px] bg-blue-500/10 dark:bg-blue-500/20 rounded-t-lg relative group-hover:bg-blue-500/30 transition-all overflow-hidden" style="height: ${height}%">
                        <div class="absolute bottom-0 left-0 w-full bg-blue-500 transition-all duration-1000" style="height: 0%"></div>
                        <!-- Tooltip -->
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            ${day.count} tasks
                        </div>
                    </div>
                    <span class="text-xs text-slate-500 font-medium uppercase">${day.day}</span>
                `;
                chartContainer.appendChild(bar);
                // Animate bar
                setTimeout(() => {
                    bar.querySelector('div > div').style.height = '100%';
                }, 100);
            });
        }

        // 3. Heatmap
        const heatmapContainer = document.getElementById('heatmapGrid');
        if (heatmapContainer) {
            heatmapContainer.innerHTML = '';
            // Determine columns (weeks). 52 weeks * 7 days
            // We'll render columns of 7 days

            stats.heatmap.forEach(week => {
                const col = document.createElement('div');
                col.className = "flex flex-col gap-1";
                week.forEach(day => {
                    let colorClass = 'bg-slate-200 dark:bg-slate-800'; // 0
                    if (day.count > 0) colorClass = 'bg-blue-500/40'; // 1-2
                    if (day.count > 2) colorClass = 'bg-blue-500/70'; // 3-5
                    if (day.count > 5) colorClass = 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'; // 6+

                    const cell = document.createElement('div');
                    cell.className = `w-3 h-3 rounded-sm ${colorClass} transition-all hover:scale-125 hover:z-10 relative group cursor-default`;
                    cell.title = `${day.date}: ${day.count} tasks`; // Basic tooltip

                    // Fancy Tooltip
                    cell.innerHTML = `
                        <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl border border-white/10">
                            ${new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${day.count} tasks
                        </div>
                   `;

                    col.appendChild(cell);
                });
                heatmapContainer.appendChild(col);
            });
        }
    },



    renderAnalytics() {
        const stats = Logic.getAnalytics();
        if (!stats) return;

        // 1. Stats Cards
        const statCompleted = document.getElementById('statTotalCompleted');
        const statSuccess = document.getElementById('statSuccessRate');
        const statStreak = document.getElementById('statBestStreak');

        if (statCompleted) statCompleted.textContent = stats.totalCompleted;
        if (statSuccess) statSuccess.textContent = `${stats.successRate}%`;
        if (statStreak) statStreak.textContent = `${stats.bestStreak} Days`;

        // 2. Weekly Chart
        const chartContainer = document.getElementById('weeklyChart');
        if (chartContainer) {
            chartContainer.innerHTML = '';
            const maxVal = Math.max(...stats.weekly.map(d => d.count), 1);

            stats.weekly.forEach(day => {
                const height = (day.count / maxVal) * 100;
                const bar = document.createElement('div');
                bar.className = "flex flex-col items-center gap-2 flex-1 h-full justify-end group";
                bar.innerHTML = `
                    <div class="w-full max-w-[40px] bg-blue-500/10 dark:bg-blue-500/20 rounded-t-lg relative group-hover:bg-blue-500/30 transition-all overflow-hidden" style="height: ${height}%">
                        <div class="absolute bottom-0 left-0 w-full bg-blue-500 transition-all duration-1000" style="height: 0%"></div>
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            ${day.count} tasks
                        </div>
                    </div>
                    <span class="text-xs text-slate-500 font-medium uppercase">${day.day}</span>
                `;
                chartContainer.appendChild(bar);
                setTimeout(() => {
                    bar.querySelector('div > div').style.height = '100%';
                }, 100);
            });
        }

        // 3. Heatmap
        const heatmapContainer = document.getElementById('heatmapGrid');
        if (heatmapContainer) {
            heatmapContainer.innerHTML = '';
            stats.heatmap.forEach(week => {
                const col = document.createElement('div');
                col.className = "flex flex-col gap-1";
                week.forEach(day => {
                    let colorClass = 'bg-slate-200 dark:bg-slate-800';
                    if (day.count > 0) colorClass = 'bg-blue-500/40';
                    if (day.count > 2) colorClass = 'bg-blue-500/70';
                    if (day.count > 5) colorClass = 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';

                    const cell = document.createElement('div');
                    cell.className = `w-3 h-3 rounded-sm ${colorClass} transition-all hover:scale-125 hover:z-10 relative group cursor-default`;
                    cell.innerHTML = `
                        <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl border border-white/10">
                            ${new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${day.count} tasks
                        </div>
                   `;
                    col.appendChild(cell);
                });
                heatmapContainer.appendChild(col);
            });
        }
    },

    openModal(date) {
        const items = AppState.db.sessions[date];
        const modal = document.getElementById('taskModal');
        const content = document.getElementById('modalContent');
        const modalDate = document.getElementById('modalDate');

        if (!modal || !content) return;

        modalDate.textContent = date;
        content.innerHTML = items.map(i => `
            <div class="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-5 h-5 rounded-md border border-blue-500/40 flex items-center justify-center">
                        ${i.done ? '<div class="w-3 h-3 bg-blue-500 rounded-sm"></div>' : ''}
                    </div>
                    <span class="font-medium ${i.done ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}">${i.text}</span>
                </div>
                ${i.desc ? `<p class="text-xs text-slate-500 mt-2 ml-8">${i.desc}</p>` : ''}
            </div>
        `).join('');

        modal.classList.remove('hidden');
        lucide.createIcons();
    },

    closeModal() {
        const modal = document.getElementById('taskModal');
        if (modal) modal.classList.add('hidden');
    },

    openDeleteModal(confirmCallback) {
        const modal = document.getElementById('deleteModal');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        if (!modal || !confirmBtn) return;

        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('deleteModalContent').classList.remove('scale-95'), 10);

        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.addEventListener('click', () => {
            confirmCallback();
            this.closeDeleteModal();
            this.showNotification("Record removed successfully", "red");
        });
        lucide.createIcons();
    },

    closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        const content = document.getElementById('deleteModalContent');
        if (content) content.classList.add('scale-95');
        setTimeout(() => { if (modal) modal.classList.add('hidden'); }, 200);
    },

    openLoginModal() {
        const modal = document.getElementById('loginModal');
        const content = document.getElementById('loginModalContent');
        if (!modal || !content) return;

        // Close dropdown
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.remove('show');

        modal.classList.remove('hidden');
        setTimeout(() => content.classList.remove('scale-95'), 10);
        lucide.createIcons();
    },

    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        const content = document.getElementById('loginModalContent');
        if (content) content.classList.add('scale-95');
        setTimeout(() => { if (modal) modal.classList.add('hidden'); }, 200);
    }
};

const Logic = {
    add() {
        const tInput = document.getElementById('topicInput');
        const dInput = document.getElementById('descInput');
        if (!tInput || !tInput.value.trim()) return;

        const taskText = tInput.value.trim();

        if (!AppState.db.sessions[AppState.currentDate]) AppState.db.sessions[AppState.currentDate] = [];
        AppState.db.sessions[AppState.currentDate].push({
            text: taskText,
            desc: dInput ? dInput.value : '',
            done: false
        });

        tInput.value = '';
        if (dInput) dInput.value = '';

        AppState.save();
        UI.renderFlow();
        UI.showNotification(`"${taskText}" added to your flow.`, "blue");
    },

    toggle(idx) {
        const task = AppState.db.sessions[AppState.currentDate][idx];
        task.done = !task.done;

        if (task.done) {
            UI.showNotification(`Great job! "${task.text}" completed.`, "green");
        } else {
            UI.showNotification(`"${task.text}" marked as active again.`, "orange");
        }

        AppState.save();
        UI.renderFlow();
    },

    remove(idx) {
        UI.openDeleteModal(() => {
            AppState.db.sessions[AppState.currentDate].splice(idx, 1);
            AppState.save();
            UI.renderFlow();
        });
    },

    deleteSession(date) {
        UI.openDeleteModal(() => {
            delete AppState.db.sessions[date];
            AppState.save();
            UI.renderHistory();
        });
    },

    clearAllHistory() {
        if (Object.keys(AppState.db.sessions).length === 0) return;
        UI.openDeleteModal(() => {
            AppState.db.sessions = {};
            AppState.save();
            UI.renderHistory();
            UI.showNotification("History cleared.", "blue");
        });
    },

    toggleTimer() {
        const icon = document.getElementById('timerIcon');
        if (AppState.timer.interval) {
            clearInterval(AppState.timer.interval);
            AppState.timer.interval = null;
            if (icon) icon.setAttribute('data-lucide', 'play');
        } else {
            if (icon) icon.setAttribute('data-lucide', 'pause');
            AppState.timer.interval = setInterval(() => { AppState.timer.seconds++; this.updateTimerDisplay(); }, 1000);
        }
        lucide.createIcons();
    },

    resetTimer() {
        if (AppState.timer.interval) { clearInterval(AppState.timer.interval); AppState.timer.interval = null; }
        AppState.timer.seconds = 0;
        this.updateTimerDisplay();
        const icon = document.getElementById('timerIcon');
        if (icon) icon.setAttribute('data-lucide', 'play');
        lucide.createIcons();
    },

    updateTimerDisplay() {
        const h = Math.floor(AppState.timer.seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((AppState.timer.seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (AppState.timer.seconds % 60).toString().padStart(2, '0');
        const display = document.getElementById('timerDisplay');
        if (display) display.textContent = `${h}:${m}:${s}`;
    },

    getAnalytics() {
        const sessions = AppState.db.sessions || {};
        const allDates = Object.keys(sessions);

        // 1. Totals
        let totalTasks = 0;
        let totalCompleted = 0;
        allDates.forEach(date => {
            const tasks = sessions[date];
            totalTasks += tasks.length;
            totalCompleted += tasks.filter(t => t.done).length;
        });

        const successRate = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);

        // 2. Best Streak
        let bestStreak = 0;
        let currentStreakCount = 0;

        const activeDates = allDates.filter(date => {
            return sessions[date] && sessions[date].some(t => t.done);
        }).sort();

        if (activeDates.length > 0) {
            activeDates.forEach((dateStr, idx) => {
                if (idx === 0) {
                    currentStreakCount = 1;
                } else {
                    const prevDate = new Date(activeDates[idx - 1]);
                    const currDate = new Date(dateStr);
                    const diffTime = Math.abs(currDate - prevDate);
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 1) {
                        currentStreakCount++;
                    } else {
                        currentStreakCount = 1;
                    }
                }
                if (currentStreakCount > bestStreak) bestStreak = currentStreakCount;
            });
        }

        // 3. Weekly Data
        const weekly = [];
        const today = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const tasks = sessions[dateStr] || [];
            const count = tasks.filter(t => t.done).length;
            weekly.push({
                day: days[d.getDay()],
                date: dateStr,
                count: count
            });
        }

        // 4. Heatmap Data (Last 52 weeks)
        const heatmap = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (52 * 7) + 1);
        while (startDate.getDay() !== 0) {
            startDate.setDate(startDate.getDate() - 1);
        }

        let walker = new Date(startDate);

        for (let w = 0; w < 53; w++) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const dateStr = walker.toISOString().split('T')[0];
                const tasks = sessions[dateStr] || [];
                const count = tasks.filter(t => t.done).length;
                week.push({ date: dateStr, count: count });
                walker.setDate(walker.getDate() + 1);
            }
            heatmap.push(week);
        }

        return {
            totalCompleted,
            successRate,
            bestStreak,
            weekly,
            heatmap
        };
    },

    getStreak() {
        // Simplified Logic for Streak Calculation
        const sessions = AppState.db.sessions || {};
        const dates = Object.keys(sessions).sort().reverse();
        if (dates.length === 0) return 0;

        let streak = 0;
        let checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);

        // Check if today has a session, if not check yesterday (grace period of 1 day)
        // Actually, logic: find the most recent date with at least one DONE task.
        // If that date is today or yesterday, the streak is alive.

        let latestActiveDate = null;
        for (const d of dates) {
            if (sessions[d].some(t => t.done)) {
                latestActiveDate = new Date(d);
                latestActiveDate.setHours(0, 0, 0, 0);
                break;
            }
        }

        if (!latestActiveDate) return 0;

        const diffTime = Math.abs(checkDate - latestActiveDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 1) return 0; // Streak broken

        // Count backwards from latestActiveDate
        let currentWalker = new Date(latestActiveDate);
        while (true) {
            const dateStr = currentWalker.toISOString().split('T')[0];
            const session = sessions[dateStr];
            if (session && session.some(t => t.done)) {
                streak++;
                currentWalker.setDate(currentWalker.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    },


};

const Clock = {
    start() {
        const update = () => {
            const now = new Date();
            let h = now.getHours();
            const m = now.getMinutes().toString().padStart(2, '0');
            const s = now.getSeconds().toString().padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            const timeEl = document.getElementById('clockTime');
            const ampmEl = document.getElementById('clockAMPM');
            if (timeEl) timeEl.innerText = `${h.toString().padStart(2, '0')}:${m}:${s}`;
            if (ampmEl) ampmEl.innerText = ampm;
        };
        // Run immediately then interval
        update();
        setInterval(update, 1000);
    }
};

UI.init();