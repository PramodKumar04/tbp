// ============================================================
// SteelSync-Opt - What-If Simulation Engine
// ============================================================

import { reOptimize } from './optimizer.js';
import { deepClone } from '../utils/helpers.js';
import { predictor } from './prediction.js';
import { PORTS } from '../data/constants.js';

function toNumber(value, fallback = 0) {
    const num = Number.parseFloat(value);
    return Number.isFinite(num) ? num : fallback;
}

function findMatchingVessel(vessels, vesselId, vesselDetails) {
    const fromList = vessels.find(v => String(v.id) === String(vesselId) || String(v.vesselId) === String(vesselId));
    if (fromList) return fromList;
    return vesselDetails?.vessel || vesselDetails || null;
}

function findMatchingRake(rakes, rakeId, rakeDetails) {
    const fromList = rakes.find(r => String(r.id) === String(rakeId) || String(r.rakeId) === String(rakeId) || String(r.rakeNumber) === String(rakeId));
    if (fromList) return fromList;
    return rakeDetails?.rake || rakeDetails || null;
}

export const SCENARIO_TYPES = [
    {
        id: 'vessel_delay',
        name: 'Vessel Delay',
        icon: '🚢',
        description: 'Add extra delay to a specific vessel',
        params: [
            { key: 'vesselId', label: 'Select Vessel', type: 'vessel-select' },
            { key: 'additionalHours', label: 'Additional Delay (hours)', type: 'range', min: 6, max: 120, step: 6, default: 48 },
        ],
    },
    {
        id: 'train_cancelled',
        name: 'Train Cancellation',
        icon: '🚂',
        description: 'Cancel a scheduled rail rake and find alternatives',
        params: [
            { key: 'rakeId', label: 'Select Rake', type: 'rake-select' },
        ],
    },
    {
        id: 'demand_spike',
        name: 'Demand Spike',
        icon: '📈',
        description: 'Increase plant demand by a percentage',
        params: [
            { key: 'plantId', label: 'Select Plant', type: 'plant-select' },
            { key: 'percentIncrease', label: 'Demand Increase (%)', type: 'range', min: 5, max: 50, step: 5, default: 20 },
        ],
    },
    {
        id: 'port_closure',
        name: 'Port Closure',
        icon: '⛔',
        description: 'Close a port and reroute all incoming vessels',
        params: [
            { key: 'portId', label: 'Select Port', type: 'port-select' },
            { key: 'days', label: 'Closure Duration (days)', type: 'range', min: 1, max: 10, step: 1, default: 3 },
        ],
    },
    {
        id: 'weather_disruption',
        name: 'Weather Disruption',
        icon: '🌊',
        description: 'Apply ML-calculated weather delays to all vessels',
        params: [
            { key: 'multiplier', label: 'Adversity Multiplier', type: 'range', min: 1.1, max: 2.0, step: 0.1, default: 1.5 },
        ],
    },
];

/**
 * Run a what-if simulation scenario
 */
