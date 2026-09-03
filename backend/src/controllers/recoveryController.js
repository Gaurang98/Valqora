const { investigateTransactionById } = require('../services/aiService');
const { evaluatePolicy } = require('../services/policyEngine');
const {
  mapPolicyActionToRecoveryAction,
  simulateRecoveryAction,
} = require('../services/recoverySimulator');
const { verifyRecovery } = require('../services/verificationService');
const { calculateRecoveryMetrics } = require('../services/recoveryMetricsService');
const {
  createReview,
  isReviewEligible,
  getReview,
  approveReview,
  rejectReview,
  listReviews,
} = require('../services/humanReviewService');
const { normalizeOpportunityId } = require('./investigationController');
const { buildDecisionTrace } = require('../services/decisionTraceService');
const { recordLearningOutcome } = require('../services/learningDatasetService');
const LearningRecord = require('../models/LearningRecord');
const { calculatePerformanceAnalytics } = require('../services/performanceAnalyticsService');
const { calculateRecoveryInsights } = require('../services/recoveryInsightsService');
const { calculateRecoveryIntelligence } = require('../services/recoveryIntelligenceService');
const { calculateModelImprovementReport } = require('../services/modelImprovementService');
const { evaluateActionCandidates } = require('../services/actionEvaluationService');

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

function buildActionEvaluationInput(investigationResult) {
  const context = investigationResult?.context || {};
  const failure = context.failure || {};
  const customer = context.customer || {};
  const mlPrediction = context.mlPrediction || {};

  return {
    opportunityId: context.opportunityId || investigationResult?.opportunityId,
    amount: context.amount,
    status: context.status,
    failureReason: failure.reason,
    retryCount: failure.retryCount,
    customerType: customer.customerType,
    recoveryProbability: mlPrediction.isAvailable ? mlPrediction.recoveryProbability : undefined,
    aiRecommendation: investigationResult?.decision?.recommendedAction,
  };
}

function evaluateOpportunityActions(investigationResult) {
  return evaluateActionCandidates(buildActionEvaluationInput(investigationResult));
}

exports.buildActionEvaluationInput = buildActionEvaluationInput;
exports.evaluateOpportunityActions = evaluateOpportunityActions;

function getLearningResult(verification) {
  if (verification?.verified === true) return 'RECOVERED';
  if (verification?.status === 'BLOCKED') return 'BLOCKED';
  if (verification?.status === 'FAILED') return 'FAILED';
  return 'NOT_RECOVERED';
}

