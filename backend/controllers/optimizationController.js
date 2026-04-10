const OptimizationResult = require('../models/OptimizationResult');

async function saveOptimization(req, res, next) {
    try {
        const {
            feasible,
            totalCost,
            costBreakdown,
            vesselSchedule,
            railPlan,
            routeHistory,
            routeAlternatives,
            savings,
            meta,
            mlConstraints,
            sourceMeta,
            inputSnapshot,
            optimizedAt,
        } = req.body;
        
        if (typeof totalCost !== 'number') {
            return res.status(400).json({ error: 'totalCost is required' });
        }

        const doc = new OptimizationResult({
            userId: req.userId,
            feasible,
            totalCost,
            costBreakdown,
            vesselSchedule,
            railPlan,
            routeHistory,
            routeAlternatives,
            savings,
            meta,
            mlConstraints,
            sourceMeta,
            inputSnapshot,
            optimizedAt
        });

        await doc.save();
        console.log(`[Optimization] Result persisted: ${doc._id}`);

        return res.status(201).json({ 
            message: 'Optimization saved', 
            optimization: doc 
        });
    } catch (err) {
        next(err);
    }
}

async function listOptimizations(req, res, next) {
    try {
        const items = await OptimizationResult.find({ userId: req.userId }).sort({ optimizedAt: -1, timestamp: -1, _id: -1 }).limit(50);
        res.json({ count: items.length, data: items });
    } catch (err) {
        next(err);
    }
}

module.exports = { saveOptimization, listOptimizations };
