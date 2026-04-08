// ============================================================
// SteelSync-Opt — Dashboard UI Module
// ============================================================

import { formatINR, formatTons, formatPercent, formatNumber } from '../utils/formatters.js';
import { APP_CONFIG } from '../data/constants.js';

/**
 * Render KPI cards
 */
export function renderKPIs(container, data, optimizationResult) {
    const { vessels, rakes, inventory } = data;
    const opt = optimizationResult;

    // Compute KPIs
    const totalCost = opt?.totalCost || 0;
    const demurrage = opt?.costBreakdown?.demurrage || 0;
    const activeVessels = vessels.filter(v => v.status !== 'completed').length;
    const delayedVessels = vessels.filter(v => v.status === 'delayed').length;
    const activeRakes = rakes.filter(r => r.status === 'in-transit').length;

    // Supply reliability
    let totalItems = 0, healthyItems = 0;
    for (const plantId in inventory) {
        for (const matId in inventory[plantId]) {
            totalItems++;
            if (inventory[plantId][matId].status === 'healthy') healthyItems++;
        }
    }
    const reliability = totalItems > 0 ? healthyItems / totalItems : 0;

    const kpis = [
        {
            label: 'Total Logistics Cost',
            value: formatINR(totalCost, true),
            icon: '💰',
            change: opt?.savings ? `-${opt.savings.percentSaved}%` : null,
            changeDir: 'positive',
            type: 'kpi-primary',
        },
        {
            label: 'Demurrage Charges',
            value: formatINR(demurrage, true),
            icon: '⏱️',
            change: opt?.savings ? `-${opt.savings.demurragePercentSaved}%` : null,
            changeDir: 'positive',
            type: 'kpi-danger',
        },
        {
            label: 'Active Vessels',
            value: activeVessels,
            icon: '🚢',
            change: delayedVessels > 0 ? `${delayedVessels} delayed` : 'All on time',
            changeDir: delayedVessels > 0 ? 'negative' : 'positive',
            type: 'kpi-warning',
        },
        {
            label: 'Rakes In Transit',
            value: activeRakes,
            icon: '🚂',
            change: `${rakes.filter(r => r.status === 'waiting').length} scheduled`,
            changeDir: 'neutral',
            type: 'kpi-cyan',
        },
        {
            label: 'Supply Reliability',
            value: formatPercent(reliability, 0),
            icon: '📊',
            change: 'vs 72% baseline',
            changeDir: reliability > 0.72 ? 'positive' : 'negative',
            type: 'kpi-success',
        },
        {
            label: 'Cost Savings',
            value: opt?.savings ? formatINR(opt.savings.totalSaved, true) : '—',
            icon: '✨',
            change: 'AI-optimized',
            changeDir: 'positive',
            type: 'kpi-purple',
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
export function renderPageHeader(container, title, subtitle) {
    container.innerHTML = `
        <div class="page-header-left">
            <h1 class="page-title">${title}</h1>
            <p class="page-subtitle">${subtitle}</p>
        </div>
        <div class="page-header-right">
            <span class="live-indicator">Live</span>
            <span class="last-updated" id="lastUpdated"></span>
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
