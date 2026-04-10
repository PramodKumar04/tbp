// ============================================================
// SteelSync-Opt — Data Input Panel (SC Navigator)
// ============================================================

import { parseUploadedFile, generateTemplate } from '../utils/excel-parser.js';
import { NetworkWhiteboard } from './whiteboard.js';
import { apiUpload } from '../utils/api.js';

let whiteboard = null;
let currentView = 'input'; // 'input' | 'whiteboard' | 'preview'
let uploadedData = null;

/**
 * Render the data input panel
 */
export function renderDataInput(container, onDataApply) {
    if (currentView === 'whiteboard') {
        renderWhiteboardView(container, onDataApply);
        return;
    }
    if (currentView === 'preview') {
        renderPreviewView(container, onDataApply);
        return;
    }

    container.innerHTML = `
        <div class="data-input-wrapper animate-fade-in">
            <div class="di-header">
                <div>
                    <h2 class="di-title">SC Navigator Input</h2>
                    <p class="di-subtitle">Load your supply chain network data to begin optimization.</p>
                </div>
            </div>

            <div class="di-options">
                <!-- Upload Excel Card -->
                <div class="di-option-card" id="uploadCard">
                    <div class="di-option-icon upload-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                    </div>
                    <h3 class="di-option-title">Upload Excel File</h3>
                    <p class="di-option-desc">Drag & drop or click to browse templates</p>
                    <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display:none">
                </div>

                <!-- Whiteboard Card -->
                <div class="di-option-card" id="whiteboardCard">
                    <div class="di-option-icon whiteboard-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                    </div>
                    <h3 class="di-option-title">Open Whiteboard</h3>
                    <p class="di-option-desc">Visually design your network nodes and flows</p>
                </div>
            </div>

            <!-- Upload Drop Zone (appears when hovering with file) -->
            <div class="di-dropzone" id="dropZone" style="display:none">
                <div class="di-dropzone-inner">
                    <span style="font-size:3rem">📄</span>
                    <p style="font-size:1rem;font-weight:600;margin-top:8px">Drop your file here</p>
                    <p style="font-size:0.78rem;color:var(--text-muted)">Supports .csv, .xlsx, .xls</p>
                </div>
            </div>

            <!-- Upload Progress -->
            <div class="di-upload-status" id="uploadStatus" style="display:none">
                <div class="di-upload-progress">
                    <div class="di-upload-progress-bar" id="uploadProgressBar"></div>
                </div>
                <p id="uploadStatusText" style="font-size:0.82rem;color:var(--text-secondary);margin-top:8px"></p>
            </div>

            <!-- Template Download -->
            <div class="di-template-row">
                <span style="font-size:0.82rem;color:var(--text-muted)">Need a template?</span>
                <button class="di-template-btn" id="downloadTemplateBtn">Download Standard Template</button>
            </div>

            <!-- Recent Data Info -->
            ${uploadedData ? `
                <div class="di-recent" style="margin-top:16px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                        <span style="font-size:0.82rem;font-weight:600;color:var(--accent-success)">✓ Data loaded</span>
                        <span style="font-size:0.72rem;color:var(--text-muted)">${uploadedData.type} — ${Array.isArray(uploadedData.data) ? uploadedData.data.length + ' records' : 'structured data'}</span>
                    </div>
                    <button class="btn btn-primary btn-sm" id="useLoadedDataBtn">Use This Data for Optimization</button>
                </div>
            ` : ''}
        </div>
    `;

    // ── Bind Events ─────────────────────────────────────
    const fileInput = container.querySelector('#fileInput');
    const uploadCard = container.querySelector('#uploadCard');
    const whiteboardCard = container.querySelector('#whiteboardCard');
    const dropZone = container.querySelector('#dropZone');

    // Upload click
    uploadCard?.addEventListener('click', () => fileInput?.click());

    // File selected
    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0], container, onDataApply);
        }
    });

    // Whiteboard click
    whiteboardCard?.addEventListener('click', () => {
        currentView = 'whiteboard';
        renderDataInput(container, onDataApply);
    });

    // Drag & drop
    const wrapper = container.querySelector('.data-input-wrapper');
    if (wrapper) {
        wrapper.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (dropZone) dropZone.style.display = 'flex';
        });
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        wrapper.addEventListener('dragleave', (e) => {
            if (!wrapper.contains(e.relatedTarget)) {
                if (dropZone) dropZone.style.display = 'none';
            }
        });
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropZone) dropZone.style.display = 'none';
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0], container, onDataApply);
            }
        });
    }

    // Template download
    container.querySelector('#downloadTemplateBtn')?.addEventListener('click', () => {
        generateTemplate('full');
    });

    // Use loaded data
    container.querySelector('#useLoadedDataBtn')?.addEventListener('click', () => {
        if (onDataApply && uploadedData) onDataApply(uploadedData);
    });
}

