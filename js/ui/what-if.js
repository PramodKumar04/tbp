// ============================================================
// SteelSync-Opt — What-If Simulation Panel
// ============================================================

import { SCENARIO_TYPES, runSimulation, getScenarioSummary } from '../engines/simulation.js';
import { formatINR, formatPercent } from '../utils/formatters.js';
import { PORTS, PLANTS } from '../data/constants.js';

let activeScenario = null;
let scenarioParams = {};

/**
 * Render what-if simulation panel
 */
export function renderWhatIfPanel(container, data, baselineResults) {
    container.innerHTML = `
        <div class="card-header">
            <div>
                <h3 class="card-title">🔮 What-If Simulation</h3>
                <p class="card-subtitle">Test disruption scenarios and analyze impact</p>
            </div>
        </div>

        <div class="whatif-container">
            <div class="whatif-scenarios-col">
                <h4 style="font-size:0.82rem;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">Scenarios</h4>
                <div class="whatif-scenarios" id="scenarioList">
                    ${SCENARIO_TYPES.map(s => `
                        <div class="scenario-card ${activeScenario === s.id ? 'active' : ''}" data-scenario="${s.id}">
                            <div class="scenario-icon">${s.icon}</div>
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

    // Bind scenario selection
    container.querySelectorAll('.scenario-card').forEach(card => {
        card.addEventListener('click', () => {
            activeScenario = card.dataset.scenario;
            scenarioParams = {};
            renderWhatIfPanel(container, data, baselineResults);
        });
    });

    // Bind run button
    const runBtn = container.querySelector('#runSimulationBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            const result = executeSimulation(activeScenario, data, baselineResults);
            renderSimulationResults(container.querySelector('#simulationOutput'), result);
        });
    }

    // Bind param inputs
    container.querySelectorAll('[data-param]').forEach(input => {
        input.addEventListener('input', (e) => {
            scenarioParams[e.target.dataset.param] = e.target.type === 'range' ? parseFloat(e.target.value) : e.target.value;
            const display = container.querySelector(`#paramDisplay_${e.target.dataset.param}`);
            if (display) display.textContent = e.target.value;
        });
    });
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
                        ${data.vessels.map(v => `<option value="${v.id}">${v.name} (${v.materialName})</option>`).join('')}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key]) scenarioParams[param.key] = data.vessels[0]?.id;
        } else if (param.type === 'rake-select') {
            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}</label>
                    <select class="form-select" data-param="${param.key}">
                        ${data.rakes.map(r => `<option value="${r.id}">${r.rakeNumber} (${r.fromPortName} → ${r.toPlantName})</option>`).join('')}
                    </select>
                </div>
            `;
            if (!scenarioParams[param.key]) scenarioParams[param.key] = data.rakes[0]?.id;
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
            scenarioParams[param.key] = scenarioParams[param.key] || defaultVal;
            paramsHtml += `
                <div class="form-group">
                    <label class="form-label">${param.label}: <span id="paramDisplay_${param.key}" class="mono" style="color:var(--accent-primary)">${defaultVal}</span></label>
                    <input type="range" data-param="${param.key}" min="${param.min}" max="${param.max}" step="${param.step}" value="${defaultVal}">
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

            ${paramsHtml}

            <button class="btn btn-primary" id="runSimulationBtn" style="width:100%;justify-content:center;margin-top:8px">
                ⚡ Run Simulation
            </button>

            <div id="simulationOutput" style="margin-top:20px"></div>
        </div>
    `;
}

function executeSimulation(scenarioId, data, baselineResults) {
    const scenario = {
        type: scenarioId,
        params: { ...scenarioParams },
    };
    return runSimulation(scenario, data, baselineResults);
}

function renderSimulationResults(container, comparison) {
    if (!container) return;
    const { impact } = comparison;
    const summary = getScenarioSummary(comparison);

    const isIncrease = impact.costChange > 0;
    const changeColor = isIncrease ? 'var(--accent-danger)' : 'var(--accent-success)';
    const changeIcon = isIncrease ? '📈' : '📉';

    container.innerHTML = `
        <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-card);border:1px solid var(--border-primary)">
            <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:12px">${changeIcon} Simulation Results</h4>

            <div style="padding:12px;border-radius:var(--radius-md);background:${isIncrease ? 'rgba(var(--accent-danger-rgb),0.06)' : 'rgba(var(--accent-success-rgb),0.06)'};border:1px solid ${isIncrease ? 'rgba(var(--accent-danger-rgb),0.15)' : 'rgba(var(--accent-success-rgb),0.15)'};margin-bottom:16px">
                <p style="font-size:0.82rem;color:var(--text-secondary)">${summary}</p>
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
                    <div class="impact-label">Demurrage Impact</div>
                </div>
                <div class="impact-card">
                    <div class="impact-value" style="color:${impact.railChange > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">
                        ${impact.railChange > 0 ? '+' : ''}${formatINR(impact.railChange, true)}
                    </div>
                    <div class="impact-label">Rail Cost Impact</div>
                </div>
            </div>
        </div>
    `;
}
