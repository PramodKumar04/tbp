const mongoose = require('mongoose');

const MLModelSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    modelType: { type: String, default: 'delay_predictor' },
    serializedData: { type: Object, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MLModel', MLModelSchema);