/**
 * Handle file upload
 */
async function handleFileUpload(file, container, onDataApply) {
    const statusEl = container.querySelector('#uploadStatus');
    const progressBar = container.querySelector('#uploadProgressBar');
    const statusText = container.querySelector('#uploadStatusText');

    if (statusEl) statusEl.style.display = 'block';
    if (progressBar) progressBar.style.width = '30%';
    if (statusText) statusText.textContent = `Reading ${file.name}...`;

    try {
        // Simulate progress
        await new Promise(r => setTimeout(r, 400));
        if (progressBar) progressBar.style.width = '60%';
        if (statusText) statusText.textContent = 'Parsing data...';

        const parsed = await parseUploadedFile(file);
        const backendTypeMap = {
            rakes: 'demand_rakes',
        };
        const backendType = backendTypeMap[parsed.type] || parsed.type;

        // Upload to backend
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', backendType);

        const uploadRes = await apiUpload('/api/data/upload', formData);
        if (!uploadRes || !uploadRes.ok) {
            let errorMessage = 'Upload rejected by server';
            try {
                const err = await uploadRes?.json();
                errorMessage = err?.error || errorMessage;
            } catch {}
            throw new Error(errorMessage);
        }

        await new Promise(r => setTimeout(r, 300));
        if (progressBar) progressBar.style.width = '100%';
        if (statusText) statusText.textContent = `✓ Successfully parsed ${Array.isArray(parsed.data) ? parsed.data.length : Object.keys(parsed.data).length} records (${backendType})`;

        uploadedData = { ...parsed, type: backendType, sourceType: parsed.type };

        // Show preview
        await new Promise(r => setTimeout(r, 500));
        currentView = 'preview';
        renderDataInput(container, onDataApply);

    } catch (err) {
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.background = 'var(--accent-danger)';
        }
        if (statusText) statusText.textContent = `✕ Error: ${err.message}`;
    }
}

/**
 * Render whiteboard view
 */
function renderWhiteboardView(container, onDataApply) {
    container.innerHTML = '<div id="whiteboardContainer" style="height:100%;min-height:700px"></div>';

    whiteboard = new NetworkWhiteboard('whiteboardContainer');
    whiteboard.init(container.querySelector('#whiteboardContainer'));

    whiteboard.onClose = () => {
        currentView = 'input';
        renderDataInput(container, onDataApply);
    };

    whiteboard.onDataChange = (networkData) => {
        // Convert whiteboard data to app format
        const converted = convertWhiteboardData(networkData);
        uploadedData = converted;
        currentView = 'preview';
        renderDataInput(container, onDataApply);
    };
}

/**
 * Convert whiteboard network data to app data
 */
function convertWhiteboardData(network) {
    const routes = network.edges.map(edge => ({
        mode: edge.mode || 'Rail',
        from: edge.from,
        fromType: edge.fromType,
        to: edge.to,
        toType: edge.toType,
        material: edge.material,
        capacity: edge.maxCapacity || 3800,
        minCapacity: edge.minCapacity || 0,
        maxCapacity: edge.maxCapacity || 3800,
        costPerDistance: edge.costPerDistance || 0,
        costPerUOM: edge.costPerUOM || 0,
        cost: edge.costPerDistance || 1.8,
        available: edge.available !== false,
        period: edge.period || new Date().getFullYear(),
    }));

    return {
        type: 'routes',
        data: routes,
        nodes: network.nodes,
        source: 'whiteboard',
    };
}

