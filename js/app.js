// ============================================================
// SteelSync-Opt — Main Application Controller
// ============================================================

import { generateAllData, generateInventoryProjection } from './data/synthetic-data.js';
import { predictor } from './engines/prediction.js';
import { optimizeLogistics } from './engines/optimizer.js';
import { renderKPIs, renderPageHeader, updateTimestamp } from './ui/dashboard.js';
import {
    renderCostDoughnut, renderVesselTimeline, renderInventoryChart,
    renderDelayScatter, renderCostTrend, renderReliabilityGauge,
} from './ui/charts.js';
import { renderVesselTracker } from './ui/vessel-tracker.js';
import { renderInventoryPanel } from './ui/inventory.js';
import { renderCostAnalytics } from './ui/cost-analytics.js';
import { renderWhatIfPanel } from './ui/what-if.js';
import { renderDataInput } from './ui/data-input.js';
import { renderVesselPlanning } from './ui/vessel-planning.js';
import { APP_CONFIG } from './data/constants.js';

// ── Application State ────────────────────────────────────
let appData = null;
let optimizationResult = null;
let predictions = [];
let currentPanel = 'overview';

// ── Presentation Mode State ──────────────────────────────
let presentationActive = false;
let currentSlide = 0;
const slides = [
    {
        title: 'Welcome to SteelSync-Opt',
        subtitle: 'AI-Based Port-to-Plant Logistics Optimization Engine',
        content: `
            <div style="text-align:center;padding:20px 0">
                <div style="font-size:4rem;margin-bottom:20px">🏗️</div>
                <h2 style="font-size:1.8rem;margin-bottom:12px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">SteelSync-Opt</h2>
                <p style="font-size:1.1rem;color:#94a3b8;max-width:600px;margin:0 auto">
                    An AI-driven logistics optimization system for the steel industry, targeting the movement of raw materials from ports to steel plants.
                </p>
                <div style="display:flex;gap:24px;justify-content:center;margin-top:32px;flex-wrap:wrap">
                    <div style="text-align:center">
                        <div style="font-size:2rem;font-weight:700;color:#3b82f6">12%</div>
                        <div style="font-size:0.75rem;color:#64748b">Cost Reduction</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:2rem;font-weight:700;color:#10b981">28%</div>
                        <div style="font-size:0.75rem;color:#64748b">Less Demurrage</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:2rem;font-weight:700;color:#8b5cf6">15%</div>
                        <div style="font-size:0.75rem;color:#64748b">Better Reliability</div>
                    </div>
                </div>
            </div>
        `,
    },
    {
        title: 'The Problem',
        subtitle: 'Current logistics challenges in steel industry',
        content: `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div style="padding:20px;border-radius:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15)">
                    <div style="font-size:1.3rem;margin-bottom:8px">📧</div>
                    <h4 style="font-size:0.95rem;margin-bottom:6px">Manual ETA Tracking</h4>
                    <p style="font-size:0.8rem;color:#94a3b8">Vessel ETAs received via emails/fax. Updates inconsistent and not real-time.</p>
                </div>
                <div style="padding:20px;border-radius:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15)">
                    <div style="font-size:1.3rem;margin-bottom:8px">📊</div>
                    <h4 style="font-size:0.95rem;margin-bottom:6px">Excel-Based Planning</h4>
                    <p style="font-size:0.8rem;color:#94a3b8">All operations handled using spreadsheets. Manual data entry across teams.</p>
                </div>
                <div style="padding:20px;border-radius:12px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15)">
                    <div style="font-size:1.3rem;margin-bottom:8px">⚠️</div>
                    <h4 style="font-size:0.95rem;margin-bottom:6px">Human Error Risk</h4>
                    <p style="font-size:0.8rem;color:#94a3b8">A single wrong entry can lead to demurrage costs and production disruptions.</p>
                </div>
                <div style="padding:20px;border-radius:12px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15)">
                    <div style="font-size:1.3rem;margin-bottom:8px">🔗</div>
                    <h4 style="font-size:0.95rem;margin-bottom:6px">Poor Coordination</h4>
                    <p style="font-size:0.8rem;color:#94a3b8">Data inconsistencies across departments. No real-time visibility.</p>
                </div>
            </div>
        `,
    },
    {
        title: 'Our Solution',
        subtitle: 'AI-powered logistics optimization pipeline',
        content: `
            <div style="display:flex;flex-direction:column;gap:12px">
                <div style="display:flex;align-items:center;gap:16px;padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="width:50px;height:50px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">1</div>
                    <div>
                        <h4 style="font-size:0.92rem">Predictive Intelligence</h4>
                        <p style="font-size:0.78rem;color:#94a3b8">Random Forest ML model predicts vessel and train delays</p>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:16px;padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="width:50px;height:50px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#ec4899);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">2</div>
                    <div>
                        <h4 style="font-size:0.92rem">MILP Optimization Engine</h4>
                        <p style="font-size:0.78rem;color:#94a3b8">Mixed-Integer Linear Programming with Branch-and-Bound</p>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:16px;padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="width:50px;height:50px;border-radius:12px;background:linear-gradient(135deg,#10b981,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">3</div>
                    <div>
                        <h4 style="font-size:0.92rem">What-If Simulation</h4>
                        <p style="font-size:0.78rem;color:#94a3b8">Test disruption scenarios and instantly recalculate impact</p>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:16px;padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="width:50px;height:50px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#f97316);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">4</div>
                    <div>
                        <h4 style="font-size:0.92rem">Real-Time Dashboard</h4>
                        <p style="font-size:0.78rem;color:#94a3b8">Visualize logistics flow, costs, and actionable insights</p>
                    </div>
                </div>
            </div>
        `,
    },
    {
        title: 'Mathematical Model',
        subtitle: 'MILP Objective Function & Constraints',
        content: `
            <div style="font-family:'JetBrains Mono',monospace;padding:20px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary);margin-bottom:16px">
                <div style="color:#8b5cf6;font-size:0.78rem;margin-bottom:8px">OBJECTIVE FUNCTION</div>
                <div style="font-size:0.92rem;color:#f1f5f9">
                    Minimize Z = Σ(freight<sub>v</sub> × q<sub>v</sub>) + Σ(handling<sub>p</sub> × q<sub>p</sub>) + Σ(rail<sub>r</sub> × d<sub>r</sub> × q<sub>r</sub>) + Σ(demurrage<sub>v</sub> × delay<sub>v</sub>)
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div style="padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="font-size:0.72rem;color:#06b6d4;font-weight:600;margin-bottom:6px">CONSTRAINT 1</div>
                    <div style="font-size:0.82rem">Inventory Balance</div>
                    <div style="font-size:0.72rem;color:#94a3b8;margin-top:4px">inv[t] = inv[t-1] + unloaded[t] − railed[t]</div>
                </div>
                <div style="padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="font-size:0.72rem;color:#10b981;font-weight:600;margin-bottom:6px">CONSTRAINT 2</div>
                    <div style="font-size:0.82rem">Sequential Unloading</div>
                    <div style="font-size:0.72rem;color:#94a3b8;margin-top:4px">One vessel per berth at any time t</div>
                </div>
                <div style="padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="font-size:0.72rem;color:#f59e0b;font-weight:600;margin-bottom:6px">CONSTRAINT 3</div>
                    <div style="font-size:0.82rem">Rail Capacity</div>
                    <div style="font-size:0.72rem;color:#94a3b8;margin-top:4px">rail[r][t] ≤ rake_capacity × max_rakes</div>
                </div>
                <div style="padding:16px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-primary)">
                    <div style="font-size:0.72rem;color:#ef4444;font-weight:600;margin-bottom:6px">CONSTRAINT 4</div>
                    <div style="font-size:0.82rem">Demand Satisfaction</div>
                    <div style="font-size:0.72rem;color:#94a3b8;margin-top:4px">Σ rail[t] ≥ plant_demand over horizon</div>
                </div>
            </div>
        `,
    },
    {
        title: 'Expected Outcomes',
        subtitle: 'Measurable improvements from AI optimization',
        content: `
            <div style="text-align:center;padding:20px 0">
                <div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-bottom:32px">
                    <div style="padding:28px 36px;border-radius:16px;background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(6,182,212,0.1));border:1px solid rgba(59,130,246,0.2)">
                        <div style="font-size:3rem;font-weight:800;color:#3b82f6;font-family:'JetBrains Mono',monospace">12%</div>
                        <div style="font-size:0.85rem;color:#94a3b8;margin-top:4px">Logistics Cost Reduction</div>
                    </div>
                    <div style="padding:28px 36px;border-radius:16px;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(6,182,212,0.1));border:1px solid rgba(16,185,129,0.2)">
                        <div style="font-size:3rem;font-weight:800;color:#10b981;font-family:'JetBrains Mono',monospace">28%</div>
                        <div style="font-size:0.85rem;color:#94a3b8;margin-top:4px">Demurrage Reduction</div>
                    </div>
                    <div style="padding:28px 36px;border-radius:16px;background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(236,72,153,0.1));border:1px solid rgba(139,92,246,0.2)">
                        <div style="font-size:3rem;font-weight:800;color:#8b5cf6;font-family:'JetBrains Mono',monospace">15%</div>
                        <div style="font-size:0.85rem;color:#94a3b8;margin-top:4px">Supply Reliability Gain</div>
                    </div>
                </div>
                <p style="font-size:0.92rem;color:#94a3b8;max-width:500px;margin:0 auto">
                    These improvements lead to better production planning, reduced operational risk, and increased profitability.
                </p>
            </div>
        `,
    },
];

