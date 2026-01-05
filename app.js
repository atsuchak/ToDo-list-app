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
    }
};

const UI = {
    init() {
        this.renderFlow();
        this.applyTheme();
        if (document.getElementById('scorePercentage')) this.updateScore();
        this.updateStreak();
        if (document.getElementById('tagList')) this.updateTags();
        Clock.start();

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

        const dateLabel = document.getElementById('dateLabel');
        if (dateLabel) {
            dateLabel.textContent = new Date().toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            });
        }

        this.toggleSidebarIndicator(false);
        lucide.createIcons();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        const isVisible = sidebar.classList.contains('sidebar-visible');
        if (isVisible) {
            sidebar.classList.remove('sidebar-visible');
            this.toggleSidebarIndicator(false);
        } else {
            sidebar.classList.add('sidebar-visible');
            this.toggleSidebarIndicator(true);
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
        if (icon) icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
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

        const sessions = AppState.db.sessions;
        const dates = Object.keys(sessions).sort().reverse();
        
        if (dates.length === 0) {
            streakDisplay.textContent = `0 Days`;
            return;
        }

        let streak = 0;
        let checkDate = new Date(); // Start checking from right now
        checkDate.setHours(0, 0, 0, 0);

        // 1. Check if the most recent entry is either today or yesterday
        // If the latest entry is older than yesterday, the streak is broken (0)
        const latestEntry = new Date(dates[0]);
        latestEntry.setHours(0, 0, 0, 0);
        
        const diffToLatest = Math.floor((checkDate - latestEntry) / (1000 * 60 * 60 * 24));
        
        if (diffToLatest > 1) {
            streakDisplay.textContent = `0 Days`;
            return;
        }

        // 2. Count backwards to find consecutive days
        for (let i = 0; i < dates.length; i++) {
            const entryDate = new Date(dates[i]);
            entryDate.setHours(0, 0, 0, 0);
            
            const diff = Math.floor((checkDate - entryDate) / (1000 * 60 * 60 * 24));
            
            if (diff <= 1) {
                streak++;
                // Move our "check" reference to the day before this entry to keep it consecutive
                checkDate = new Date(entryDate);
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        streakDisplay.textContent = `${streak} Day${streak !== 1 ? 's' : ''}`;
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

        switch(type) {
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
                        <span class="text-lg font-medium truncate ${item.done ? 'line-through' : ''}">${item.text}</span>
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
                        <h3 class="text-2xl font-bold text-white">${percentage}% Done</h3>
                    </div>
                    <i data-lucide="maximize-2" class="w-5 h-5 text-slate-600 group-hover:text-blue-400"></i>
                </div>
                <div class="space-y-2 flex-1 overflow-hidden">
                    ${items.slice(0, 7).map(i => `
                        <div class="flex items-center gap-2 text-sm">
                            <div class="w-1 h-1 rounded-full ${i.done ? 'bg-blue-500' : 'bg-slate-800'}"></div>
                            <span class="truncate ${i.done ? 'text-slate-500 line-through opacity-50' : 'text-slate-300'}">${i.text}</span>
                        </div>
                    `).join('')}
                    ${items.length > 7 ? `<p class="text-[10px] text-blue-500 font-bold mt-2">+ ${items.length - 7} MORE TOPICS</p>` : ''}
                </div>
                <div class="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                    <span class="text-[10px] text-slate-500 font-bold uppercase">${items.length} Topics</span>
                    <button onclick="event.stopPropagation(); Logic.deleteSession('${date}')" class="text-slate-600 hover:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`;
            container.appendChild(card);
        });
        lucide.createIcons();
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
                    <span class="font-medium ${i.done ? 'line-through text-slate-500' : 'text-white'}">${i.text}</span>
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
        
        // Show notification based on new status
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
    }
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
            if (timeEl) timeEl.textContent = `${h.toString().padStart(2, '0')}:${m}:${s}`;
            if (ampmEl) ampmEl.textContent = ampm;
        };
        setInterval(update, 1000);
        update();
    }
};

UI.init();