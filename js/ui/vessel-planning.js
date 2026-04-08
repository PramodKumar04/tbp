// ============================================================
// SteelSync-Opt — Vessel Planning Module
// ============================================================
// Multi-step wizard: Select Vessel → Configure Discharge → Optimize Route

import { PORTS, PLANTS, RAIL_ROUTES, COST_PARAMS, MATERIALS } from '../data/constants.js';

let _vessels = [];
let _selectedVessel = null;
let _step = 'select';  // 'select' | 'discharge' | 'route'
let _planConfig = { portId: '', plantId: '', rakes: 2, objective: 'cost' };
let _rankedRoutes = [];
let _selectedRoute = null;
let _container = null;
let _onPlanConfirmed = null;

// Status color mapping
const STATUS_COLORS = {
    'in-transit': { bg: '#ecfdf5', text: '#10b981', label: 'In Transit' },
    'on-time':    { bg: '#ecfdf5', text: '#10b981', label: 'On Time' },
    'delayed':    { bg: '#fef3c7', text: '#f59e0b', label: 'Delayed' },
    'berthed':    { bg: '#dbeafe', text: '#3b82f6', label: 'Berthed' },
    'unloading':  { bg: '#dbeafe', text: '#3b82f6', label: 'Unloading' },
    'anchorage':  { bg: '#fef3c7', text: '#f59e0b', label: 'Anchorage' },
};

/**
 * Public API: Render the vessel planning panel
 */
export function renderVesselPlanning(container, vessels, onPlanConfirmed) {
    _container = container;
    _vessels = vessels || [];
    _onPlanConfirmed = onPlanConfirmed;
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
    return `
        <div class="vp-list-header">
            <h3 class="vp-list-title">Inbound Vessels</h3>
            <p class="vp-list-sub">Select a vessel to plan discharge</p>
        </div>
        <div class="vp-list">
            ${_vessels.map(v => {
                const sc = STATUS_COLORS[v.status] || STATUS_COLORS['in-transit'];
                const isActive = _selectedVessel?.id === v.id;
                const mat = MATERIALS.find(m => m.id === v.material);
                const eta = new Date(v.actualETA);
                const etaStr = eta.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                return `
                <div class="vp-vessel-card ${isActive ? 'vp-vessel-card--active' : ''}" data-vid="${v.id}">
                    <div class="vp-vessel-top">
                        <div class="vp-vessel-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>
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
            }).join('')}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// RIGHT PANEL — Dynamic based on step
// ═══════════════════════════════════════════════════════════
function _renderMainPanel() {
    if (!_selectedVessel) return _renderEmptyState();
    if (_step === 'route') return _renderRoutePlanning();
    return _renderDischargePlanning();
}

function _renderEmptyState() {
    return `
        <div class="vp-empty">
            <div class="vp-empty-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.2">
                    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
                    <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
                </svg>
            </div>
            <p class="vp-empty-text">Select a vessel from the list to start planning.</p>
        </div>
    `;
}

