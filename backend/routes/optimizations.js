const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { saveOptimization, listOptimizations } = require('../controllers/optimizationController');

router.post('/', auth, saveOptimization);
router.get('/', auth, listOptimizations);

module.exports = router;