async function recordRecoveryLearningData({ investigationResult, policy, verification }) {
  const context = investigationResult.context || {};
  const decision = investigationResult.decision || {};
  const recoveryAmount = Number(verification?.amountRecovered ?? 0);

  try {
    await recordLearningOutcome({
      opportunityId: investigationResult.opportunityId || context.opportunityId,
      action: policy?.action || decision.recommendedAction,
      predictedProbability: context.mlPrediction?.recoveryProbability,
      amount: context.amount,
      customerType: context.customer?.customerType,
      failureReason: context.failure?.reason,
      provider: context.provider?.name,
      retryCount: context.failure?.retryCount,
      actualResult: getLearningResult(verification),
      actualRecoveredAmount: verification?.verified === true ? recoveryAmount : 0,
      verified: verification?.verified === true,
      timestamp: context.timestamp,
    });
  } catch (error) {
    console.error('[recordRecoveryLearningData] Persistence failed:', error.message);
  }
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
    const optimizerRecommendation = evaluateOpportunityActions(investigationResult);
    const policyInput = buildPolicyInput(
      { ...investigationResult.decision, recommendedAction: optimizerRecommendation.bestAction },
      investigationResult.context
    );
    const policy = evaluatePolicy(policyInput);

    if (policy.decision === 'BLOCKED') {
      const verification = verifyRecovery({
        transaction: {
          status: investigationResult.context?.status || 'FAILED',
          amount: investigationResult.context?.amount,
        },
        action: policy.action,
        policyDecision: policy,
      });

      await recordRecoveryLearningData({ investigationResult, policy, verification });

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
        verification,
        policy,
        aiRecommendation: investigationResult.decision?.recommendedAction || 'WAIT',
        optimizerRecommendation,
        policyDecision: policy,
        finalAction: policy.decision === 'APPROVED' ? policy.action : policy.action,
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

    await recordRecoveryLearningData({ investigationResult, policy, verification });

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

exports.getRecoveryTraceHandler = async (req, res) => {
  try {
    const rawId = req.params.opportunityId || req.query?.opportunityId;
    const normalizedTxnId = normalizeOpportunityId(rawId);

    if (!normalizedTxnId) {
      return res.status(400).json({ success: false, error: 'Valid opportunity ID is required' });
    }

    const { investigateTransactionById } = require('../services/aiService');
    const { evaluatePolicy } = require('../services/policyEngine');
    const { listReviews } = require('../services/humanReviewService');

    const investigationResult = await investigateTransactionById(normalizedTxnId);
    const optimizerRecommendation = evaluateOpportunityActions(investigationResult);
    const policyInput = buildPolicyInput(
      { ...investigationResult.decision, recommendedAction: optimizerRecommendation.bestAction },
      investigationResult.context
    );
    const policy = evaluatePolicy(policyInput);
    const opportunityId = investigationResult.context?.opportunityId || normalizedTxnId;
    const transactionId = investigationResult.context?.transactionId || normalizedTxnId;

    const reviewList = listReviews();
    const review = reviewList.find((entry) => entry.transactionId === transactionId || entry.opportunityId === opportunityId) || null;

    const trace = buildDecisionTrace({
      opportunityId,
      transactionId,
      amount: investigationResult.context?.amount || 0,
      investigation: {
        ...investigationResult.context,
        aiDecision: investigationResult.decision,
      },
      policy,
      optimizerRecommendation,
      review,
      metrics: { revenueRecovered: 0 },
      riskDetected: 'Revenue risk detected for failed transaction review',
    });

    return res.status(200).json({ success: true, trace });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('not found')) {
      return res.status(404).json({ success: false, error: msg });
    }
    if (msg.includes('Successful transactions cannot be investigated')) {
      return res.status(400).json({ success: false, error: msg });
    }
    console.error('[getRecoveryTraceHandler] Error:', msg);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred while building the decision trace' });
  }
};

exports.getRecoveryMetricsHandler = async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');

    const failedTransactions = await Transaction.find({ status: 'FAILED' }).lean();
    const recoveryResults = [];

    for (const transaction of failedTransactions) {
      const transactionId = transaction.transaction_id;
      const context = {
        transactionId,
        amount: transaction.amount,
        status: transaction.status,
        failure: {
          reason: transaction.failure_reason,
          retryCount: transaction.retry_count,
        },
      };

      const decision = {
        recommendedAction: transaction.retry_count < 2 ? 'RETRY' : 'HUMAN_REVIEW',
        confidence: 0.8,
      };

      const policyInput = {
        status: context.status,
        amount: context.amount,
        retry_count: context.failure.retryCount,
        failure_reason: context.failure.reason,
        riskClassification: 'NORMAL',
        aiRecommendedAction: decision.recommendedAction,
        aiConfidence: decision.confidence,
      };

      const policy = evaluatePolicy(policyInput);
      if (policy.decision === 'BLOCKED') {
        recoveryResults.push({
          transaction,
          policy,
          verification: { verified: false, amountRecovered: 0 },
        });
        continue;
      }

      const action = mapPolicyActionToRecoveryAction(policy.action);
      const simulation = simulateRecoveryAction({
        action,
        transaction: {
          transactionId,
          amount: transaction.amount,
          retry_count: transaction.retry_count,
          status: transaction.status,
        },
        policyDecision: policy,
      });

      const verification = verifyRecovery({
        transaction: {
          status: transaction.status,
          amount: transaction.amount,
        },
        action,
        simulation,
        policyDecision: policy,
      });

      recoveryResults.push({
        transaction,
        policy,
        simulation,
        verification,
      });
    }

    const metrics = calculateRecoveryMetrics({
      transactions: failedTransactions,
      recoveryResults,
    });

    return res.status(200).json({
      success: true,
      metrics,
    });
  } catch (err) {
    console.error('[getRecoveryMetricsHandler] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred while calculating recovery metrics',
    });
  }
};

