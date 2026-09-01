/**
 * Valqora AI Investigation Routes
 *
 * Exposes:
 * POST /api/investigations/:opportunityId
 * POST /api/investigations
 */

const express = require('express');
const {
  investigateOpportunityByIdHandler,
  investigateOpportunityPayloadHandler,
} = require('../controllers/investigationController');

const router = express.Router();

// Direct investigation by opportunityId
router.post('/:opportunityId', investigateOpportunityByIdHandler);

// Investigation by request body payload
router.post('/', investigateOpportunityPayloadHandler);

module.exports = router;
