/**
 * Valqora AI Investigation Controller
 *
 * Exposes the AI Investigation Engine API:
 * POST /api/investigations/:opportunityId
 *
 * Connects the route request to the investigation and ML pipeline:
 * Opportunity -> Context -> ML Inference -> AI Advisory -> Validated Output
 */

const { investigateTransactionById, investigateOpportunity } = require('../services/aiService');
const { buildInvestigationContext } = require('../services/investigationService');

/**
 * Normalizes and extracts the underlying transaction ID from an opportunity ID.
 *
 * @param {string} rawId - Input opportunity or transaction ID
 * @returns {string|null} Normalized transaction ID or null if invalid
 */
function normalizeOpportunityId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed || trimmed.length < 3 || /[^a-zA-Z0-9_-]/.test(trimmed)) {
    return null;
  }
  // Strip OPP_ prefix if present
  if (trimmed.startsWith('OPP_')) {
    const withoutPrefix = trimmed.substring(4);
    return withoutPrefix.startsWith('TXN_') ? withoutPrefix : `TXN_${withoutPrefix}`;
  }
  return trimmed.startsWith('TXN_') ? trimmed : `TXN_${trimmed}`;
}

/**
 * POST /api/investigations/:opportunityId
 * Investigates a specific recovery opportunity by ID.
 */
exports.investigateOpportunityByIdHandler = async (req, res) => {
  try {
    const rawId = req.params.opportunityId || req.body?.opportunityId;

    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Opportunity ID is required in URL path or request body',
      });
    }

    const normalizedTxnId = normalizeOpportunityId(rawId);
    if (!normalizedTxnId) {
      return res.status(400).json({
        success: false,
        error: `Invalid opportunity ID format: "${rawId}"`,
      });
    }

    // Run AI & ML investigation by transaction ID from database
    const investigationResult = await investigateTransactionById(normalizedTxnId);

    // Format clean public response without DB internals or ground truth
    return res.status(200).json({
      success: true,
      investigation: {
        opportunityId: investigationResult.context.opportunityId,
        transactionId: investigationResult.context.transactionId,
        mlPrediction: {
          recoveryProbability: investigationResult.context.mlPrediction.recoveryProbability,
          isAvailable: investigationResult.context.mlPrediction.isAvailable,
          model: investigationResult.context.mlPrediction.model,
          ...(investigationResult.context.mlPrediction.reason
            ? { reason: investigationResult.context.mlPrediction.reason }
            : {}),
        },
        aiDecision: investigationResult.decision,
      },
    });
  } catch (err) {
    const msg = err.message || '';

    // Handle not found
    if (msg.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: msg,
      });
    }

    // Handle successful transaction rejection
    if (msg.includes('Successful transactions cannot be investigated')) {
      return res.status(400).json({
        success: false,
        error: msg,
      });
    }

    // Handle AI contract validation failure
    if (msg.includes('AI decision') || msg.includes('Safety violation') || msg.includes('Invalid recoverability')) {
      console.error('[investigateOpportunityByIdHandler] AI Contract Error:', msg);
      return res.status(502).json({
        success: false,
        error: 'AI diagnostic output failed validation safety checks',
      });
    }

    // Generic safe error
    console.error('[investigateOpportunityByIdHandler] Unexpected Error:', msg);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during opportunity investigation',
    });
  }
};

/**
 * POST /api/investigations
 * Investigates an opportunity from a provided transaction payload (useful for testing & offline mode).
 */
exports.investigateOpportunityPayloadHandler = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transaction payload or opportunityId is required in request body',
      });
    }

    // If request contains opportunityId only, forward to ID handler
    if (payload.opportunityId && !payload.amount && !payload.failure_reason) {
      req.params.opportunityId = payload.opportunityId;
      return exports.investigateOpportunityByIdHandler(req, res);
    }

    const investigationResult = await investigateOpportunity(payload);

    return res.status(200).json({
      success: true,
      investigation: {
        opportunityId: investigationResult.context.opportunityId,
        transactionId: investigationResult.context.transactionId,
        mlPrediction: {
          recoveryProbability: investigationResult.context.mlPrediction.recoveryProbability,
          isAvailable: investigationResult.context.mlPrediction.isAvailable,
          model: investigationResult.context.mlPrediction.model,
          ...(investigationResult.context.mlPrediction.reason
            ? { reason: investigationResult.context.mlPrediction.reason }
            : {}),
        },
        aiDecision: investigationResult.decision,
      },
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Successful transactions cannot be investigated')) {
      return res.status(400).json({ success: false, error: msg });
    }
    if (msg.includes('Transaction amount must be a positive number') || msg.includes('valid transaction_id')) {
      return res.status(400).json({ success: false, error: msg });
    }
    console.error('[investigateOpportunityPayloadHandler] Error:', msg);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during investigation',
    });
  }
};
