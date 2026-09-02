const express = require('express');
const {
	getOpportunities,
	investigateOpportunityHandler,
	getActionEvaluationHandler,
} = require('../controllers/opportunityController');

const router = express.Router();

router.get('/', getOpportunities);
router.get('/:id/action-evaluation', getActionEvaluationHandler);
router.post('/investigate', investigateOpportunityHandler);
router.post('/:id/investigate', investigateOpportunityHandler);

module.exports = router;