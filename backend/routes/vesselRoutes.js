const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { saveVesselPlan, listPlans, lookupPlan, deletePlan, clearAllPlans } = require('../controllers/vesselController');

router.post('/plans', auth, saveVesselPlan);
router.get('/plans', auth, listPlans);
router.post('/plans/lookup', auth, lookupPlan);
router.delete('/plans/:id', auth, deletePlan);
router.delete('/plans', auth, clearAllPlans);

module.exports = router;
