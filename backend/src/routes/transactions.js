const express = require('express');
const router = express.Router();
const { getTransactions } = require('../controllers/transactionController');

/**
 * GET /api/transactions
 *
 * Query parameters:
 *   page  (integer, default 1)
 *   limit (integer, default 50, max 500)
 *
 * Returns:
 *   {
 *     "data":  [ ...transaction objects ],
 *     "page":  1,
 *     "limit": 50,
 *     "total": 100000
 *   }
 */
router.get('/', getTransactions);

module.exports = router;
