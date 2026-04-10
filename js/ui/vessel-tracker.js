// ============================================================
// SteelSync-Opt - Strategic Tracker Panel
// ============================================================

import { formatDateTime, formatTons, formatDuration, getStatusClass, getStatusText, toCSV, downloadCSV, downloadExcel } from '../utils/formatters.js';

export function renderVesselTracker(container, vessels, predictions) {
    const delayed = vessels.filter(v => v.status === 'delayed').length;
    const inTransit = vessels.filter(v => v.status === 'in-transit').length;
    const booked = vessels.filter(v => v.planned).length;

    container.innerHTML = `
        <div class="card-header" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
            <div>
                <h3 class="card-title" style="margin:0 0 4px;">Strategic Tracker</h3>
                <p class="card-subtitle" style="margin:0;">
                    ${vessels.length} vessels
                    ${booked > 0 ? ` <span style="color:var(--accent-success);font-weight:700">${booked} booked</span>` : ''}
                    <span style="margin:0 6px;">|</span>
                    ${delayed} delayed
                    <span style="margin:0 6px;">|</span>
                    ${inTransit} in transit
                </p>
            </div>
            <div class="download-bar" style="display:flex;gap:10px;flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm" id="downloadVesselsCSV">CSV</button>
                <button class="btn btn-ghost btn-sm" id="downloadVesselsExcel">Excel</button>
            </div>
        </div>

        <div style="overflow-x:auto;margin-top:12px;">
            <table class="data-table" id="vesselTable" style="min-width:1280px;">
                <thead>
                    <tr>
                        <th>Vessel</th>
                        <th>Origin</th>
                        <th>Port</th>
                        <th>Material</th>
                        <th>Quantity</th>
                        <th>Route</th>
                        <th>Rakes</th>
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
                        const isBooked = !!v.planned;
                        const eta = v.scheduledETA ? new Date(v.scheduledETA) : null;
                        const etaStr = eta ? formatDateTime(eta) : '—';
                        const routeName = v.routeName || v.planRoute?.routeName || v.planRoute?.selectedRoute?.routeName || '—';
                        const routeDetail = [
                            v.planRoute?.fromPortName || v.origin || '',
                            v.planRoute?.toPlantName || v.destinationPortName || ''
                        ].filter(Boolean).join(' -> ');

                        return `
                            <tr style="${isBooked ? 'background:#f0fdf4;border-left:3px solid var(--accent-success)' : ''}">
                                <td>
                                    <div style="display:flex;align-items:center;gap:10px;min-width:160px;">
                                        <span style="font-size:1.1rem;color:var(--text-secondary);line-height:1;">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>
                                        </span>
                                        <div>
                                            <div style="font-weight:700;color:var(--text-primary);line-height:1.2;">${v.name || 'Unknown Vessel'}</div>
                                            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">
                                                Age: ${v.vesselAge || '—'}y
                                                ${isBooked ? ' <span style="background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:999px;font-size:0.62rem;font-weight:700;">BOOKED</span>' : ''}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style="font-weight:600;">${v.origin || '—'}</div>
                                    <div style="font-size:0.72rem;color:var(--text-muted);">${v.originCountry || ''}</div>
                                </td>
                                <td>${v.destinationPortName || v.destinationPort || '—'}</td>
                                <td>
                                    <span style="display:inline-flex;align-items:center;gap:6px;">
                                        <span style="width:8px;height:8px;border-radius:50%;background:${getMaterialColor(v.material)}"></span>
                                        ${v.materialName || v.material || '—'}
                                    </span>
                                </td>
                                <td class="mono">${v.quantity ? formatTons(v.quantity) : '—'}</td>
                                <td>
                                    <div style="font-weight:600;line-height:1.25;">${routeName}</div>
                                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">${routeDetail || 'Optimized path'}</div>
                                </td>
                                <td class="mono">${Number.isFinite(Number(v.rakes)) && Number(v.rakes) > 0 ? Number(v.rakes).toLocaleString() : '—'}</td>
                                <td class="mono" style="font-size:0.78rem;">${etaStr}</td>
                                <td>
                                    <div class="mono" style="${delayHours > 24 ? 'color:var(--accent-danger)' : delayHours > 6 ? 'color:var(--accent-warning)' : 'color:var(--accent-success)'}">
                                        ${delayHours > 0 ? '+' : ''}${formatDuration(Math.abs(delayHours))}
                                    </div>
                                    ${pred ? `
                                        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:3px;">
                                            AI: ${(pred.predictedDelay || 0) > 0 ? '+' : ''}${pred.predictedDelay || 0}h (${Math.round((pred.confidence || 0) * 100)}% conf.)
                                        </div>
                                    ` : ''}
                                </td>
                                <td><span class="status-badge ${getStatusClass(v.status || 'berthed')}">${getStatusText(v.status || 'berthed')}</span></td>
                                <td class="mono">${v.berthAssigned ? `B-${v.berthAssigned}` : '—'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        ${delayed > 0 ? `
            <div style="margin-top:16px;padding:12px 16px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;">
                <div style="font-size:0.82rem;font-weight:700;color:#b45309;margin-bottom:4px;">
                    ${delayed} vessel(s) experiencing delays
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted);">
                    ${vessels.filter(v => v.status === 'delayed').map(v => `${v.name}: +${formatDuration(v.delayHours)} delay at ${v.destinationPortName}`).join(' | ')}
                </div>
            </div>
        ` : ''}
    `;

    document.getElementById('downloadVesselsCSV')?.addEventListener('click', () => exportVesselData(vessels, 'csv'));
    document.getElementById('downloadVesselsExcel')?.addEventListener('click', () => exportVesselData(vessels, 'excel'));
}

function getMaterialColor(materialId) {
    const colors = { coal: '#374151', iron_ore: '#dc2626', limestone: '#d4d4d8', dolomite: '#a78bfa' };
    return colors[materialId] || '#6b7280';
}

function exportVesselData(vessels, format) {
    const columns = [
        { key: 'name', label: 'Vessel Name' },
        { key: 'origin', label: 'Origin' },
        { key: 'originCountry', label: 'Country' },
        { key: 'destinationPortName', label: 'Destination Port' },
        { key: 'materialName', label: 'Material' },
        { key: 'quantity', label: 'Quantity (MT)' },
        { key: 'routeName', label: 'Route' },
        { key: 'rakes', label: 'Rakes' },
        { key: 'scheduledETA', label: 'Scheduled ETA', format: (v) => formatDateTime(v) },
        { key: 'delayHours', label: 'Delay (hrs)' },
        { key: 'status', label: 'Status' },
        { key: 'berthAssigned', label: 'Berth' },
        { key: 'freightCost', label: 'Freight Cost (INR)' },
    ];

    const csv = toCSV(vessels, columns);
    if (format === 'csv') downloadCSV(csv, 'strategic_tracker.csv');
    else downloadExcel(csv, 'strategic_tracker.xls');
}
