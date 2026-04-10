// ============================================================
// BharatSupply — Main Application Controller
// ============================================================

import { generateAllData, generateInventoryProjection } from './data/synthetic-data.js';
import { predictor } from './engines/prediction.js';
import { optimizeLogistics } from './engines/optimizer.js';
import { renderKPIs, renderPageHeader, updateTimestamp } from './ui/dashboard.js';
import {
    renderCostDoughnut, renderVesselTimeline, renderInventoryChart,
    renderReliabilityGauge,
} from './ui/charts.js';
import { renderVesselTracker } from './ui/vessel-tracker.js';
import { renderInventoryPanel } from './ui/inventory.js';
import { renderCostAnalytics } from './ui/cost-analytics.js';
import { renderWhatIfPanel } from './ui/what-if.js';
import { renderDataInput } from './ui/data-input.js';
import { renderVesselPlanning } from './ui/vessel-planning.js';
import { APP_CONFIG, PORTS, PLANTS, MATERIALS } from './data/constants.js';
import { renderMLStudioPanel } from './ui/ml-studio.js';
import { renderOptimizerPanel } from './ui/optimization-studio.js';
import { auth } from './auth.js';
import { apiFetch } from './utils/api.js';
import { renderLandingView } from './ui/landing-view.js';
import { renderDashboardView } from './ui/dashboard-view.js';
import { renderPredictionsPanel } from './ui/ml-predictions.js';

// ── Application State ────────────────────────────────────
let appData = { vessels: [], rakes: [], inventory: {} };
let dashboardSummary = { 
    totalCost: 0, optimizedCost: 0, 
    costBreakdown: { freight: 0, portHandling: 0, railTransport: 0, demurrage: 0, storage: 0 },
    savings: { totalSaved: 0, percentSaved: 0 }
};
let currentPanel = 'overview';
let activePredictions = [];
let bookedVessels = []; // Vessels explicitly planned & saved via Vessel Planning wizard

/**
 * Initialize Application
 */
