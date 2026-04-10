// ============================================================
// SteelSync-Opt — What-If Simulation Panel
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

/**
 * Render what-if simulation panel
 */
export function renderWhatIfPanel(container, data, baselineResults) {
    if (!container) return;
    
    // Initial Render
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

    // --- EVENT DELEGATION (SINGLE BINDING) ---
    // Remove existing to prevent duplication if container persists
    if (container._whatIfBound) return;
    container._whatIfBound = true;

    container.addEventListener('click', async (ev) => {
        // Scenario Selection
        const card = ev.target.closest('.scenario-card');
        if (card) {
            activeScenario = card.dataset.scenario;
            scenarioParams = {};
            renderWhatIfPanel(container, data, baselineResults);
            return;
        }

        // Run Simulation
        const btn = ev.target.closest('#runSimulationBtn');
        if (btn) {
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="loading-spinner"></span> Running...';
                
                const result = executeSimulation(activeScenario, data, baselineResults);
                const out = container.querySelector('#simulationOutput');
                if (out) renderSimulationResults(out, result);

                // System of Record Flow: Save to DB
                await persistSimulationResult(activeScenario, scenarioParams, result);

                // Dispatch completion events
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

    container.addEventListener('input', (ev) => {
        const input = ev.target.closest('[data-param]');
        if (input) {
            scenarioParams[input.dataset.param] = input.type === 'range' ? parseFloat(input.value) : input.value;
            const display = container.querySelector(`#paramDisplay_${input.dataset.param}`);
            if (display) display.textContent = input.value;
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

    let paramsHtml = '';
    for (const param of scenario.params) {
        if (param.type === 'vessel-select') {
            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}</label>
                    <select class="form-select" data-param="${param.key}">
                        ${data.vessels.map(v => {
                            const matName = v.materialName || v.material || 'Vessel';
                            return `<option value="${v.id}">${v.name} (${matName})</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key]) scenarioParams[param.key] = data.vessels[0]?.id;
        } else if (param.type === 'rake-select') {
            const rakeOptions = (data.rakes || []).map(r => {
                const fromName = getPortName(r.fromPort || r.from);
                const toName = getPlantName(r.toPlant || r.to);
                const label = `${r.rakeNumber || r.id || 'RK'} (${fromName} → ${toName})`;
                return `<option value="${r.id}" ${scenarioParams[param.key] === r.id ? 'selected' : ''}>${label}</option>`;
            }).join('');

            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}</label>
                    <select class="form-select" data-param="${param.key}">
                        ${rakeOptions || '<option disabled>No active rakes found</option>'}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key] && data.rakes?.length) scenarioParams[param.key] = data.rakes[0].id;
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

    const isIncrease = impact.costChange > 0;
    const changeColor = isIncrease ? 'var(--accent-danger)' : 'var(--accent-success)';
    const changeIcon = isIncrease ? '📈' : '📉';

    container.innerHTML = `
        <div class="simulation-result-card animate-slide-up">
            <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:12px">Simulation Impact Analysis</h4>

            <div class="simulation-summary-box" style="background:${isIncrease ? 'rgba(185, 28, 28, 0.06)' : 'rgba(21, 128, 61, 0.06)'}">
                <p>${summary}</p>
            </div>

            <div class="impact-grid">
                <div class="impact-card">
                    <div class="impact-value" style="color:${changeColor}">
                        ${isIncrease ? '+' : ''}${formatINR(impact.costChange, true)}
                    </div>
                    <div class="impact-label">Total Cost Impact</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:${changeColor}">
                        ${isIncrease ? '+' : ''}${impact.costChangePercent.toFixed(1)}%
                    </div>
                    <div class="impact-label">Cost Change</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:${impact.demurrageChange > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">
                        ${impact.demurrageChange > 0 ? '+' : ''}${formatINR(impact.demurrageChange, true)}
                    </div>
                    <div class="impact-label">Demurrage</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:${impact.railChange > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">
                        ${impact.railChange > 0 ? '+' : ''}${formatINR(impact.railChange, true)}
                    </div>
                    <div class="impact-label">Rail Impact</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:var(--accent-danger)">
                        ${impact.penaltyChange > 0 ? '+' : ''}${formatINR(impact.penaltyChange, true)}
                    </div>
                    <div class="impact-label">Penalties & Fees</div>
                </div>
            </div>
        </div>
    `;
}
