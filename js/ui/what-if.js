// ============================================================
// SteelSync-Opt - What-If Simulation Panel
// ============================================================

import { SCENARIO_TYPES, runSimulation, getScenarioSummary } from '../engines/simulation.js';
import { predictor } from '../engines/prediction.js';
import { formatINR } from '../utils/formatters.js';
import { PORTS, PLANTS } from '../data/constants.js';

let activeScenario = null;
let scenarioParams = {};

// Helper to get names safely
const getPortName = (id) => PORTS.find(p => p.id === id)?.name || id || 'Unknown Port';
const getPlantName = (id) => PLANTS.find(p => p.id === id)?.name || id || 'Unknown Plant';

function getVesselPool(data) {
    const planned = Array.isArray(data?.plannedVessels) ? data.plannedVessels : [];
    const live = Array.isArray(data?.vessels) ? data.vessels : [];
    const pool = planned.length > 0 ? planned : live;
    const seen = new Set();

    return pool.filter(item => {
        const vessel = item.vessel || item;
        const key = String(vessel.id || vessel.vesselId || item.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getRakePool(data) {
    const planned = Array.isArray(data?.plannedRakes) ? data.plannedRakes : [];
    const live = Array.isArray(data?.rakes) ? data.rakes : [];
    const pool = planned.length > 0 ? planned : live;
    const seen = new Set();

    return pool.filter(item => {
        const key = String(item.id || item.rakeId || item.rakeNumber || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Render what-if simulation panel
 */
export function renderWhatIfPanel(container, data, baselineResults) {
    if (!container) return;

    container.innerHTML = `
        <div class="card-header">
            <div>
                <h3 class="card-title">Scenario Simulation</h3>
                <p class="card-subtitle">Test logistics disruption scenarios and analyze cost impacts</p>
            </div>
        </div>

        <div class="whatif-container">
            <div class="whatif-scenarios-col">
                <h4 style="font-size:0.82rem;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">Scenarios</h4>
                <div class="whatif-scenarios" id="scenarioList">
                    ${SCENARIO_TYPES.map(s => `
                        <div class="scenario-card ${activeScenario === s.id ? 'active' : ''}" data-scenario="${s.id}">
                            <div class="scenario-name">${s.name}</div>
                            <div class="scenario-desc">${s.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="whatif-results card" style="background:var(--bg-tertiary)" id="whatifResultsArea">
                ${activeScenario ? renderScenarioConfig(activeScenario, data) : `
                    <div class="chart-empty" style="min-height:300px">
                        <span class="chart-empty-icon">🔮</span>
                        <div>Select a scenario to begin simulation</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
                            Analyze the impact of disruptions on logistics costs
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;

    if (container._whatIfBound) return;
    container._whatIfBound = true;

    container.addEventListener('click', async (ev) => {
        const card = ev.target.closest('.scenario-card');
        if (card) {
            activeScenario = card.dataset.scenario;
            scenarioParams = {};
            renderWhatIfPanel(container, data, baselineResults);
            return;
        }

        const btn = ev.target.closest('#runSimulationBtn');
        if (btn) {
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="loading-spinner"></span> Running...';

                const result = executeSimulation(activeScenario, data, baselineResults);
                const out = container.querySelector('#simulationOutput');
                if (out) renderSimulationResults(out, result);

                await persistSimulationResult(activeScenario, scenarioParams, result);

                window.dispatchEvent(new CustomEvent('simulationSaved', { detail: { result } }));
                window.dispatchEvent(new CustomEvent('simulationCompleted', {
                    detail: {
                        comparison: result,
                        modelTrained: !!(predictor && predictor.trained),
                    }
                }));
            } catch (err) {
                console.error('[What-If] run error', err);
                const out = container.querySelector('#simulationOutput');
                if (out) out.innerHTML = `<div class="alert alert-error">Simulation failed: ${err.message}</div>`;
            } finally {
                btn.disabled = false;
                btn.innerHTML = '⚡ Run Simulation';
            }
        }
    });

    container.addEventListener('input', async (ev) => {
        const input = ev.target.closest('[data-param]');
        if (!input) return;

        const paramKey = input.dataset.param;
        scenarioParams[paramKey] = input.type === 'range' ? parseFloat(input.value) : input.value;

        const display = container.querySelector(`#paramDisplay_${paramKey}`);
        if (display) display.textContent = input.value;

        if (paramKey === 'vesselId') {
            const statusArea = container.querySelector('#simulationOutput');
            if (statusArea) statusArea.innerHTML = '<div class="alert alert-info" style="font-size:0.75rem">Fetching live plan context for the selected vessel...</div>';

            try {
                const res = await apiFetch('/api/vessels/plans/lookup', {
                    method: 'POST',
                    body: JSON.stringify({ vesselId: input.value })
                });
                if (res.ok) {
                    const vesselDetails = await res.json();
                    scenarioParams._vesselDetails = vesselDetails;
                    if (statusArea) {
                        statusArea.innerHTML = `
                            <div class="alert alert-info animate-fade-in" style="font-size:0.75rem">
                                <strong>${vesselDetails.vessel?.name || vesselDetails.name || input.value}</strong>:
                                Currently sailing from <strong>${vesselDetails.source || vesselDetails.origin || 'Unknown'}</strong>
                                to <strong>${vesselDetails.destination || vesselDetails.destinationPortName || 'Unknown'}</strong>.
                                <br/><span style="opacity:0.8">Delay impact will use the saved vessel-plan snapshot.</span>
                            </div>
                        `;
                    }
                }
            } catch (err) {
                console.warn('[What-If] Failed to fetch vessel details', err);
            }
        }

        if (paramKey === 'rakeId') {
            const statusArea = container.querySelector('#simulationOutput');
            if (statusArea) statusArea.innerHTML = '<div class="alert alert-info" style="font-size:0.75rem">🔍 Fetching real-time status for the selected rake...</div>';

            try {
                const res = await apiFetch('/api/vessels/plans/lookup', {
                    method: 'POST',
                    body: JSON.stringify({ rakeId: input.value })
                });
                if (res.ok) {
                    const rakeDetails = await res.json();
                    scenarioParams._rakeDetails = rakeDetails;
                    if (statusArea) {
                        statusArea.innerHTML = `
                            <div class="alert alert-info animate-fade-in" style="font-size:0.75rem">
                                <strong>${rakeDetails.rake?.rakeNumber || rakeDetails.rake?.routeId || input.value}</strong>:
                                Currently moving from <strong>${rakeDetails.source || rakeDetails.rake?.fromPortName || 'Unknown'}</strong>
                                to <strong>${rakeDetails.destination || rakeDetails.rake?.toPlantName || 'Unknown'}</strong>.
                                <br/><span style="opacity:0.8">Disruption prediction will use this saved vessel-plan context.</span>
                            </div>
                        `;
                    }
                }
            } catch (err) {
                console.warn('[What-If] Failed to fetch rake details', err);
                try {
                    const fallback = await apiFetch('/api/data/whatif/rail-cancel', {
                        method: 'POST',
                        body: JSON.stringify({ rakeId: input.value })
                    });
                    if (fallback?.ok) {
                        const rakeDetails = await fallback.json();
                        scenarioParams._rakeDetails = rakeDetails;
                    }
                } catch (fallbackErr) {
                    console.warn('[What-If] Fallback rake lookup also failed', fallbackErr);
                }
            }
        }
    });
}

async function persistSimulationResult(scenarioId, params, result) {
    try {
        await fetch('/api/simulation/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scenarioType: scenarioId,
                inputParams: params,
                originalCost: result.baseline?.totalCost || 0,
                newCost: result.scenario?.totalCost || 0,
                meta: { scenarioSummary: getScenarioSummary(result) }
            })
        });
    } catch (err) {
        console.warn('[What-If] Failed to persist simulation', err);
    }
}

function renderScenarioConfig(scenarioId, data) {
    const scenario = SCENARIO_TYPES.find(s => s.id === scenarioId);
    if (!scenario) return '';

    const vesselPool = getVesselPool(data);
    const rakePool = getRakePool(data);
    let paramsHtml = '';

    for (const param of scenario.params) {
        if (param.type === 'vessel-select') {
            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}</label>
                    <select class="form-select" data-param="${param.key}">
                        ${vesselPool.map(v => {
                            const vessel = v.vessel || v;
                            const matName = vessel.materialName || vessel.material || 'Vessel';
                            const label = `${vessel.name || vessel.vesselName || vessel.id || 'Vessel'} (${matName})`;
                            const value = vessel.id || vessel.vesselId || v.id;
                            return `<option value="${value}" ${scenarioParams[param.key] === value ? 'selected' : ''}>${label}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key] && vesselPool.length) {
                const vessel = vesselPool[0].vessel || vesselPool[0];
                scenarioParams[param.key] = vessel.id || vessel.vesselId || vesselPool[0].id;
            }
        } else if (param.type === 'rake-select') {
            const rakeOptions = rakePool.map(r => {
                const fromName = getPortName(r.fromPort || r.from || r.route?.fromPort || r.route?.from);
                const toName = getPlantName(r.toPlant || r.to || r.route?.toPlant || r.route?.to);
                const label = `${r.rakeNumber || r.routeId || r.id || 'RK'} (${fromName} -> ${toName})`;
                const value = r.id || r.rakeId || r.rakeNumber;
                return `<option value="${value}" ${scenarioParams[param.key] === value ? 'selected' : ''}>${label}</option>`;
            }).join('');

            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}</label>
                    <select class="form-select" data-param="${param.key}">
                        ${rakeOptions || '<option disabled>No active rakes found</option>'}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key] && rakePool.length) {
                scenarioParams[param.key] = rakePool[0].id || rakePool[0].rakeId || rakePool[0].rakeNumber;
            }
        } else if (param.type === 'plant-select') {
            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}</label>
                    <select class="form-select" data-param="${param.key}">
                        ${PLANTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key]) scenarioParams[param.key] = PLANTS[0]?.id;
        } else if (param.type === 'port-select') {
            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}</label>
                    <select class="form-select" data-param="${param.key}">
                        ${PORTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key]) scenarioParams[param.key] = PORTS[0]?.id;
        } else if (param.type === 'range') {
            const defaultVal = param.default;
            const currentVal = scenarioParams[param.key] !== undefined ? scenarioParams[param.key] : defaultVal;
            scenarioParams[param.key] = currentVal;

            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}: <span id="paramDisplay_${param.key}" class="mono" style="color:var(--accent-primary)">${currentVal}</span></label>
                    <input type="range" data-param="${param.key}" min="${param.min}" max="${param.max}" step="${param.step}" value="${currentVal}">
                </div>
            `;
        }
    }

    return `
        <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                <span style="font-size:1.6rem">${scenario.icon}</span>
                <div>
                    <h4 style="font-size:1rem;font-weight:600">${scenario.name}</h4>
                    <p style="font-size:0.75rem;color:var(--text-muted)">${scenario.description}</p>
                </div>
            </div>

            <div class="scenario-params-grid">
                ${paramsHtml}
            </div>

            <button class="btn btn-primary" id="runSimulationBtn" style="width:100%;justify-content:center;margin-top:16px">
                ⚡ Run Simulation
            </button>

            <div id="simulationOutput" style="margin-top:20px"></div>
        </div>
    `;
}

function executeSimulation(scenarioId, data, baselineResults) {
    if (!scenarioId) throw new Error('No scenario selected');
    const simulationScenario = {
        type: scenarioId,
        params: { ...scenarioParams },
    };
    return runSimulation(simulationScenario, data, baselineResults);
}

function renderSimulationResults(container, comparison) {
    if (!container) return;
    const { impact } = comparison;
    const summary = getScenarioSummary(comparison);

    const isLoss = impact.costChange > 0;
    const themeColor = isLoss ? 'var(--accent-danger)' : 'var(--accent-success)';
    const headerLabel = isLoss ? 'Critical Disruption Analysis' : 'Optimization Impact Analysis';
    const totalLabel = isLoss ? 'Potential Loss' : 'Potential Saving';

    container.innerHTML = `
        <div class="simulation-result-card animate-slide-up">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h4 style="font-size:0.88rem;font-weight:600">${headerLabel}</h4>
                <div class="ml-badge" style="background:${isLoss ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color:${themeColor}; border:1px solid ${themeColor}44">
                    ${isLoss ? '⚠️ Risk Alert' : '✨ Efficiency Gain'}
                </div>
            </div>

            <div class="simulation-summary-box" style="background:${isLoss ? 'rgba(185, 28, 28, 0.06)' : 'rgba(21, 128, 61, 0.06)'}; border-left:4px solid ${themeColor}; padding:14px; border-radius:8px; margin-bottom:20px">
                <p style="font-size:0.85rem;line-height:1.5;color:var(--text-secondary)">${summary}</p>
            </div>

            <div class="impact-grid" style="grid-template-columns:repeat(auto-fit, minmax(140px, 1fr))">
                <div class="impact-card" style="border-top:2px solid ${themeColor}">
                    <div class="impact-value" style="color:${themeColor}">
                        ${isLoss ? '▲' : '▼'} ${formatINR(Math.abs(impact.costChange), true)}
                    </div>
                    <div class="impact-label">${totalLabel}</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:${themeColor}">
                        ${isLoss ? '+' : ''}${impact.costChangePercent.toFixed(1)}%
                    </div>
                    <div class="impact-label">Budget Delta</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:${impact.demurrageChange > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">
                        ${impact.demurrageChange > 0 ? '+' : ''}${formatINR(impact.demurrageChange, true)}
                    </div>
                    <div class="impact-label">Demurrage Variation</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:var(--accent-danger)">
                        ${formatINR(impact.penaltyChange, true)}
                    </div>
                    <div class="impact-label">Unmet Demand Penalty</div>
                </div>
            </div>

            <div style="margin-top:16px; font-size:0.75rem; color:var(--text-muted); text-align:center">
                📊 Analysis based on current state fleet and active ML constraints
            </div>
        </div>
    `;
}
