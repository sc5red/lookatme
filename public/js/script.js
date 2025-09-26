// --- Theme Toggle (Refactored / cookie-synced) ---
// Early theme application now handled server-side + head partial script; keep logic minimal here.

class ThemeToggle {
    static instance;
    constructor() {
        if (ThemeToggle.instance) return ThemeToggle.instance;
        ThemeToggle.instance = this;
        this.init();
    }
    init(){
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else { this.setup(); }
    }
    setup(){
        this.html = document.documentElement;
        this.toggleBtn = document.getElementById('theme-toggle');
        this.sunPath = document.getElementById('sun-icon');
        this.moonPath = document.getElementById('moon-icon');
        this.knob = document.getElementById('theme-switch');
        this.label = document.getElementById('theme-text');

        // If markup uses dual paths, ensure both present; if not, bail gracefully
        this.syncFromSaved();
        this.updateUI();

        if (this.toggleBtn) {
            this.toggleBtn.setAttribute('role','button');
            this.toggleBtn.addEventListener('click', (e)=>{ 
                e.preventDefault(); 
                e.stopPropagation(); // keep dropdown open
                this.toggle(); 
                // keep parent menu visible explicitly
                const menu = document.getElementById('user-menu');
                if (menu) menu.classList.remove('hidden');
            });
        }
    }
    current(){ return this.html.classList.contains('dark') ? 'dark' : 'light'; }
    apply(theme){
        if (theme === 'dark') this.html.classList.add('dark'); else this.html.classList.remove('dark');
        try {
            localStorage.setItem('color-theme', theme);
            // Persist cookie for server-render to avoid flash on navigation
            document.cookie = 'color-theme=' + theme + ';path=/;max-age=' + (60*60*24*365);
        } catch(_){ }
    }
    syncFromSaved(){
        try {
            const saved = localStorage.getItem('color-theme');
            if (saved === 'dark') this.apply('dark'); else if (saved === 'light') this.apply('light');
        } catch(_){ }
    }
    updateUI(){
        const dark = this.current() === 'dark';
        if (this.sunPath && this.moonPath){
            if (dark){
                this.sunPath.classList.add('hidden');
                this.moonPath.classList.remove('hidden');
            } else {
                this.sunPath.classList.remove('hidden');
                this.moonPath.classList.add('hidden');
            }
        }
        if (this.knob){
            this.knob.classList.add('transform','transition-transform','duration-300');
            if (dark) this.knob.classList.add('translate-x-4'); else this.knob.classList.remove('translate-x-4');
        }
        if (this.label){ 
            this.label.textContent = dark ? 'Dark Mode' : 'Light Mode';
        }
        // ensure button text color contrasts (explicit utility override if needed)
        if (this.toggleBtn){
            if (dark){
                this.toggleBtn.classList.remove('text-gray-700');
                this.toggleBtn.classList.add('text-gray-300');
            } else {
                this.toggleBtn.classList.remove('text-gray-300');
                this.toggleBtn.classList.add('text-gray-700');
            }
        }
        if (this.toggleBtn){ this.toggleBtn.setAttribute('aria-pressed', dark ? 'true':'false'); }
    }
    toggle(){
        const next = this.current() === 'dark' ? 'light' : 'dark';
        this.apply(next);
        this.updateUI();
    }
}
// Ensure single instance
window.themeToggle = new ThemeToggle();

// Centralized global logout (used by header include)
window.logout = function logout(){
        fetch('/auth/logout', { method:'POST', headers:{ 'Content-Type':'application/json' } })
            .then(r=>r.json())
            .then(d=>{ if(d.success) window.location.href = d.redirect || '/login'; })
            .catch(err=>{ console.error('Logout error:', err); alert('Logout failed. Please try again.'); });
};

// Friends Online functionality
class FriendsOnline {
    constructor() {
        this.skeleton = document.getElementById('friends-skeleton');
        this.friendsList = document.getElementById('friends-list');
        this.init();
    }

    init() {
        this.loadFriends();
    }

    async loadFriends() {
        try {
            // Check if database is available
            const dbStatus = await this.checkDatabaseConnection();
            
            if (dbStatus.connected) {
                // Database found - load friends from API
                const response = await fetch('/api/friends/online');
                
                if (response.ok) {
                    const friends = await response.json();
                    
                    if (friends && friends.length > 0) {
                        this.showFriends(friends);
                    } else {
                        this.showEmptyState();
                    }
                } else {
                    console.warn('Friends API not available');
                    this.showEmptyState();
                }
            } else {
                // No database connection - show empty state
                console.log('Database not connected, showing empty state');
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
            this.showEmptyState();
        }
    }

    async checkDatabaseConnection() {
        try {
            // Check database connectivity via API endpoint
            const response = await fetch('/api/status/database', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const status = await response.json();
                return {
                    connected: status.database === 'connected',
                    message: status.message
                };
            }
            
            return { connected: false, message: 'Database check failed' };
        } catch (error) {
            console.warn('Database connectivity check failed:', error);
            return { connected: false, message: 'Connection error' };
        }
    }

    showEmptyState() {
        this.skeleton.classList.add('hidden');
        this.friendsList.classList.remove('hidden');
        
        this.friendsList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <svg class="w-12 h-12 mb-3 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zM4 18v-4.8C4 11.29 5.29 10 7.2 10H9c.8 0 1.6.31 2.19.86l.8.72L10.5 14c-.28.28-.45.66-.45 1.05 0 .39.17.77.45 1.05l.55.54c.28.28.66.45 1.05.45s.77-.17 1.05-.45l.54-.54c.28-.28.45-.66.45-1.05 0-.39-.17-.77-.45-1.05L12.64 13l.86-.8c.55-.59 1.39-.86 2.19-.86h1.8c1.91 0 3.2 1.29 3.2 3.2V18c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2zm8-10c0-2.21-1.79-4-4-4S4 5.79 4 8s1.79 4 4 4 4-1.79 4-4z"/>
                </svg>
                <p class="text-sm">No friends online</p>
                <p class="text-xs mt-1">Check back later!</p>
            </div>
        `;
    }

    showFriends(friends) {
        this.skeleton.classList.add('hidden');
        this.friendsList.classList.remove('hidden');
        
        const friendsHTML = friends.map(friend => `
            <div class="flex items-center space-x-3 mb-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                <div class="relative">
                    <img src="${friend.avatar || '/images/default-avatar.png'}" 
                         alt="${friend.name}" 
                         class="w-8 h-8 rounded-full">
                    <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">${friend.name}</p>
                    <p class="text-xs text-gray-500 truncate">${friend.status || 'Online'}</p>
                </div>
            </div>
        `).join('');
        
        this.friendsList.innerHTML = friendsHTML;
    }
}

// User Menu Dropdown functionality
class UserMenuDropdown {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.menuButton = document.getElementById('user-menu-button');
        this.menu = document.getElementById('user-menu');
        
        if (this.menuButton && this.menu) {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // Toggle menu on button click
        this.menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target) && !this.menuButton.contains(e.target)) {
                this.closeMenu();
            }
        });
    }

    toggleMenu() {
        if (this.menu.classList.contains('hidden')) {
            this.openMenu();
        } else {
            this.closeMenu();
        }
    }

    openMenu() {
        this.menu.classList.remove('hidden');
        this.menuButton.setAttribute('aria-expanded', 'true');
    }

    closeMenu() {
        this.menu.classList.add('hidden');
        this.menuButton.setAttribute('aria-expanded', 'false');
    }
}

// Initialize User Menu Dropdown
new UserMenuDropdown();

// Initialize Friends Online when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new FriendsOnline();
});