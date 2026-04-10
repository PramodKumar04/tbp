/**
 * SteelSync-Opt Authentication Manager
 */
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('steelsync_token');
        this.user = JSON.parse(localStorage.getItem('steelsync_user'));
        this.apiBase = '/api/auth';
    }

    isAuthenticated() {
        return !!this.token;
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    async signup(username, email, password) {
        try {
            const response = await fetch(`${this.apiBase}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Signup failed');

            this.loginSuccess(data);
            return data;
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Login failed');

            this.loginSuccess(data);
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    loginSuccess(data) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('steelsync_token', this.token);
        localStorage.setItem('steelsync_user', JSON.stringify(this.user));
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('steelsync_token');
        localStorage.removeItem('steelsync_user');
        window.location.reload(); 
    }

    checkAuth() {
        // No longer redirects to separate pages
        return this.isAuthenticated();
    }
}

export const auth = new AuthManager();
