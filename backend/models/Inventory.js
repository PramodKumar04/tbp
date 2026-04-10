const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plant: { type: String, required: true },
    material: { type: String, required: true },
    currentLevel: { type: Number, default: 0 },
    safetyStock: { type: Number, default: 0 },
    dailyConsumption: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

// Ensure a user can only have one record per plant/material combination
InventorySchema.index({ userId: 1, plant: 1, material: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);
