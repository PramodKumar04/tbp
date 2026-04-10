// ============================================================
// SteelSync-Opt — Inventory Management Panel
// ============================================================

import { formatTons, formatNumber, formatShortDate, getStatusClass, toCSV, downloadCSV, downloadExcel } from '../utils/formatters.js';
import { renderInventoryChart } from './charts.js';
import { PLANTS, MATERIALS } from '../data/constants.js';
import { apiFetch } from '../utils/api.js';
import { showNotification } from '../app.js';

/**
 * Render inventory panel
 */
export function renderInventoryPanel(container, inventory, inventoryProjection, bookedVessels = []) {
    let html = `
        <div class="card-header">
            <div>
                <h3 class="card-title">Plant Inventory Management</h3>
                <p class="card-subtitle">Real-time stock levels across all plants</p>
            </div>
            <div class="download-bar">
                <button class="btn btn-primary btn-sm" id="addInventoryRecordBtn" style="border-radius:20px; padding:6px 16px;">+ Add Record</button>
                <button class="btn btn-ghost btn-sm" id="downloadInventoryCSV">📥 CSV</button>
                <button class="btn btn-ghost btn-sm" id="downloadInventoryExcel">📊 Excel</button>
            </div>
        </div>
    `;

    for (const plant of PLANTS) {
        const plantInv = inventory[plant.id];
        if (!plantInv) continue;

        let alertCount = 0;
        for (const matId in plantInv) {
            if (plantInv[matId].status !== 'healthy') alertCount++;
        }

        html += `
            <div class="card" style="margin-bottom:16px;background:var(--bg-tertiary)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                    <div>
                        <h4 style="font-size:0.95rem;font-weight:600">${plant.name}</h4>
                        <span style="font-size:0.72rem;color:var(--text-muted)">${plant.operator} • ${plant.state}</span>
                    </div>
                    ${alertCount > 0 ? `
                        <span class="status-badge status-warning">⚠ ${alertCount} alert${alertCount > 1 ? 's' : ''}</span>
                    ` : '<span class="status-badge status-success">✓ Healthy</span>'}
                </div>

                ${Object.entries(plantInv).map(([matId, inv]) => {
                    const mat = MATERIALS.find(m => m.id === matId);
                    const pct = Math.min(100, (inv.currentLevel / (inv.safetyStock * 1.8)) * 100);
                    
                    return `
                    <div class="inventory-item-card">
                        <div class="item-header">
                            <span class="item-name">${mat?.name || matId}</span>
                            <span class="item-qty">${formatTons(inv.currentLevel)}</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill-green" style="width:${pct}%"></div>
                        </div>
                        <div class="item-footer">
                            <span>Safety: ${formatTons(inv.safetyStock)}</span>
                            <span>Daily: ${formatTons(inv.dailyConsumption)}/day</span>
                        </div>
                        <div style="display:flex; justify-content: flex-end; margin-top:10px;">
                            <button class="edit-btn">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                Edit
                            </button>
                        </div>
                    </div>`;
                }).join('')}

                <!-- Booked vessels for this plant (from VesselPlan) -->
                ${renderBookedVesselsForPlant(bookedVessels, plant)}

                <div class="inventory-projection-container" style="margin-top:20px; padding-top:15px; border-top:1px solid var(--border-color)">
                    <h5 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px">
                        30-Day Inventory Projection
                    </h5>
                    <div style="height:140px">
                        <canvas id="inventoryChart-${plant.id}"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Render charts after adding to DOM
    if (inventoryProjection) {
        setTimeout(() => {
            for (const plant of PLANTS) {
                const canvasId = `inventoryChart-${plant.id}`;
                if (document.getElementById(canvasId)) {
                    renderInventoryChart(canvasId, inventoryProjection, plant.id);
                }
            }
        }, 100);
    }

    // Export handlers
    document.getElementById('downloadInventoryCSV')?.addEventListener('click', () => exportInventoryData(inventory, 'csv'));
    document.getElementById('downloadInventoryExcel')?.addEventListener('click', () => exportInventoryData(inventory, 'excel'));

    // Modal handler
    document.getElementById('addInventoryRecordBtn')?.addEventListener('click', () => {
        renderAddRecordModal();
    });
}

/**
 * Render Add Inventory Record Modal (matching image)
 */
function renderAddRecordModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-fade-in';
    overlay.id = 'inventoryModalOverlay';
    
    overlay.innerHTML = `
        <div class="inventory-modal">
            <h3>Add Inventory Record</h3>
            
            <div class="modal-grid">
                <div class="modal-field">
                    <label>Plant</label>
                    <select class="modal-select" id="modalPlant">
                        ${PLANTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-field">
                    <label>Material</label>
                    <select class="modal-select" id="modalMaterial">
                        ${MATERIALS.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="modal-field">
                <label>Current Level (MT)</label>
                <input type="number" class="modal-input" id="modalLevel" value="45382">
            </div>

            <div class="modal-field">
                <label>Safety Stock (MT)</label>
                <input type="number" class="modal-input" id="modalSafety" value="333">
            </div>

            <div class="modal-field">
                <label>Daily Consumption (MT)</label>
                <input type="number" class="modal-input" id="modalDaily" value="383">
            </div>

            <div class="modal-actions">
                <button class="btn btn-ghost" id="closeInvModal">Cancel</button>
                <button class="btn btn-primary" id="saveInvRecord">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event Listeners
    document.getElementById('closeInvModal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };

    document.getElementById('saveInvRecord').onclick = async () => {
        const plant = document.getElementById('modalPlant').value;
        const material = document.getElementById('modalMaterial').value;
        const currentLevel = parseFloat(document.getElementById('modalLevel').value);
        const safetyStock = parseFloat(document.getElementById('modalSafety').value);
        const dailyConsumption = parseFloat(document.getElementById('modalDaily').value);

        try {
            const res = await apiFetch('/api/inventory', {
                method: 'POST',
                body: JSON.stringify({
                    plant,
                    material,
                    currentLevel,
                    safetyStock,
                    dailyConsumption
                })
            });

            if (res.ok) {
                showNotification('Inventory record saved successfully!', 'success');
                overlay.remove();
                
                // Trigger refresh via global event
                window.dispatchEvent(new CustomEvent('inventoryUpdated', { 
                    detail: { plant, material, currentLevel } 
                }));
            }
        } catch (err) {
            showNotification('Failed to save record', 'error');
            console.error(err);
        }
    };
}

function exportInventoryData(inventory, format) {
    const rows = [];
    for (const plant of PLANTS) {
        for (const mat of MATERIALS) {
            const inv = inventory[plant.id]?.[mat.id];
            if (!inv) continue;
            rows.push({
                plant: plant.name,
                material: mat.name,
                currentLevel: inv.currentLevel,
                safetyStock: inv.safetyStock,
                dailyConsumption: inv.dailyConsumption,
                daysOfSupply: inv.daysOfSupply,
                status: inv.status,
            });
        }
    }

    const columns = [
        { key: 'plant', label: 'Plant' },
        { key: 'material', label: 'Material' },
        { key: 'currentLevel', label: 'Current Level (MT)' },
        { key: 'safetyStock', label: 'Safety Stock (MT)' },
        { key: 'dailyConsumption', label: 'Daily Consumption (MT)' },
        { key: 'daysOfSupply', label: 'Days of Supply' },
        { key: 'status', label: 'Status' },
    ];

    const csv = toCSV(rows, columns);
    if (format === 'csv') downloadCSV(csv, 'inventory_report.csv');
    else downloadExcel(csv, 'inventory_report.xls');
}

function renderBookedVesselsForPlant(bookedVessels, plant) {
    if (!bookedVessels || bookedVessels.length === 0) return '';

    // Group booked vessels by plant id heuristically
    const matches = [];
    for (const bv of bookedVessels) {
        // Attempt several fields that may contain plant id
        const candidateKeys = [bv.plantId, bv.toPlant, bv.planRoute && bv.planRoute.to, bv.route && bv.route.to, bv.portId, bv.destinationPort, bv.destinationPortName, bv.planRoute && bv.planRoute.plantId, bv.plant];
        const found = candidateKeys.find(k => k !== undefined && k !== null && String(k) !== '');
        if (!found) continue;

        // Normalize
        const key = String(found).toLowerCase();
        if (key === String(plant.id).toLowerCase() || String(plant.name).toLowerCase().includes(key) || key.includes(String(plant.name).toLowerCase())) {
            matches.push(bv);
        }
    }

    if (matches.length === 0) return '';

    // Build HTML list
    const itemsHtml = matches.map(m => {
        const vesselName = m.name || m.vesselName || m.vessel || m.vesselId || 'Vessel';
        const qty = (m.quantity || m.qty || (m.cargo && m.cargo.quantity) || 0);
        const mat = m.materialName || (m.cargo && m.cargo.material) || '';
        return `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.85rem">
                    <div style="color:var(--text-secondary)">${vesselName}${mat ? ' • ' + mat : ''}</div>
                    <div style="font-weight:600">${formatTons(qty)}</div>
                </div>`;
    }).join('');

    const totalQty = matches.reduce((s, m) => s + (m.quantity || m.qty || (m.cargo && m.cargo.quantity) || 0), 0);

    return `
        <div style="margin-top:12px;border-top:1px dashed var(--border-color);padding-top:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="font-size:0.82rem;font-weight:600;color:var(--text-muted)">Booked Vessels</div>
                <div style="font-size:0.82rem;color:var(--text-muted)">${formatTons(totalQty)} booked</div>
            </div>
            ${itemsHtml}
        </div>
    `;
}
