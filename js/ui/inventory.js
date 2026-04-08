// ============================================================
// SteelSync-Opt — Inventory Management Panel
// ============================================================

import { formatTons, formatNumber, formatShortDate, getStatusClass, toCSV, downloadCSV, downloadExcel } from '../utils/formatters.js';
import { PLANTS, MATERIALS } from '../data/constants.js';

/**
 * Render inventory panel
 */
export function renderInventoryPanel(container, inventory, inventoryProjection) {
    let html = `
        <div class="card-header">
            <div>
                <h3 class="card-title">Plant Inventory Management</h3>
                <p class="card-subtitle">Real-time stock levels across all plants</p>
            </div>
            <div class="download-bar">
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
                    const fillClass = inv.status === 'critical' ? 'fill-danger' :
                        inv.status === 'warning' ? 'fill-warning' : 'fill-success';

                    return `
                    <div class="inventory-item">
                        <span class="inventory-material-dot" style="background:${mat?.color || '#6b7280'}"></span>
                        <div class="inventory-details">
                            <div class="inventory-header">
                                <span class="inventory-material-name">${mat?.name || matId}</span>
                                <span class="inventory-level">${formatTons(inv.currentLevel)}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-bar-fill ${fillClass}" style="width:${pct}%"></div>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-top:4px">
                                <span style="font-size:0.68rem;color:var(--text-muted)">
                                    Safety: ${formatTons(inv.safetyStock)}
                                </span>
                                <span style="font-size:0.68rem;color:var(--text-muted)">
                                    ${inv.daysOfSupply} days supply
                                </span>
                                <span style="font-size:0.68rem;color:var(--text-muted)">
                                    Daily: ${formatTons(inv.dailyConsumption)}/day
                                </span>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }

    container.innerHTML = html;

    // Export handlers
    document.getElementById('downloadInventoryCSV')?.addEventListener('click', () => exportInventoryData(inventory, 'csv'));
    document.getElementById('downloadInventoryExcel')?.addEventListener('click', () => exportInventoryData(inventory, 'excel'));
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