// ── Initialize Application ───────────────────────────────
export function initApp() {
    console.log('[SteelSync-Opt] Initializing...');

    // 1. Generate data
    appData = generateAllData();
    console.log(`[Data] Generated ${appData.vessels.length} vessels, ${appData.rakes.length} rakes`);

    // 2. Train prediction model
    predictor.train(appData.historicalData, 7);

    // 3. Run predictions for all vessels
    predictions = appData.vessels.map(v => predictor.predictVesselDelay(v));
    console.log('[Predictions] Vessel delay predictions complete');

    // 4. Run optimization
    optimizationResult = optimizeLogistics(appData.vessels, appData.rakes, appData.inventory);
    console.log(`[Optimizer] Total cost: ₹${Math.round(optimizationResult.totalCost).toLocaleString()}`);

    // 5. Setup navigation
    setupNavigation();

    // 6. Render initial view
    switchPanel('overview');

    // 7. Update timestamp periodically
    setInterval(updateTimestamp, 1000);

    // 8. Setup presentation mode
    setupPresentation();

    console.log('[SteelSync-Opt] Ready ✓');
}

// ── Navigation ───────────────────────────────────────────
function setupNavigation() {
    document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
        item.addEventListener('click', () => {
            const panel = item.dataset.panel;
            switchPanel(panel);
        });
    });
}

