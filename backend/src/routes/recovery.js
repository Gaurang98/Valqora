const express = require('express');
const { executeRecoveryHandler } = require('../controllers/recoveryController');

const router = express.Router();

router.post('/execute/:opportunityId', executeRecoveryHandler);

module.exports = router;
