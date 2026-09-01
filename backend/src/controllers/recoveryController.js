const { investigateTransactionById } = require('../services/aiService');
const { evaluatePolicy } = require('../services/policyEngine');
const {
  mapPolicyActionToRecoveryAction,
  simulateRecoveryAction,
} = require('../services/recoverySimulator');
const { verifyRecovery } = require('../services/verificationService');
const { normalizeOpportunityId } = require('./investigationController');

function buildPolicyInput(decision, context) {
  const failureReason = context?.failure?.reason || context?.failure_reason || 'UNKNOWN';
  const riskClassification = failureReason === 'SUSPICIOUS_TRANSACTION' ? 'SUSPICIOUS_TRANSACTION' : 'NORMAL';

  return {
    status: context?.status || 'FAILED',
    amount: context?.amount || 0,
    retry_count: context?.failure?.retryCount ?? context?.retry_count ?? 0,
    failure_reason: failureReason,
    riskClassification,
    aiRecommendedAction: decision?.recommendedAction || 'WAIT',
    aiConfidence: Number(decision?.confidence ?? 0),
  };
}

exports.executeRecoveryHandler = async (req, res) => {
  try {
    const rawId = req.params.opportunityId || req.body?.opportunityId;
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Opportunity ID is required',
      });
    }

    const normalizedTxnId = normalizeOpportunityId(rawId);
    if (!normalizedTxnId) {
      return res.status(400).json({
        success: false,
        error: `Invalid opportunity ID format: "${rawId}"`,
      });
    }

    const investigationResult = await investigateTransactionById(normalizedTxnId);
    const policyInput = buildPolicyInput(investigationResult.decision, investigationResult.context);
    const policy = evaluatePolicy(policyInput);

    if (policy.decision === 'BLOCKED') {
      return res.status(200).json({
        success: true,
        simulation: {
          simulated: true,
          executed: false,
          action: 'BLOCKED',
          status: 'BLOCKED',
          amountRecovered: 0,
          message: 'Recovery action blocked by policy',
        },
        verification: {
          verified: false,
          status: 'BLOCKED',
          action: 'BLOCKED',
          previousStatus: String(investigationResult.context?.status || 'FAILED').toUpperCase(),
          currentStatus: String(investigationResult.context?.status || 'FAILED').toUpperCase(),
          amountRecovered: 0,
          message: 'Recovery action blocked by policy',
        },
        policy,
      });
    }

    const recoveryAction = mapPolicyActionToRecoveryAction(policy.action);
    const simulation = simulateRecoveryAction({
      action: recoveryAction,
      transaction: {
        transactionId: investigationResult.context.transactionId,
        transaction_id: investigationResult.context.transactionId,
        amount: investigationResult.context.amount,
        retry_count: investigationResult.context.failure.retryCount,
        status: investigationResult.context.status,
      },
      policyDecision: policy,
    });

    const verification = verifyRecovery({
      transaction: {
        status: investigationResult.context?.status || 'FAILED',
        amount: investigationResult.context?.amount,
      },
      action: recoveryAction,
      simulation,
      policyDecision: policy,
    });

    return res.status(200).json({
      success: true,
      simulation,
      verification,
      policy,
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('not found')) {
      return res.status(404).json({ success: false, error: msg });
    }
    if (msg.includes('Successful transactions cannot be investigated')) {
      return res.status(400).json({ success: false, error: msg });
    }
    console.error('[executeRecoveryHandler] Error:', msg);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred while simulating recovery',
    });
  }
};
