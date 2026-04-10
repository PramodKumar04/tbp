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
    const booked = vessels.filter(v => v.planned).length;

    container.innerHTML = `
        <div class="card-header">
            <div>
                <h3 class="card-title">Vessel Tracker</h3>
                <p class="card-subtitle">${vessels.length} vessels • ${booked > 0 ? `<span style="color:var(--accent-success);font-weight:700">${booked} booked</span> • ` : ''}${delayed} delayed • ${inTransit} in transit</p>
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
                        const delayHours = Number(v.delayHours) || 0;
                        const delayClass = delayHours > 24 ? 'style="color: var(--accent-danger)"' :
                            delayHours > 6 ? 'style="color: var(--accent-warning)"' :
                            'style="color: var(--accent-success)"';
                        const isBooked = !!v.planned;
                        const eta = v.scheduledETA ? new Date(v.scheduledETA) : null;
                        const etaStr = eta ? formatDateTime(eta) : '—';
                        return `
                        <tr style="${isBooked ? 'background:#f0fdf4;border-left:3px solid var(--accent-success)' : ''}">
                            <td>
                                <div style="display:flex;align-items:center;gap:10px">
                                    <span style="font-size:1.2rem;color:var(--text-secondary)">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>
                                    </span>
                                    <div>
                                        <div style="font-weight:600;color:var(--text-primary)">${v.name || 'Unknown Vessel'}</div>
                                        <div style="font-size:0.68rem;color:var(--text-muted)">Age: ${v.vesselAge || '—'}y${isBooked ? ' &nbsp;<span style="background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:8px;font-size:0.6rem;font-weight:700">BOOKED</span>' : ''}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div>${v.origin || '—'}</div>
                                <div style="font-size:0.68rem;color:var(--text-muted)">${v.originCountry || ''}</div>
                            </td>
                            <td>${v.destinationPortName || v.destinationPort || '—'}</td>
                            <td>
                                <span style="display:inline-flex;align-items:center;gap:4px">
                                    <span style="width:8px;height:8px;border-radius:50%;background:${getMaterialColor(v.material)}"></span>
                                    ${v.materialName || v.material || '—'}
                                </span>
                            </td>
                            <td class="mono">${v.quantity ? formatTons(v.quantity) : '—'}</td>
                            <td class="mono" style="font-size:0.78rem">${etaStr}</td>
                            <td>
                                <span class="mono" ${delayClass}>
                                    ${delayHours > 0 ? '+' : ''}${formatDuration(Math.abs(delayHours))}
                                </span>
                                ${pred ? `
                                    <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">
                                        AI: ${(pred.predictedDelay || 0) > 0 ? '+' : ''}${pred.predictedDelay || 0}h
                                        (${Math.round((pred.confidence || 0) * 100)}% conf.)
                                    </div>
                                ` : ''}
                            </td>
                            <td><span class="status-badge ${getStatusClass(v.status || 'berthed')}">${getStatusText(v.status || 'berthed')}</span></td>
                            <td class="mono">${v.berthAssigned ? `B-${v.berthAssigned}` : '—'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>

        ${delayed > 0 ? `
            <div style="margin-top:16px;padding:12px 16px;border-radius:var(--radius-md);background:#fffbeb;border:1px solid #fde68a">
                <div style="font-size:0.82rem;font-weight:600;color:#b45309;margin-bottom:4px">
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
