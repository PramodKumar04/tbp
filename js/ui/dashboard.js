// ============================================================
// SteelSync-Opt — Dashboard UI Module
// ============================================================

import { formatINR, formatPercent } from '../utils/formatters.js';

/**
 * Render KPI cards using Summary API data
 */
export function renderKPIs(container, summaryData) {
    if (!container || !summaryData) return;

    const {
        totalCost = 0,
        optimizedCost = 0,
        savings = 0,
        delayedVesselsCount = 0,
        rakeUtilization = 0,
        planCount = 0
    } = summaryData;

    const kpis = [
        {
            label: 'Total Logistics Budget',
            value: formatINR(totalCost, true),
            icon: '💰',
            change: savings > 0 ? `-${formatINR(savings, true)} saved` : null,
            changeDir: 'positive',
            type: 'kpi-primary',
        },
        {
            label: 'Optimized Cost (Latest)',
            value: formatINR(optimizedCost, true),
            icon: '✨',
            change: `v${planCount} Optimization`,
            changeDir: 'neutral',
            type: 'kpi-purple',
        },
        {
            label: 'Delayed Vessels',
            value: delayedVesselsCount,
            icon: '🚢',
            change: delayedVesselsCount > 0 ? 'Urgent attention' : 'Normal Operations',
            changeDir: delayedVesselsCount > 0 ? 'negative' : 'positive',
            type: 'kpi-danger',
        },
        {
            label: 'Rake Utilization',
            value: formatPercent(rakeUtilization / 100, 0),
            icon: '🚂',
            change: rakeUtilization > 80 ? 'Optimal' : 'Under capacity',
            changeDir: rakeUtilization > 80 ? 'positive' : 'warning',
            type: 'kpi-cyan',
        },
    ];

    container.innerHTML = kpis.map((kpi, i) => `
        <div class="kpi-card ${kpi.type} hover-lift" style="animation-delay: ${i * 0.05}s">
            <div class="kpi-top">
                <span class="kpi-label">${kpi.label}</span>
                <div class="kpi-icon">${kpi.icon}</div>
            </div>
            <div class="kpi-value count-up">${kpi.value}</div>
            ${kpi.change ? `
                <div class="kpi-change ${kpi.changeDir}">
                    ${kpi.changeDir === 'positive' ? '↗' : kpi.changeDir === 'negative' ? '↘' : '→'}
                    ${kpi.change}
                </div>
            ` : ''}
        </div>
    `).join('');
}

/**
 * Render page header
 */
export function renderPageHeader(container, title, subtitle, context = {}) {
    if (!container) return;
    const initials = (context.userInitials || context.username || 'U').toString().trim().slice(0, 1).toUpperCase();
    const label = context.username || context.userLabel || 'Account';
    container.innerHTML = `
        <div class="page-header-left">
            <h1 class="page-title">${title}</h1>
            <p class="page-subtitle">${subtitle}</p>
        </div>
        <div class="page-header-right">
            <div class="header-meta-group">
                <span class="live-indicator">Real-Time Data</span>
                <span class="last-updated" id="lastUpdated"></span>
            </div>
            <button class="profile-trigger" id="dashboardProfileTrigger" title="User Profile" type="button">
                <span class="profile-trigger-avatar">${initials}</span>
                <span class="profile-trigger-label">${label}</span>
            </button>
        </div>
    `;
    updateTimestamp();
}

export function updateTimestamp() {
    const el = document.getElementById('lastUpdated');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}
