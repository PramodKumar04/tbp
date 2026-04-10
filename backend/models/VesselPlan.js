const mongoose = require('mongoose');

const VesselPlanSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vesselId:  { type: String, required: true },
    // Full vessel snapshot for Vessel Tracker rendering
    vesselName: { type: String, required: true },
    origin:     { type: String, default: '' },
    originCountry: { type: String, default: '' },
    destinationPort:     { type: String, default: '' },
    destinationPortName: { type: String, default: '' },
    material:     { type: String, default: '' },
    materialName: { type: String, default: '' },
    quantity:   { type: Number, default: 0 },
    vesselAge:  { type: Number, default: 0 },
    scheduledETA: { type: Date },
    actualETA:    { type: Date },
    delayHours:   { type: Number, default: 0 },
    status:    { type: String, default: 'in-transit' },
    berthAssigned: { type: Number, default: null },
    freightCost: { type: Number, default: 0 },
    // Plan details
    portId:  { type: String, default: '' },
    plantId: { type: String, default: '' },
    route:   { type: Object, default: {} },
    rakes:   { type: Number, default: 2 },
    cost:    { type: Number, required: true },
    cargo:   { type: Object, default: {} },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VesselPlan', VesselPlanSchema);
