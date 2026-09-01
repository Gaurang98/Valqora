const express = require('express');
const { getOpportunities, investigateOpportunityHandler } = require('../controllers/opportunityController');

const router = express.Router();

router.get('/', getOpportunities);
router.post('/investigate', investigateOpportunityHandler);
router.post('/:id/investigate', investigateOpportunityHandler);

module.exports = router;