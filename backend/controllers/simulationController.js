const SimulationResult = require('../models/SimulationResult');
const OptimizationResult = require('../models/OptimizationResult');

async function saveSimulation(req, res, next) {
    try {
        const { scenarioType, inputParams, originalCost, newCost, meta } = req.body;
        
        // --- 🔴 SYSTEM OF RECORD: ENSURE PERSISTENCE ---
        if (!scenarioType || typeof originalCost !== 'number' || typeof newCost !== 'number') {
            return res.status(400).json({ error: 'scenarioType, originalCost and newCost required' });
        }

        const costImpact = newCost - originalCost;

        const doc = new SimulationResult({
            userId: req.userId,
            scenarioType,
            inputParams,
            baselineCost: originalCost,
            optimizedCost: newCost,
            impact: {
                costChange: costImpact,
                costChangePercent: originalCost ? (costImpact / originalCost) * 100 : 0,
                demurrageChange: meta?.impact?.demurrageChange || 0,
                railChange: meta?.impact?.railChange || 0
            },
            meta
        });
        
        await doc.save();
        console.log(`[Simulation] Result persisted: ${doc._id}`);

        return res.status(201).json({ 
            message: 'Simulation saved', 
            simulation: doc 
        });
    } catch (err) {
        next(err);
    }
}

async function listHistory(req, res, next) {
    try {
        const items = await SimulationResult.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(50);
        res.json({ count: items.length, data: items });
    } catch (err) {
        next(err);
    }
}

module.exports = { saveSimulation, listHistory };
