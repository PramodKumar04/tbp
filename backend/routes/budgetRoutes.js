const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getBudget, updateBudget } = require('../controllers/budgetController');

router.get('/', auth, getBudget);
router.post('/', auth, updateBudget);

module.exports = router;
