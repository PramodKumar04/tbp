// ============================================================
// SteelSync-Opt — Vessel Planning Module
// ============================================================
// Multi-step wizard: Select Vessel → Configure Discharge → Optimize Route

import { PORTS, PLANTS, RAIL_ROUTES, COST_PARAMS, MATERIALS } from '../data/constants.js';
import { apiFetch } from '../utils/api.js';

let _vessels = [];
let _routeCandidates = [];
let _derivedVessels = [];
let _selectedVessel = null;
let _step = 'route';  // 'route' | 'vessel' | 'rake'
let _planConfig = { portId: '', plantId: '', rakes: 2, objective: 'cost' };
let _rankedRoutes = [];
let _selectedRoute = null;
let _container = null;
let _onPlanConfirmed = null;

// Status color mapping
const STATUS_COLORS = {
    'in-transit': { bg: '#f1f5f9', text: '#475569', label: 'In Transit' },
    'on-time':    { bg: '#ecfdf5', text: '#15803d', label: 'On Time' },
    'delayed':    { bg: '#fffbeb', text: '#b45309', label: 'Delayed' },
    'berthed':    { bg: '#eff6ff', text: '#1d4ed8', label: 'Berthed' },
    'unloading':  { bg: '#eff6ff', text: '#1d4ed8', label: 'Unloading' },
    'anchorage':  { bg: '#fef2f2', text: '#991b1b', label: 'Anchorage' },
};

function normalizeRouteCandidates(routes = []) {
    return (Array.isArray(routes) ? routes : []).map((route, index) => {
        const snap = route.selectedRoute || route.routeSnapshot || route.route || route;
        const vessel = route.vessel || route.vesselSnapshot || {};
        const routeId = snap.routeId || route.routeId || route.id || route.rakeNumber || `route_${index + 1}`;
        const fromPort = snap.fromPort || route.fromPort || route.portId || route.sourcePort || route.destinationPort || route.port || '';
        const toPlant = snap.toPlant || route.toPlant || route.plantId || route.targetPlantId || route.targetPlant || '';
        const fromPortName = snap.fromPortName || route.fromPortName || route.portName || route.port || route.sourcePortName || fromPort || 'Unknown Port';
        const toPlantName = snap.toPlantName || route.toPlantName || route.plantName || route.targetPlant || toPlant || 'Unknown Plant';
        const quantity = Number(route.quantity || route.cargo?.quantity || snap.quantity || vessel.quantity || 0);
        const cost = Number(route.cost || route.railCost || snap.railCost || snap.cost || route.totalCost || 0);
        const time = Number(route.time || snap.avgTime || route.avgTime || 0);
        const vesselId = route.vesselId || vessel.id || route.id || snap.vesselId || '';
        const vesselName = route.vesselName || vessel.name || route.vessel || snap.vesselName || route.name || '';
        return {
            ...route,
            id: route.id || `${routeId}_${index}`,
            routeId,
            fromPort,
            toPlant,
            fromPortName,
            toPlantName,
            quantity,
            cost,
            time,
            vesselId,
            vesselName,
            routeName: route.routeName || `${fromPortName} → ${toPlantName}`,
            routeSnapshot: snap,
            vesselSnapshot: vessel,
            routeSource: route,
        };
    });
}

function buildVesselOptionsFromRoutes(routes = []) {
    return (Array.isArray(routes) ? routes : []).map((route, index) => {
        const vessel = route.vessel || route.vesselSnapshot || {};
        const routeMeta = route.selectedRoute || route.routeSnapshot || route.route || route;
        const vesselId = vessel.id || route.vesselId || route.id || `route_vessel_${index + 1}`;
        const quantity = Number(route.quantity || route.cargo?.quantity || vessel.quantity || 0);
        return {
            id: vesselId,
            vesselId,
            name: vessel.name || route.vesselName || `Vessel ${index + 1}`,
            origin: vessel.origin || route.fromPortName || 'Optimized Route',
            originCountry: vessel.originCountry || '',
            destinationPort: vessel.destinationPort || route.fromPort || route.portId || '',
            destinationPortName: vessel.destinationPortName || route.fromPortName || route.portName || '',
            material: vessel.material || route.material || routeMeta.material || 'coal',
            materialName: vessel.materialName || route.materialName || routeMeta.materialName || (route.material ? String(route.material) : 'Coal'),
            quantity,
            scheduledETA: vessel.scheduledETA || route.eta || new Date().toISOString(),
            actualETA: vessel.actualETA || route.eta || new Date().toISOString(),
            delayHours: Number(vessel.delayHours || route.delayHours || 0),
            status: vessel.status || route.status || 'on-time',
            berthAssigned: vessel.berthAssigned || 1,
            freightCost: Number(vessel.freightCost || route.cost || route.railCost || 0),
        };
    });
}

