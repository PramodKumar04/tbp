// ============================================================
// SteelSync-Opt — Excel/CSV Parser & Template Generator
// ============================================================

import { PORTS, PLANTS, MATERIALS, RAIL_ROUTES, COST_PARAMS } from '../data/constants.js';
import { uid } from './helpers.js';

function mapToId(name, list) {
    if (!name) return null;
    const lowerName = name.toLowerCase().trim();
    for (const item of list) {
        if (item.name && item.name.toLowerCase() === lowerName) return item.id;
        if (item.id && item.id.toLowerCase() === lowerName) return item.id;
        if (item.name && lowerName.includes(item.name.toLowerCase().split(' ')[0])) return item.id;
    }
    return null;
}

/**
 * Parse CSV text into array of objects
 */
export function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        const row = {};
        headers.forEach((h, j) => {
            row[h] = values[j]?.trim() || '';
        });
        rows.push(row);
    }
    return rows;
}

/**
 * Parse a single CSV line (handling quoted fields)
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

/**
 * Parse uploaded file (CSV or Excel-as-CSV)
 */
export function parseUploadedFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const data = parseCSV(text);
                const parsed = interpretData(data);
                resolve(parsed);
            } catch (err) {
                reject(new Error('Failed to parse file: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Interpret parsed CSV rows into app data structures
 * Supports different sheet types based on column headers
 */
function interpretData(rows) {
    if (rows.length === 0) throw new Error('No data found in file');

    const headers = Object.keys(rows[0]).map(h => h.toLowerCase());
    const result = { type: 'unknown', data: rows };

    // Detect data type from headers
    if (headers.some(h => h.includes('vessel') || h.includes('ship'))) {
        result.type = 'vessels';
        result.data = rows.map(r => parseVesselRow(r));
    } else if (headers.some(h => h.includes('rake') || h.includes('train'))) {
        result.type = 'rakes';
        result.data = rows.map(r => parseRakeRow(r));
    } else if (headers.some(h => h.includes('inventory') || h.includes('stock'))) {
        result.type = 'inventory';
        result.data = parseInventoryRows(rows);
    } else if (headers.some(h => h.includes('from') && headers.some(h2 => h2.includes('to')))) {
        result.type = 'routes';
        result.data = rows.map(r => parseRouteRow(r));
    } else if (headers.some(h => h.includes('port') || h.includes('node'))) {
        result.type = 'nodes';
        result.data = rows.map(r => parseNodeRow(r));
    }

    return result;
}

function findCol(row, ...patterns) {
    for (const key of Object.keys(row)) {
        const lower = key.toLowerCase();
        for (const p of patterns) {
            if (lower.includes(p)) return row[key];
        }
    }
    return '';
}

function parseVesselRow(row) {
    const name = findCol(row, 'vessel', 'ship', 'name') || 'Unknown Vessel';
    const destinationPortName = findCol(row, 'port', 'destination', 'dest');
    const materialName = findCol(row, 'material', 'cargo', 'commodity');
    const quantity = parseFloat(findCol(row, 'quantity', 'tonnage', 'tons', 'mt')) || 50000;
    const etaStr = findCol(row, 'eta', 'arrival', 'scheduled');
    
    const destinationPort = mapToId(destinationPortName, PORTS) || (PORTS[0] ? PORTS[0].id : 'paradip');
    const material = mapToId(materialName, MATERIALS) || (MATERIALS[0] ? MATERIALS[0].id : 'coal');
    const scheduledETA = etaStr ? new Date(etaStr) : new Date(Date.now() + 5 * 24 * 3600 * 1000);
    
    return {
        id: uid('VSL'),
        name,
        origin: findCol(row, 'origin', 'source', 'from') || 'Unknown Origin',
        originCountry: findCol(row, 'country') || 'Unknown',
        destinationPort,
        destinationPortName: PORTS.find(p => p.id === destinationPort)?.name || destinationPortName || 'Unknown Port',
        material,
        materialName: MATERIALS.find(m => m.id === material)?.name || materialName || 'Unknown Material',
        quantity,
        scheduledETA,
        actualETA: scheduledETA,
        delayHours: 0,
        vesselAge: parseFloat(findCol(row, 'age')) || 10,
        status: 'in-transit',
        unloadProgress: 0,
        berthAssigned: null,
        freightCost: Math.round(quantity * COST_PARAMS.freightCostPerTon * COST_PARAMS.usdToInr),
        demurrageDays: 0,
    };
}

function parseRakeRow(row) {
    const fromPortName = findCol(row, 'from', 'origin', 'source');
    const toPlantName = findCol(row, 'to', 'destination', 'plant');
    const materialName = findCol(row, 'material', 'cargo');
    const quantity = parseFloat(findCol(row, 'quantity', 'tons', 'tonnage')) || 3800;
    const departureStr = findCol(row, 'departure', 'depart');
    const arrivalStr = findCol(row, 'arrival', 'arrive');
    
    const fromPort = mapToId(fromPortName, PORTS) || (PORTS[0] ? PORTS[0].id : 'paradip');
    const toPlant = mapToId(toPlantName, PLANTS) || (PLANTS[0] ? PLANTS[0].id : 'bhilai');
    const material = mapToId(materialName, MATERIALS) || (MATERIALS[0] ? MATERIALS[0].id : 'coal');
    
    const departure = departureStr ? new Date(departureStr) : new Date();
    const arrival = arrivalStr ? new Date(arrivalStr) : new Date(Date.now() + 24 * 3600 * 1000);
    
    const route = RAIL_ROUTES.find(r => r.from === fromPort && r.to === toPlant) || { distance: 500, costPerTonKm: 1.8 };
    
    return {
        id: uid('RKE'),
        rakeNumber: findCol(row, 'rake', 'train', 'number', 'id') || 'RK-001',
        fromPort,
        fromPortName: PORTS.find(p => p.id === fromPort)?.name || fromPortName || 'Unknown Port',
        toPlant,
        toPlantName: PLANTS.find(p => p.id === toPlant)?.name || toPlantName || 'Unknown Plant',
        material,
        materialName: MATERIALS.find(m => m.id === material)?.name || materialName || 'Unknown Material',
        quantity,
        departure,
        arrival,
        delayHours: 0,
        status: 'waiting',
        distance: route.distance,
        costPerTonKm: route.costPerTonKm,
        totalCost: Math.round(quantity * route.distance * route.costPerTonKm),
    };
}

function parseInventoryRows(rows) {
    const inventory = {};
    for (const row of rows) {
        const plantName = findCol(row, 'plant', 'location', 'site');
        const materialName = findCol(row, 'material', 'commodity');
        const level = parseFloat(findCol(row, 'level', 'stock', 'quantity', 'current')) || 0;
        const safety = parseFloat(findCol(row, 'safety', 'minimum', 'min')) || level * 0.5;
        const daily = parseFloat(findCol(row, 'daily', 'consumption', 'usage')) || 1000;

        const plant = mapToId(plantName, PLANTS) || (PLANTS[0] ? PLANTS[0].id : 'bhilai');
        const material = mapToId(materialName, MATERIALS) || (MATERIALS[0] ? MATERIALS[0].id : 'coal');

        if (!inventory[plant]) inventory[plant] = {};
        inventory[plant][material] = { 
            currentLevel: level, 
            safetyStock: safety, 
            dailyConsumption: daily,
            daysOfSupply: daily > 0 ? Math.round((level / daily) * 10) / 10 : 99,
            status: level < safety * 0.8 ? 'critical' : level < safety ? 'warning' : 'healthy'
        };
    }
    return inventory;
}

function parseRouteRow(row) {
    return {
        from: findCol(row, 'from', 'origin', 'source'),
        to: findCol(row, 'to', 'destination', 'dest'),
        distance: parseFloat(findCol(row, 'distance', 'km')) || 500,
        costPerTonKm: parseFloat(findCol(row, 'cost', 'rate')) || 1.8,
        mode: findCol(row, 'mode', 'transport') || 'Rail',
        capacity: parseFloat(findCol(row, 'capacity', 'max')) || 3800,
        product: findCol(row, 'product', 'material', 'commodity') || 'Raw Material',
    };
}

function parseNodeRow(row) {
    return {
        name: findCol(row, 'name', 'node', 'location'),
        type: findCol(row, 'type', 'category') || 'Unknown',
        capacity: parseFloat(findCol(row, 'capacity')) || 0,
        lat: parseFloat(findCol(row, 'lat', 'latitude')) || 0,
        lng: parseFloat(findCol(row, 'lng', 'longitude', 'lon')) || 0,
    };
}

/**
 * Generate downloadable CSV template
 */
export function generateTemplate(type = 'full') {
    const templates = {
        vessels: {
            filename: 'steelsync_vessels_template.csv',
            content: `Vessel Name,Origin Port,Country,Destination Port,Material,Quantity (MT),Scheduled ETA,Vessel Age
MV Cape Horizon,Richards Bay,South Africa,Paradip Port,Coking Coal,65000,2026-04-10,8
MV Iron Maiden,Newcastle,Australia,Vizag Port,Iron Ore,72000,2026-04-12,12
MV Pacific Star,Hay Point,Australia,Dhamra Port,Coking Coal,58000,2026-04-15,5`,
        },
        rakes: {
            filename: 'steelsync_rakes_template.csv',
            content: `Rake Number,From Port,To Plant,Material,Quantity (MT),Departure,Arrival
RK-001,Paradip Port,Bhilai Steel Plant,Coking Coal,3800,2026-04-08,2026-04-09
RK-002,Vizag Port,Rourkela Steel Plant,Iron Ore,3600,2026-04-09,2026-04-10
RK-003,Dhamra Port,Bokaro Steel Plant,Limestone,3500,2026-04-10,2026-04-11`,
        },
        routes: {
            filename: 'steelsync_routes_template.csv',
            content: `Mode of Transport,From Location,To Location,Product,Period,Available,Min Capacity,Max Capacity,Cost Per Distance
Rail,Paradip Port,Bhilai Steel Plant,Coking Coal,2026,Yes,0,3800,1.80
Rail,Vizag Port,Rourkela Steel Plant,Iron Ore,2026,Yes,0,3800,1.70
Rail,Dhamra Port,Bokaro Steel Plant,Limestone,2026,Yes,0,3800,1.90
Rail,Haldia Port,Bhilai Steel Plant,Coking Coal,2026,Yes,0,3800,1.60`,
        },
        inventory: {
            filename: 'steelsync_inventory_template.csv',
            content: `Plant,Material,Current Stock (MT),Safety Stock (MT),Daily Consumption (MT)
Bhilai Steel Plant,Coking Coal,120000,90000,8000
Bhilai Steel Plant,Iron Ore,180000,135000,12000
Rourkela Steel Plant,Coking Coal,80000,72000,6000
Bokaro Steel Plant,Iron Ore,140000,100000,10000`,
        },
        full: {
            filename: 'steelsync_full_template.csv',
            content: `Mode of Transport,From Location,To Location,Product,Period,Available,Min Capacity,Max Capacity,Cost Per Distance
Rail,Paradip Port,Bhilai Steel Plant,Coking Coal,2026,Yes,0,3800,1.80
Rail,Paradip Port,Rourkela Steel Plant,Iron Ore,2026,Yes,0,3800,1.90
Rail,Vizag Port,Bhilai Steel Plant,Coking Coal,2026,Yes,0,3800,1.70
Rail,Haldia Port,Bokaro Steel Plant,Limestone,2026,Yes,0,3800,1.60
Rail,Dhamra Port,Rourkela Steel Plant,Dolomite,2026,Yes,0,3800,1.90`,
        },
    };

    const tmpl = templates[type] || templates.full;
    const blob = new Blob(['\uFEFF' + tmpl.content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = tmpl.filename;
    link.click();
    URL.revokeObjectURL(url);
}