export function runSimulation(scenario, data, baselineResults) {
    if (!data || !data.vessels) {
        console.warn('[Simulation] Missing data, returning empty result');
        return createFallbackResult(baselineResults);
    }

    const { type, params = {} } = scenario;
    const modifications = { constraints: {} };
    let explicitPenalties = 0;

    const mlConstraints = predictor.getConstraints() || {};

    const modifiedVessels = deepClone(data.vessels).map(v => {
        v.scheduledETA = v.scheduledETA ? new Date(v.scheduledETA) : new Date();
        v.actualETA = v.actualETA ? new Date(v.actualETA) : new Date(v.scheduledETA);
        return v;
    });
    const modifiedRakes = deepClone(data.rakes || []).map(r => {
        r.departure = r.departure ? new Date(r.departure) : new Date();
        r.arrival = r.arrival ? new Date(r.arrival) : new Date();
        return r;
    });
    const modifiedInventory = deepClone(data.inventory || {});

    try {
        switch (type) {
            case 'vessel_delay': {
                const additionalHours = Math.max(0, toNumber(params.additionalHours, 0));
                const selectedVessel = findMatchingVessel(modifiedVessels, params.vesselId, params._vesselDetails);

                modifications.vesselDelay = {
                    vesselId: params.vesselId,
                    additionalHours,
                };

                if (selectedVessel) {
                    const freightBase = toNumber(selectedVessel.freightCost, 0);
                    const quantity = toNumber(selectedVessel.quantity, 0);
                    const vesselBaseValue = Math.max(25000, freightBase + (quantity * 0.18));
                    const hourlyDelayCost = vesselBaseValue / 72;
                    explicitPenalties += Math.round(hourlyDelayCost * additionalHours);
                    modifications.constraints.delayPenaltyMultiplier = 1 + Math.min(1.5, additionalHours / 72);
                    modifications.constraints.portCapacityFactor = 1 + Math.min(0.12, additionalHours / 360);
                } else {
                    explicitPenalties += Math.round(50000 * additionalHours);
                }
                break;
            }

            case 'train_cancelled': {
                const rakeId = params.rakeId;
                const rakeDetails = params._rakeDetails;
                const cancelledRake = findMatchingRake(modifiedRakes, rakeId, rakeDetails);

                if (cancelledRake) {
                    modifications.trainCancelled = { rakeId };

                    const quantity = toNumber(cancelledRake.quantity || cancelledRake.qty, 2500);
                    const rawCost = toNumber(cancelledRake.cost || cancelledRake.totalCost || cancelledRake.total_cost, 0);
                    const routeDistance = toNumber(cancelledRake.distance || cancelledRake.route?.distance, 500);
                    const unitCost = (quantity > 0 && rawCost > 0) ? (rawCost / quantity) : 1500;
                    const distanceMultiplier = 1.2 + Math.min(1.1, routeDistance / 1200);
                    const roadCost = Math.round(quantity * unitCost * distanceMultiplier);

                    explicitPenalties += roadCost;

                    const delayed = cancelledRake.status === 'delayed' || toNumber(cancelledRake.delayHours, 0) > 0;
                    modifications.constraints.delayPenaltyMultiplier = delayed
                        ? 1 + Math.min(1.25, toNumber(cancelledRake.delayHours, 24) / 24)
                        : 1 + Math.min(0.75, quantity / 12000);
                    modifications.constraints.rakeAvailabilityFactor = Math.max(0.55, 1 - Math.min(0.4, quantity / 15000));
                }
                break;
            }

            case 'demand_spike': {
                const pct = parseFloat(params.percentIncrease || 0);
                modifications.demandSpike = {
                    plantId: params.plantId,
                    percentIncrease: pct,
                };

                modifications.constraints = modifications.constraints || {};
                modifications.constraints.demandSpike = modifications.constraints.demandSpike || {};
                modifications.constraints.demandSpike[params.plantId] = pct;

                try {
                    const windowDays = 3;
                    let addedQty = 0;
                    let totalDailyNeed = 0;

                    if (modifiedInventory[params.plantId]) {
                        for (const matKey of Object.keys(modifiedInventory[params.plantId])) {
                            const daily = toNumber(modifiedInventory[params.plantId][matKey].dailyConsumption, 0);
                            totalDailyNeed += daily;
                            addedQty += daily * (pct / 100) * windowDays;
                        }
                    }

                    if (addedQty <= 0) {
                        totalDailyNeed = modifiedVessels.reduce((sum, v) => sum + toNumber(v.quantity, 0), 0) / Math.max(1, modifiedVessels.length);
                        addedQty = Math.max(1, totalDailyNeed * (pct / 100) * windowDays * 0.25);
                    }

                    const totalVesselQty = modifiedVessels.reduce((s, v) => s + (v.quantity || 0), 0);
                    const totalRakeQty = modifiedRakes.reduce((s, r) => s + (r.quantity || 0), 0);
                    const totalQty = Math.max(1, totalVesselQty + totalRakeQty);

                    const totalVesselCost = modifiedVessels.reduce((s, v) => s + (v.freightCost || 0), 0);
                    const totalRakeCost = modifiedRakes.reduce((s, r) => s + (r.totalCost || 0), 0);
                    const totalTransportCost = Math.max(0, totalVesselCost + totalRakeCost);

                    const costPerTon = totalTransportCost > 0 ? (totalTransportCost / totalQty) : 2000;
                    const urgencyMultiplier = 1.15 + (pct / 100) * 0.75;

                    const additionalTransportCost = Math.round(addedQty * costPerTon * urgencyMultiplier);
                    const rushHandlingBuffer = Math.round(additionalTransportCost * Math.min(0.25, 0.04 + pct / 250));

                    explicitPenalties += additionalTransportCost + rushHandlingBuffer;

                    modifications.constraints.rakeAvailabilityFactor = Math.max(0.65, 1 - (pct / 250));
                    modifications.constraints.portCapacityFactor = 1 + Math.min(0.2, pct / 250);
                } catch (err) {
                    explicitPenalties += Math.round(750000 * Math.max(1, pct / 5));
                }
                break;
            }

            case 'port_closure': {
                const days = Math.max(1, parseInt(params.days || 3));
                modifications.portClosure = {
                    portId: params.portId,
                    days,
                };

                const affectedVessels = modifiedVessels.filter(v => v.destinationPort === params.portId).length;
                explicitPenalties += Math.round(affectedVessels * days * 2500000);

                const otherPorts = PORTS.filter(p => p.id !== params.portId);
                modifiedVessels.forEach(v => {
                    if (v.destinationPort === params.portId) {
                        const targetPort = otherPorts[Math.floor(Math.random() * otherPorts.length)];
                        v.destinationPort = targetPort.id;
                        v.delayHours = (v.delayHours || 0) + (24 * days);
                        v.demurrageDays = (v.demurrageDays || 0) + (days * (mlConstraints.weatherRiskFactor || 1));
                    }
                });
                break;
            }

            case 'weather_disruption': {
                const multiplier = parseFloat(params.multiplier || 1.5);
                const baselineWeatherExposure = modifiedVessels.reduce((sum, v) => {
                    const vesselDelay = predictor.trained
                        ? (predictor.predictVesselDelay(v).predictedDelay || 0)
                        : (v.delayHours || 0);
                    return sum + (toNumber(v.quantity, 0) * (1 + vesselDelay / 48));
                }, 0);
                explicitPenalties += Math.round(Math.max(1000000, baselineWeatherExposure * 1200 * (multiplier - 1)));

                for (const v of modifiedVessels) {
                    const baseExtra = predictor.trained
                        ? (predictor.predictVesselDelay(v).predictedDelay || 24)
                        : (v.delayHours || 24);

                    const extra = baseExtra * (multiplier - 1) * (mlConstraints.weatherRiskFactor || 1);
                    v.delayHours = (v.delayHours || 0) + extra;
                    v.actualETA = new Date(v.actualETA.getTime() + extra * 3600000);
                    v.demurrageDays = (v.demurrageDays || 0) + (extra / 24);
                }
                break;
            }
        }
    } catch (err) {
        console.error('[Simulation] Modifier logic failed:', err);
    }

    const optimizedResult = reOptimize(modifiedVessels, modifiedRakes, modifiedInventory, modifications);

    if (optimizedResult) {
        optimizedResult.totalCost += explicitPenalties;
        optimizedResult.costBreakdown.penalties = explicitPenalties;
    }

    const baseCB = baselineResults?.costBreakdown || { freight: 0, demurrage: 0, portHandling: 0, railTransport: 0 };
    const optCB = optimizedResult?.costBreakdown || { freight: 0, demurrage: 0, portHandling: 0, railTransport: 0, penalties: 0 };

    return {
        baseline: baselineResults,
        scenario: optimizedResult,
        impact: {
            costChange: (optimizedResult?.totalCost || 0) - (baselineResults?.totalCost || 0),
            costChangePercent: (baselineResults?.totalCost)
                ? (((optimizedResult?.totalCost || 0) - baselineResults.totalCost) / baselineResults.totalCost) * 100
                : 0,
            freightChange: (optCB.freight || 0) - (baseCB.freight || 0),
            demurrageChange: (optCB.demurrage || 0) - (baseCB.demurrage || 0),
            handlingChange: (optCB.portHandling || 0) - (baseCB.portHandling || 0),
            railChange: (optCB.railTransport || 0) - (baseCB.railTransport || 0),
            penaltyChange: (optCB.penalties || 0),
        },
        scenarioType: type,
        scenarioParams: params,
        simulatedAt: new Date(),
    };
}

