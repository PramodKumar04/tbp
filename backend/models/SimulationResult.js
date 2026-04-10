const mongoose = require('mongoose');

const SimulationResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scenarioType: { type: String, required: true },
    inputParams: { type: Object, default: {} },
    impact: {
        costChange: { type: Number, default: 0 },
        costChangePercent: { type: Number, default: 0 },
        demurrageChange: { type: Number, default: 0 },
        railChange: { type: Number, default: 0 }
    },
    baselineCost: { type: Number, required: true },
    optimizedCost: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    meta: { type: Object, default: {} }
});

module.exports = mongoose.model('SimulationResult', SimulationResultSchema);
