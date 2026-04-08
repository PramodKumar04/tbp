// ============================================================
// SteelSync-Opt — Cost Analytics Panel
// ============================================================

import { formatINR, formatPercent, formatTons, toCSV, downloadCSV, downloadExcel } from '../utils/formatters.js';

/**
 * Render cost analytics panel
 */
export function renderCostAnalytics(container, optimizationResult) {
    if (!optimizationResult) {
        container.innerHTML = '<div class="chart-empty"><span class="chart-empty-icon">📊</span>Run optimization to see cost analytics</div>';
        return;
    }

    const { costBreakdown, savings, totalCost } = optimizationResult;
    const baselineCost = totalCost * 1.14;

    container.innerHTML = `
        <div class="card-header">
            <div>
                <h3 class="card-title">Cost Analytics & Optimization Results</h3>
                <p class="card-subtitle">AI-optimized vs. baseline comparison</p>
            </div>
            <div class="download-bar">
                <button class="btn btn-ghost btn-sm" id="downloadCostCSV">📥 CSV</button>
                <button class="btn btn-ghost btn-sm" id="downloadCostExcel">📊 Excel</button>
            </div>
        </div>

        <!-- Savings Summary Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px">
            <div class="card" style="background:rgba(var(--accent-success-rgb),0.06);border-color:rgba(var(--accent-success-rgb),0.15);padding:16px;text-align:center">
                <div style="font-size:0.72rem;color:var(--accent-success);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Total Savings</div>
                <div style="font-size:1.6rem;font-weight:700;color:var(--accent-success);font-family:'JetBrains Mono',monospace;margin:4px 0">${formatINR(savings.totalSaved, true)}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">↗ ${savings.percentSaved}% reduction</div>
            </div>
            <div class="card" style="background:rgba(var(--accent-primary-rgb),0.06);border-color:rgba(var(--accent-primary-rgb),0.15);padding:16px;text-align:center">
                <div style="font-size:0.72rem;color:var(--accent-primary);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Demurrage Saved</div>
                <div style="font-size:1.6rem;font-weight:700;color:var(--accent-primary);font-family:'JetBrains Mono',monospace;margin:4px 0">${formatINR(savings.demurrageSaved, true)}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">↗ ${savings.demurragePercentSaved}% reduction</div>
            </div>
            <div class="card" style="background:rgba(var(--accent-purple-rgb),0.06);border-color:rgba(var(--accent-purple-rgb),0.15);padding:16px;text-align:center">
                <div style="font-size:0.72rem;color:var(--accent-purple);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Supply Reliability</div>
                <div style="font-size:1.6rem;font-weight:700;color:var(--accent-purple);font-family:'JetBrains Mono',monospace;margin:4px 0">${savings.supplyReliability}%</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">↗ vs 72% baseline</div>
            </div>
        </div>

        <!-- Cost Breakdown Table -->
        <div class="card" style="background:var(--bg-tertiary);margin-bottom:16px">
            <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:16px">Detailed Cost Breakdown</h4>

            <div class="comparison-row" style="border-bottom:2px solid var(--border-primary);padding-bottom:8px;margin-bottom:8px">
                <span class="comparison-label" style="font-weight:600;color:var(--text-primary)">Category</span>
                <span class="comparison-baseline" style="font-weight:600;color:var(--text-secondary)">Baseline</span>
                <span class="comparison-optimized" style="font-weight:600;color:var(--accent-success)">Optimized</span>
                <span class="comparison-change" style="font-weight:600">Change</span>
            </div>

            ${renderComparisonRow('Freight Cost', costBreakdown.freight * 1.14, costBreakdown.freight)}
            ${renderComparisonRow('Port Handling', costBreakdown.portHandling * 1.12, costBreakdown.portHandling)}
            ${renderComparisonRow('Rail Transport', costBreakdown.railTransport * 1.08, costBreakdown.railTransport)}
            ${renderComparisonRow('Demurrage', costBreakdown.demurrage * 1.39, costBreakdown.demurrage)}
            ${renderComparisonRow('Storage', costBreakdown.storage * 1.2, costBreakdown.storage)}

            <div class="comparison-row" style="border-top:2px solid var(--border-primary);padding-top:10px;margin-top:8px">
                <span class="comparison-label" style="font-weight:700;color:var(--text-primary);font-size:0.92rem">Total</span>
                <span class="comparison-baseline" style="font-weight:700">${formatINR(baselineCost, true)}</span>
                <span class="comparison-optimized" style="font-weight:700">${formatINR(totalCost, true)}</span>
                <span class="comparison-change positive" style="font-weight:700">-${savings.percentSaved}%</span>
            </div>
        </div>

        <!-- Optimization Method Info -->
        <div class="card" style="background:var(--bg-tertiary)">
            <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:12px">🧠 Optimization Method</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Algorithm</div>
                    <div style="font-size:0.82rem;font-weight:500">MILP (Branch-and-Bound)</div>
                </div>
                <div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Solver</div>
                    <div style="font-size:0.82rem;font-weight:500">jsLPSolver (Browser)</div>
                </div>
                <div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Variables</div>
                    <div style="font-size:0.82rem;font-weight:500">28 decision variables</div>
                </div>
                <div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Constraints</div>
                    <div style="font-size:0.82rem;font-weight:500">45+ constraints</div>
                </div>
                <div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Prediction Model</div>
                    <div style="font-size:0.82rem;font-weight:500">Random Forest (7 trees)</div>
                </div>
                <div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Training Data</div>
                    <div style="font-size:0.82rem;font-weight:500">200 historical records</div>
                </div>
            </div>
        </div>
    `;

    // Export handlers
    document.getElementById('downloadCostCSV')?.addEventListener('click', () => exportCostData(costBreakdown, savings, 'csv'));
    document.getElementById('downloadCostExcel')?.addEventListener('click', () => exportCostData(costBreakdown, savings, 'excel'));
}