export async function initApp() {
    const root = document.getElementById('app-root');
    if (!root) return;
    
    if (!auth.isAuthenticated()) {
        renderLandingView(root);
        return;
    }

    renderDashboardView(root);
    console.log('[BharatSupply] Initializing Control Tower...');

    // 1. Load Data & ML Model
    // Load saved ML model from backend
    try {
        const mlRes = await apiFetch('/api/ml/load');
        if (mlRes && mlRes.ok) {
            const mlData = await mlRes.json();
            if (mlData) {
                predictor.deserialize(mlData);
                console.log('[App] ML Model reloaded from persistence');
            }
        }
    } catch (e) {
        console.warn('[App] No persisted ML model found or failed to load');
    }

    await loadAppData();
    await Promise.all([
        refreshDashboardSummary(),
        loadBookedVessels()   // Load user-specific booked vessels from Vessel Planning
    ]);
    switchPanel('overview');

    // 2. Initial Optimization (System of Record Flow)
    await runInitialOptimization();

    // 3. Final Dashboard Refresh
    await refreshDashboardSummary();

    setupNavigation();
    switchPanel('overview');

    // 4. Background Refresh Cycles
    setInterval(updateTimestamp, 1000);
    setInterval(refreshDashboardSummary, APP_CONFIG.refreshInterval || 30000);

    // 5. Global Event Listeners
    window.addEventListener('simulationSaved', () => refreshDashboardSummary());
    window.addEventListener('optimizationSaved', () => refreshDashboardSummary());

    // 🟢 When a vessel is booked in Vessel Planning, fetch updated list and refresh tracker
    window.addEventListener('vesselPlanSaved', async (e) => {
        // Optimistic update: immediately add the just-booked vessel to the tracker
        const plan = e.detail;
        if (plan && plan.vessel) {
            const optimisticVessel = {
                ...plan.vessel,
                planned: true,
                status: 'berthed',
                berthAssigned: plan.vessel.berthAssigned || 1,
                planRoute: plan.route,
            };
            // Avoid duplicates
            if (!bookedVessels.find(v => v.id === optimisticVessel.id)) {
                bookedVessels = [optimisticVessel, ...bookedVessels];
            }
        }

        // Then sync from DB (authoritative)
        await loadBookedVessels();

        // Re-render tracker if visible
        if (currentPanel === 'vessels') {
            switchPanel('vessels');
        }
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => auth.logout());
}

async function loadAppData() {
    try {
        const [rakeRes, invRes, vesselRes] = await Promise.all([
            apiFetch('/api/data/demand_rakes'),
            apiFetch('/api/data/inventory'),
            apiFetch('/api/data/vessels')
        ]);

        const rakes = await rakeRes.json();
        const inv = await invRes.json();
        const vessels = await vesselRes.json();

        if (!rakes.data?.length || !vessels.data?.length) {
            console.warn('[App] Backend data empty, using synthetic fallback');
            appData = generateAllData();
        } else {
            appData = {
                rakes: rakes.data[0].data,
                vessels: vessels.data[0].data,
                inventory: mapInventory(inv.data[0]?.data || []),
                isLive: true
            };
            normalizeAppData();
        }
        appData.inventoryProjection = generateInventoryProjection(appData.inventory, appData.rakes);
    } catch (err) {
        console.error('[App] Load failed', err);
        appData = generateAllData();
    }
}

async function tryLoadMLModel() {
    try {
        const res = await apiFetch('/api/ml/load');
        if (res.ok) {
            const weights = await res.json();
            predictor.deserialize(weights);
            console.log('[App] ML Model loaded from DB');
        }
    } catch (e) {
        console.warn('[App] Model load failed, using heuristic defaults');
    }
}

/**
 * Load vessels that were explicitly booked via the Vessel Planning wizard.
 * These are user-specific (JWT scoped) and shown EXCLUSIVELY in the Vessel Tracker.
 */
async function loadBookedVessels() {
    try {
        const res = await apiFetch('/api/vessels/plans');
        if (res && res.ok) {
            const result = await res.json();
            const plans = result.data || [];

            // Cross-reference with live appData to fill missing fields for old records
            bookedVessels = plans.map(plan => {
                // Detect old/incomplete record: name is missing, generic, or starts with 'Vessel '
                const hasFullData = plan.name && 
                    !plan.name.startsWith('Vessel ') && 
                    plan.origin && plan.origin !== 'International';

                if (hasFullData) return plan; // New record — all data is present

                // Try to find the matching vessel in live data by ID
                const liveVessel = appData.vessels && appData.vessels.find(v => v.id === plan.id);
                if (liveVessel) {
                    // Merge: live vessel provides identity/timing data, plan provides booking info
                    return {
                        ...liveVessel,
                        planned: true,
                        planRoute: plan.planRoute || plan.route || {},
                        planCost: plan.planCost || plan.cost || 0,
                        planTimestamp: plan.planTimestamp,
                        // Override status to 'berthed' since it was booked
                        status: 'berthed',
                        berthAssigned: liveVessel.berthAssigned || plan.berthAssigned || 1,
                    };
                }

                // Return the DB plan as-is even if partial (will show with fallbacks)
                return { ...plan, planned: true };
            });

            console.log(`[App] Loaded ${bookedVessels.length} booked vessels (${bookedVessels.filter(v => v.name && !v.name.startsWith('Vessel')).length} with full data)`);
        }
    } catch (e) {
        console.warn('[App] Failed to load booked vessels:', e);
        bookedVessels = [];
    }
}

async function runInitialOptimization() {
    if (!appData) return;
    
    // 1. Check if a baseline optimization already exists for this user
    try {
        const res = await apiFetch('/api/optimizations');
        const result = await res.json();
        
        if (result.count > 0 || result.data?.length > 0) {
            console.log('[App] Baseline optimization found, skipping initial run.');
            return;
        }
    } catch (e) {
        console.warn('[App] Failed to check for existing optimization');
    }

    // 2. Only if no existing optimization, run a fresh one and save it
    console.log('[App] No baseline optimization found, running initial...');
    const result = optimizeLogistics(appData.vessels, appData.rakes, appData.inventory);
    
    try {
        await apiFetch('/api/optimizations', {
            method: 'POST',
            body: JSON.stringify({
                totalCost: result.totalCost,
                costBreakdown: result.costBreakdown,
                vesselSchedule: result.vesselSchedule,
                railPlan: result.railPlan,
                savings: result.savings,
                meta: { isInitialBaseline: true }
            })
        });
    } catch (e) {
        console.warn('[App] Failed to save initial optimization:', e);
    }
}

async function refreshDashboardSummary() {
    try {
        const res = await apiFetch('/api/dashboard/summary');
        dashboardSummary = await res.json();
        
        // Update live predictions from ML model
        if (appData?.vessels) {
            activePredictions = appData.vessels.map(v => {
                try { return predictor.predictVesselDelay(v); }
                catch { return { predictedDelay: 0, confidence: 0, factors: [] }; }
            });
        }

        // Always re-render the overview panel with fresh data
        renderOverviewPanel();
        updateTimestamp();

        // Signal that dashboard data is fresh (optimizer studio waits for this)
        window.dispatchEvent(new CustomEvent('dashboardRefreshed', { detail: dashboardSummary }));
    } catch (err) {
        console.warn('[App] Summary refresh failed', err);
        // Still signal so optimizer doesn't hang
        window.dispatchEvent(new CustomEvent('dashboardRefreshed', { detail: dashboardSummary }));
    }
}

function mapInventory(raw) {
    const structured = {};
    raw.forEach(row => {
        const p = row.plant || 'bhilai';
        const m = row.material || 'coal';
        if (!structured[p]) structured[p] = {};
        structured[p][m] = {
            currentLevel: parseFloat(row.currentLevel || 50000),
            safetyStock: parseFloat(row.safetyStock || 20000),
            dailyConsumption: parseFloat(row.dailyConsumption || 3500),
            status: 'healthy'
        };
    });
    return structured;
}

function normalizeAppData() {
    appData.vessels = appData.vessels.map(v => ({
        ...v,
        destinationPortName: v.destinationPortName || PORTS.find(p => p.id === v.destinationPort)?.name || 'Unknown',
        materialName: v.materialName || MATERIALS.find(m => m.id === v.material)?.name || 'Unknown',
        actualETA: new Date(v.actualETA || v.scheduledETA)
    }));
}

export function switchPanel(panelId) {
    currentPanel = panelId;
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(el => el.classList.toggle('active', el.dataset.panel === panelId));
    
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.classList.toggle('active', panel.id === `panel-${panelId}`));

    const contentIdMap = {
        overview: 'overview',
        vessels: 'vesselTrackerContent',
        inventory: 'inventoryContent',
        costs: 'costAnalyticsContent',
        whatif: 'whatifContent',
        predictions: 'predictionsContent',
        datainput: 'dataInputContent',
        vesselplan: 'vesselPlanContent',
        mlstudio: 'mlStudioContent',
        optimizer: 'optimizerStudioContent'
    };

    const containerId = contentIdMap[panelId] || panelId;
    const container = document.getElementById(containerId);
    if (!container) return;

    switch (panelId) {
        case 'overview': {
            renderOverviewPanel(); 
            break;
        }
        case 'vessels': {
            // Merge: booked vessels at top (marked), then remaining live vessels
            const bookedIds = new Set(bookedVessels.map(v => v.id));
            const unbookedVessels = appData.vessels.filter(v => !bookedIds.has(v.id));
            
            // Tag booked vessels so tracker can highlight them
            const taggedBooked = bookedVessels.map(v => ({ ...v, planned: true }));
            const allVessels = [...taggedBooked, ...unbookedVessels];

            const predictions = allVessels.map(v => {
                if (predictor && predictor.trained) {
                    try { return predictor.predictVesselDelay(v); } catch(e) {}
                }
                return { predictedDelay: v.delayHours || 0, confidence: 0.75, factors: [] };
            });

            renderVesselTracker(container, allVessels, predictions);
            break;
        }
        case 'inventory': {
            renderInventoryPanel(container, appData.inventory); 
            break;
        }
        case 'costs': {
            renderCostAnalytics(container, dashboardSummary); 
            break;
        }
        case 'whatif': {
            const whatIfData = {
                ...appData,
                vessels: bookedVessels.length > 0 ? bookedVessels : (dashboardSummary.activeRoutes || appData.vessels),
                rakes: dashboardSummary.activeRakes || appData.rakes
            };
            renderWhatIfPanel(container, whatIfData, dashboardSummary); 
            break;
        }
        case 'predictions': {
            renderPredictionsPanel(appData.vessels, activePredictions); 
            break;
        }
        case 'datainput': {
            renderDataInput(container, () => {
                loadAppData().then(() => refreshDashboardSummary());
            }); 
            break;
        }
        case 'vesselplan': {
            renderVesselPlanning(container, appData.vessels); 
            break;
        }
        case 'mlstudio': {
            renderMLStudioPanel(appData.vessels); 
            break;
        }
        case 'optimizer': {
            renderOptimizerPanel(); 
            break;
        }
    }
}

