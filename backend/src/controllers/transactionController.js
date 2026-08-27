const Transaction = require('../models/Transaction');

/**
 * GET /api/transactions
 *
 * Returns paginated transaction records from MongoDB.
 *
 * Query parameters:
 *   page  (integer ≥ 1, default 1)
 *   limit (integer 1-500, default 50)
 *
 * Response shape:
 *   {
 *     "data":  [ ...transaction objects ],
 *     "page":  1,
 *     "limit": 50,
 *     "total": 100000
 *   }
 */
exports.getTransactions = async (req, res) => {
  try {
    // ── Parse & clamp pagination params ──────────────────────────────────────
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1) limit = 50;
    if (limit > 500) limit = 500; // hard ceiling — never return unlimited records

    const skip = (page - 1) * limit;

    // ── Query MongoDB in parallel ─────────────────────────────────────────────
    const [data, total] = await Promise.all([
      Transaction.find({})
        .sort({ timestamp: -1 })  // most-recent first
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({}),
    ]);

    return res.status(200).json({
      data,
      page,
      limit,
      total,
    });
  } catch (err) {
    console.error('[getTransactions] Unexpected error:', err.message);
    return res.status(500).json({
      error: 'An unexpected server error occurred while fetching transactions.',
    });
  }
};