/**
 * Render preview of uploaded/designed data
 */
function renderPreviewView(container, onDataApply) {
    if (!uploadedData) {
        currentView = 'input';
        renderDataInput(container, onDataApply);
        return;
    }

    const records = Array.isArray(uploadedData.data) ? uploadedData.data : [];

    container.innerHTML = `
        <div class="data-input-wrapper animate-fade-in">
            <div class="di-header">
                <div>
                    <h2 class="di-title">Data Preview</h2>
                    <p class="di-subtitle">Review your data before applying to optimization</p>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-ghost btn-sm" id="backToInputBtn">← Back</button>
                    <button class="btn btn-primary" id="applyDataBtn">✨ Apply & Optimize</button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
                <div class="di-summary-card">
                    <div class="di-summary-value">${uploadedData.type}</div>
                    <div class="di-summary-label">Data Type</div>
                </div>
                <div class="di-summary-card">
                    <div class="di-summary-value">${records.length || '—'}</div>
                    <div class="di-summary-label">Records</div>
                </div>
                <div class="di-summary-card">
                    <div class="di-summary-value">${uploadedData.source === 'whiteboard' ? 'Whiteboard' : 'CSV Upload'}</div>
                    <div class="di-summary-label">Source</div>
                </div>
                ${uploadedData.nodes ? `
                    <div class="di-summary-card">
                        <div class="di-summary-value">${uploadedData.nodes.length}</div>
                        <div class="di-summary-label">Nodes</div>
                    </div>
                ` : ''}
            </div>

            <!-- Data Table -->
            <div class="card" style="background:var(--bg-tertiary);overflow-x:auto">
                <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:12px">📋 Data Records</h4>
                ${records.length > 0 ? `
                    <table class="data-table">
                        <thead><tr>
                            ${Object.keys(records[0]).map(k => `<th>${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</th>`).join('')}
                        </tr></thead>
                        <tbody>
                            ${records.slice(0, 20).map(row => `
                                <tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>
                            `).join('')}
                            ${records.length > 20 ? `
                                <tr><td colspan="${Object.keys(records[0]).length}" style="text-align:center;color:var(--text-muted)">
                                    ...and ${records.length - 20} more records
                                </td></tr>
                            ` : ''}
                        </tbody>
                    </table>
                ` : '<p style="color:var(--text-muted);text-align:center;padding:20px">No tabular data to display</p>'}
            </div>

            ${uploadedData.nodes ? `
                <div class="card" style="background:var(--bg-tertiary);margin-top:16px">
                    <h4 style="font-size:0.88rem;font-weight:600;margin-bottom:12px">🗺️ Network Nodes</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:8px">
                        ${uploadedData.nodes.map(n => `
                            <div style="padding:8px 14px;border-radius:var(--radius-md);border:1px solid var(--border-primary);background:var(--bg-card);display:flex;align-items:center;gap:8px">
                                <span style="font-size:1.1rem">${getNodeIcon(n.type)}</span>
                                <div>
                                    <div style="font-size:0.82rem;font-weight:600">${n.label}</div>
                                    <div style="font-size:0.68rem;color:var(--text-muted)">${n.type}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Events
    container.querySelector('#backToInputBtn')?.addEventListener('click', () => {
        currentView = 'input';
        renderDataInput(container, onDataApply);
    });

    container.querySelector('#applyDataBtn')?.addEventListener('click', () => {
        if (onDataApply && uploadedData) {
            onDataApply(uploadedData);
            showNotification('Data applied! Running optimization...', 'success');
        }
    });
}

function getNodeIcon(type) {
    const icons = { port: '🚢', plant: '🏭', stockyard: '📦', supplier: '🌍' };
    return icons[type] || '📍';
}

function showNotification(msg, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification notification-${type}`;
    notif.textContent = msg;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3500);
}

/**
 * Reset data input state
 */
export function resetDataInput() {
    currentView = 'input';
    uploadedData = null;
    if (whiteboard) {
        whiteboard.destroy();
        whiteboard = null;
    }
}