function getVisibleVessels() {
    return _vessels.length ? _vessels : _derivedVessels;
}

/**
 * Public API: Render the vessel planning panel
 */
export function renderVesselPlanning(container, vesselsOrContext, onPlanConfirmed) {
    _container = container;
    _onPlanConfirmed = onPlanConfirmed;

    const context = Array.isArray(vesselsOrContext)
        ? { vessels: vesselsOrContext }
        : (vesselsOrContext || {});

    _vessels = Array.isArray(context.vessels) ? context.vessels : [];
    _routeCandidates = normalizeRouteCandidates(
        context.optimizedRoutes || context.routeHistory || context.routes || context.activeRoutes || []
    );
    _derivedVessels = buildVesselOptionsFromRoutes(_routeCandidates);
    if (!_vessels.length && Array.isArray(context.plannedVessels) && context.plannedVessels.length) {
        _vessels = context.plannedVessels;
    }

    _step = 'route';
    _selectedVessel = null;
    _selectedRoute = null;
    _rankedRoutes = [];
    _planConfig = { portId: '', plantId: '', rakes: 2, objective: 'cost' };

    _render();
}

function _render() {
    if (!_container) return;
    _container.innerHTML = `
        <div class="vp-layout">
            <div class="vp-sidebar">${_renderVesselList()}</div>
            <div class="vp-main">${_renderMainPanel()}</div>
        </div>
    `;
    _bindEvents();
}

// ═══════════════════════════════════════════════════════════
// LEFT SIDEBAR — Vessel List
// ═══════════════════════════════════════════════════════════
function _renderVesselList() {
    if (_step === 'route' && _routeCandidates.length > 0) {
        return _renderRouteSidebar();
    }

    const vessels = getVisibleVessels();
    return `
        <div class="vp-list-header">
            <h3 class="vp-list-title">Inbound Vessels</h3>
            <p class="vp-list-sub">${_selectedRoute ? 'Select a vessel for the optimized route' : 'Select a vessel to plan discharge'}</p>
        </div>
        <div class="vp-list">
            ${vessels.length > 0 ? vessels.map(v => {
                const sc = STATUS_COLORS[v.status] || STATUS_COLORS['in-transit'];
                const isActive = _selectedVessel?.id === v.id;
                const mat = MATERIALS.find(m => m.id === v.material);
                const eta = new Date(v.actualETA);
                const etaStr = eta.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                return `
                <div class="vp-vessel-card ${isActive ? 'vp-vessel-card--active' : ''}" data-vid="${v.id}">
                    <div class="vp-vessel-top">
                        <div class="vp-vessel-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>
                        </div>
                        <h4 class="vp-vessel-name">${v.name}</h4>
                        <span class="vp-status-badge" style="background:${sc.bg};color:${sc.text}">${sc.label}</span>
                    </div>
                    <div class="vp-vessel-meta">
                        <div class="vp-meta-row">
                            <span class="vp-meta-label">Cargo:</span>
                            <span class="vp-meta-value" style="color:${mat?.color || '#374151'}">${v.materialName}</span>
                            <span class="vp-meta-label" style="margin-left:auto">Qty:</span>
                            <span class="vp-meta-value">${Math.round(v.quantity / 1000)}k MT</span>
                        </div>
                        <div class="vp-meta-row">
                            <span class="vp-meta-label">Load:</span>
                            <span class="vp-meta-value">${v.origin}, ${v.originCountry?.substring(0, 2) || ''}</span>
                            <span class="vp-meta-label" style="margin-left:auto">ETA:</span>
                            <span class="vp-meta-value">${etaStr}</span>
                        </div>
                    </div>
                </div>`;
            }).join('') : `
                <div style="padding:40px 20px;text-align:center;color:var(--text-muted)">
                    <div style="font-size:0.75rem;font-weight:600;margin-bottom:8px">NO ACTIVE VESSELS</div>
                    <div style="font-size:0.68rem">${_routeCandidates.length > 0 ? 'Choose an optimized route first to derive vessel options.' : 'Run optimization on uploaded shipments to create vessel planning data.'}</div>
                </div>
            `} 
        </div>
    `;
}

