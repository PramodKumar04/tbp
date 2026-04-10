const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { saveSimulation, listHistory } = require('../controllers/simulationController');

router.post('/save', auth, saveSimulation);
router.get('/history', auth, listHistory);

module.exports = router;
