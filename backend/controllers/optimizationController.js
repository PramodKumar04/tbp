const OptimizationResult = require('../models/OptimizationResult');

async function saveOptimization(req, res, next) {
    try {
        const { totalCost, costBreakdown, vesselSchedule, railPlan, savings, meta } = req.body;
        
        if (typeof totalCost !== 'number') {
            return res.status(400).json({ error: 'totalCost is required' });
        }

        // 🗑️ Overwrite previous results (Reliability: Maintain only the latest optimized state)
        await OptimizationResult.deleteMany({ userId: req.userId });

        const doc = new OptimizationResult({
            userId: req.userId,
            totalCost,
            costBreakdown,
            vesselSchedule,
            railPlan,
            savings,
            meta
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
        const items = await OptimizationResult.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(50);
        res.json({ count: items.length, data: items });
    } catch (err) {
        next(err);
    }
}

module.exports = { saveOptimization, listOptimizations };
