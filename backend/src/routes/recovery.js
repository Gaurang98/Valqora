const express = require('express');
const {
  executeRecoveryHandler,
  getRecoveryMetricsHandler,
  createHumanReviewHandler,
  listHumanReviewsHandler,
  approveHumanReviewHandler,
  rejectHumanReviewHandler,
} = require('../controllers/recoveryController');

const router = express.Router();

router.post('/execute/:opportunityId', executeRecoveryHandler);
router.get('/metrics', getRecoveryMetricsHandler);
router.post('/reviews/:opportunityId', createHumanReviewHandler);
router.get('/reviews', listHumanReviewsHandler);
router.post('/reviews/:reviewId/approve', approveHumanReviewHandler);
router.post('/reviews/:reviewId/reject', rejectHumanReviewHandler);

module.exports = router;
