const VesselPlan = require('../models/VesselPlan');
const SessionBudget = require('../models/SessionBudget');

async function saveVesselPlan(req, res, next) {
    try {
        const {
            vesselId, vesselName, origin, originCountry,
            destinationPort, destinationPortName, material, materialName,
            quantity, vesselAge, scheduledETA, actualETA, delayHours,
            status, berthAssigned, freightCost,
            portId, plantId, route, rakes, cost, cargo
        } = req.body;

        if (!vesselId || !vesselName || typeof cost !== 'number') {
            return res.status(400).json({ error: 'vesselId, vesselName and numeric cost required' });
        }

        const doc = new VesselPlan({
            userId: req.userId,
            vesselId, vesselName, origin, originCountry,
            destinationPort, destinationPortName, material, materialName,
            quantity, vesselAge, scheduledETA, actualETA, delayHours,
            status: status || 'berthed',
            berthAssigned, freightCost,
            portId, plantId, route, rakes, cost,
            cargo: cargo || { quantity, material }
        });
        await doc.save();

        // Update session budget: add cost
        try {
            const budget = await SessionBudget.findOne({ userId: req.userId }).sort({ timestamp: -1 });
            if (budget) {
                budget.baseCost = (budget.baseCost || 0) + (cost || 0);
                budget.budget = (budget.baseCost || 0) + (budget.penalties || 0) + (budget.delays || 0) - (budget.optimizations || 0);
                await budget.save();
            }
        } catch (e) {
            console.warn('[VesselPlan] budget update failed', e);
        }

        return res.status(201).json({ message: 'Vessel plan saved', plan: doc });
    } catch (err) {
        next(err);
    }
}

async function listPlans(req, res, next) {
    try {
        const plans = await VesselPlan.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(100);

        // Transform to Vessel Tracker format — handle both old (minimal) and new (full snapshot) records
        const trackerVessels = plans.map(p => {
            const cargo = p.cargo || {};

            // --- Fallback for old records that only have: vesselId, cargo, cost, route ---
            const vesselName = p.vesselName || `Vessel ${p.vesselId?.substring(0, 8) || 'Unknown'}`;
            const material   = p.material   || cargo.material  || 'coal';
            const materialName = p.materialName || (cargo.material ? cargo.material.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown');
            const quantity   = p.quantity   || cargo.quantity  || 0;
            const status     = p.status     || 'berthed';
            const scheduledETA = p.scheduledETA || p.timestamp || new Date();
            const actualETA  = p.actualETA  || scheduledETA;
            const destinationPortName = p.destinationPortName || p.portId || 'Port';

            return {
                id: p.vesselId,
                _dbId: p._id,
                name: vesselName,
                origin: p.origin     || 'International',
                originCountry: p.originCountry || '',
                destinationPort: p.destinationPort || p.portId || '',
                destinationPortName,
                material,
                materialName,
                quantity,
                vesselAge: p.vesselAge || 10,
                scheduledETA,
                actualETA,
                delayHours: p.delayHours || 0,
                status,
                berthAssigned: p.berthAssigned || 1,
                freightCost: p.freightCost || p.cost || 0,
                planned: true,
                planRoute: p.route   || {},
                planCost: p.cost     || 0,
                planTimestamp: p.timestamp,
            };
        });

        res.json({ count: plans.length, data: trackerVessels });
    } catch (err) {
        next(err);
    }
}

async function deletePlan(req, res, next) {
    try {
        const { id } = req.params;
        await VesselPlan.deleteOne({ _id: id, userId: req.userId });
        res.json({ message: 'Plan deleted' });
    } catch (err) {
        next(err);
    }
}

async function clearAllPlans(req, res, next) {
    try {
        const result = await VesselPlan.deleteMany({ userId: req.userId });
        res.json({ message: `Cleared ${result.deletedCount} vessel plans` });
    } catch (err) {
        next(err);
    }
}

module.exports = { saveVesselPlan, listPlans, deletePlan, clearAllPlans };