// ─── Step 1: Discharge Planning ─────────────────────────
function _renderDischargePlanning() {
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
                    <div class="vp-plan-subtitle">Ready for Discharge Planning</div>
                </div>
                <div class="vp-plan-qty">
                    <span class="vp-plan-qty-num">${v.quantity.toLocaleString()}</span>
                    <span class="vp-plan-qty-unit">MT</span>
                    <div class="vp-plan-qty-label">${v.materialName}</div>
                </div>
            </div>

            <!-- Port & Plant Selection -->
            <div class="vp-form-row">
                <div class="vp-form-col">
                    <label class="vp-form-label">1. Select Discharge Port</label>
                    <select class="vp-select" id="vpPortSelect">
                        ${PORTS.map(p => `<option value="${p.id}" ${p.id === (port?.id || v.destinationPort) ? 'selected' : ''}>${p.name} (Stock: ${Math.round(p.maxStockyard / 1000)}k)</option>`).join('')}
                    </select>
                </div>
                <div class="vp-form-col">
                    <label class="vp-form-label">2. Target Plant</label>
                    <select class="vp-select" id="vpPlantSelect">
                        ${PLANTS.map(p => `<option value="${p.id}" ${p.id === _planConfig.plantId ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Rake Allocation Slider -->
            <div class="vp-rake-section">
                <label class="vp-form-label">3. Rail Rake Allocation</label>
                <div class="vp-rake-row">
                    <div class="vp-rake-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
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
                <button class="vp-btn vp-btn-primary vp-btn-lg" id="vpNextBtn">
                    Next: Optimize Rail Route
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
        </div>
    `;
}

// ─── Step 2: Route Optimization ─────────────────────────
function _renderRoutePlanning() {
    const v = _selectedVessel;
    const port = PORTS.find(p => p.id === _planConfig.portId);
    const plant = PLANTS.find(p => p.id === _planConfig.plantId);

    // Generate ranked routes
    if (_rankedRoutes.length === 0) _generateRoutes();

    return `
        <div class="vp-route">
            <!-- Header -->
            <div class="vp-route-header">
                <div>
                    <h3 class="vp-route-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
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
                            return `<path d="M 28 76 Q ${60 + i * 30} ${50 - i * 10}, 172 24" fill="none" stroke="#3b82f6" stroke-width="${i === 0 ? 2.5 : 1.5}" stroke-dasharray="${dash}" opacity="${opacity}"/>`;
                        }).join('')}
                    </svg>
                </div>
            </div>

            <!-- Optimization Objective -->
            <div class="vp-objective-card">
                <div class="vp-objective-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
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
                        cheapest: { bg: '#dbeafe', text: '#3b82f6', label: 'CHEAPEST' },
                        balanced: { bg: '#e5e7eb', text: '#4b5563', label: 'BALANCED' },
                        fastest:  { bg: '#fce7f3', text: '#ec4899', label: 'FASTEST' },
                    };
                    const badge = badges[route.tag] || badges.balanced;
                    const rakeColor = route.rakeLevel === 'High' ? '#ef4444' : route.rakeLevel === 'Medium' ? '#f59e0b' : '#10b981';

                    return `
                    <div class="vp-route-card ${isSelected ? 'vp-route-card--selected' : ''}" data-rid="${route.id}">
                        ${i === 0 ? '<div class="vp-best-badge">⚡ BEST CHOICE</div>' : ''}
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
                                    <div class="vp-metric-label">₹ Cost</div>
                                    <div class="vp-metric-val" style="color:#3b82f6">₹${route.cost}</div>
                                </div>
                                <div class="vp-metric">
                                    <div class="vp-metric-label">⏱ Time</div>
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
                    <button class="vp-btn vp-btn-ghost" id="vpBackBtn">Cancel</button>
                    <button class="vp-btn vp-btn-primary vp-btn-lg ${!_selectedRoute ? 'vp-btn--disabled' : ''}" id="vpConfirmBtn" ${!_selectedRoute ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        Confirm Plan
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

    // Vessel card clicks
    _container.querySelectorAll('.vp-vessel-card').forEach(card => {
        card.addEventListener('click', () => {
            const vid = card.dataset.vid;
            const vessel = _vessels.find(v => v.id === vid);
            if (!vessel) return;
            _selectedVessel = vessel;
            _step = 'discharge';
            _planConfig.portId = vessel.destinationPort;
            _planConfig.plantId = PLANTS[0].id;
            _planConfig.rakes = 2;
            _selectedRoute = null;
            _rankedRoutes = [];
            _render();
        });
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

    // Next button
    _container.querySelector('#vpNextBtn')?.addEventListener('click', () => {
        _step = 'route';
        _rankedRoutes = [];
        _selectedRoute = null;
        _render();
    });

    // Objective radio buttons
    _container.querySelectorAll('input[name="vpObjective"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            _planConfig.objective = e.target.value;
            _rankedRoutes = [];
            _selectedRoute = null;
            _render();
        });
    });

    // Route card selection
    _container.querySelectorAll('.vp-route-card').forEach(card => {
        card.addEventListener('click', () => {
            const rid = card.dataset.rid;
            _selectedRoute = _rankedRoutes.find(r => r.id === rid);
            _render();
        });
    });

    // Back / Cancel
    _container.querySelector('#vpBackBtn')?.addEventListener('click', () => {
        _step = 'discharge';
        _selectedRoute = null;
        _render();
    });

    // Confirm Plan
    _container.querySelector('#vpConfirmBtn')?.addEventListener('click', () => {
        if (!_selectedRoute || !_selectedVessel) return;
        const plan = {
            vessel: _selectedVessel,
            port: PORTS.find(p => p.id === _planConfig.portId),
            plant: PLANTS.find(p => p.id === _planConfig.plantId),
            rakes: _planConfig.rakes,
            route: _selectedRoute,
            objective: _planConfig.objective,
        };
        console.log('[VesselPlanning] Plan confirmed:', plan);
        if (_onPlanConfirmed) _onPlanConfirmed(plan);

        // Show success toast
        const toast = document.createElement('div');
        toast.className = 'notification notification-success';
        toast.textContent = `✓ Plan confirmed for ${_selectedVessel.name} via Route #${_selectedRoute.routeId}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);

        // Reset
        _selectedVessel = null;
        _step = 'select';
        _selectedRoute = null;
        _rankedRoutes = [];
        _render();
    });
}

export function resetVesselPlanning() {
    _selectedVessel = null;
    _step = 'select';
    _selectedRoute = null;
    _rankedRoutes = [];
}
