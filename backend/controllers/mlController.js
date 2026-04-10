const MLModel = require('../models/MLModel');

async function saveModel(req, res, next) {
    try {
        const { serializedData } = req.body;
        if (!serializedData) return res.status(400).json({ error: 'serializedData is required' });

        // Update existing or create new
        const model = await MLModel.findOneAndUpdate(
            { userId: req.userId, modelType: 'delay_predictor' },
            { serializedData, timestamp: new Date() },
            { upsert: true, new: true }
        );

        res.status(201).json({ message: 'Model saved successfully', timestamp: model.timestamp });
    } catch (err) {
        next(err);
    }
}

async function loadModel(req, res, next) {
    try {
        const model = await MLModel.findOne({ userId: req.userId, modelType: 'delay_predictor' });
        if (!model) return res.status(404).json({ error: 'No trained model found for this user' });

        res.json(model.serializedData);
    } catch (err) {
        next(err);
    }
}

module.exports = { saveModel, loadModel };
