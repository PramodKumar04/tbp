const SessionBudget = require('../models/SessionBudget');

async function getBudget(req, res, next) {
    try {
        const budget = await SessionBudget.findOne({ userId: req.userId }).sort({ timestamp: -1 });
        if (!budget) return res.json({ exists: false, budget: 0 });
        return res.json({ exists: true, budget });
    } catch (err) {
        next(err);
    }
}

async function updateBudget(req, res, next) {
    try {
        const { baseCost, penalties, delays, optimizations } = req.body;
        let budget = new SessionBudget({ userId: req.userId, baseCost, penalties, delays, optimizations });
        budget.budget = (baseCost || 0) + (penalties || 0) + (delays || 0) - (optimizations || 0);
        await budget.save();
        return res.json({ message: 'Budget updated', budget });
    } catch (err) {
        next(err);
    }
}

module.exports = { getBudget, updateBudget };
