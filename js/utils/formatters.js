// ============================================================
// SteelSync-Opt — Data Formatters
// ============================================================

/**
 * Format INR currency
 */
export function formatINR(amount, compact = false) {
    if (compact) {
        if (Math.abs(amount) >= 1e7) return '₹' + (amount / 1e7).toFixed(2) + ' Cr';
        if (Math.abs(amount) >= 1e5) return '₹' + (amount / 1e5).toFixed(2) + ' L';
        if (Math.abs(amount) >= 1e3) return '₹' + (amount / 1e3).toFixed(1) + 'K';
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format metric tons
 */
export function formatTons(tons) {
    if (tons >= 1e6) return (tons / 1e6).toFixed(2) + ' MT';
    if (tons >= 1e3) return (tons / 1e3).toFixed(1) + ' KT';
    return tons.toFixed(0) + ' T';
}

/**
 * Format date as DD MMM YYYY
 */
export function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Format date as DD MMM YYYY, HH:MM
 */
export function formatDateTime(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format short date as DD MMM
 */
export function formatShortDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * Format duration in hours to human readable
 */
export function formatDuration(hours) {
    if (hours < 1) return Math.round(hours * 60) + ' min';
    if (hours < 24) return hours.toFixed(1) + ' hrs';
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    return `${d}d ${h}h`;
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 1) {
    return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format large number with commas (Indian style)
 */
export function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

/**
 * Get status badge class
 */
export function getStatusClass(status) {
    const map = {
        'on-time': 'status-success',
        'in-transit': 'status-info',
        'delayed': 'status-warning',
        'critical': 'status-danger',
        'completed': 'status-neutral',
        'berthed': 'status-info',
        'unloading': 'status-active',
        'waiting': 'status-warning',
    };
    return map[status] || 'status-neutral';
}

/**
 * Get status display text
 */
export function getStatusText(status) {
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
}

/**
 * Format as CSV value (escape commas and quotes)
 */
export function csvEscape(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV(data, columns) {
    const header = columns.map(c => csvEscape(c.label || c.key)).join(',');
    const rows = data.map(row =>
        columns.map(c => csvEscape(c.format ? c.format(row[c.key], row) : row[c.key])).join(',')
    );
    return header + '\n' + rows.join('\n');
}

/**
 * Trigger CSV file download
 */
export function downloadCSV(csvString, filename) {
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Trigger Excel (XLSX via CSV) download — simple approach
 */
export function downloadExcel(csvString, filename) {
    // For true .xlsx, we'd need a library, but .csv opens fine in Excel
    const blob = new Blob(['\uFEFF' + csvString], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace('.csv', '.xls');
    link.click();
    URL.revokeObjectURL(url);
}
