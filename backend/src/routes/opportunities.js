const express = require('express');
const { getOpportunities } = require('../controllers/opportunityController');

const router = express.Router();
router.get('/', getOpportunities);

module.exports = router;