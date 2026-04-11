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
import { renderUserProfile, toggleProfile } from './ui/user-profile.js';

// ── Application State ────────────────────────────────────
let appData = { vessels: [], rakes: [], routes: [], nodes: [], inventory: {} };
let dashboardSummary = { 
    totalCost: 0, optimizedCost: 0, 
    costBreakdown: { freight: 0, portHandling: 0, railTransport: 0, demurrage: 0, storage: 0 },
    savings: { totalSaved: 0, percentSaved: 0 }
};
let currentPanel = 'overview';
let activePredictions = [];
let bookedVessels = []; // Vessels explicitly planned & saved via Vessel Planning wizard
let latestOptimizationSnapshot = { routeHistory: [], routeAlternatives: [], activeRoutes: [] };
let uploadedOptimizationData = {
    vessels: [],
    rakes: [],
    routes: [],
    nodes: [],
    inventory: {},
};

function mergeUploadedOptimizationData(base, incoming) {
    const next = {
        vessels: Array.isArray(base?.vessels) ? [...base.vessels] : [],
        rakes: Array.isArray(base?.rakes) ? [...base.rakes] : [],
        routes: Array.isArray(base?.routes) ? [...base.routes] : [],
        nodes: Array.isArray(base?.nodes) ? [...base.nodes] : [],
        inventory: base?.inventory ? JSON.parse(JSON.stringify(base.inventory)) : {},
    };

    if (!incoming) return next;

    const type = incoming.type === 'rakes' ? 'demand_rakes' : incoming.type;
    if ((type === 'vessels' || type === 'demand_vessels') && Array.isArray(incoming.data)) {
        next.vessels = incoming.data;
    } else if (type === 'demand_rakes' && Array.isArray(incoming.data)) {
        next.rakes = incoming.data;
    } else if (type === 'routes' && Array.isArray(incoming.data)) {
        next.routes = incoming.data;
    } else if (type === 'nodes' && Array.isArray(incoming.data)) {
        next.nodes = incoming.data;
    } else if (type === 'inventory' && incoming.data) {
        next.inventory = incoming.data;
    } else if (incoming.vessels || incoming.rakes || incoming.inventory) {
        if (Array.isArray(incoming.vessels)) next.vessels = incoming.vessels;
        if (Array.isArray(incoming.rakes)) next.rakes = incoming.rakes;
        if (Array.isArray(incoming.routes)) next.routes = incoming.routes;
        if (Array.isArray(incoming.nodes)) next.nodes = incoming.nodes;
        if (incoming.inventory) next.inventory = incoming.inventory;
    }

    return next;
}

async function readJsonResult(settledResult) {
    if (!settledResult || settledResult.status !== 'fulfilled') return { data: [] };
    const response = settledResult.value;
    if (!response || typeof response.json !== 'function') return { data: [] };
    try {
        return await response.json();
    } catch {
        return { data: [] };
    }
}

function normalizeBookedVessel(plan, liveVessel = null) {
    const vessel = plan?.vessel || {};
    const route = plan?.planRoute || plan?.route || {};
    const rake = plan?.rake || {};
    const source = liveVessel || vessel || {};
    const vesselId = plan?.id || plan?.vesselId || vessel.id || source.id || '';
    const name = plan?.name || plan?.vesselName || vessel.name || source.name || `Vessel ${String(vesselId || 'Unknown').slice(0, 8)}`;

    return {
        id: vesselId,
        vesselId,
        name,
        origin: plan?.origin || vessel.origin || source.origin || 'International',
        originCountry: plan?.originCountry || vessel.originCountry || source.originCountry || '',
        destinationPort: plan?.destinationPort || vessel.destinationPort || source.destinationPort || '',
        destinationPortName: plan?.destinationPortName || vessel.destinationPortName || source.destinationPortName || '',
        material: plan?.material || vessel.material || source.material || '',
        materialName: plan?.materialName || vessel.materialName || source.materialName || '',
        quantity: Number(plan?.quantity || vessel.quantity || source.quantity || 0),
        vesselAge: Number(plan?.vesselAge || vessel.vesselAge || source.vesselAge || 0),
        scheduledETA: plan?.scheduledETA || vessel.scheduledETA || source.scheduledETA || null,
        actualETA: plan?.actualETA || vessel.actualETA || source.actualETA || null,
        delayHours: Number(plan?.delayHours || vessel.delayHours || source.delayHours || 0),
        status: 'berthed',
        berthAssigned: Number(plan?.berthAssigned || vessel.berthAssigned || source.berthAssigned || 1),
        freightCost: Number(plan?.freightCost || vessel.freightCost || source.freightCost || 0),
        rakes: Number(plan?.rakes || rake.rakes || rake.quantity || 0),
        planned: true,
        planRoute: route,
        planCost: Number(plan?.planCost || plan?.cost || route.cost || 0),
        routeName: plan?.routeName || route?.routeName || '',
        planTimestamp: plan?.planTimestamp || plan?.timestamp || plan?.createdAt || null,
        vessel: vessel,
        rake,
    };
}