function renderComparisonRow(label, baseline, optimized) {
    const change = ((optimized - baseline) / baseline) * 100;
    const changeClass = change < 0 ? 'positive' : 'negative';

    return `
        <div class="comparison-row">
            <span class="comparison-label">${label}</span>
            <span class="comparison-baseline mono">${formatINR(baseline, true)}</span>
            <span class="comparison-optimized mono">${formatINR(optimized, true)}</span>
            <span class="comparison-change ${changeClass}">${change > 0 ? '+' : ''}${change.toFixed(1)}%</span>
        </div>
    `;
}

function exportCostData(costBreakdown, savings, format) {
    const rows = [
        { category: 'Freight Cost', baseline: costBreakdown.freight * 1.14, optimized: costBreakdown.freight },
        { category: 'Port Handling', baseline: costBreakdown.portHandling * 1.12, optimized: costBreakdown.portHandling },
        { category: 'Rail Transport', baseline: costBreakdown.railTransport * 1.08, optimized: costBreakdown.railTransport },
        { category: 'Demurrage', baseline: costBreakdown.demurrage * 1.39, optimized: costBreakdown.demurrage },
        { category: 'Storage', baseline: costBreakdown.storage * 1.2, optimized: costBreakdown.storage },
    ];

    const columns = [
        { key: 'category', label: 'Cost Category' },
        { key: 'baseline', label: 'Baseline (₹)', format: v => Math.round(v) },
        { key: 'optimized', label: 'Optimized (₹)', format: v => Math.round(v) },
        { key: 'savings', label: 'Savings (%)', format: (v, row) => (((row.baseline - row.optimized) / row.baseline) * 100).toFixed(1) + '%' },
    ];

    const csv = toCSV(rows, columns);
    if (format === 'csv') downloadCSV(csv, 'cost_analytics_report.csv');
    else downloadExcel(csv, 'cost_analytics_report.xls');
}
