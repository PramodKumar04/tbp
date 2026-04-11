// ============================================================
// SteelSync-Opt - What-If Simulation Engine
// ============================================================

import { reOptimize } from './optimizer.js';
import { deepClone } from '../utils/helpers.js';
import { predictor } from './prediction.js';
import { PORTS, PLANTS, MATERIALS } from '../data/constants.js';

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
    let affectedCount = 0;
    let mRisk = 1.0;

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
                const vesselId = params.vesselId;
                const additionalHours = parseFloat(params.additionalHours || 48);
                const selectedVessel = findMatchingVessel(modifiedVessels, vesselId, params._vesselDetails);

                modifications.vesselDelay = {
                    vesselId: params.vesselId,
                    additionalHours,
                };

                if (selectedVessel) {
                    affectedCount = 1;
                    const freightBase = toNumber(selectedVessel.freightCost, 0) || (toNumber(selectedVessel.quantity, 30000) * 120);
                    const quantity = toNumber(selectedVessel.quantity, 30000);
                    const vesselBaseValue = Math.max(5000000, freightBase + (quantity * 0.18));
                    
                    mRisk = 1 + (toNumber(mlConstraints.weatherRiskFactor, 1.0) - 1) + (toNumber(mlConstraints.monsoonPenalty, 1.0) - 1);
                    const hourlyDelayCost = (vesselBaseValue / 72) * mRisk;
                    
                    explicitPenalties += Math.round(hourlyDelayCost * additionalHours);
                    modifications.constraints.delayPenaltyMultiplier = mRisk;
                    modifications.constraints.portCapacityFactor = 1 - Math.min(0.15, additionalHours / 480);
                } else {
                    mRisk = 2.5 + (toNumber(mlConstraints.weatherRiskFactor, 1.0) - 1);
                    explicitPenalties += Math.round(75000 * additionalHours * mRisk); 
                }
                break;
            }

            case 'train_cancelled': {
                const rakeId = params.rakeId;
                const rakeDetails = params._rakeDetails;
                const cancelledRake = findMatchingRake(modifiedRakes, rakeId, rakeDetails);

                if (cancelledRake) {
                    affectedCount = 1;
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
                affectedCount = 1;

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
                    modifications.constraints.portCapacityFactor = 1 - Math.min(0.2, pct / 250);
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

                // Defensive check across multiple naming conventions (destinationPort, portId, port)
                const targetPortId = String(params.portId).toLowerCase();
                affectedCount = modifiedVessels.filter(v => {
                    const vPort = String(v.destinationPort || v.portId || v.port || '').toLowerCase();
                    return vPort === targetPortId || vPort.includes(targetPortId);
                }).length;

                mRisk = 2.5 + (toNumber(mlConstraints.weatherRiskFactor, 1.0) - 1);
                
                // MATH: Base Disruption Fee (₹2 Cr/day) + Per-Vessel Rerouting Penalty
                const baseDisruptionFee = days * 20000000 * mRisk; 
                const perVesselPenalty = affectedCount * days * 1250000 * mRisk;
                
                explicitPenalties += Math.round(baseDisruptionFee + perVesselPenalty);
                
                console.log(`[Mathematician] Port Closure: Port=${params.portId}, Days=${days}, Affected=${affectedCount}, mRisk=${mRisk.toFixed(2)}, TotalPenalty=${explicitPenalties}`);
                break;
            }

            case 'weather_disruption': {
                const multiplier = parseFloat(params.multiplier || 1.5);
                affectedCount = modifiedVessels.length;
                mRisk = multiplier * (toNumber(mlConstraints.weatherRiskFactor, 1.0));
                
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
        optimizedResult.costBreakdown.penalties = (optimizedResult.costBreakdown.penalties || 0) + explicitPenalties;
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
        meta: {
            affectedCount,
            mRisk: mRisk.toFixed(2),
            days: params.days || params.duration || (params.additionalHours ? params.additionalHours / 24 : 0),
            portName: PORTS.find(p => p.id === params.portId)?.name,
            plantName: PLANTS.find(p => p.id === params.plantId)?.name,
            vesselName: findMatchingVessel(modifiedVessels, params.vesselId)?.name,
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
    const { impact, scenarioType, meta } = comparison;
    const costDir = impact.costChange > 0 ? 'increase' : 'decrease';
    const absChange = Math.abs(impact.costChangePercent).toFixed(1);
    const impactType = impact.costChange > 0 ? 'Disruption Impact' : 'Potential Saving';

    const mRiskStr = meta?.mRisk ? ` with an AI risk multiplier of ${meta.mRisk}x` : '';
    const affectedStr = meta?.affectedCount ? ` affecting ${meta.affectedCount} ${scenarioType === 'train_cancelled' ? 'rake' : 'vessel'}${meta.affectedCount > 1 ? 's' : ''}` : '';
    const durationStr = meta?.days ? ` across ${meta.days} days` : '';

    const summaries = {
        vessel_delay: `${impactType}: Delay for ${meta?.vesselName || 'vessel'}${durationStr} results in a ${absChange}% budget ${costDir} due to scaled demurrage and wait penalties.`,
        train_cancelled: `${impactType}: Cancellation of rake ${affectedStr} creates a ${absChange}% budget ${costDir}. Gap filled by ₹${(impact.penaltyChange / 10000000).toFixed(2)} Cr in operational shortfall penalties.`,
        demand_spike: `${impactType}: A ${absChange}% budget ${costDir} observed at ${meta?.plantName || 'plant'}. Operational risk reflects increased throughput stress${mRiskStr}.`,
        port_closure: `${impactType}: CRITICAL - Closure of ${meta?.portName || 'port'}${durationStr}${affectedStr} results in a ${absChange}% budget ${costDir}. Primarily driven by ₹${(impact.penaltyChange / 10000000).toFixed(2)} Cr in unmet demand penalties and rerouting costs.`,
        weather_disruption: `${impactType}: Regional weather event leads to a ${absChange}% budget ${costDir}. Analysis incorporates model-predicted delay variances and turn-around penalties.`,
    };

    return summaries[scenarioType] || `Scenario results in a ${absChange}% budget ${costDir}.`;
}
