const OptimizationResult = require('../models/OptimizationResult');
const mongoose = require('mongoose');

async function getSummary(req, res, next) {
    try {
        const userId = req.userId;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // 1. Aggregate Historical Totals across all optimization runs
        const agg = await OptimizationResult.aggregate([
            { $match: { userId: userObjectId } },
            { 
                $group: { 
                    _id: null, 
                    historicalTotal: { $sum: '$totalCost' }, 
                    historicalSavings: { $sum: '$savings.totalSaved' },
                    count: { $sum: 1 } 
                } 
            }
        ]);

        // 2. Get Latest Optimization for current state
        const latestOptim = await OptimizationResult.findOne({ userId }).sort({ optimizedAt: -1, timestamp: -1, _id: -1 });

        // 3. Compute Real-Time Metrics from current plan
        let delayedVesselsCount = 0;
        let rakeUtilization = 0;
        let activeVessels = [];
        let activeRakes = [];
        let routeHistory = [];
        let routeAlternatives = [];
        let costBreakdown = { freight: 0, portHandling: 0, railTransport: 0, demurrage: 0, storage: 0 };
        let currentSavings = { totalSaved: 0, percentSaved: 0, demurrageSaved: 0, demurragePercentSaved: 0, supplyReliability: 85 };

        if (latestOptim) {
            const vessels = latestOptim.vesselSchedule || [];
            const rakes = latestOptim.railPlan || [];
            
            delayedVesselsCount = vessels.filter(v => (v.demurrage || 0) > 0).length;
            
            const usedRakes = rakes.filter(r => r.used).length;
            rakeUtilization = rakes.length ? (usedRakes / rakes.length) * 100 : 0;
            
            activeVessels = vessels; // Keep all from the plan
            activeRakes = rakes;
            routeHistory = latestOptim.routeHistory || [];
            routeAlternatives = latestOptim.routeAlternatives || [];
            costBreakdown = latestOptim.costBreakdown || costBreakdown;
            currentSavings = latestOptim.savings || currentSavings;
        }

        const stats = agg[0] || { historicalTotal: 0, historicalSavings: 0, count: 0 };

        res.json({
            historicalTotal: stats.historicalTotal,
            historicalSavings: stats.historicalSavings,
            totalCost: latestOptim ? latestOptim.totalCost : 0,
            optimizedCost: latestOptim ? latestOptim.totalCost : 0,
            costBreakdown,
            savings: currentSavings,
            delayedVesselsCount,
            rakeUtilization: Math.round(rakeUtilization),
            activeRoutes: activeVessels,
            activeRakes: activeRakes,
            routeHistory,
            routeAlternatives,
            planCount: stats.count,
            lastOptimized: latestOptim ? (latestOptim.optimizedAt || latestOptim.timestamp) : null
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getSummary };
