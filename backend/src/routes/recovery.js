const express = require('express');
const { executeRecoveryHandler, getRecoveryMetricsHandler } = require('../controllers/recoveryController');

const router = express.Router();

router.post('/execute/:opportunityId', executeRecoveryHandler);
router.get('/metrics', getRecoveryMetricsHandler);

module.exports = router;
