import { optimizeLogistics } from '../engines/optimizer.js';
import { switchPanel, showNotification } from '../app.js';
import { apiUpload, apiFetch } from '../utils/api.js';
import { parseUploadedFile } from '../utils/excel-parser.js';
import { formatINR } from '../utils/formatters.js';
import { PORTS, PLANTS, COST_PARAMS } from '../data/constants.js';
import { predictor } from '../engines/prediction.js';

let optVessels = null;
let optRakes = null;
let optInventory = null;
let solverResult = null;

export function renderOptimizerPanel(autoRun = false) {
    const container = document.getElementById('optimizerStudioContent');
    if (!container) return;

    container.innerHTML = `
        <div class="wizard-container">
            <div class="wizard-sidebar">
                <div class="wizard-step active" data-step="1">1. Demand &amp; Rakes</div>
                <div class="wizard-step" data-step="2">2. Inventory (SAP)</div>
                <div class="wizard-step" data-step="3">3. Configure Constraints</div>
                <div class="wizard-step" data-step="4">4. Run MILP Solver</div>
            </div>
            <div class="wizard-content">

                <!-- Step 1: Demand & Rakes -->
                <div class="step-pane active" id="optStep1" style="display:block">
                    <h2>Upload Demand &amp; Rakes Data</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px">Provide a CSV/Excel file with columns: vessel name, port, material, quantity, ETA.</p>
                    <div class="file-drop-zone">
                        <div class="drop-icon">📄🚆</div>
                        <p id="optDemandStatus">Drag and drop Demand & Rakes CSV/Excel here</p>
                        <input type="file" id="optDemandRakeInput" accept=".csv, .xlsx, .xls" style="display:none">
                        <button class="btn btn-primary" onclick="document.getElementById('optDemandRakeInput').click()">Browse</button>
                    </div>
                    <div style="margin-top:16px;padding:14px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border-primary)">
                        <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">💡 Or skip upload and optimize using live app data:</p>
                        <button class="btn btn-ghost btn-sm" id="btnUseLiveData">Use Live App Data →</button>
                    </div>
                    <div id="demandDataPreview" class="data-preview-table mt-3" style="max-height:200px;overflow:auto;display:none;background:var(--bg-tertiary);border-radius:8px;padding:10px"></div>
                </div>

                <!-- Step 2: SAP -->
                <div class="step-pane" id="optStep2" style="display:none">
                    <h2>Upload SAP Inventory Data</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px">Current plant stock levels and safety stock requirements.</p>
                    <div class="file-drop-zone">
                        <div class="drop-icon">📦</div>
                        <p id="optSapStatus">Drag and drop SAP Inventory CSV/Excel here</p>
                        <input type="file" id="optSapInput" accept=".csv, .xlsx, .xls" style="display:none">
                        <button class="btn btn-primary" onclick="document.getElementById('optSapInput').click()">Browse</button>
                    </div>
                    <div style="margin-top:16px;padding:14px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border-primary)">
                        <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">💡 Skip and use synthetic inventory data:</p>
                        <button class="btn btn-ghost btn-sm" id="btnSkipInventory">Skip → Use Defaults</button>
                    </div>
                    <div id="inventoryDataPreview" class="data-preview-table mt-3" style="max-height:200px;overflow:auto;display:none;background:var(--bg-tertiary);border-radius:8px;padding:10px"></div>
                </div>

                <!-- Step 3: Constraints -->
                <div class="step-pane" id="optStep3" style="display:none">
                    <h2>Configure Solver Constraints</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px">Tune the MILP parameters below or use defaults.</p>
                    <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
                        <label style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-card);padding:14px 16px;border-radius:8px;border:1px solid var(--border-primary)">
                            <span style="font-size:0.85rem">Max Rake Capacity (MT)</span>
                            <input type="number" id="constRakeCap" value="3800" style="width:100px;background:var(--bg-tertiary);color:#fff;border:1px solid var(--border-primary);padding:6px 8px;border-radius:6px;text-align:right">
                        </label>
                        <label style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-card);padding:14px 16px;border-radius:8px;border:1px solid var(--border-primary)">
                            <span style="font-size:0.85rem">Demurrage Rate (USD/day)</span>
                            <input type="number" id="constDemurrage" value="25000" style="width:100px;background:var(--bg-tertiary);color:#fff;border:1px solid var(--border-primary);padding:6px 8px;border-radius:6px;text-align:right">
                        </label>
                        <label style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-card);padding:14px 16px;border-radius:8px;border:1px solid var(--border-primary)">
                            <span style="font-size:0.85rem">Enable ML Delay Constraints</span>
                            <input type="checkbox" id="constEnableML" checked style="width:20px;height:20px">
                        </label>
                    </div>
                    <button class="btn btn-primary" id="btnGoToSolve" style="margin-top:20px;width:100%">Next: Run Optimization →</button>
                </div>

                <!-- Step 4: Solve -->
                <div class="step-pane" id="optStep4" style="display:none">
                    <h2>Run MILP Optimization Engine</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px">Branch-and-Bound solver with ML-informed constraints.</p>
                    
                    <button class="btn btn-primary" id="btnSolve" style="width:100%;padding:15px;font-size:1rem;margin-bottom:20px">
                        ⚙️ Initialize jsLPSolver &amp; Optimize
                    </button>
                    
                    <div id="solveProgress" style="display:none;margin-bottom:20px">
                        <p id="solveStatusMsg" style="color:var(--text-muted);margin-bottom:8px">Preparing model...</p>
                        <div class="progress-bar" style="width:100%;background:#333;height:10px;border-radius:5px">
                            <div class="progress-fill" id="solveBarFill" style="width:0%;background:#10b981;height:100%;border-radius:5px;transition:width 0.1s"></div>
                        </div>
                    </div>

                    <div id="solveResults" style="display:none">
                        <!-- Summary Grid -->
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
                            <div class="card" style="text-align:center;padding:16px;border-left:4px solid #10b981">
                                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">Optimized Cost</div>
                                <div id="solveTotalCost" style="font-size:1.5rem;font-weight:700;color:#10b981">—</div>
                            </div>
                            <div class="card" style="text-align:center;padding:16px;border-left:4px solid #3b82f6">
                                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">Cost Saved vs Baseline</div>
                                <div id="solveSavings" style="font-size:1.5rem;font-weight:700;color:#3b82f6">—</div>
                            </div>
                            <div class="card" style="text-align:center;padding:16px;border-left:4px solid #8b5cf6">
                                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">Feasibility</div>
                                <div id="solveFeasible" style="font-size:1.2rem;font-weight:700;color:#10b981">OPTIMAL</div>
                            </div>
                        </div>

                        <!-- Cost Breakdown -->
                        <div class="card" style="background:var(--bg-tertiary);margin-bottom:16px;padding:16px">
                            <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:12px">Cost Breakdown</h4>
                            <div id="solveCostBreakdown"></div>
                        </div>

                        <!-- Vessel Schedule -->
                        <div class="card" style="background:var(--bg-tertiary);margin-bottom:16px;overflow:hidden">
                            <div style="padding:14px 16px;border-bottom:1px solid var(--border-primary)">
                                <h4 style="font-size:0.88rem;font-weight:600">Vessel Schedule</h4>
                            </div>
                            <div id="solveVesselSchedule" style="overflow:auto;max-height:220px"></div>
                        </div>

                        <!-- Rail Plan -->
                        <div class="card" style="background:var(--bg-tertiary);margin-bottom:16px;overflow:hidden">
                            <div style="padding:14px 16px;border-bottom:1px solid var(--border-primary)">
                                <h4 style="font-size:0.88rem;font-weight:600">Rail Plan</h4>
                            </div>
                            <div id="solveRailPlan" style="overflow:auto;max-height:220px"></div>
                        </div>

                        <button class="btn btn-primary" id="btnApplySolve" style="width:100%">✅ Apply Plan to Dashboard</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    bindOptStudioEvents();

    if (autoRun) {
        // Skip straight to Step 4 and trigger optimization
        setTimeout(() => {
            goToOptStep(4);
            const solveBtn = document.getElementById('btnSolve');
            if (solveBtn) solveBtn.click();
        }, 100);
    }
}

function bindOptStudioEvents() {
    // --- File handlers ---
    document.getElementById('optDemandRakeInput')?.addEventListener('change', async (e) => {
        await handleFileUpload(e.target.files[0], 'demand_rakes', 'optDemandStatus', 'demandDataPreview', 1);
    });

    document.getElementById('optSapInput')?.addEventListener('change', async (e) => {
        await handleFileUpload(e.target.files[0], 'inventory', 'optSapStatus', 'inventoryDataPreview', 2);
    });

    // --- Skip / Live Data fallbacks ---
    document.getElementById('btnUseLiveData')?.addEventListener('click', async () => {
        try {
            const [rRes, vRes, invRes] = await Promise.all([
                apiFetch('/api/data/demand_rakes'),
                apiFetch('/api/data/vessels'),
                apiFetch('/api/data/inventory')
            ]);
            const rakes = await rRes.json();
            const vessels = await vRes.json();
            const inv = await invRes.json();
            
            optRakes = rakes.data?.[0]?.data || [];
            optVessels = vessels.data?.[0]?.data || [];
            optInventory = inv.data?.[0]?.data || {};
            showNotification('Live app data loaded for optimization', 'success');
        } catch (e) {
            showNotification('Using synthetic fallback data', 'info');
            optVessels = null; optRakes = null; optInventory = null;
        }
        goToOptStep(2);
    });

    document.getElementById('btnSkipInventory')?.addEventListener('click', () => {
        showNotification('Using default synthetic inventory data', 'info');
        goToOptStep(3);
    });

    document.getElementById('btnGoToSolve')?.addEventListener('click', () => goToOptStep(4));

    // --- Solve Button ---
    document.getElementById('btnSolve')?.addEventListener('click', () => {
        document.getElementById('btnSolve').style.display = 'none';
        document.getElementById('solveProgress').style.display = 'block';
        runOptimization();
    });

    // --- Apply Button ---
    document.getElementById('btnApplySolve')?.addEventListener('click', async () => {
        if (!solverResult) return;
        
        const btn = document.getElementById('btnApplySolve');
        btn.textContent = '⏳ Saving & Updating Dashboard...';
        btn.disabled = true;

        // 1. Save to MongoDB
        await saveOptimizationResult(solverResult);
        
        // 2. Notify app to refresh dashboard summary (wait for it)
        await new Promise(resolve => {
            const handler = () => {
                window.removeEventListener('dashboardRefreshed', handler);
                resolve();
            };
            window.addEventListener('dashboardRefreshed', handler);
            window.dispatchEvent(new CustomEvent('optimizationSaved', { detail: solverResult }));
            // Timeout fallback in case event never fires
            setTimeout(resolve, 2000);
        });

        showNotification('✅ Optimization applied & Dashboard updated!', 'success');
        switchPanel('overview');
    });
}

async function handleFileUpload(file, type, statusId, previewId, step) {
    if (!file) return;
    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.textContent = `Uploading ${file.name}...`;

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        await apiUpload('/api/data/upload', formData);

        const parsed = await parseUploadedFile(file);
        if (statusEl) statusEl.textContent = `✅ ${parsed.data?.length || 0} records from ${file.name}`;
        showNotification(`Loaded ${parsed.data?.length || 0} records`, 'success');
        await fetchAndShowPreview(type, previewId);
        setTimeout(() => goToOptStep(step + 1), 1500);
    } catch (err) {
        console.error('[Optimizer] Upload error:', err);
        if (statusEl) statusEl.textContent = `❌ Upload failed: ${err.message}`;
    }
}

async function fetchAndShowPreview(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const res = await apiFetch(`/api/data/${type}`);
        const result = await res.json();
        const data = result.data?.[0]?.data || [];
        if (!data.length) return;

        container.style.display = 'block';
        const headers = Object.keys(data[0]);
        container.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:11px;color:#ddd">
                <tr style="background:var(--bg-card)">${headers.map(h => `<th style="padding:6px;border:1px solid var(--border-primary)">${h}</th>`).join('')}</tr>
                ${data.slice(0, 5).map(row => `<tr>${headers.map(h => `<td style="padding:6px;border:1px solid var(--border-primary)">${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}
            </table>
            <p style="font-size:10px;color:var(--text-muted);margin-top:6px">Showing 5 of ${data.length} records</p>
        `;
    } catch (e) {}
}

function goToOptStep(step) {
    document.querySelectorAll('#optimizerStudioContent .wizard-step').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.step) === step);
    });
    document.querySelectorAll('#optimizerStudioContent .step-pane').forEach((el, idx) => {
        const isActive = idx + 1 === step;
        el.classList.toggle('active', isActive);
        el.style.display = isActive ? 'block' : 'none';
    });
}

