// ============================================================
// SteelSync-Opt — Synthetic Data Generator
// ============================================================

import { createRNG, randInt, randFloat, randPick, addDays, addHours, uid } from '../utils/helpers.js';
import {
    PORTS, PLANTS, MATERIALS, VESSEL_NAMES, ORIGINS,
    RAIL_ROUTES, COST_PARAMS, getSeason, DELAY_FACTORS,
} from './constants.js';

const RNG = createRNG(42);

// ── Vessels ──────────────────────────────────────────────────
export function generateVessels(count = 10) {
    const now = new Date();
    const vessels = [];
    const usedNames = new Set();

    for (let i = 0; i < count; i++) {
        let name;
        do { name = randPick(RNG, VESSEL_NAMES); } while (usedNames.has(name));
        usedNames.add(name);

        const origin = randPick(RNG, ORIGINS);
        const port = randPick(RNG, PORTS);
        const material = randPick(RNG, MATERIALS);
        const quantity = randInt(RNG, 35000, 85000);
        const vesselAge = randInt(RNG, 2, 25);

        // ETA: some in the past (already arrived), some in the future
        const etaOffset = randInt(RNG, -5, 20);
        const scheduledETA = addDays(now, etaOffset);

        // Delay based on season and random factors
        const month = scheduledETA.getMonth();
        const season = getSeason(month);
        const baseDelay = randFloat(RNG, -6, 48); // hours
        const seasonMultiplier = DELAY_FACTORS[season];
        const actualDelay = Math.max(-6, baseDelay * seasonMultiplier + (vesselAge > 15 ? randFloat(RNG, 0, 12) : 0));

        const actualETA = addHours(scheduledETA, actualDelay);

        // Status determination
        let status;
        const hoursUntilArrival = (actualETA - now) / (1000 * 60 * 60);
        if (hoursUntilArrival < -48) {
            status = 'unloading';
        } else if (hoursUntilArrival < 0) {
            status = 'berthed';
        } else if (hoursUntilArrival < 24) {
            status = actualDelay > 12 ? 'delayed' : 'on-time';
        } else {
            status = actualDelay > 24 ? 'delayed' : 'in-transit';
        }

        // Unloading progress for arrived vessels
        let unloadProgress = 0;
        if (status === 'unloading') {
            const daysSinceArrival = Math.abs(hoursUntilArrival) / 24;
            const unloadDays = quantity / port.handlingRate;
            unloadProgress = Math.min(1, daysSinceArrival / unloadDays);
        } else if (status === 'berthed') {
            unloadProgress = randFloat(RNG, 0, 0.15);
        }

        vessels.push({
            id: uid('VSL'),
            name,
            origin: origin.name,
            originCountry: origin.country,
            destinationPort: port.id,
            destinationPortName: port.name,
            material: material.id,
            materialName: material.name,
            quantity,
            vesselAge,
            scheduledETA,
            actualETA,
            delayHours: Math.round(actualDelay * 10) / 10,
            status,
            unloadProgress,
            berthAssigned: status === 'berthed' || status === 'unloading' ? randInt(RNG, 1, port.berths) : null,
            freightCost: Math.round(quantity * COST_PARAMS.freightCostPerTon * COST_PARAMS.usdToInr),
            demurrageDays: status === 'waiting' ? randFloat(RNG, 0.5, 4) : (actualDelay > 0 ? Math.max(0, actualDelay / 24 - 1) : 0),
        });
    }

    return vessels.sort((a, b) => a.actualETA - b.actualETA);
}

// ── Rail Rakes ───────────────────────────────────────────────
export function generateRakes(count = 18) {
    const now = new Date();
    const rakes = [];

    for (let i = 0; i < count; i++) {
        const route = randPick(RNG, RAIL_ROUTES);
        const material = randPick(RNG, MATERIALS);
        const fromPort = PORTS.find(p => p.id === route.from);
        const toPlant = PLANTS.find(p => p.id === route.to);

        const departureOffset = randInt(RNG, -3, 15);
        const departure = addHours(now, departureOffset * 24 + randInt(RNG, 0, 23));
        const travelHours = route.avgTime + randFloat(RNG, -4, 12);
        const arrival = addHours(departure, travelHours);

        const quantity = Math.min(COST_PARAMS.rakeCapacity, randInt(RNG, 3200, 3800));
        const delayHours = randFloat(RNG, -2, 8);

        let status;
        const hoursUntilDeparture = (departure - now) / (1000 * 60 * 60);
        const hoursUntilArrival = (arrival - now) / (1000 * 60 * 60);

        if (hoursUntilArrival < 0) {
            status = 'completed';
        } else if (hoursUntilDeparture < 0) {
            status = 'in-transit';
        } else {
            status = 'waiting';
        }

        rakes.push({
            id: uid('RKE'),
            rakeNumber: `RK-${String(i + 1).padStart(3, '0')}`,
            fromPort: route.from,
            fromPortName: fromPort.name,
            toPlant: route.to,
            toPlantName: toPlant.name,
            material: material.id,
            materialName: material.name,
            quantity,
            departure,
            arrival,
            delayHours: Math.round(delayHours * 10) / 10,
            status,
            distance: route.distance,
            costPerTonKm: route.costPerTonKm,
            totalCost: Math.round(quantity * route.distance * route.costPerTonKm),
        });
    }

    return rakes.sort((a, b) => a.departure - b.departure);
}