exports.getPerformanceAnalyticsHandler = async (req, res) => {
  try {
    const records = await LearningRecord.find().lean();
    const analytics = calculatePerformanceAnalytics(records, {
      action: req.query?.action,
      customer_type: req.query?.customer_type,
      failure_reason: req.query?.failure_reason,
      provider: req.query?.provider,
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
    });

    return res.status(200).json({ success: true, analytics });
  } catch (err) {
    console.error('[getPerformanceAnalyticsHandler] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to calculate performance analytics.',
    });
  }
};

exports.getRecoveryInsightsHandler = async (req, res) => {
  try {
    const records = await LearningRecord.find().lean();
    const insights = calculateRecoveryInsights(records);

    return res.status(200).json({ success: true, ...insights });
  } catch (err) {
    console.error('[getRecoveryInsightsHandler] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to calculate recovery insights.',
    });
  }
};

exports.getRecoveryIntelligenceHandler = async (req, res) => {
  try {
    const records = await LearningRecord.find().lean();
    const performanceAnalytics = calculatePerformanceAnalytics(records);
    const recoveryInsights = calculateRecoveryInsights(records);
    const intelligence = calculateRecoveryIntelligence({ performanceAnalytics, recoveryInsights });

    return res.status(200).json({ success: true, intelligence });
  } catch (err) {
    console.error('[getRecoveryIntelligenceHandler] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to calculate recovery intelligence.',
    });
  }
};

exports.getModelImprovementHandler = async (req, res) => {
  try {
    const records = await LearningRecord.find().lean();
    const performanceAnalytics = calculatePerformanceAnalytics(records);
    const recoveryInsights = calculateRecoveryInsights(records);
    const recoveryIntelligence = calculateRecoveryIntelligence({ performanceAnalytics, recoveryInsights });
    const report = calculateModelImprovementReport({
      performanceAnalytics,
      recoveryInsights,
      recoveryIntelligence,
    });

    return res.status(200).json({ success: true, report });
  } catch (err) {
    console.error('[getModelImprovementHandler] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to calculate model improvement feedback.',
    });
  }
};

exports.createHumanReviewHandler = async (req, res) => {
  try {
    const rawId = req.params.opportunityId || req.body?.opportunityId;
    const normalizedTxnId = normalizeOpportunityId(rawId);
    if (!normalizedTxnId) {
      return res.status(400).json({ success: false, error: 'Valid opportunity ID is required' });
    }

    const investigationResult = await investigateTransactionById(normalizedTxnId);
    const policyInput = buildPolicyInput(investigationResult.decision, investigationResult.context);
    const policy = evaluatePolicy(policyInput);

    if (policy.decision === 'APPROVED') {
      return res.status(200).json({
        success: true,
        review: null,
        message: 'This opportunity does not require human review',
      });
    }

    if (policy.decision === 'BLOCKED' && !isReviewEligible(policy)) {
      return res.status(200).json({
        success: true,
        review: null,
        status: 'BLOCKED',
        message: 'This action remains blocked by policy and cannot be reviewed for automatic recovery',
      });
    }

    const review = createReview({
      opportunityId: investigationResult.opportunityId || normalizedTxnId,
      transactionId: investigationResult.transactionId || normalizedTxnId,
      amount: investigationResult.context?.amount || 0,
      reason: policy.reason || 'Manual review required',
      aiRecommendation: investigationResult.decision?.recommendedAction || 'HUMAN_REVIEW',
      aiConfidence: Number(investigationResult.decision?.confidence ?? 0),
      policyDecision: policy,
    });

    return res.status(200).json({ success: true, review });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('not found')) {
      return res.status(404).json({ success: false, error: msg });
    }
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred while creating a human review' });
  }
};

exports.listHumanReviewsHandler = async (req, res) => {
  try {
    const status = req.query?.status;
    return res.status(200).json({ success: true, reviews: listReviews(status) });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred while listing reviews' });
  }
};

exports.approveHumanReviewHandler = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!reviewId) {
      return res.status(400).json({ success: false, error: 'Review ID is required' });
    }

    const review = approveReview(reviewId);
    return res.status(200).json({ success: true, review, message: 'Review approved' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Review approval failed' });
  }
};

exports.rejectHumanReviewHandler = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!reviewId) {
      return res.status(400).json({ success: false, error: 'Review ID is required' });
    }

    const review = rejectReview(reviewId);
    return res.status(200).json({ success: true, review, message: 'Review rejected' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Review rejection failed' });
  }
};