function createFallbackResult(baseline) {
    return {
        baseline: baseline || { totalCost: 0, costBreakdown: {} },
        scenario: baseline || { totalCost: 0, costBreakdown: {} },
        impact: { costChange: 0, costChangePercent: 0, demurrageChange: 0, railChange: 0, penaltyChange: 0 },
        scenarioType: 'unknown',
        simulatedAt: new Date()
    };
}

/**
 * Generate summary text for a scenario result
 */
export function getScenarioSummary(comparison) {
    const { impact, scenarioType } = comparison;
    const costDir = impact.costChange > 0 ? 'increase' : 'decrease';
    const absChange = Math.abs(impact.costChangePercent).toFixed(1);
    const impactType = impact.costChange > 0 ? 'Disruption Impact' : 'Potential Saving';

    const summaries = {
        vessel_delay: `${impactType}: Vessel delay causes a ${absChange}% cost ${costDir}. Demurrage and late arrival fees are the primary drivers.`,
        train_cancelled: `${impactType}: Train cancellation creates a ${absChange}% ${costDir} in total operating costs due to required emergency fallback and inventory risks.`,
        demand_spike: `${impactType}: ${absChange}% budget ${costDir} observed. Logistics fleet stretched to accommodate increased plant requirements.`,
        port_closure: `${impactType}: CRITICAL - Port closure results in a ${absChange}% ${costDir} driven by expensive rerouting and demurrage on diverted vessels.`,
        weather_disruption: `${impactType}: Network-wide weather event leads to a ${absChange}% budget ${costDir}. Model accounts for weather penalties and increased turnaround time.`,
    };

    return summaries[scenarioType] || `Scenario results in a ${absChange}% cost ${costDir}.`;
}