/**
 * Initialize Application
 */
export async function initApp() {
    const root = document.getElementById('app-root');
    if (!root) return;
    
    if (!auth.isAuthenticated()) {
        document.body.className = 'landing-page';
        renderLandingView(root);
        return;
    }

    document.body.className = '';
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
            const optimisticVessel = normalizeBookedVessel(plan);
            // Avoid duplicates
            bookedVessels = [
                optimisticVessel,
                ...bookedVessels.filter(v => String(v.id) !== String(optimisticVessel.id))
            ];
        }

        // Refresh summary so dashboard counters and tracker stay in sync.
        refreshDashboardSummary().catch(() => {});

        // Then sync from DB (authoritative)
        try {
            await loadBookedVessels();
        } catch (syncErr) {
            console.warn('[App] Booked vessel resync failed, keeping optimistic tracker state', syncErr);
        }

        // Re-render tracker if visible, otherwise keep the updated state for next navigation
        if (currentPanel === 'vessels') {
            switchPanel('vessels');
        } else if (currentPanel === 'inventory') {
            switchPanel('inventory');
        } else if (document.getElementById('vesselTrackerContent')) {
            const container = document.getElementById('vesselTrackerContent');
            const bookedIds = new Set(bookedVessels.map(v => v.id));
            const unbookedVessels = appData.vessels.filter(v => !bookedIds.has(v.id));
            const taggedBooked = bookedVessels.map(v => ({ ...v, planned: true }));
            const allVessels = [...taggedBooked, ...unbookedVessels];
            const predictions = allVessels.map(v => {
                if (predictor && predictor.trained) {
                    try { return predictor.predictVesselDelay(v); } catch (e) {}
                }
                return { predictedDelay: v.delayHours || 0, confidence: 0.75, factors: [] };
            });
            renderVesselTracker(container, allVessels, predictions);
        }
    });

    window.addEventListener('inventoryUpdated', async () => {
        console.log('[App] Inventory updated, refreshing data...');
        try {
            await loadAppData();
            await refreshDashboardSummary();
            if (currentPanel === 'inventory') {
                switchPanel('inventory');
            }
        } catch (err) {
            console.warn('[App] Inventory refresh failed', err);
        }
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => auth.logout());

    // Initialize User Profile Side-Panel
    renderUserProfile();

    // Global listener for profile trigger (since header is dynamic)
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('#dashboardProfileTrigger');
        if (trigger) {
            toggleProfile(true);
        }
    });
}

