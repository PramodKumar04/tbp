// ============================================================
// SteelSync-Opt — Vessel Tracker Panel
// ============================================================

import { formatDate, formatDateTime, formatTons, formatINR, formatDuration, getStatusClass, getStatusText, toCSV, downloadCSV, downloadExcel } from '../utils/formatters.js';

/**
 * Render vessel tracker panel
 */
export function renderVesselTracker(container, vessels, predictions) {
    const delayed = vessels.filter(v => v.status === 'delayed').length;
    const inTransit = vessels.filter(v => v.status === 'in-transit').length;

    container.innerHTML = `
        <div class="card-header">
            <div>
                <h3 class="card-title">Vessel Tracker</h3>
                <p class="card-subtitle">${vessels.length} vessels • ${delayed} delayed • ${inTransit} in transit</p>
            </div>
            <div class="download-bar">
                <button class="btn btn-ghost btn-sm" id="downloadVesselsCSV">📥 CSV</button>
                <button class="btn btn-ghost btn-sm" id="downloadVesselsExcel">📊 Excel</button>
            </div>
        </div>

        <div style="overflow-x: auto;">
            <table class="data-table" id="vesselTable">
                <thead>
                    <tr>
                        <th>Vessel</th>
                        <th>Origin</th>
                        <th>Port</th>
                        <th>Material</th>
                        <th>Quantity</th>
                        <th>Scheduled ETA</th>
                        <th>Predicted Delay</th>
                        <th>Status</th>
                        <th>Berth</th>
                    </tr>
                </thead>
                <tbody>
                    ${vessels.map((v, i) => {
                        const pred = predictions[i];
                        const delayClass = v.delayHours > 24 ? 'style="color: var(--accent-danger)"' :
                            v.delayHours > 6 ? 'style="color: var(--accent-warning)"' :
                            'style="color: var(--accent-success)"';
                        return `
                        <tr>
                            <td>
                                <div style="display:flex;align-items:center;gap:10px">
                                    <span style="font-size:1.2rem">🚢</span>
                                    <div>
                                        <div style="font-weight:600;color:var(--text-primary)">${v.name}</div>
                                        <div style="font-size:0.68rem;color:var(--text-muted)">Age: ${v.vesselAge}y</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div>${v.origin}</div>
                                <div style="font-size:0.68rem;color:var(--text-muted)">${v.originCountry}</div>
                            </td>
                            <td>${v.destinationPortName}</td>
                            <td>
                                <span style="display:inline-flex;align-items:center;gap:4px">
                                    <span style="width:8px;height:8px;border-radius:50%;background:${getMaterialColor(v.material)}"></span>
                                    ${v.materialName}
                                </span>
                            </td>
                            <td class="mono">${formatTons(v.quantity)}</td>
                            <td class="mono" style="font-size:0.78rem">${formatDateTime(v.scheduledETA)}</td>
                            <td>
                                <span class="mono" ${delayClass}>
                                    ${v.delayHours > 0 ? '+' : ''}${formatDuration(Math.abs(v.delayHours))}
                                </span>
                                ${pred ? `
                                    <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">
                                        AI: ${pred.predictedDelay > 0 ? '+' : ''}${pred.predictedDelay}h
                                        (${Math.round(pred.confidence * 100)}% conf.)
                                    </div>
                                ` : ''}
                            </td>
                            <td><span class="status-badge ${getStatusClass(v.status)}">${getStatusText(v.status)}</span></td>
                            <td class="mono">${v.berthAssigned ? `B-${v.berthAssigned}` : '—'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>

        ${delayed > 0 ? `
            <div style="margin-top:16px;padding:12px 16px;border-radius:var(--radius-md);background:rgba(var(--accent-warning-rgb),0.06);border:1px solid rgba(var(--accent-warning-rgb),0.15)">
                <div style="font-size:0.82rem;font-weight:600;color:var(--accent-warning);margin-bottom:4px">
                    ⚠️ ${delayed} vessel(s) experiencing delays
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted)">
                    ${vessels.filter(v => v.status === 'delayed').map(v =>
                        `${v.name}: +${formatDuration(v.delayHours)} delay at ${v.destinationPortName}`
                    ).join(' • ')}
                </div>
            </div>
        ` : ''}
    `;

    // Download handlers
    document.getElementById('downloadVesselsCSV')?.addEventListener('click', () => exportVesselData(vessels, predictions, 'csv'));
    document.getElementById('downloadVesselsExcel')?.addEventListener('click', () => exportVesselData(vessels, predictions, 'excel'));
}

function getMaterialColor(materialId) {
    const colors = { coal: '#374151', iron_ore: '#dc2626', limestone: '#d4d4d8', dolomite: '#a78bfa' };
    return colors[materialId] || '#6b7280';
}

function exportVesselData(vessels, predictions, format) {
    const columns = [
        { key: 'name', label: 'Vessel Name' },
        { key: 'origin', label: 'Origin' },
        { key: 'originCountry', label: 'Country' },
        { key: 'destinationPortName', label: 'Destination Port' },
        { key: 'materialName', label: 'Material' },
        { key: 'quantity', label: 'Quantity (MT)' },
        { key: 'scheduledETA', label: 'Scheduled ETA', format: (v) => formatDateTime(v) },
        { key: 'delayHours', label: 'Delay (hrs)' },
        { key: 'status', label: 'Status' },
        { key: 'berthAssigned', label: 'Berth' },
        { key: 'freightCost', label: 'Freight Cost (₹)' },
    ];

    const csv = toCSV(vessels, columns);
    if (format === 'csv') downloadCSV(csv, 'vessels_report.csv');
    else downloadExcel(csv, 'vessels_report.xls');
}