function _renderRouteSidebar() {
    return `
        <div class="vp-list-header">
            <h3 class="vp-list-title">Optimized Routes</h3>
            <p class="vp-list-sub">Pick a route first, then assign the vessel</p>
        </div>
        <div class="vp-list">
            ${_routeCandidates.map((route) => {
                const isActive = _selectedRoute?.id === route.id;
                return `
                    <div class="vp-vessel-card ${isActive ? 'vp-vessel-card--active' : ''}" data-rid="${route.id}" data-role="route">
                        <div class="vp-vessel-top">
                            <div class="vp-vessel-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v4H4z"/><path d="M4 10h16v10H4z"/><path d="M8 14h8"/></svg>
                            </div>
                            <h4 class="vp-vessel-name">Route #${route.routeId}</h4>
                            <span class="vp-status-badge" style="background:#eff6ff;color:#1d4ed8">OPTIMIZED</span>
                        </div>
                        <div class="vp-vessel-meta">
                            <div class="vp-meta-row">
                                <span class="vp-meta-label">Path:</span>
                                <span class="vp-meta-value">${route.fromPortName} → ${route.toPlantName}</span>
                                <span class="vp-meta-label" style="margin-left:auto">Cost:</span>
                                <span class="vp-meta-value">₹${Math.round(route.cost || 0).toLocaleString()}</span>
                            </div>
                            <div class="vp-meta-row">
                                <span class="vp-meta-label">Vessel:</span>
                                <span class="vp-meta-value">${route.vesselName || 'Derived from optimization'}</span>
                                <span class="vp-meta-label" style="margin-left:auto">Time:</span>
                                <span class="vp-meta-value">${route.time || route.routeSnapshot?.avgTime || 0}h</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// RIGHT PANEL — Dynamic based on step
// ═══════════════════════════════════════════════════════════
function _renderMainPanel() {
    if (_step === 'route') return _renderRoutePlanning();
    if (_step === 'vessel') return _renderVesselSelection();
    if (_step === 'rake') return _renderRakePlanning();
    if (!_selectedVessel) return _renderEmptyState();
    return _renderRakePlanning();
}

function _renderEmptyState() {
    return `
        <div class="vp-empty">
            <div class="vp-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
                    <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
                </svg>
            </div>
            <p class="vp-empty-text" style="color:var(--text-muted);font-weight:500;margin-top:12px">Select an inbound vessel from the monitor list to initialize the strategic discharge planning sequence.</p>
        </div>
    `;
}

function _buildRankedRoutesFromOptimizedData() {
    const source = Array.isArray(_routeCandidates) ? _routeCandidates : [];
    const ranked = source.map((route, index) => {
        const cost = Number(route.cost || route.railCost || route.routeSnapshot?.railCost || route.routeSnapshot?.cost || 0);
        const time = Number(route.time || route.routeSnapshot?.avgTime || 0);
        const quantity = Number(route.quantity || route.routeSnapshot?.quantity || route.vesselSnapshot?.quantity || 0);
        const routeId = route.routeId || route.routeSnapshot?.routeId || `R${index + 1}`;
        return {
            ...route,
            id: route.id || `${routeId}_${index}`,
            routeId,
            via: route.via || route.routeName || `${route.fromPortName || route.fromPort || '?'} -> ${route.toPlantName || route.toPlant || '?'}`,
            cost,
            time,
            quantity,
            rakeLevel: route.rakeLevel || route.routeSnapshot?.rakeLevel || (quantity > COST_PARAMS.rakeCapacity * 2 ? 'High' : 'Medium'),
            tag: route.tag || 'balanced',
            score: _planConfig.objective === 'time' ? time : _planConfig.objective === 'rakes' ? -quantity : cost,
        };
    }).filter(route => route.fromPortName || route.toPlantName || route.vesselName || route.vesselId);

    ranked.sort((a, b) => a.score - b.score);
    return ranked.slice(0, 5);
}

function _renderNoOptimizationState() {
    return `
        <div class="vp-empty">
            <div class="vp-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16v16H4z"/>
                    <path d="M8 12h8"/>
                    <path d="M12 8v8"/>
                </svg>
            </div>
            <p class="vp-empty-text" style="color:var(--text-muted);font-weight:500;margin-top:12px">
                No optimized shipment path is available yet. Upload shipment data, run optimization, and then return here to assign the vessel.
            </p>
        </div>
    `;
}

function _renderVesselSelection() {
    const route = _selectedRoute;
    const vesselPool = getVisibleVessels();
    const routePort = route?.fromPort || _planConfig.portId;
    const routePlant = route?.toPlant || _planConfig.plantId;
    const matchingVessels = vesselPool.filter(v => {
        const portMatch = !routePort || v.destinationPort === routePort || v.destinationPortName === route.fromPortName;
        const vesselMatch = !route?.vesselId || String(v.id) === String(route.vesselId);
        const materialMatch = !route?.material || !v.material || route.material === v.material;
        return portMatch && materialMatch && (vesselMatch || portMatch);
    });

    const vessels = matchingVessels.length ? matchingVessels : vesselPool;

    if (!route) {
        return _renderNoOptimizationState();
    }

    return `
        <div class="vp-discharge">
            <div class="vp-plan-header">
                <div>
                    <div class="vp-plan-vessel-name">Select Vessel for ${route?.routeName || `Route #${route?.routeId || 'Optimized'}`}</div>
                    <div class="vp-plan-subtitle">Choose the vessel that will use the optimized rail path</div>
                </div>
                <div class="vp-plan-qty">
                    <span class="vp-plan-qty-num">${vessels.length}</span>
                    <span class="vp-plan-qty-unit">Choices</span>
                    <div class="vp-plan-qty-label">Matched by route</div>
                </div>
            </div>

            <div class="vp-routes-header">
                <h4>Available Vessels</h4>
                <span class="vp-sort-label">Filtered by optimized route and cargo compatibility</span>
            </div>

            <div class="vp-routes-list">
                ${vessels.map((v, index) => {
                    const isSelected = _selectedVessel?.id === v.id;
                    const sc = STATUS_COLORS[v.status] || STATUS_COLORS['in-transit'];
                    return `
                        <div class="vp-route-card ${isSelected ? 'vp-route-card--selected' : ''}" data-vid="${v.id}" data-role="vessel">
                            ${index === 0 ? '<div class="vp-best-badge">OPTIMAL MATCH</div>' : ''}
                            <div class="vp-route-card-body">
                                <div class="vp-route-info">
                                    <div class="vp-route-name">${v.name}<span class="vp-route-tag" style="background:${sc.bg};color:${sc.text}">${sc.label}</span></div>
                                    <div class="vp-route-via">Origin: ${v.origin || 'Unknown'}${v.destinationPortName ? ` • Port: ${v.destinationPortName}` : ''}</div>
                                </div>
                                <div class="vp-route-metrics">
                                    <div class="vp-metric">
                                        <div class="vp-metric-label">Material</div>
                                        <div class="vp-metric-val">${v.materialName || v.material || '—'}</div>
                                    </div>
                                    <div class="vp-metric">
                                        <div class="vp-metric-label">Quantity</div>
                                        <div class="vp-metric-val">${Math.round((v.quantity || 0)).toLocaleString()} MT</div>
                                    </div>
                                    <div class="vp-metric">
                                        <div class="vp-metric-label">ETA</div>
                                        <div class="vp-metric-val">${new Date(v.actualETA || v.scheduledETA || Date.now()).toLocaleDateString('en-IN')}</div>
                                    </div>
                                </div>
                                <div class="vp-route-radio">
                                    <div class="vp-radio-circle ${isSelected ? 'vp-radio-circle--active' : ''}"></div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="vp-bottom-bar vp-bottom-bar--route">
                <div class="vp-selected-label">Selected Route: <span style="color:${route ? '#3b82f6' : '#94a3b8'};font-weight:600">${route ? `Route #${route.routeId}` : 'None'}</span></div>
                <div class="vp-bottom-actions">
                    <button type="button" class="vp-btn vp-btn-ghost" id="vpBackBtn">Back</button>
                    <button type="button" class="vp-btn vp-btn-primary vp-btn-lg ${!_selectedVessel ? 'vp-btn--disabled' : ''}" id="vpConfirmVesselBtn" ${!_selectedVessel ? 'disabled' : ''}>Next: Select Rakes</button>
                </div>
            </div>
        </div>
    `;
}

// ─── Step 1: Discharge Planning ─────────────────────────
function _renderRakePlanning() {
    const v = _selectedVessel;
    const mat = MATERIALS.find(m => m.id === v.material);
    const port = PORTS.find(p => p.id === (_planConfig.portId || v.destinationPort));
    const stockUsed = Math.round((port?.maxStockyard || 0) * 0.74 / 1000); // simulated

    return `
        <div class="vp-discharge">
            <!-- Header -->
            <div class="vp-plan-header">
                <div>
                    <div class="vp-plan-vessel-name">${v.name}
                        <span class="vp-id-badge">ID: ${v.id.substring(0, 6)}</span>
                    </div>
                    <div class="vp-plan-subtitle">Select rake allocation for the optimized route and vessel</div>
                </div>
                <div class="vp-plan-qty">
                    <span class="vp-plan-qty-num">${v.quantity.toLocaleString()}</span>
                    <span class="vp-plan-qty-unit">MT</span>
                    <div class="vp-plan-qty-label">${v.materialName}</div>
                </div>
            </div>

            <div class="vp-summary-cards">
                <div class="vp-summary-item">
                    <div class="vp-summary-val">${_selectedRoute?.routeName || `${port?.name || 'Port'} → ${PLANTS.find(p => p.id === _selectedRoute?.toPlant)?.name || 'Plant'}`}</div>
                    <div class="vp-summary-lbl">Optimized Path</div>
                </div>
                <div class="vp-summary-item">
                    <div class="vp-summary-val">${v.name}</div>
                    <div class="vp-summary-lbl">Selected Vessel</div>
                </div>
                <div class="vp-summary-item">
                    <div class="vp-summary-val">${port?.name || v.destinationPortName || 'Port'}</div>
                    <div class="vp-summary-lbl">Discharge Port</div>
                </div>
                <div class="vp-summary-item">
                    <div class="vp-summary-val">${PLANTS.find(p => p.id === _selectedRoute?.toPlant)?.name || _planConfig.plantId || 'Plant'}</div>
                    <div class="vp-summary-lbl">Target Plant</div>
                </div>
            </div>

            <!-- Rake Allocation Slider -->
            <div class="vp-rake-section">
                <label class="vp-form-label">1. Rail Rake Allocation</label>
                <div class="vp-rake-row">
                    <div class="vp-rake-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
                    </div>
                    <div class="vp-rake-slider-wrap">
                        <input type="range" class="vp-slider" id="vpRakeSlider" min="0" max="10" value="${_planConfig.rakes}" step="1">
                        <div class="vp-slider-labels">
                            <span>0 Rakes</span>
                            <span>5 Rakes</span>
                            <span>10 Rakes</span>
                        </div>
                    </div>
                    <div class="vp-rake-display">
                        <span class="vp-rake-num" id="vpRakeNum">${_planConfig.rakes}</span>
                        <span class="vp-rake-unit">Rakes/Day</span>
                    </div>
                </div>
            </div>

            <!-- Discharge Summary -->
            <div class="vp-summary-cards">
                <div class="vp-summary-item">
                    <div class="vp-summary-val">${Math.ceil(v.quantity / (port?.handlingRate || 12000))} days</div>
                    <div class="vp-summary-lbl">Unloading Time</div>
                </div>
                <div class="vp-summary-item">
                    <div class="vp-summary-val">₹${Math.round((port?.handlingCost || 300) * v.quantity / 10000000).toFixed(1)} Cr</div>
                    <div class="vp-summary-lbl">Handling Cost</div>
                </div>
                <div class="vp-summary-item">
                    <div class="vp-summary-val">${Math.ceil(v.quantity / COST_PARAMS.rakeCapacity)} rakes</div>
                    <div class="vp-summary-lbl">Total Rakes Needed</div>
                </div>
                <div class="vp-summary-item">
                    <div class="vp-summary-val">${Math.ceil(v.quantity / (COST_PARAMS.rakeCapacity * _planConfig.rakes || 1))} days</div>
                    <div class="vp-summary-lbl">Rail Dispatch Time</div>
                </div>
            </div>

            <!-- Next Button -->
            <div class="vp-bottom-bar">
                <div></div>
                <button type="button" class="vp-btn vp-btn-primary vp-btn-lg" id="vpBookBtn">
                    Book Rakes &amp; Save Plan
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
        </div>
    `;
}

// ─── Step 2: Route Optimization ─────────────────────────
function _renderRoutePlanning() {
    const v = _selectedVessel || getVisibleVessels()[0] || {};
    const port = PORTS.find(p => p.id === _planConfig.portId);
    const plant = PLANTS.find(p => p.id === _planConfig.plantId);

    // Show only optimized shipment paths; never synthesize random routes here.
    if (_rankedRoutes.length === 0) {
        _rankedRoutes = _buildRankedRoutesFromOptimizedData();
    }

    if (_rankedRoutes.length === 0) {
        return _renderNoOptimizationState();
    }

    return `
        <div class="vp-route">
            <!-- Header -->
            <div class="vp-route-header">
                <div>
                    <h3 class="vp-route-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
                        Rail Route Optimization Engine
                    </h3>
                    <p class="vp-route-sub">Calculate the optimal Port-to-Plant rail path based on cost, transit time, and rake availability.</p>
                </div>
            </div>

            <!-- Source / Destination row -->
            <div class="vp-route-endpoints">
                <div class="vp-form-col">
                    <label class="vp-form-label-sm">SOURCE PORT</label>
                    <select class="vp-select vp-select-sm" id="vpRoutePort" disabled>
                        ${PORTS.map(p => `<option value="${p.id}" ${p.id === _planConfig.portId ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="vp-route-arrow">→</div>
                <div class="vp-form-col">
                    <label class="vp-form-label-sm">DESTINATION PLANT</label>
                    <select class="vp-select vp-select-sm" id="vpRoutePlant" disabled>
                        ${PLANTS.map(p => `<option value="${p.id}" ${p.id === _planConfig.plantId ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>

                <!-- Mini route viz -->
                <div class="vp-route-viz">
                    <div class="vp-route-viz-label vp-route-viz-badge">${_rankedRoutes.length} Feasible Paths Found</div>
                    <svg class="vp-route-svg" viewBox="0 0 200 100">
                        <circle cx="20" cy="80" r="8" fill="#93c5fd" stroke="#3b82f6" stroke-width="2"/>
                        <text x="20" y="98" text-anchor="middle" fill="#64748b" font-size="9" font-family="Inter">PORT</text>
                        <circle cx="180" cy="20" r="8" fill="#86efac" stroke="#10b981" stroke-width="2"/>
                        <text x="180" y="16" text-anchor="middle" fill="#64748b" font-size="9" font-family="Inter">PLANT</text>
                        ${_rankedRoutes.map((r, i) => {
                            const opacity = i === 0 ? 1 : 0.3;
                            const dash = i === 0 ? '' : '4,4';
                            const stroke = i === 0 ? '#2563eb' : '#94a3b8';
                            return `<path d="M 28 76 Q ${60 + i * 30} ${50 - i * 10}, 172 24" fill="none" stroke="${stroke}" stroke-width="${i === 0 ? 2.5 : 1.5}" stroke-dasharray="${dash}" opacity="${opacity}"/>`;
                        }).join('')}
                    </svg>
                </div>
            </div>

            <!-- Optimization Objective -->
            <div class="vp-objective-card">
                <div class="vp-objective-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Optimization Objective
                </div>
                <div class="vp-objective-options">
                    <label class="vp-radio ${_planConfig.objective === 'cost' ? 'vp-radio--active' : ''}">
                        <input type="radio" name="vpObjective" value="cost" ${_planConfig.objective === 'cost' ? 'checked' : ''}>
                        <span>Minimize Total Landed Cost</span>
                        ${_planConfig.objective === 'cost' ? '<span class="vp-active-badge">Active</span>' : ''}
                    </label>
                    <label class="vp-radio ${_planConfig.objective === 'time' ? 'vp-radio--active' : ''}">
                        <input type="radio" name="vpObjective" value="time" ${_planConfig.objective === 'time' ? 'checked' : ''}>
                        <span>Fastest Transit Time (Priority)</span>
                        ${_planConfig.objective === 'time' ? '<span class="vp-active-badge">Active</span>' : ''}
                    </label>
                    <label class="vp-radio ${_planConfig.objective === 'rakes' ? 'vp-radio--active' : ''}">
                        <input type="radio" name="vpObjective" value="rakes" ${_planConfig.objective === 'rakes' ? 'checked' : ''}>
                        <span>Maximize Rake Availability</span>
                        ${_planConfig.objective === 'rakes' ? '<span class="vp-active-badge">Active</span>' : ''}
                    </label>
                </div>
            </div>

            <!-- Ranked Routes -->
            <div class="vp-routes-header">
                <h4>Recommended Rail Paths (Ranked)</h4>
                <span class="vp-sort-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="14" y2="15"/><line x1="4" y1="21" x2="8" y2="21"/></svg>
                    Sorted by ${_planConfig.objective === 'cost' ? 'cost' : _planConfig.objective === 'time' ? 'time' : 'availability'}
                </span>
            </div>

            <div class="vp-routes-list">
                ${_rankedRoutes.map((route, i) => {
                    const isSelected = _selectedRoute?.id === route.id;
                    const badges = {
                        cheapest: { bg: '#eff6ff', text: '#2563eb', label: 'CHEAPEST' },
                        balanced: { bg: '#f8fafc', text: '#475569', label: 'BALANCED' },
                        fastest:  { bg: '#fdf2f8', text: '#db2777', label: 'FASTEST' },
                    };
                    const badge = badges[route.tag] || badges.balanced;
                    const rakeColor = route.rakeLevel === 'High' ? '#ef4444' : route.rakeLevel === 'Medium' ? '#f59e0b' : '#10b981';

                    return `
                    <div class="vp-route-card ${isSelected ? 'vp-route-card--selected' : ''}" data-rid="${route.id}">
                        ${i === 0 ? '<div class="vp-best-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> OPTIMAL PATH</div>' : ''}
                        <div class="vp-route-card-body">
                            <div class="vp-route-info">
                                <div class="vp-route-name">Route #${route.routeId}
                                    <span class="vp-route-tag" style="background:${badge.bg};color:${badge.text}">${badge.label}</span>
                                </div>
                                <div class="vp-route-via">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                                    Via: ${route.via}
                                </div>
                            </div>
                            <div class="vp-route-metrics">
                                <div class="vp-metric">
                                    <div class="vp-metric-label">Landed Cost</div>
                                    <div class="vp-metric-val" style="color:var(--primary)">₹${route.cost}</div>
                                </div>
                                <div class="vp-metric">
                                    <div class="vp-metric-label">Transit Time</div>
                                    <div class="vp-metric-val">${route.time}h</div>
                                </div>
                                <div class="vp-metric">
                                    <div class="vp-metric-label">Rakes</div>
                                    <div class="vp-metric-val" style="color:${rakeColor}">${route.rakeLevel}</div>
                                </div>
                            </div>
                            <div class="vp-route-radio">
                                <div class="vp-radio-circle ${isSelected ? 'vp-radio-circle--active' : ''}"></div>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Bottom Bar -->
            <div class="vp-bottom-bar vp-bottom-bar--route">
                <div class="vp-selected-label">
                    Selected Route: <span style="color:${_selectedRoute ? '#3b82f6' : '#94a3b8'};font-weight:600">${_selectedRoute ? 'Route #' + _selectedRoute.routeId : 'None'}</span>
                </div>
                <div class="vp-bottom-actions">
                    <button type="button" class="vp-btn vp-btn-ghost" id="vpBackBtn">Cancel</button>
                    <button type="button" class="vp-btn vp-btn-primary vp-btn-lg ${!_selectedRoute ? 'vp-btn--disabled' : ''}" id="vpConfirmBtn" ${!_selectedRoute ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        Next: Select Vessel
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// ROUTE GENERATION (uses MILP-style scoring)
// ═══════════════════════════════════════════════════════════
function _generateRoutes() {
    const portId = _planConfig.portId;
    const plantId = _planConfig.plantId;

    // Get direct route
    const directRoute = RAIL_ROUTES.find(r => r.from === portId && r.to === plantId);

    // Build alternative route options (via intermediate ports)
    const alts = [];
    const viaOptions = ['Bhadrak → Keonjhar', 'Cuttack → Jajpur', 'Alt. Route X', 'Angul → Talcher', 'Jharsuguda Jn.'];
    const allRoutes = RAIL_ROUTES.filter(r => r.from === portId);

    // Generate 3-5 feasible route variants with scoring
    for (let i = 0; i < Math.min(allRoutes.length + 2, 5); i++) {
        const base = directRoute || allRoutes[0] || RAIL_ROUTES[0];
        const costVariance = 1 + (i * 0.08) + (Math.random() * 0.05 - 0.025);
        const timeVariance = 1 + ((2 - i) * 0.12) + (Math.random() * 0.1);
        const cost = Math.round(base.distance * base.costPerTonKm * costVariance / base.costPerTonKm);
        const time = Math.round(base.avgTime * timeVariance / (i === 0 ? 2.2 : 2 - i * 0.15));
        const rakeLevel = i === 0 ? 'Medium' : i === 1 ? 'Medium' : i === 2 ? 'High' : 'Low';

        alts.push({
            id: `rt_${i}`,
            routeId: `R${i + 1}`,
            via: viaOptions[i % viaOptions.length],
            cost,
            time: Math.max(6, Math.min(time, 42)),
            rakeLevel,
            distance: Math.round(base.distance * (1 + i * 0.05)),
            tag: i === 0 ? 'cheapest' : (i === alts.length ? 'fastest' : 'balanced'),
        });
    }

    // Tag the last one as fastest (lowest time)
    alts.sort((a, b) => {
        if (_planConfig.objective === 'cost') return a.cost - b.cost;
        if (_planConfig.objective === 'time') return a.time - b.time;
        return a.rakeLevel === 'Low' ? -1 : 1;
    });

    if (alts.length >= 1) alts[0].tag = _planConfig.objective === 'cost' ? 'cheapest' : _planConfig.objective === 'time' ? 'fastest' : 'balanced';
    if (alts.length >= 2) alts[1].tag = 'balanced';
    if (alts.length >= 3) alts[alts.length - 1].tag = alts[alts.length - 1].tag === 'cheapest' ? 'balanced' : 'fastest';

    _rankedRoutes = alts;
}

// ═══════════════════════════════════════════════════════════
// EVENT BINDING
// ═══════════════════════════════════════════════════════════
function _bindEvents() {
    if (!_container) return;

    // Route / vessel card clicks
    _container.addEventListener('click', (event) => {
        const card = event.target.closest('.vp-vessel-card, .vp-route-card');
        if (!card || !_container.contains(card)) return;

        const role = card.dataset.role || (card.dataset.rid ? 'route' : card.dataset.vid ? 'vessel' : '');
        if (role === 'route') {
            const rid = card.dataset.rid;
            _selectedRoute = _rankedRoutes.find(r => r.id === rid || r.routeId === rid);
            if (!_selectedRoute) return;
            _step = 'vessel';
            _selectedVessel = null;
            _planConfig.portId = _selectedRoute.fromPort || '';
            _planConfig.plantId = _selectedRoute.toPlant || '';
            _render();
            return;
        }

        if (role === 'vessel') {
            const vid = card.dataset.vid;
            const vessels = getVisibleVessels();
            const vessel = vessels.find(v => String(v.id) === String(vid));
            if (!vessel) return;
            _selectedVessel = vessel;
            _step = 'rake';
            _planConfig.portId = vessel.destinationPort || _planConfig.portId;
            _planConfig.plantId = _selectedRoute?.toPlant || _planConfig.plantId || PLANTS[0].id;
            _planConfig.rakes = Math.max(1, Math.ceil((vessel.quantity || 0) / COST_PARAMS.rakeCapacity));
            _render();
        }
    });

    // Port/Plant selects
    _container.querySelector('#vpPortSelect')?.addEventListener('change', (e) => {
        _planConfig.portId = e.target.value;
        _render();
    });
    _container.querySelector('#vpPlantSelect')?.addEventListener('change', (e) => {
        _planConfig.plantId = e.target.value;
        _render();
    });

    // Rake slider
    const slider = _container.querySelector('#vpRakeSlider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            _planConfig.rakes = parseInt(e.target.value) || 1;
            const numEl = _container.querySelector('#vpRakeNum');
            if (numEl) numEl.textContent = _planConfig.rakes;
        });
    }

    // Objective radio buttons
    _container.querySelectorAll('input[name="vpObjective"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            _planConfig.objective = e.target.value;
            _rankedRoutes = [];
            _selectedRoute = null;
            _render();
        });
    });

    _container.querySelector('#vpConfirmVesselBtn')?.addEventListener('click', () => {
        if (!_selectedRoute || !_selectedVessel) return;
        _step = 'rake';
        _planConfig.portId = _selectedRoute.fromPort || _selectedVessel.destinationPort || '';
        _planConfig.plantId = _selectedRoute.toPlant || _planConfig.plantId || PLANTS[0].id;
        _planConfig.rakes = Math.max(1, Math.ceil((_selectedVessel.quantity || 0) / COST_PARAMS.rakeCapacity));
        _render();
    });

    // Back / Cancel
    _container.querySelector('#vpBackBtn')?.addEventListener('click', () => {
        if (_step === 'vessel') {
            _step = 'route';
            _selectedRoute = null;
        } else {
            _step = _selectedRoute ? 'vessel' : 'route';
        }
        _render();
    });

    // Route selection -> vessel selection
    _container.querySelector('#vpConfirmBtn')?.addEventListener('click', () => {
        if (!_selectedRoute) return;
        _step = 'vessel';
        _render();
    });

    // Final booking
    _container.querySelector('#vpBookBtn')?.addEventListener('click', async () => {
        if (!_selectedRoute || !_selectedVessel) return;

        const btn = _container.querySelector('#vpBookBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

        const v = _selectedVessel;
        const port = PORTS.find(p => p.id === _planConfig.portId);
        const plant = PLANTS.find(p => p.id === _planConfig.plantId);
        const handlingCost = Math.round((port?.handlingCost || 300) * v.quantity);
        const railCost = _selectedRoute.cost * v.quantity;
        const totalCost = handlingCost + railCost;

        const plan = {
            vessel: v,
            port,
            plant,
            rakes: _planConfig.rakes,
            route: _selectedRoute,
            rake: _selectedRoute,
            objective: _planConfig.objective,
        };

        // --- 🟢 Persist full vessel snapshot via authenticated API ---
        try {
            const resp = await apiFetch('/api/vessels/plans', {
                method: 'POST',
                body: JSON.stringify({
                    // Vessel identity
                    vesselId: v.id,
                    vesselName: v.name,
                    origin: v.origin,
                    originCountry: v.originCountry,
                    destinationPort: port?.id || v.destinationPort,
                    destinationPortName: port?.name || v.destinationPortName,
                    material: v.material,
                    materialName: v.materialName,
                    quantity: v.quantity,
                    vesselAge: v.vesselAge,
                    scheduledETA: v.scheduledETA,
                    actualETA: v.actualETA,
                    delayHours: v.delayHours || 0,
                    status: 'berthed',
                    berthAssigned: v.berthAssigned || 1,
                    freightCost: v.freightCost || 0,
                    // Plan details
                    portId: port?.id || '',
                    plantId: plant?.id || '',
                    route: _selectedRoute,
                    vessel: v,
                    rake: _selectedRoute,
                    rakes: _planConfig.rakes,
                    cost: totalCost,
                    cargo: { quantity: v.quantity, material: v.material }
                })
            });

            if (resp && resp.ok) {
                // 🔔 Notify the Vessel Tracker to refresh with the booked vessel
                window.dispatchEvent(new CustomEvent('vesselPlanSaved', { detail: plan }));

                // Show success toast
                const toast = document.createElement('div');
                toast.className = 'notification notification-success';
                toast.textContent = `✅ ${v.name} booked via Route #${_selectedRoute.routeId} — reflected in Vessel Tracker`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 4000);
            } else {
                const err = await resp?.json();
                throw new Error(err?.error || 'Save failed');
            }
        } catch (err) {
            console.error('[VesselPlanning] Save error:', err);
            const toast = document.createElement('div');
            toast.className = 'notification notification-error';
            toast.textContent = `❌ Failed to save plan: ${err.message}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        // Reset wizard
        _selectedVessel = null;
        _step = 'route';
        _selectedRoute = null;
        _rankedRoutes = [];
        _render();
    });
}

export function resetVesselPlanning() {
    _selectedVessel = null;
    _step = 'route';
    _selectedRoute = null;
    _rankedRoutes = [];
}
