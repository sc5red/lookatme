// Admin Theme Toggle System
class AdminThemeToggle {
    static instance;
    
    constructor() {
        if (AdminThemeToggle.instance) return AdminThemeToggle.instance;
        AdminThemeToggle.instance = this;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.html = document.documentElement;
        this.toggleBtn = document.getElementById('admin-theme-toggle');
        this.sunIcon = document.getElementById('admin-sun-icon');
        this.moonIcon = document.getElementById('admin-moon-icon');
        this.knob = document.getElementById('admin-theme-switch');
        this.label = document.getElementById('admin-theme-text');

        // Apply saved theme on load
        this.syncFromSaved();
        this.updateUI();

        // Setup event listener
        if (this.toggleBtn) {
            this.toggleBtn.setAttribute('role', 'button');
            this.toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle();
            });
        }
    }

    current() {
        return this.html.classList.contains('dark') ? 'dark' : 'light';
    }

    apply(theme) {
        if (theme === 'dark') {
            this.html.classList.add('dark');
        } else {
            this.html.classList.remove('dark');
        }
        
        try {
            localStorage.setItem('admin-theme', theme);
            // Persist cookie for server-side rendering
            document.cookie = `admin-theme=${theme};path=/;max-age=${60*60*24*365}`;
        } catch(e) {
            console.error('Failed to save theme preference:', e);
        }
    }

    syncFromSaved() {
        try {
            const saved = localStorage.getItem('admin-theme');
            if (saved === 'dark') {
                this.apply('dark');
            } else if (saved === 'light') {
                this.apply('light');
            } else {
                // Default to dark for admin panel
                this.apply('dark');
            }
        } catch(e) {
            // Fallback to dark theme
            this.apply('dark');
        }
    }

    updateUI() {
        const dark = this.current() === 'dark';
        
        // Toggle sun/moon icons
        if (this.sunIcon && this.moonIcon) {
            if (dark) {
                this.sunIcon.classList.add('hidden');
                this.moonIcon.classList.remove('hidden');
            } else {
                this.sunIcon.classList.remove('hidden');
                this.moonIcon.classList.add('hidden');
            }
        }

        // Animate toggle switch
        if (this.knob) {
            if (dark) {
                this.knob.classList.add('translate-x-4');
            } else {
                this.knob.classList.remove('translate-x-4');
            }
        }

        // Update label text
        if (this.label) {
            this.label.textContent = dark ? 'Dark Mode' : 'Light Mode';
        }

        // Update button aria attribute
        if (this.toggleBtn) {
            this.toggleBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        }
    }

    toggle() {
        const next = this.current() === 'dark' ? 'light' : 'dark';
        this.apply(next);
        this.updateUI();
    }
}

// Initialize theme toggle
window.adminThemeToggle = new AdminThemeToggle();
