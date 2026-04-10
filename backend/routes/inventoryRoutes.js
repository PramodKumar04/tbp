const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Inventory = require('../models/Inventory');

// 📥 Get all inventory for user
router.get('/', auth, async (req, res) => {
    try {
        const data = await Inventory.find({ userId: req.userId });
        res.json({ count: data.length, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 💾 Save/Update inventory record
router.post('/', auth, async (req, res) => {
    try {
        const { plant, material, currentLevel, safetyStock, dailyConsumption } = req.body;
        
        if (!plant || !material) {
            return res.status(400).json({ error: 'Plant and material are required' });
        }

        const update = {
            currentLevel: parseFloat(currentLevel || 0),
            safetyStock: parseFloat(safetyStock || 0),
            dailyConsumption: parseFloat(dailyConsumption || 0),
            updatedAt: new Date()
        };

        const doc = await Inventory.findOneAndUpdate(
            { userId: req.userId, plant, material },
            { $set: update },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: '✅ Inventory saved', data: doc });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
