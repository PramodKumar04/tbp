// ============================================================
// SteelSync-Opt — Chart Configurations (Chart.js)
// ============================================================

import { formatINR, formatTons, formatShortDate, formatPercent } from '../utils/formatters.js';
import { APP_CONFIG, MATERIALS, PLANTS } from '../data/constants.js';

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: true,
            position: 'bottom',
            labels: {
                color: '#94a3b8',
                font: { family: 'Inter', size: 11 },
                padding: 16,
                usePointStyle: true,
                pointStyleWidth: 8,
            },
        },
        tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: 'Inter', weight: '600', size: 12 },
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            displayColors: true,
            boxPadding: 4,
        },
    },
    scales: {
        x: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } },
        },
        y: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } },
        },
    },
};

// ── Store chart instances ────────────────────────────────
const chartInstances = {};

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

// ── 1. Cost Breakdown Doughnut ──────────────────────────
export function renderCostDoughnut(canvasId, costBreakdown) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = ['Freight', 'Port Handling', 'Rail Transport', 'Demurrage', 'Storage'];
    const data = [
        costBreakdown.freight,
        costBreakdown.portHandling,
        costBreakdown.railTransport,
        costBreakdown.demurrage,
        costBreakdown.storage,
    ];
    const colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ef4444', '#f59e0b'];

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: '#111827',
                borderWidth: 3,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        padding: 14,
                        usePointStyle: true,
                        pointStyleWidth: 8,
                    },
                },
                tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatINR(ctx.raw, true)}`,
                    },
                },
            },
        },
    });
}

// ── 2. Vessel Timeline (Gantt-style) ────────────────────
export function renderVesselTimeline(canvasId, vessels) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const now = new Date();
    const sorted = [...vessels].sort((a, b) => new Date(a.actualETA) - new Date(b.actualETA));

    const labels = sorted.map(v => v.name.replace('MV ', ''));
    const scheduledData = sorted.map(v => {
        const eta = new Date(v.scheduledETA);
        return Math.round((eta - now) / (1000 * 60 * 60));
    });
    const delayData = sorted.map(v => Math.max(0, v.delayHours));

    const barColors = sorted.map(v => {
        if (v.status === 'delayed') return 'rgba(239, 68, 68, 0.7)';
        if (v.status === 'berthed' || v.status === 'unloading') return 'rgba(16, 185, 129, 0.7)';
        return 'rgba(59, 130, 246, 0.7)';
    });

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Scheduled (hrs from now)',
                    data: scheduledData,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderRadius: 4,
                    borderSkipped: false,
                },
                {
                    label: 'Delay (hrs)',
                    data: delayData,
                    backgroundColor: sorted.map(v => v.delayHours > 24 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.6)'),
                    borderRadius: 4,
                    borderSkipped: false,
                },
            ],
        },
        options: {
            ...CHART_DEFAULTS,
            indexAxis: 'y',
            plugins: {
                ...CHART_DEFAULTS.plugins,
                tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}h`,
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    ...CHART_DEFAULTS.scales.x,
                    title: { display: true, text: 'Hours from Now', color: '#64748b', font: { size: 10 } },
                },
                y: {
                    stacked: true,
                    ...CHART_DEFAULTS.scales.y,
                },
            },
        },
    });
}