// ── Inventory Levels ────────────────────────────────────────
export function generateInventory() {
    const inventory = {};
    for (const plant of PLANTS) {
        inventory[plant.id] = {};
        for (const mat of MATERIALS) {
            const daily = plant.dailyConsumption[mat.id] || 0;
            if (daily === 0) continue;
            const safetyStock = daily * plant.safetyStockDays;
            const currentLevel = randInt(RNG, Math.round(safetyStock * 0.6), Math.round(safetyStock * 1.8));

            inventory[plant.id][mat.id] = {
                currentLevel,
                safetyStock,
                dailyConsumption: daily,
                daysOfSupply: Math.round((currentLevel / daily) * 10) / 10,
                status: currentLevel < safetyStock * 0.8 ? 'critical' :
                    currentLevel < safetyStock ? 'warning' : 'healthy',
            };
        }
    }
    return inventory;
}

// ── Historical Data (for ML training) ────────────────────────
export function generateHistoricalData(count = 200) {
    const history = [];
    const histRNG = createRNG(123);

    for (let i = 0; i < count; i++) {
        const origin = randPick(histRNG, ORIGINS);
        const port = randPick(histRNG, PORTS);
        const month = randInt(histRNG, 0, 11);
        const season = getSeason(month);
        const vesselAge = randInt(histRNG, 1, 28);
        const portCongestion = randFloat(histRNG, 0.2, 1.0);
        const weatherScore = season === 'Monsoon' ? randFloat(histRNG, 0.3, 0.7) :
            season === 'Winter' ? randFloat(histRNG, 0.7, 1.0) :
                randFloat(histRNG, 0.5, 0.9);

        // Feature-based delay calculation (ground truth)
        let delay = origin.avgDays * 24 * (DELAY_FACTORS[season] - 1);
        delay += vesselAge > 15 ? randFloat(histRNG, 4, 18) : randFloat(histRNG, -2, 6);
        delay += portCongestion > 0.7 ? randFloat(histRNG, 6, 24) : 0;
        delay += weatherScore < 0.5 ? randFloat(histRNG, 8, 36) : 0;
        delay += randFloat(histRNG, -6, 6); // noise
        delay = Math.max(-12, delay);

        history.push({
            originDistance: origin.avgDays,
            season,
            seasonIdx: SEASONS_IDX[season],
            vesselAge,
            portCongestion: Math.round(portCongestion * 100) / 100,
            weatherScore: Math.round(weatherScore * 100) / 100,
            portId: port.id,
            actualDelay: Math.round(delay * 10) / 10,
        });
    }

    return history;
}

const SEASONS_IDX = { Winter: 0, 'Pre-Monsoon': 1, Monsoon: 2, 'Post-Monsoon': 3 };

// ── Generate 30-day inventory projection ────────────────────
export function generateInventoryProjection(inventory, rakes) {
    const projection = {};

    for (const plant of PLANTS) {
        projection[plant.id] = {};

        for (const mat of MATERIALS) {
            const inv = inventory[plant.id]?.[mat.id];
            if (!inv) continue;

            const days = [];
            let level = inv.currentLevel;
            const now = new Date();

            for (let d = 0; d < 30; d++) {
                const date = addDays(now, d);
                // incoming from rakes arriving that day
                const incoming = rakes
                    .filter(r => r.toPlant === plant.id && r.material === mat.id &&
                        r.arrival.toDateString() === date.toDateString())
                    .reduce((sum, r) => sum + r.quantity, 0);

                level = level - inv.dailyConsumption + incoming;
                level = Math.max(0, level);

                days.push({
                    date,
                    level: Math.round(level),
                    incoming,
                    consumption: inv.dailyConsumption,
                    safetyStock: inv.safetyStock,
                });
            }
            projection[plant.id][mat.id] = days;
        }
    }
    return projection;
}

// ── Master data generation ───────────────────────────────────
export function generateAllData() {
    const vessels = generateVessels(10);
    const rakes = generateRakes(18);
    const inventory = generateInventory();
    const historicalData = generateHistoricalData(200);
    const inventoryProjection = generateInventoryProjection(inventory, rakes);

    return {
        vessels,
        rakes,
        inventory,
        historicalData,
        inventoryProjection,
        generatedAt: new Date(),
    };
}
