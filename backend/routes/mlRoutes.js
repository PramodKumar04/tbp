const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { saveModel, loadModel } = require('../controllers/mlController');

router.post('/save', auth, saveModel);
router.get('/load', auth, loadModel);

module.exports = router;