async function runOptimization() {
    const enableML = document.getElementById('constEnableML')?.checked ?? true;
    const demurrageRate = parseFloat(document.getElementById('constDemurrage')?.value || 25000);

    const solveMessages = [
        'Loading vessel data...',
        'Building LP model variables...',
        'Applying port berth constraints...',
        `${enableML ? 'Applying ML delay predictions...' : 'Applying static constraints...'}`,
        'Running Branch-and-Bound solver...',
        'Evaluating rail allocation plan...',
        'Computing cost breakdown...',
        'Finalizing optimal plan...',
    ];

    const fill = document.getElementById('solveBarFill');
    const statusMsg = document.getElementById('solveStatusMsg');
    let width = 0;
    let msgIdx = 0;

    await new Promise((resolve) => {
        const interval = setInterval(() => {
            width += 13;
            if (fill) fill.style.width = Math.min(width, 95) + '%';
            const newIdx = Math.floor(width / 13);
            if (newIdx !== msgIdx && newIdx < solveMessages.length) {
                msgIdx = newIdx;
                if (statusMsg) statusMsg.textContent = solveMessages[msgIdx];
            }
            if (width >= 100) {
                clearInterval(interval);
                resolve();
            }
        }, 120);
    });

    // Import generateAllData for fallback
    const { generateAllData } = await import('../data/synthetic-data.js');

    // Fetch real data if not already loaded
    if (!optVessels || !optRakes) {
        try {
            const [rRes, vRes] = await Promise.all([
                apiFetch('/api/data/demand_rakes'),
                apiFetch('/api/data/vessels')
            ]);
            const rakes = await rRes.json();
            const vessels = await vRes.json();
            optVessels = vessels.data?.[0]?.data;
            optRakes = rakes.data?.[0]?.data;
        } catch (e) {}
    }

    // Fallback to synthetic if empty
    if (!optVessels?.length || !optRakes?.length) {
        const synth = generateAllData();
        optVessels = synth.vessels;
        optRakes = synth.rakes;
        optInventory = synth.inventory;
    }

    if (!optInventory || Object.keys(optInventory).length === 0) {
        const synth = generateAllData();
        optInventory = synth.inventory;
    }

    // Normalize vessels to ensure Date objects
    const vessels = optVessels.map(v => ({
        ...v,
        actualETA: new Date(v.actualETA || v.scheduledETA || Date.now()),
        scheduledETA: new Date(v.scheduledETA || Date.now())
    }));
    const rakes = optRakes.map(r => ({
        ...r,
        departure: new Date(r.departure || Date.now()),
        arrival: new Date(r.arrival || Date.now())
    }));

    // Run MILP Optimizer
    const dynamicConstraints = enableML ? {
        delayPenaltyMultiplier: 1.2,
        portCapacityFactor: 0.9
    } : {};

    solverResult = optimizeLogistics(vessels, rakes, optInventory, dynamicConstraints);

    if (fill) fill.style.width = '100%';
    if (statusMsg) statusMsg.textContent = 'Optimization complete!';

    setTimeout(() => displayResults(solverResult), 300);
}