function switchPanel(panelId) {
    currentPanel = panelId;

    // Update nav active state
    document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
        item.classList.toggle('active', item.dataset.panel === panelId);
    });

    // Hide all panels, show active
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`panel-${panelId}`);
    if (panel) panel.classList.add('active');

    // Render panel content
    renderPanel(panelId);
}

function renderPanel(panelId) {
    switch (panelId) {
        case 'datainput':
            renderDataInputPanel();
            break;
        case 'overview':
            renderOverview();
            break;
        case 'vessels':
            renderVesselsPanel();
            break;
        case 'inventory':
            renderInventoryView();
            break;
        case 'costs':
            renderCostsPanel();
            break;
        case 'whatif':
            renderWhatIfView();
            break;
        case 'predictions':
            renderPredictionsPanel();
            break;
        case 'vesselplan':
            renderVesselPlanPanel();
            break;
    }
}

// ── Panel Renderers ──────────────────────────────────────
function renderDataInputPanel() {
    renderDataInput(document.getElementById('dataInputContent'), (uploadedData) => {
        console.log('[Data Input] User data applied:', uploadedData.type);
        
        // Merge uploaded data into appData based on type
        if (uploadedData.type === 'vessels') {
            appData.vessels = uploadedData.data;
        } else if (uploadedData.type === 'rakes') {
            appData.rakes = uploadedData.data;
        } else if (uploadedData.type === 'inventory') {
            appData.inventory = uploadedData.data;
        }
        
        // Regenerate inventory projection if rakes or inventory were updated
        if (uploadedData.type === 'rakes' || uploadedData.type === 'inventory') {
            if (appData.inventory && appData.rakes) {
                appData.inventoryProjection = generateInventoryProjection(appData.inventory, appData.rakes);
            }
        }
        
        // Re-run optimization and prediction with the new data
        optimizationResult = optimizeLogistics(appData.vessels, appData.rakes, appData.inventory);
        predictions = appData.vessels.map(v => predictor.predictVesselDelay(v));

        // Show notification
        const notif = document.createElement('div');
        notif.className = 'notification notification-success';
        notif.textContent = '✓ Data applied! Dashboard updated with real-world inputs.';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3500);

        // Switch to dashboard
        switchPanel('overview');
    });
}