function renderOverviewPanel() {
    const header = document.getElementById('overviewHeader');
    const kpis = document.getElementById('kpiGrid');
    if (!header || !kpis) return;

    renderPageHeader(header, 'Supply Chain Control Tower', 'AI-driven real-time optimization & risk management');
    
    // Add Active ML Constraints indicator
    const mlConstraints = predictor.getConstraints();
    if (mlConstraints) {
        const constraintsHeader = document.createElement('div');
        constraintsHeader.className = 'ml-constraints-banner animate-fade-in';
        constraintsHeader.innerHTML = `
            <span class="ml-badge">🤖 AI Constraints Active</span>
            <span class="ml-rule">Monsoon Penalty: 1.45x</span>
            <span class="ml-rule">Weather Risk: 1.3x</span>
            <span class="ml-rule">Min Confidence: 85%</span>
        `;
        header.appendChild(constraintsHeader);
    }

    renderKPIs(kpis, dashboardSummary);
    
    setTimeout(() => {
        // 1. Cost Doughnut — needs costBreakdown object (not entire summaryData)
        const cb = dashboardSummary.costBreakdown || {};
        renderCostDoughnut('costDoughnutChart', cb);

        // 2. Vessel Timeline — prefer optimized schedule, fallback to raw vessels
        const timelineVessels = (dashboardSummary.activeRoutes && dashboardSummary.activeRoutes.length > 0)
            ? dashboardSummary.activeRoutes.map(v => ({
                name: v.vessel || v.name || 'Unknown',
                scheduledETA: v.eta || v.scheduledETA || new Date(),
                actualETA: v.eta || v.actualETA || new Date(),
                delayHours: v.delayHours || 0,
                status: v.assigned ? 'berthed' : 'in-transit',
            }))
            : (appData.vessels || []);
        renderVesselTimeline('vesselTimelineChart', timelineVessels);

        // 3. Inventory — always from live projection
        renderInventoryChart('inventoryAreaChart', appData.inventoryProjection || {});

        // 4. Reliability gauge — use stored value from DB
        const reliability = dashboardSummary.savings?.supplyReliability ?? 85;
        renderReliabilityGauge('reliabilityGauge', reliability);
    }, 100);
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset.panel) {
                switchPanel(item.dataset.panel);
            }
        });
    });
}

export function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-up`;
    toast.innerHTML = `<div class="toast-message">${message}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.switchPanel = switchPanel;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();