async function loadAppData() {
    try {
        const [rakeRes, invRes, vesselRes, routeRes, nodeRes, manualInvRes] = await Promise.allSettled([
            apiFetch('/api/data/demand_rakes'),
            apiFetch('/api/data/inventory'),
            apiFetch('/api/data/vessels'),
            apiFetch('/api/data/routes'),
            apiFetch('/api/data/nodes'),
            apiFetch('/api/inventory')
        ]);

        const rakes = await readJsonResult(rakeRes);
        const inv = await readJsonResult(invRes);
        const vessels = await readJsonResult(vesselRes);
        const routes = await readJsonResult(routeRes);
        const nodes = await readJsonResult(nodeRes);
        const manualInv = await readJsonResult(manualInvRes);

        if (!rakes.data?.length || !vessels.data?.length) {
            console.warn('[App] Backend data empty, initializing clean state');
            // Even if general data is empty, check if we have manual inventory
            const structuredInv = mapInventory(inv.data[0]?.data || []);
            const manualStructured = mapManualInventory(manualInv.data || []);
            const finalInv = { ...structuredInv, ...manualStructured };
            
            appData = { 
                vessels: [], 
                rakes: [], 
                routes: routes.data?.[0]?.data || [], 
                nodes: nodes.data?.[0]?.data || [], 
                inventory: finalInv, 
                isEmpty: Object.keys(finalInv).length === 0 
            };
        } else {
            const structuredInv = mapInventory(inv.data[0]?.data || []);
            const manualStructured = mapManualInventory(manualInv.data || []);
            
            appData = {
                rakes: rakes.data[0].data,
                vessels: vessels.data[0].data,
                routes: routes.data?.[0]?.data || [],
                nodes: nodes.data?.[0]?.data || [],
                inventory: mergeInventories(structuredInv, manualStructured),
                isLive: true,
                isEmpty: false
            };
            normalizeAppData();
        }
        
        if (appData.isEmpty) {
            appData.inventoryProjection = {};
        } else {
            appData.inventoryProjection = generateInventoryProjection(appData.inventory, appData.rakes);
        }
    } catch (err) {
        console.error('[App] Load failed', err);
        appData = { vessels: [], rakes: [], routes: [], nodes: [], inventory: {}, isEmpty: true };
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

            // Normalize every plan into a tracker-ready vessel record.
            bookedVessels = plans.map(plan => {
                const liveVessel = appData.vessels && appData.vessels.find(v =>
                    String(v.id) === String(plan.id || plan.vesselId || plan.vessel?.id)
                );
                return normalizeBookedVessel(plan, liveVessel);
            });

            console.log(`[App] Loaded ${bookedVessels.length} booked vessels (${bookedVessels.filter(v => v.name && !v.name.startsWith('Vessel')).length} with full data)`);
        } else {
            console.warn('[App] Booked vessel endpoint returned no data, keeping current tracker state');
        }
    } catch (e) {
        console.warn('[App] Failed to load booked vessels:', e);
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

    // 2. Only if no existing optimization AND data exists, run a fresh one and save it
    if (appData.isEmpty) {
        console.log('[App] New account detected (no data), skipping baseline optimization.');
        return;
    }

    console.log('[App] No baseline optimization found, running initial...');
    const result = optimizeLogistics(appData.vessels, appData.rakes, appData.inventory, {
        routeCandidates: appData.routes || [],
        nodes: appData.nodes || []
    });
    
    try {
            await apiFetch('/api/optimizations', {
                method: 'POST',
                body: JSON.stringify({
                feasible: result.feasible,
                totalCost: result.totalCost,
                costBreakdown: result.costBreakdown,
                vesselSchedule: result.vesselSchedule,
                railPlan: result.railPlan,
                routeHistory: result.routeHistory,
                routeAlternatives: result.routeAlternatives,
                savings: result.savings,
                meta: { isInitialBaseline: true },
                mlConstraints: result.mlConstraints,
                sourceMeta: result.sourceMeta,
                inputSnapshot: result.inputSnapshot,
                optimizedAt: result.optimizedAt
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
        latestOptimizationSnapshot = {
            routeHistory: Array.isArray(dashboardSummary?.routeHistory) ? dashboardSummary.routeHistory : [],
            routeAlternatives: Array.isArray(dashboardSummary?.routeAlternatives) ? dashboardSummary.routeAlternatives : [],
            activeRoutes: Array.isArray(dashboardSummary?.activeRoutes) ? dashboardSummary.activeRoutes : [],
        };
        
        // Update live predictions from ML model
        const predictionSource = bookedVessels.length > 0 ? bookedVessels : (appData?.vessels || []);
        if (predictionSource.length) {
            activePredictions = predictionSource.map(v => {
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

function calculateSupplyReliability(vessels, inventory, predictions) {
    if (!vessels || !inventory) return 0.85;

    // 1. Vessel Performance (40%): Ratio of on-time vessels
    const onTimeVessels = vessels.filter(v => (v.delayHours || 0) < 24).length;
    const vesselScore = vessels.length > 0 ? (onTimeVessels / vessels.length) : 0.9;

    // 2. Inventory Buffer (40%): Average margin above safety stock across all plants/materials
    let inventoryScores = [];
    for (const plant in inventory) {
        for (const mat in inventory[plant]) {
            const current = inventory[plant][mat].currentLevel || 0;
            const safety = inventory[plant][mat].safetyStock || 1;
            // 1.0 if current > 1.2 * safety, 0.0 if current < safety
            const margin = Math.min(1, Math.max(0, (current - safety) / (safety * 0.2)));
            inventoryScores.push(margin);
        }
    }
    const inventoryScore = inventoryScores.length > 0 
        ? inventoryScores.reduce((a, b) => a + b, 0) / inventoryScores.length 
        : 0.8;

    // 3. AI Prediction Confidence (20%): Average model confidence
    const confidenceScore = predictions && predictions.length > 0
        ? predictions.reduce((acc, p) => acc + (p.confidence || 0.75), 0) / predictions.length
        : 0.85;

    const weightedScore = (vesselScore * 0.4) + (inventoryScore * 0.4) + (confidenceScore * 0.2);
    return Math.min(1, Math.max(0.1, weightedScore));
}

function mapInventory(raw) {
    const structured = {};
    if (!Array.isArray(raw)) return structured;
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

function mapManualInventory(raw) {
    const structured = {};
    if (!Array.isArray(raw)) return structured;
    raw.forEach(row => {
        const p = row.plant;
        const m = row.material;
        if (!p || !m) return;
        if (!structured[p]) structured[p] = {};
        structured[p][m] = {
            currentLevel: parseFloat(row.currentLevel || 0),
            safetyStock: parseFloat(row.safetyStock || 0),
            dailyConsumption: parseFloat(row.dailyConsumption || 0),
            status: 'healthy'
        };
    });
    return structured;
}

function mergeInventories(base, manual) {
    const next = JSON.parse(JSON.stringify(base));
    for (const plant in manual) {
        if (!next[plant]) next[plant] = {};
        for (const mat in manual[plant]) {
            next[plant][mat] = manual[plant][mat];
        }
    }
    return next;
}

function normalizeAppData() {
    appData.vessels = appData.vessels.map(v => ({
        ...v,
        destinationPortName: v.destinationPortName || PORTS.find(p => p.id === v.destinationPort)?.name || 'Unknown',
        materialName: v.materialName || MATERIALS.find(m => m.id === v.material)?.name || 'Unknown',
        actualETA: new Date(v.actualETA || v.scheduledETA)
    }));
}

export function switchPanel(panelId, autoRun = false) {
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
            renderInventoryPanel(container, appData.inventory, appData.inventoryProjection, bookedVessels); 
            break;
        }
        case 'costs': {
            renderCostAnalytics(container, dashboardSummary); 
            break;
        }
        case 'whatif': {
            // CRITICAL: For mathematical parity and completeness, enrich the dashboard 
            // routes by linking them back to the full vessel data objects.
            const dashboardVessels = dashboardSummary.activeRoutes || [];
            
            const enrichedVessels = dashboardVessels.map(dv => {
                const original = appData.vessels.find(v => String(v.id) === String(dv.vesselId) || String(v.vesselId) === String(dv.vesselId));
                // Merge Properties: Prefer original data context, then dashboard state
                return { 
                    ...original, 
                    ...dv, 
                    // Ensure core properties for simulation are strictly mapped
                    destinationPort: dv.destinationPort || original?.destinationPort,
                    quantity: dv.quantity || original?.quantity || 30000 
                };
            });

            const baseVessels = (enrichedVessels.length > 0) ? enrichedVessels : appData.vessels;
            const baseRakes = (dashboardSummary.activeRakes && dashboardSummary.activeRakes.length > 0)
                ? dashboardSummary.activeRakes
                : appData.rakes || [];

            const whatIfData = {
                ...appData,
                vessels: baseVessels,
                rakes: baseRakes,
                plannedVessels: bookedVessels,
                // Ensure helper pools are also consistent
                _originalFleet: true 
            };
            renderWhatIfPanel(container, whatIfData, dashboardSummary); 
            break;
        }
        case 'predictions': {
            const predictionSource = bookedVessels.length > 0 ? bookedVessels : appData.vessels;
            const predictionResults = predictionSource.map(v => {
                try { return predictor.predictVesselDelay(v); }
                catch { return { predictedDelay: 0, confidence: 0, factors: [] }; }
            });
            renderPredictionsPanel(predictionSource, predictionResults); 
            break;
        }
        case 'datainput': {
            renderDataInput(container, (data) => {
                uploadedOptimizationData = mergeUploadedOptimizationData(uploadedOptimizationData, data);
                // Keep the uploaded dataset available for the optimizer instead of
                // replacing it with stale live data or synthetic defaults.
                switchPanel('optimizer', true);
            }); 
            break;
        }
        case 'vesselplan': {
            const optimizedRoutes = latestOptimizationSnapshot.routeHistory.length
                ? latestOptimizationSnapshot.routeHistory
                : latestOptimizationSnapshot.activeRoutes;
            renderVesselPlanning(container, {
                vessels: [],
                routes: optimizedRoutes,
                activeRoutes: optimizedRoutes,
                optimizedRoutes,
                routeHistory: latestOptimizationSnapshot.routeHistory,
                routeAlternatives: latestOptimizationSnapshot.routeAlternatives,
                inventory: appData.inventory,
            }); 
            break;
        }
        case 'mlstudio': {
            renderMLStudioPanel(appData.vessels); 
            break;
        }
        case 'optimizer': {
            renderOptimizerPanel(autoRun, uploadedOptimizationData); 
            break;
        }
    }
}

function renderOverviewPanel() {
    const header = document.getElementById('overviewHeader');
    const kpis = document.getElementById('kpiGrid');
    if (!header || !kpis) return;

    const user = auth.getUser?.() || {};
    renderPageHeader(header, 'Supply Chain Control Tower', 'AI-driven real-time optimization & risk management', {
        username: user.username || user.name || user.email || 'Account',
        userInitials: user.username || user.name || user.email || 'A',
    });
    
    // Add Active ML Constraints indicator — values are DYNAMIC from the trained model
    const mlConstraints = predictor.getConstraints();
    if (mlConstraints) {
        const constraintsHeader = document.createElement('div');
        constraintsHeader.className = 'ml-constraints-banner animate-fade-in';
        constraintsHeader.innerHTML = `
            <span class="ml-badge">🤖 AI Constraints Active</span>
            <span class="ml-rule">Monsoon Penalty: ${mlConstraints.monsoonPenalty}x</span>
            <span class="ml-rule">Weather Risk: ${mlConstraints.weatherRiskFactor}x</span>
            <span class="ml-rule">Avg Delay: ${mlConstraints.meanTrainedDelay}h ± ${mlConstraints.stdTrainedDelay}h</span>
            <span class="ml-rule">Confidence: ${Math.round(mlConstraints.confidenceLevel * 100)}%</span>
        `;
        header.appendChild(constraintsHeader);
    }

    renderKPIs(kpis, dashboardSummary);
    
    setTimeout(() => {
        // 1. Cost Doughnut
        const cb = dashboardSummary.costBreakdown || { freight: 0, portHandling: 0, railTransport: 0, demurrage: 0, storage: 0 };
        renderCostDoughnut('costDoughnutChart', cb);

        // 2. Vessel Timeline
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

        // 3. Inventory
        renderInventoryChart('inventoryAreaChart', appData.inventoryProjection || {});

        // 4. Reliability gauge
        const reliability = appData.isEmpty ? 0 : calculateSupplyReliability(appData.vessels, appData.inventory, activePredictions);
        const gaugeContainer = document.getElementById('reliabilityGauge');
        if (gaugeContainer) {
            renderReliabilityGauge(gaugeContainer, reliability);
        }
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
