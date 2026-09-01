const express = require('express');
const {
  executeRecoveryHandler,
  getRecoveryMetricsHandler,
  getRecoveryTraceHandler,
  createHumanReviewHandler,
  listHumanReviewsHandler,
  approveHumanReviewHandler,
  rejectHumanReviewHandler,
} = require('../controllers/recoveryController');

const router = express.Router();

router.post('/execute/:opportunityId', executeRecoveryHandler);
router.get('/metrics', getRecoveryMetricsHandler);
router.get('/:opportunityId/trace', getRecoveryTraceHandler);
router.post('/reviews/:opportunityId', createHumanReviewHandler);
router.get('/reviews', listHumanReviewsHandler);
router.post('/reviews/:reviewId/approve', approveHumanReviewHandler);
router.post('/reviews/:reviewId/reject', rejectHumanReviewHandler);

module.exports = router;
