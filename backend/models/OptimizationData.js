const mongoose = require('mongoose');

const OptimizationDataSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['demand_rakes', 'inventory', 'vessels'], required: true },
    data: { type: Array, default: [] },
    uploadedAt: { type: Date, default: Date.now },
    fileName: String
});

module.exports = mongoose.model('OptimizationData', OptimizationDataSchema);
