// ============================================================
// SteelSync-Opt — What-If Simulation Engine
// ============================================================

import { reOptimize } from './optimizer.js';
import { deepClone } from '../utils/helpers.js';
import { predictor } from './prediction.js';
import { PORTS, RAIL_ROUTES } from '../data/constants.js';

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
    // --- 🔴 PHASE 1: GUARDS ---
    if (!data || !data.vessels) {
        console.warn('[Simulation] Missing data, returning empty result');
        return createFallbackResult(baselineResults);
    }
    
    const { type, params = {} } = scenario;
    let modifications = { constraints: {} };
    let explicitPenalties = 0;

    // Get ML constraints for realism
    const mlConstraints = predictor.getConstraints() || {};

    // Deep clone data to avoid mutating application state
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

    // --- 🟢 PHASE 2: REALISTIC SCENARIO LOGIC ---
    try {
        switch (type) {
            case 'vessel_delay':
                modifications.vesselDelay = {
                    vesselId: params.vesselId,
                    additionalHours: parseFloat(params.additionalHours || 0),
                };
                // Real-world cost: penalty for delay beyond threshold
                if (parseFloat(params.additionalHours) > 48) {
                    explicitPenalties += 1200000; // ₹12 Lakh late arrival fee
                }
                break;

            case 'train_cancelled':
                const cancelledRake = modifiedRakes.find(r => r.id === params.rakeId);
                if (cancelledRake) {
                    modifications.trainCancelled = { rakeId: params.rakeId };
                    // 🔴 LOSS: Emergency road transport is 250% more expensive
                    const roadCost = (cancelledRake.totalCost || 200000) * 2.5; 
                    explicitPenalties += roadCost;
                    
                    modifications.constraints.delayPenaltyMultiplier = 1.6;
                }
                break;

            case 'demand_spike':
                modifications.demandSpike = {
                    plantId: params.plantId,
                    percentIncrease: parseFloat(params.percentIncrease || 0),
                };
                explicitPenalties += 2500000; // Operational rush fee
                break;

            case 'port_closure':
                modifications.portClosure = {
                    portId: params.portId,
                    days: parseInt(params.days || 3),
                };
                // 🔴 BIG LOSS: Port closure results in fixed vessel cancellation/divergence fees
                const affectedVessels = modifiedVessels.filter(v => v.destinationPort === params.portId).length;
                explicitPenalties += affectedVessels * 5000000; // ₹50 Lakh per vessel
                
                // Real-Time Rerouting: vessels for this port must go elsewhere
                const otherPorts = PORTS.filter(p => p.id !== params.portId);
                modifiedVessels.forEach(v => {
                    if (v.destinationPort === params.portId) {
                        const targetPort = otherPorts[Math.floor(Math.random() * otherPorts.length)];
                        v.destinationPort = targetPort.id;
                        v.delayHours = (v.delayHours || 0) + 72; // Rerouting penalty
                        v.demurrageDays = (v.demurrageDays || 0) + (3 * (mlConstraints.weatherRiskFactor || 1));
                    }
                });
                break;

            case 'weather_disruption':
                const multiplier = parseFloat(params.multiplier || 1.5);
                explicitPenalties += 8000000; // Global weather insurance premium loss
                
                for (const v of modifiedVessels) {
                    const baseExtra = predictor.trained 
                        ? (predictor.predictVesselDelay(v).predictedDelay || 24)
                        : (v.delayHours || 24);
                        
                    const extra = baseExtra * (multiplier - 1) * (mlConstraints.monsoonPenalty || 1);
                    v.delayHours = (v.delayHours || 0) + extra;
                    v.actualETA = new Date(v.actualETA.getTime() + extra * 3600000);
                    v.demurrageDays = (v.demurrageDays || 0) + (extra / 24);
                }
                break;
        }
    } catch (err) {
        console.error('[Simulation] Modifier logic failed:', err);
    }

    // --- 🟢 PHASE 3: RE-OPTIMIZE ---
    const optimizedResult = reOptimize(modifiedVessels, modifiedRakes, modifiedInventory, modifications);

    // Add explicit penalties to the final scenario cost
    if (optimizedResult) {
        optimizedResult.totalCost += explicitPenalties;
        optimizedResult.costBreakdown.penalties = explicitPenalties;
    }

    // --- 🟢 PHASE 4: SAFE COMPARISON ---
    const baseCB = baselineResults?.costBreakdown || { freight: 0, demurrage: 0, portHandling: 0, railTransport: 0 };
    const optCB = optimizedResult?.costBreakdown || { freight: 0, demurrage: 0, portHandling: 0, railTransport: 0, penalties: 0 };

    const comparison = {
        baseline: baselineResults,
        scenario: optimizedResult,
        impact: {
            costChange: (optimizedResult?.totalCost || 0) - (baselineResults?.totalCost || 0),
            costChangePercent: (baselineResults?.totalCost) ? (((optimizedResult?.totalCost || 0) - baselineResults.totalCost) / baselineResults.totalCost) * 100 : 0,
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

    return comparison;
}

function createFallbackResult(baseline) {
    return {
        baseline: baseline || { totalCost: 0, costBreakdown: {} },
        scenario: baseline || { totalCost: 0, costBreakdown: {} },
        impact: { costChange: 0, costChangePercent: 0, demurrageChange: 0, railChange: 0 },
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

    const summaries = {
        vessel_delay: `Vessel delay would cause a ${absChange}% cost ${costDir}, primarily through ${impact.demurrageChange > 0 ? 'increased demurrage charges' : 'rescheduling adjustments'}.`,
        train_cancelled: `Train cancellation leads to a ${absChange}% impact. ${impact.costChange > 0 ? 'Alternate routing or road transport fallback applied.' : 'Managed with existing scheduling.'}`,
        demand_spike: `Demand spike causes a ${absChange}% cost ${costDir}. Additional material flow optimized to prevent stock-outs.`,
        port_closure: `Significant port closure forces rerouting, resulting in a ${absChange}% budget ${costDir}. Demurrage and rerouting costs are primary factors.`,
        weather_disruption: `AI Predicts that weather conditions will cause a ${absChange}% cost ${costDir} across the network.`,
    };

    return summaries[scenarioType] || `Scenario results in a ${absChange}% cost ${costDir}.`;
}