// ── 3. Inventory Projection (Stacked Area) ──────────────
export function renderInventoryChart(canvasId, projection, plantId = 'bhilai') {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const plantData = projection[plantId];
    if (!plantData) return;

    const materialColors = {
        coal: { bg: 'rgba(55, 65, 81, 0.4)', border: '#6b7280' },
        iron_ore: { bg: 'rgba(220, 38, 38, 0.3)', border: '#ef4444' },
        limestone: { bg: 'rgba(212, 212, 216, 0.3)', border: '#a1a1aa' },
        dolomite: { bg: 'rgba(167, 139, 250, 0.3)', border: '#8b5cf6' },
    };

    const datasets = [];
    let labels = [];

    for (const [matId, days] of Object.entries(plantData)) {
        if (!labels.length) {
            labels = days.map(d => formatShortDate(d.date));
        }
        const mat = MATERIALS.find(m => m.id === matId);
        const colors = materialColors[matId] || { bg: 'rgba(59,130,246,0.3)', border: '#3b82f6' };

        datasets.push({
            label: mat?.name || matId,
            data: days.map(d => d.level),
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: 1.5,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
        });
    }

    // Add safety stock line for first material
    const firstMat = Object.keys(plantData)[0];
    if (firstMat && plantData[firstMat].length) {
        datasets.push({
            label: 'Safety Stock',
            data: plantData[firstMat].map(d => d.safetyStock),
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            fill: false,
            pointRadius: 0,
        });
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            ...CHART_DEFAULTS,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                ...CHART_DEFAULTS.plugins,
                tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatTons(ctx.raw)}`,
                    },
                },
            },
            scales: {
                x: { ...CHART_DEFAULTS.scales.x },
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    title: { display: true, text: 'Tons', color: '#64748b', font: { size: 10 } },
                },
            },
        },
    });
}

// ── 4. Delay Predictions Scatter ────────────────────────
export function renderDelayScatter(canvasId, vessels, predictions) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const data = vessels.map((v, i) => ({
        x: predictions[i]?.predictedDelay || 0,
        y: v.delayHours,
        label: v.name,
    }));

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Vessels',
                    data,
                    backgroundColor: data.map(d => {
                        const error = Math.abs(d.x - d.y);
                        if (error < 6) return 'rgba(16, 185, 129, 0.7)';
                        if (error < 18) return 'rgba(245, 158, 11, 0.7)';
                        return 'rgba(239, 68, 68, 0.7)';
                    }),
                    borderColor: data.map(d => {
                        const error = Math.abs(d.x - d.y);
                        if (error < 6) return '#10b981';
                        if (error < 18) return '#f59e0b';
                        return '#ef4444';
                    }),
                    borderWidth: 1.5,
                    pointRadius: 7,
                    pointHoverRadius: 10,
                },
                {
                    label: 'Perfect Prediction',
                    data: [{ x: -10, y: -10 }, { x: 60, y: 60 }],
                    type: 'line',
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderDash: [6, 4],
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                },
            ],
        },
        options: {
            ...CHART_DEFAULTS,
            plugins: {
                ...CHART_DEFAULTS.plugins,
                tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                        label: (ctx) => {
                            const d = ctx.raw;
                            return `${d.label || ''}: Predicted ${d.x}h, Actual ${d.y}h`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ...CHART_DEFAULTS.scales.x,
                    title: { display: true, text: 'Predicted Delay (hrs)', color: '#64748b', font: { size: 10 } },
                },
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    title: { display: true, text: 'Actual Delay (hrs)', color: '#64748b', font: { size: 10 } },
                },
            },
        },
    });
}

// ── 5. Cost Trend Line ──────────────────────────────────
export function renderCostTrend(canvasId, data) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Generate 30-day trend data
    const now = new Date();
    const labels = [];
    const baselineCosts = [];
    const optimizedCosts = [];
    const baseCost = data?.totalCost || 50000000;

    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(formatShortDate(date));

        const variation = 0.9 + Math.random() * 0.2;
        const baseline = baseCost * variation * 1.14;
        const optimized = baseCost * variation;

        baselineCosts.push(baseline);
        optimizedCosts.push(optimized);
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Baseline Cost',
                    data: baselineCosts,
                    borderColor: 'rgba(239, 68, 68, 0.6)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2,
                },
                {
                    label: 'Optimized Cost',
                    data: optimizedCosts,
                    borderColor: 'rgba(16, 185, 129, 0.8)',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2,
                },
            ],
        },
        options: {
            ...CHART_DEFAULTS,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                ...CHART_DEFAULTS.plugins,
                tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatINR(ctx.raw, true)}`,
                    },
                },
            },
            scales: {
                x: { ...CHART_DEFAULTS.scales.x },
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    title: { display: true, text: 'Cost (₹)', color: '#64748b', font: { size: 10 } },
                },
            },
        },
    });
}

// ── 6. Supply Reliability Gauge ─────────────────────────
export function renderReliabilityGauge(container, reliability) {
    const pct = Math.round(reliability * 100);
    const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

    // SVG arc gauge
    const r = 60;
    const circumference = Math.PI * r;
    const offset = circumference - (pct / 100) * circumference;

    container.innerHTML = `
        <div class="gauge-container">
            <svg class="gauge-svg" viewBox="0 0 150 90">
                <path class="gauge-track" d="M 15 80 A 60 60 0 0 1 135 80" />
                <path class="gauge-fill" d="M 15 80 A 60 60 0 0 1 135 80"
                    stroke="${color}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}" />
                <text x="75" y="70" text-anchor="middle" fill="${color}"
                    font-family="JetBrains Mono" font-size="22" font-weight="700">${pct}%</text>
                <text x="75" y="85" text-anchor="middle" fill="#64748b"
                    font-family="Inter" font-size="9">RELIABILITY</text>
            </svg>
        </div>
    `;
}

// ── Cleanup ─────────────────────────────────────────────
export function destroyAllCharts() {
    for (const id in chartInstances) {
        chartInstances[id].destroy();
    }
}