function displayResults(result) {
    document.getElementById('solveProgress').style.display = 'none';
    document.getElementById('solveResults').style.display = 'block';

    document.getElementById('solveTotalCost').textContent = formatINR(result.totalCost, true);

    const savings = result.savings?.totalSaved || 0;
    document.getElementById('solveSavings').textContent = savings > 0 ? formatINR(savings, true) : '₹0';
    document.getElementById('solveFeasible').textContent = result.feasible ? 'OPTIMAL' : 'FEASIBLE';
    document.getElementById('solveFeasible').style.color = result.feasible ? '#10b981' : '#f59e0b';

    // Cost Breakdown
    const breakdownEl = document.getElementById('solveCostBreakdown');
    if (breakdownEl && result.costBreakdown) {
        const cb = result.costBreakdown;
        breakdownEl.innerHTML = Object.entries(cb).map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-primary);font-size:0.82rem">
                <span style="color:var(--text-secondary);text-transform:capitalize">${k.replace(/([A-Z])/g, ' $1')}</span>
                <span style="font-weight:600">${formatINR(v, true)}</span>
            </div>
        `).join('');
    }

    // Vessel Schedule
    const vesselEl = document.getElementById('solveVesselSchedule');
    if (vesselEl && result.vesselSchedule?.length) {
        vesselEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
                <thead><tr style="background:var(--bg-card)">
                    <th style="padding:10px;text-align:left">Vessel</th>
                    <th style="padding:10px;text-align:left">Port</th>
                    <th style="padding:10px;text-align:left">Material</th>
                    <th style="padding:10px;text-align:right">Quantity</th>
                    <th style="padding:10px;text-align:right">Demurrage</th>
                    <th style="padding:10px;text-align:center">Status</th>
                </tr></thead>
                <tbody>
                    ${result.vesselSchedule.map(v => `
                        <tr style="border-bottom:1px solid var(--border-primary)">
                            <td style="padding:10px">${v.vessel}</td>
                            <td style="padding:10px;color:var(--text-muted)">${v.port}</td>
                            <td style="padding:10px;color:var(--text-muted)">${v.material || '—'}</td>
                            <td style="padding:10px;text-align:right">${(v.quantity || 0).toLocaleString()} MT</td>
                            <td style="padding:10px;text-align:right;color:${v.demurrage > 0 ? '#ef4444' : '#10b981'}">
                                ${v.demurrage > 0 ? formatINR(v.demurrage, true) : '—'}
                            </td>
                            <td style="padding:10px;text-align:center">
                                <span style="background:${v.assigned ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};color:${v.assigned ? '#10b981' : '#ef4444'};padding:3px 8px;border-radius:12px;font-size:0.68rem;font-weight:700">
                                    ${v.assigned ? 'BERTH ASSIGNED' : 'QUEUED'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Rail Plan
    const railEl = document.getElementById('solveRailPlan');
    if (railEl && result.railPlan?.length) {
        railEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
                <thead><tr style="background:var(--bg-card)">
                    <th style="padding:10px;text-align:left">Rake ID</th>
                    <th style="padding:10px;text-align:left">Route</th>
                    <th style="padding:10px;text-align:right">Quantity</th>
                    <th style="padding:10px;text-align:right">Cost</th>
                    <th style="padding:10px;text-align:center">Status</th>
                </tr></thead>
                <tbody>
                    ${result.railPlan.map(r => `
                        <tr style="border-bottom:1px solid var(--border-primary)">
                            <td style="padding:10px;font-weight:500">${r.rakeNumber || r.rakeId}</td>
                            <td style="padding:10px;color:var(--text-muted)">${r.from || '?'} → ${r.to || '?'}</td>
                            <td style="padding:10px;text-align:right">${(r.quantity || 0).toLocaleString()} MT</td>
                            <td style="padding:10px;text-align:right">${formatINR(r.cost || 0, true)}</td>
                            <td style="padding:10px;text-align:center">
                                <span style="background:${r.used ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)'};color:${r.used ? '#10b981' : '#64748b'};padding:3px 8px;border-radius:12px;font-size:0.68rem;font-weight:700">
                                    ${r.used ? 'ACTIVE' : 'STANDBY'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    showNotification('✅ MILP Optimization complete!', 'success');
}

async function saveOptimizationResult(result) {
    try {
        const payload = {
            totalCost: result.totalCost,
            costBreakdown: result.costBreakdown,
            vesselSchedule: result.vesselSchedule,
            railPlan: result.railPlan,
            savings: result.savings,
            meta: { source: 'optimizer_studio', timestamp: new Date().toISOString() }
        };

        // Validate before sending
        if (typeof payload.totalCost !== 'number' || isNaN(payload.totalCost)) {
            console.error('[Optimizer Studio] Cannot save: totalCost is invalid', payload.totalCost);
            return;
        }

        // ► Fixed: server mounts at /api/optimizations (plural)
        const res = await apiFetch('/api/optimizations', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res && res.ok) {
            const saved = await res.json();
            console.log('[Optimizer Studio] Result persisted to DB ✔', saved.optimization?._id);
        } else {
            const err = await res?.json();
            console.error('[Optimizer Studio] Save failed:', err);
        }
    } catch (e) {
        console.error('[Optimizer Studio] Failed to persist result', e);
    }
}