function renderOverview() {
    // Header
    renderPageHeader(
        document.getElementById('overviewHeader'),
        'Dashboard Overview',
        'AI-optimized port-to-plant logistics monitoring'
    );

    // KPIs
    renderKPIs(document.getElementById('kpiGrid'), appData, optimizationResult);

    // Charts
    setTimeout(() => {
        renderCostDoughnut('costDoughnutChart', optimizationResult.costBreakdown);
        renderVesselTimeline('vesselTimelineChart', appData.vessels);
        renderInventoryChart('inventoryAreaChart', appData.inventoryProjection);
        renderCostTrend('costTrendChart', optimizationResult);

        // Reliability gauge
        const gaugeEl = document.getElementById('reliabilityGauge');
        if (gaugeEl) {
            let totalItems = 0, healthyItems = 0;
            for (const plantId in appData.inventory) {
                for (const matId in appData.inventory[plantId]) {
                    totalItems++;
                    if (appData.inventory[plantId][matId].status === 'healthy') healthyItems++;
                }
            }
            renderReliabilityGauge(gaugeEl, totalItems > 0 ? healthyItems / totalItems : 0);
        }
    }, 100);
}

function renderVesselsPanel() {
    renderVesselTracker(document.getElementById('vesselTrackerContent'), appData.vessels, predictions);
}

function renderInventoryView() {
    renderInventoryPanel(document.getElementById('inventoryContent'), appData.inventory, appData.inventoryProjection);
}

function renderCostsPanel() {
    renderCostAnalytics(document.getElementById('costAnalyticsContent'), optimizationResult);
}

function renderWhatIfView() {
    renderWhatIfPanel(document.getElementById('whatifContent'), appData, optimizationResult);
}

function renderVesselPlanPanel() {
    const container = document.getElementById('vesselPlanContent');
    if (!container || !appData) return;
    renderVesselPlanning(container, appData.vessels, (plan) => {
        console.log('[App] Vessel plan confirmed:', plan);
        // Re-run optimization with updated allocation
        optimizationResult = optimizeLogistics(appData.vessels, appData.rakes, appData.inventory);
        predictions = appData.vessels.map(v => predictor.predictVesselDelay(v));
    });
}

