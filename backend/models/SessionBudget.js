const mongoose = require('mongoose');

const SessionBudgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String },
    timestamp: { type: Date, default: Date.now },
    baseCost: { type: Number, default: 0 },
    penalties: { type: Number, default: 0 },
    delays: { type: Number, default: 0 },
    optimizations: { type: Number, default: 0 },
    budget: { type: Number, default: 0 }
});

module.exports = mongoose.model('SessionBudget', SessionBudgetSchema);
