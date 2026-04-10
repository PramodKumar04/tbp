const VesselPlan = require('../models/VesselPlan');
const SessionBudget = require('../models/SessionBudget');

function buildVesselSnapshot(body = {}) {
    const vesselId = body.vesselId || body.id || '';
    return {
        id: vesselId,
        vesselId,
        name: body.vesselName || body.name || `Vessel ${String(vesselId || 'Unknown').slice(0, 8)}`,
        origin: body.origin || 'International',
        originCountry: body.originCountry || '',
        destinationPort: body.destinationPort || '',
        destinationPortName: body.destinationPortName || '',
        material: body.material || '',
        materialName: body.materialName || '',
        quantity: Number(body.quantity || 0),
        vesselAge: Number(body.vesselAge || 0),
        scheduledETA: body.scheduledETA || null,
        actualETA: body.actualETA || null,
        delayHours: Number(body.delayHours || 0),
        status: body.status || 'berthed',
        berthAssigned: body.berthAssigned ?? 1,
        freightCost: Number(body.freightCost || 0),
    };
}

function buildRakeSnapshot(body = {}) {
    const route = body.route || {};
    const rake = body.rake || {};
    const rakeId = rake.id || route.id || body.rakeId || body.routeId || body.vesselId || '';

    return {
        id: rakeId,
        rakeId,
        rakeNumber: rake.rakeNumber || route.rakeNumber || route.routeId || body.rakeNumber || body.routeId || String(rakeId || 'RK'),
        fromPort: rake.fromPort || route.fromPort || body.portId || body.fromPort || '',
        toPlant: rake.toPlant || route.toPlant || body.plantId || body.toPlant || '',
        fromPortName: rake.fromPortName || route.fromPortName || '',
        toPlantName: rake.toPlantName || route.toPlantName || '',
        quantity: Number(rake.quantity || route.quantity || body.quantity || 0),
        cost: Number(rake.cost || route.cost || body.cost || 0),
        distance: Number(rake.distance || route.distance || 0),
        route,
    };
}

function serializePlan(p) {
    const cargo = p.cargo || {};
    const vessel = p.vessel && Object.keys(p.vessel).length > 0
        ? p.vessel
        : buildVesselSnapshot(p);
    const vesselName = p.vesselName || vessel.name || `Vessel ${p.vesselId?.substring(0, 8) || 'Unknown'}`;
    const material = p.material || cargo.material || vessel.material || 'coal';
    const materialName = p.materialName || vessel.materialName || (cargo.material ? cargo.material.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown');
    const quantity = p.quantity || cargo.quantity || vessel.quantity || 0;
    const status = p.status || vessel.status || 'berthed';
    const scheduledETA = p.scheduledETA || vessel.scheduledETA || p.timestamp || new Date();
    const actualETA = p.actualETA || vessel.actualETA || scheduledETA;
    const destinationPortName = p.destinationPortName || p.portId || vessel.destinationPortName || 'Port';
    const rake = p.rake && Object.keys(p.rake).length > 0
        ? p.rake
        : buildRakeSnapshot(p);
    const rakes = Number(p.rakes || cargo.rakes || rake.rakes || rake.quantity || 0);

    return {
        id: p.vesselId,
        _dbId: p._id,
        name: vesselName,
        origin: p.origin || vessel.origin || 'International',
        originCountry: p.originCountry || vessel.originCountry || '',
        destinationPort: p.destinationPort || p.portId || vessel.destinationPort || '',
        destinationPortName,
        material,
        materialName,
        quantity,
        vesselAge: p.vesselAge || vessel.vesselAge || 10,
        scheduledETA,
        actualETA,
        delayHours: p.delayHours || vessel.delayHours || 0,
        status,
        berthAssigned: p.berthAssigned || vessel.berthAssigned || 1,
        freightCost: p.freightCost || vessel.freightCost || p.cost || 0,
        planned: true,
        planRoute: p.route || {},
        planCost: p.cost || 0,
        rakes,
        routeName: p.route?.routeName || p.route?.selectedRoute?.routeName || p.route?.routeSnapshot?.routeName || '',
        planTimestamp: p.timestamp,
        vessel,
        rake,
    };
}

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

        const vessel = buildVesselSnapshot(req.body);
        const rake = buildRakeSnapshot(req.body);

        // 🗑️ Delete previous plan for this specific vessel (Reliability: Latest plan version only)
        await VesselPlan.deleteMany({ userId: req.userId, vesselId });

        const doc = new VesselPlan({
            userId: req.userId,
            vesselId, vesselName, origin, originCountry,
            destinationPort, destinationPortName, material, materialName,
            quantity, vesselAge, scheduledETA, actualETA, delayHours,
            status: status || 'berthed',
            berthAssigned, freightCost,
            portId, plantId, route, rakes, cost,
            cargo: cargo || { quantity, material },
            vessel,
            rake,
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
        const trackerVessels = plans.map(serializePlan);

        res.json({ count: plans.length, data: trackerVessels });
    } catch (err) {
        next(err);
    }
}

async function lookupPlan(req, res, next) {
    try {
        const { vesselId, rakeId } = req.body;
        if (!vesselId && !rakeId) return res.status(400).json({ error: 'vesselId or rakeId required' });

        let plan = null;
        if (vesselId) {
            plan = await VesselPlan.findOne({ userId: req.userId, vesselId }).sort({ timestamp: -1 });
        }

        if (!plan && rakeId) {
            const plans = await VesselPlan.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(100);
            plan = plans.find(p => {
                const rake = p.rake || {};
                const route = p.route || {};
                return [rake.id, rake.rakeId, rake.rakeNumber, route.id, route.rakeId, route.rakeNumber, p.vesselId]
                    .some(value => String(value) === String(rakeId));
            }) || null;
        }

        if (!plan) return res.status(404).json({ error: 'Vessel plan not found' });

        const serialized = serializePlan(plan);
        return res.json({
            ...serialized,
            source: serialized.origin,
            destination: serialized.destinationPortName,
        });
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

module.exports = { saveVesselPlan, listPlans, lookupPlan, deletePlan, clearAllPlans };