function renderPredictionsPanel() {
    const container = document.getElementById('predictionsContent');
    if (!container) return;

    container.innerHTML = `
        <div class="card-header">
            <div>
                <h3 class="card-title">🤖 ML Delay Predictions</h3>
                <p class="card-subtitle">Random Forest ensemble model — 7 decision trees trained on 200 records</p>
            </div>
        </div>

        <div class="dashboard-grid" style="margin-bottom:20px">
            <div class="chart-card">
                <div class="card-header">
                    <span class="card-title">Predicted vs Actual Delays</span>
                </div>
                <div class="chart-container">
                    <canvas id="predScatterChart"></canvas>
                </div>
            </div>
            <div class="card" style="background:var(--bg-card)">
                <h4 style="font-size:0.95rem;font-weight:600;margin-bottom:16px">Prediction Results</h4>
                ${predictions.map((pred, i) => {
                    const vessel = appData.vessels[i];
                    if (!vessel) return '';
                    const error = Math.abs(pred.predictedDelay - vessel.delayHours);
                    const accuracy = error < 6 ? 'High' : error < 18 ? 'Medium' : 'Low';
                    const accColor = error < 6 ? 'var(--accent-success)' : error < 18 ? 'var(--accent-warning)' : 'var(--accent-danger)';

                    return `
                    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-primary)">
                        <span style="font-size:0.82rem;font-weight:550;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${vessel.name}</span>
                        <span class="mono" style="font-size:0.78rem;color:var(--text-secondary);width:60px;text-align:right">
                            ${pred.predictedDelay > 0 ? '+' : ''}${pred.predictedDelay}h
                        </span>
                        <span style="font-size:0.68rem;color:${accColor};font-weight:600;width:50px;text-align:right">${accuracy}</span>
                        <span style="font-size:0.68rem;color:var(--text-muted);width:40px;text-align:right">${Math.round(pred.confidence * 100)}%</span>
                    </div>`;
                }).join('')}

                <div style="margin-top:16px">
                    <h4 style="font-size:0.82rem;font-weight:600;margin-bottom:8px;color:var(--text-muted)">Key Delay Factors</h4>
                    ${getTopFactors(predictions)}
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        renderDelayScatter('predScatterChart', appData.vessels, predictions);
    }, 100);
}

function getTopFactors(predictions) {
    const factorCounts = {};
    for (const pred of predictions) {
        for (const f of pred.factors) {
            factorCounts[f.name] = (factorCounts[f.name] || 0) + 1;
        }
    }

    return Object.entries(factorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `
            <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
                <span style="font-size:0.78rem;flex:1">${name}</span>
                <span class="mono" style="font-size:0.72rem;color:var(--text-muted)">${count} vessels</span>
            </div>
        `).join('');
}

// ── Presentation Mode ────────────────────────────────────
function setupPresentation() {
    const btn = document.getElementById('presentationBtn');
    if (btn) {
        btn.addEventListener('click', togglePresentation);
    }

    document.addEventListener('keydown', (e) => {
        if (!presentationActive) return;
        if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
        else if (e.key === 'ArrowLeft') prevSlide();
        else if (e.key === 'Escape') togglePresentation();
    });
}

function togglePresentation() {
    presentationActive = !presentationActive;
    const overlay = document.getElementById('presentationOverlay');
    if (overlay) {
        overlay.classList.toggle('active', presentationActive);
        if (presentationActive) {
            currentSlide = 0;
            renderSlide();
        }
    }
}

function renderSlide() {
    const slide = slides[currentSlide];
    const slideEl = document.getElementById('presentationSlideContent');
    const counterEl = document.getElementById('slideCounter');

    if (slideEl) {
        slideEl.innerHTML = `
            <h2 style="font-size:1.8rem;font-weight:700;margin-bottom:6px;background:linear-gradient(135deg,#f1f5f9,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${slide.title}</h2>
            <p style="font-size:0.92rem;color:#94a3b8;margin-bottom:28px">${slide.subtitle}</p>
            ${slide.content}
        `;
    }

    if (counterEl) {
        counterEl.textContent = `${currentSlide + 1} / ${slides.length}`;
    }
}

function nextSlide() {
    if (currentSlide < slides.length - 1) {
        currentSlide++;
        renderSlide();
    }
}

function prevSlide() {
    if (currentSlide > 0) {
        currentSlide--;
        renderSlide();
    }
}

// Export for global access
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.togglePresentation = togglePresentation;

// ── Auto-init ────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
