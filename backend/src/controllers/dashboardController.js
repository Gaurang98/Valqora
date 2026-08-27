const Transaction = require('../models/Transaction');

/**
 * GET /api/dashboard/summary
 * Return aggregate metrics from the transactions collection.
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const [summary] = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          successfulTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] },
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] },
          },
          revenueAtRisk: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'FAILED'] },
                    { $in: ['$is_recoverable', ['YES', 'POSSIBLY']] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalTransactions: 1,
          successfulTransactions: 1,
          failedTransactions: 1,
          totalRevenue: { $round: [{ $max: ['$totalRevenue', 0] }, 2] },
          revenueAtRisk: { $round: [{ $max: ['$revenueAtRisk', 0] }, 2] },
        },
      },
    ]);

    const metrics = summary || {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalRevenue: 0,
      revenueAtRisk: 0,
    };
    const total = metrics.totalTransactions;
    const successRate = total ? (metrics.successfulTransactions / total) * 100 : 0;
    const failureRate = total ? (metrics.failedTransactions / total) * 100 : 0;

    return res.status(200).json({
      ...metrics,
      recoverableRevenue: metrics.revenueAtRisk,
      successRate: Number(successRate.toFixed(2)),
      failureRate: Number(failureRate.toFixed(2)),
      activeOpportunities: metrics.failedTransactions,
    });
  } catch (err) {
    console.error('[getDashboardSummary] Unexpected error:', err.message);
    return res.status(500).json({ error: 'An unexpected server error occurred while fetching dashboard metrics.' });
  }
};