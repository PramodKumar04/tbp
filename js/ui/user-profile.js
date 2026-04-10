/**
 * SteelSync-Opt — User Profile Dashboard Module
 * Handles session-specific user identity and fleet history.
 */

import { auth } from '../auth.js';
import { apiFetch } from '../utils/api.js';
import { formatINR } from '../utils/formatters.js';

let profilePanel = null;
let profileOverlay = null;

/**
 * Initialize and render the profile panel container in the DOM
 */
export function renderUserProfile() {
    // 1. Create Overlay
    profileOverlay = document.createElement('div');
    profileOverlay.className = 'profile-overlay';
    document.body.appendChild(profileOverlay);

    // 2. Create Panel
    profilePanel = document.createElement('div');
    profilePanel.className = 'profile-panel';
    document.body.appendChild(profilePanel);

    // Close on overlay click
    profileOverlay.addEventListener('click', () => toggleProfile(false));
}

/**
 * Toggle the profile panel visibility
 */
export async function toggleProfile(show) {
    if (!profilePanel || !profileOverlay) return;

    if (show) {
        // Fetch fresh data before showing
        await updateProfileContent();
        profilePanel.classList.add('active');
        profileOverlay.classList.add('active');
    } else {
        profilePanel.classList.remove('active');
        profileOverlay.classList.remove('active');
    }
}

/**
 * Update the HTML content of the profile panel with user data
 */
async function updateProfileContent() {
    const user = auth.getUser() || { username: '', email: '' };
    
    // Fetch bookings and budget
    let bookings = [];
    let budgetData = { budget: 0 };
    
    try {
        const [planRes, budgetRes] = await Promise.all([
            apiFetch('/api/vessels/plans'),
            apiFetch('/api/budget')
        ]);
        
        if (planRes?.ok) {
            const data = await planRes.json();
            bookings = data.data || [];
        }
        
        if (budgetRes?.ok) {
            budgetData = await budgetRes.json();
        }
    } catch (e) {
        console.warn('[Profile] Failed to fetch data', e);
    }

    const initials = (user.username || '?').substring(0, 1).toUpperCase();
    const berthedCount = bookings.filter(b => b.status === 'berthed').length;
    const transitCount = bookings.filter(b => b.status === 'in-transit').length;

    profilePanel.innerHTML = `
        <div class="profile-user-header">
            <div class="profile-avatar">${initials}</div>
            <div class="profile-user-info">
                <h2>${user.username}</h2>
                <p>${user.email}</p>
            </div>
        </div>

        <div class="profile-stats-grid">
            <div class="p-stat-card">
                <div class="p-stat-value">${bookings.length}</div>
                <div class="p-stat-label">Total Bookings</div>
            </div>
            <div class="p-stat-card">
                <div class="p-stat-value">${formatINR(budgetData.budget || 0, true)}</div>
                <div class="p-stat-label">Current Budget</div>
            </div>
            <div class="p-stat-card">
                <div class="p-stat-value">${berthedCount}</div>
                <div class="p-stat-label">Berthed</div>
            </div>
            <div class="p-stat-card">
                <div class="p-stat-value">${transitCount}</div>
                <div class="p-stat-label">In Transit</div>
            </div>
        </div>

        <div class="profile-section-title">
            <span>Recent Bookings</span>
            <span style="font-size:0.7rem;font-weight:400;color:var(--text-muted)">Latest 5</span>
        </div>

        <div class="profile-bookings-list">
            ${bookings.length > 0 ? bookings.slice(0, 5).map(booking => `
                <div class="booking-item">
                    <div class="booking-item-header">
                        <span class="booking-vessel-name">${booking.name}</span>
                        <span class="booking-status status-${booking.status === 'berthed' ? 'berthed' : 'transit'}">
                            ${booking.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="booking-details">
                        <span>${booking.destinationPortName}</span>
                        <span>${new Date(booking.planTimestamp || Date.now()).toLocaleDateString()}</span>
                    </div>
                </div>
            `).join('') : `
                <div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.85rem">
                    No vessel bookings found.
                </div>
            `}
        </div>

        <div class="profile-footer">
            <button class="btn-profile-logout" id="profileLogoutBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sign Out
            </button>
        </div>
    `;

    // Logout event
    document.getElementById('profileLogoutBtn')?.addEventListener('click', () => {
        auth.logout();
    });
}
