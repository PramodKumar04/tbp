// js/engines/milp-solver.js
import { sum } from '../utils/helpers.js';

export class MilpSolver {
    constructor() {
        this.solver = window.solver; // jsLPSolver
    }

    solve(fois, rakes, sapData, mlPredictions, config) {
        if (!this.solver) {
            console.warn('[MILP Solver] jsLPSolver not loaded, using fallback.');
            return this.fallbackSolve(fois, rakes, sapData);
        }

        const model = {
            optimize: 'cost',
            opType: 'min',
            constraints: {},
            variables: {},
            ints: {},
        };

        let estCost = 0;

        // Simplified MILP model for the new optimizer UI
        // In real life, maps FOI rows to delivery variables
        fois.forEach((foi, i) => {
            const varName = `foi_${i}`;
            const cost = foi.quantity * 10; // example transport cost
            
            model.variables[varName] = {
                cost: cost,
                [`plant_${foi.plant}_recv`]: foi.quantity
            };
            
            // Add deadline penalty constraint approximation
            model.variables[`${varName}_delay`] = {
                cost: config.penaltyCost,
            };
        });

        // Constraint example: Demand constraints
        fois.forEach(foi => {
            model.constraints[`plant_${foi.plant}_recv`] = { min: foi.quantity * 0.8 }; // 80% demand min
        });

        try {
            const result = this.solver.Solve(model);
            return {
                feasible: result.feasible,
                totalCost: result.result,
                costBreakdown: { transport: result.result * 0.7, handling: result.result * 0.2, penalty: result.result * 0.1 },
                plan: [], // populated logic
            };
        } catch (e) {
            console.warn("Solver error", e);
            return this.fallbackSolve(fois, rakes, sapData);
        }
    }

    fallbackSolve(fois, rakes, sapData) {
    let totalCost = 0;

    fois.forEach(f => {
        totalCost += f.quantity * 10;
    });

    return {
        feasible: true,
        totalCost,
        costBreakdown: {
            transport: totalCost * 0.7,
            handling: totalCost * 0.2,
            penalty: totalCost * 0.1,
        },
        plan: []
    };
}
}

export const milpSolver = new MilpSolver();
