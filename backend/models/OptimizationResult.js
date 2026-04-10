const mongoose = require('mongoose');

const OptimizationResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    totalCost: { type: Number, required: true },
    costBreakdown: {
        freight:      { type: Number, default: 0 },
        portHandling: { type: Number, default: 0 },
        railTransport:{ type: Number, default: 0 },
        demurrage:    { type: Number, default: 0 },
        storage:      { type: Number, default: 0 }
    },
    vesselSchedule: { type: Array, default: [] },
    railPlan:       { type: Array, default: [] },
    savings: {
        totalSaved:             { type: Number, default: 0 },
        percentSaved:           { type: Number, default: 0 },
        demurrageSaved:         { type: Number, default: 0 },
        demurragePercentSaved:  { type: Number, default: 0 },
        supplyReliability:      { type: Number, default: 85 }
    },
    meta: { type: Object, default: {} }
});

module.exports = mongoose.model('OptimizationResult', OptimizationResultSchema);
