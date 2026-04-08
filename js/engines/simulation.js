// ============================================================
// SteelSync-Opt — What-If Simulation Engine
// ============================================================

import { reOptimize } from './optimizer.js';
import { deepClone } from '../utils/helpers.js';

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
        description: 'Cancel a scheduled rail rake',
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
        description: 'Close a port for scheduled maintenance or weather',
        params: [
            { key: 'portId', label: 'Select Port', type: 'port-select' },
            { key: 'days', label: 'Closure Duration (days)', type: 'range', min: 1, max: 10, step: 1, default: 3 },
        ],
    },
    {
        id: 'weather_disruption',
        name: 'Weather Disruption',
        icon: '🌊',
        description: 'Apply weather delay multiplier to all vessels',
        params: [
            { key: 'multiplier', label: 'Delay Multiplier', type: 'range', min: 1.1, max: 2.0, step: 0.1, default: 1.5 },
        ],
    },
];

/**
 * Run a what-if simulation scenario
 */
export function runSimulation(scenario, data, baselineResults) {
    const { type, params } = scenario;
    let modifications = {};

    switch (type) {
        case 'vessel_delay':
            modifications = {
                vesselDelay: {
                    vesselId: params.vesselId,
                    additionalHours: params.additionalHours,
                },
            };
            break;

        case 'train_cancelled':
            modifications = {
                trainCancelled: { rakeId: params.rakeId },
            };
            break;

        case 'demand_spike':
            modifications = {
                demandSpike: {
                    plantId: params.plantId,
                    percentIncrease: params.percentIncrease,
                },
            };
            break;

        case 'port_closure':
            modifications = {
                portClosure: {
                    portId: params.portId,
                    days: params.days,
                },
            };
            break;

        case 'weather_disruption':
            // Apply multiplier to all vessel delays
            modifications = {
                weatherMultiplier: params.multiplier,
            };
            break;
    }

    // Deep clone data
    const modifiedVessels = deepClone(data.vessels).map(v => {
        v.scheduledETA = new Date(v.scheduledETA);
        v.actualETA = new Date(v.actualETA);
        return v;
    });
    const modifiedRakes = deepClone(data.rakes).map(r => {
        r.departure = new Date(r.departure);
        r.arrival = new Date(r.arrival);
        return r;
    });
    const modifiedInventory = deepClone(data.inventory);

    // Apply weather disruption globally
    if (type === 'weather_disruption') {
        for (const v of modifiedVessels) {
            const extraDelay = v.delayHours * (params.multiplier - 1);
            v.delayHours += extraDelay;
            v.actualETA = new Date(v.actualETA.getTime() + extraDelay * 3600000);
            v.demurrageDays += extraDelay / 24;
        }
    }

    const optimizedResult = reOptimize(modifiedVessels, modifiedRakes, modifiedInventory, modifications);

    // Compare with baseline
    const comparison = {
        baseline: baselineResults,
        scenario: optimizedResult,
        impact: {
            costChange: optimizedResult.totalCost - baselineResults.totalCost,
            costChangePercent: ((optimizedResult.totalCost - baselineResults.totalCost) / baselineResults.totalCost) * 100,
            freightChange: optimizedResult.costBreakdown.freight - baselineResults.costBreakdown.freight,
            demurrageChange: optimizedResult.costBreakdown.demurrage - baselineResults.costBreakdown.demurrage,
            handlingChange: optimizedResult.costBreakdown.portHandling - baselineResults.costBreakdown.portHandling,
            railChange: optimizedResult.costBreakdown.railTransport - baselineResults.costBreakdown.railTransport,
        },
        scenarioType: type,
        scenarioParams: params,
        simulatedAt: new Date(),
    };

    return comparison;
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
        train_cancelled: `Train cancellation leads to a ${absChange}% cost ${costDir}. ${impact.costChange > 0 ? 'Alternative routes needed.' : 'No significant impact.'}`,
        demand_spike: `Demand spike causes a ${absChange}% cost ${costDir}. ${impact.costChange > 0 ? 'Additional supply capacity required.' : 'Current supply adequate.'}`,
        port_closure: `Port closure results in a ${absChange}% cost ${costDir}. ${impact.demurrageChange > 0 ? 'Significant demurrage impact expected.' : 'Manageable with rerouting.'}`,
        weather_disruption: `Weather disruption would cause a ${absChange}% cost ${costDir} across the supply chain.`,
    };

    return summaries[scenarioType] || `Scenario results in a ${absChange}% cost ${costDir}.`;
}
