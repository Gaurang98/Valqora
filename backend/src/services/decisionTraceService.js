/**
 * Valqora Decision Trace Service
 *
 * Produces a deterministic, ordered audit trail for a recovery opportunity.
 * The trace is observational: it records AI advisory output, authoritative
 * policy decisions, human review outcomes, recovery actions, verification,
 * and final revenue recovered. It never creates a synthetic successful recovery
 * without evidence from the policy/simulator/verification layers.
 */

function normalizeTraceStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();

  const allowed = new Set([
    'COMPLETED',
    'APPROVED',
    'BLOCKED',
    'PENDING',
    'REJECTED',
    'SUCCESS',
    'FAILED',
    'VERIFIED',
    'NOT_EXECUTED',
    'ESCALATED',
  ]);

  return allowed.has(normalized) ? normalized : 'COMPLETED';
}

function asSafeMoney(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function createTraceEvent({ step, type, status, data = {}, timestamp = null }) {
  return {
    step,
    type: String(type || 'GENERIC_EVENT').toUpperCase(),
    status: normalizeTraceStatus(status),
    timestamp: timestamp || new Date().toISOString(),
    data: data && typeof data === 'object' ? { ...data } : { value: data },
  };
}

function buildDecisionTrace({
  opportunityId = null,
  transactionId = null,
  amount = 0,
  investigation = {},
  optimizerRecommendation = null,
  policy = {},
  review = null,
  simulation = null,
  verification = null,
  metrics = {},
  riskDetected = null,
} = {}) {
  const amountValue = asSafeMoney(amount);
  const policyDecision = policy && typeof policy === 'object' ? policy : {};
  const investigationData = investigation && typeof investigation === 'object' ? investigation : {};
  const reviewData = review && typeof review === 'object' ? review : {};
  const simulationData = simulation && typeof simulation === 'object' ? simulation : {};
  const verificationData = verification && typeof verification === 'object' ? verification : {};
  const metricsData = metrics && typeof metrics === 'object' ? metrics : {};

  const policyDecisionLabel = String(policyDecision.decision || 'BLOCKED').toUpperCase();
  const policyActionLabel = String(policyDecision.action || 'HUMAN_REVIEW').toUpperCase();
  const aiRecommendation = String(investigationData.aiDecision?.recommendedAction || investigationData.recommendedAction || 'WAIT').toUpperCase();
  const aiConfidence = Number(investigationData.aiDecision?.confidence ?? investigationData.confidence ?? 0);
  const mlProbability = Number(
    investigationData.mlPrediction?.recoveryProbability ??
    investigationData.recoveryProbability ??
    0
  );
  const rootCause = String(
    investigationData.aiDecision?.rootCause ||
    investigationData.rootCause ||
    investigationData.failure?.reason ||
    'Failure analyzed'
  );

  const events = [];
  const riskAmount = amountValue > 0 ? amountValue : 0;

  events.push(
    createTraceEvent({
      step: 1,
      type: 'RISK_DETECTED',
      status: 'COMPLETED',
      data: {
        amount: riskAmount,
        description: riskDetected || 'Revenue at risk identified for recovery review',
      },
    })
  );

  events.push(
    createTraceEvent({
      step: 2,
      type: 'AI_INVESTIGATION',
      status: 'COMPLETED',
      data: {
        rootCause,
        confidence: Number.isFinite(aiConfidence) ? Number(aiConfidence.toFixed(4)) : 0,
      },
    })
  );

  events.push(
    createTraceEvent({
      step: 3,
      type: 'RECOVERY_PREDICTION',
      status: 'COMPLETED',
      data: {
        probability: Number.isFinite(mlProbability) ? Number(mlProbability.toFixed(4)) : 0,
        model: investigationData.mlPrediction?.model || investigationData.model || 'RandomForestClassifier',
      },
    })
  );

  events.push(
    createTraceEvent({
      step: 4,
      type: 'AI_RECOMMENDATION',
      status: 'COMPLETED',
      data: {
        action: aiRecommendation,
        confidence: Number.isFinite(aiConfidence) ? Number(aiConfidence.toFixed(4)) : 0,
      },
    })
  );

  if (optimizerRecommendation && typeof optimizerRecommendation === 'object') {
    events.push(
      createTraceEvent({
        step: 5,
        type: 'REVENUE_OPTIMIZATION',
        status: 'COMPLETED',
        data: {
          bestAction: optimizerRecommendation.bestAction || 'NO_ACTION',
          bestExpectedRecovery: asSafeMoney(optimizerRecommendation.bestExpectedRecovery),
          candidateCount: Array.isArray(optimizerRecommendation.candidates)
            ? optimizerRecommendation.candidates.length
            : 0,
          reason: optimizerRecommendation.selectionReason || 'Candidate actions evaluated',
          isRecommendationOnly: true,
        },
      })
    );
  }

  events.push(
    createTraceEvent({
      step: 5,
      type: 'POLICY_EVALUATION',
      status: policyDecisionLabel === 'APPROVED' ? 'APPROVED' : policyDecisionLabel === 'BLOCKED' ? 'BLOCKED' : 'COMPLETED',
      data: {
        decision: policyDecisionLabel,
        action: policyActionLabel,
        reason: policyDecision.reason || 'No policy reason supplied',
        requiresHumanReview: Boolean(policyDecision.requiresHumanReview),
      },
    })
  );

  if (policyDecision.requiresHumanReview || reviewData && Object.keys(reviewData).length > 0) {
    const reviewStatus = String(reviewData.status || 'PENDING').toUpperCase();
    const reviewEvent = createTraceEvent({
      step: 6,
      type: 'HUMAN_REVIEW',
      status: reviewStatus === 'APPROVED' ? 'APPROVED' : reviewStatus === 'REJECTED' ? 'REJECTED' : 'PENDING',
      data: {
        reviewerDecision: reviewData.reviewerDecision || reviewStatus || 'PENDING',
        reason: reviewData.reason || policyDecision.reason || 'Manual review required',
      },
    });
    events.push(reviewEvent);
  }

  let recoveryStatus = 'NOT_EXECUTED';
  let recoveryAction = 'NOT_EXECUTED';
  let recoveryAmount = 0;

  if (policyDecisionLabel === 'BLOCKED') {
    recoveryStatus = 'NOT_EXECUTED';
    recoveryAction = 'NOT_EXECUTED';
    recoveryAmount = 0;
  } else if (reviewData && String(reviewData.status || '').toUpperCase() === 'REJECTED') {
    recoveryStatus = 'NOT_EXECUTED';
    recoveryAction = 'NOT_EXECUTED';
    recoveryAmount = 0;
  } else if (simulationData && Object.keys(simulationData).length > 0) {
    recoveryStatus = String(simulationData.status || 'NOT_EXECUTED').toUpperCase();
    recoveryAction = String(simulationData.action || 'NOT_EXECUTED').toUpperCase();
    recoveryAmount = asSafeMoney(simulationData.amountRecovered ?? 0);
  } else if (policyDecisionLabel === 'APPROVED') {
    recoveryStatus = 'NOT_EXECUTED';
    recoveryAction = 'NOT_EXECUTED';
    recoveryAmount = 0;
  }

  events.push(
    createTraceEvent({
      step: reviewData && Object.keys(reviewData).length > 0 ? 7 : 6,
      type: 'RECOVERY_ACTION',
      status: recoveryStatus,
      data: {
        action: recoveryAction,
        amountRecovered: recoveryAmount,
        message: simulationData.message || (recoveryStatus === 'NOT_EXECUTED' ? 'Recovery action was not executed' : 'Recovery action completed'),
      },
    })
  );

  let verificationStatus = 'NOT_EXECUTED';
  let verificationAmount = 0;

  if (verificationData && Object.keys(verificationData).length > 0) {
    const rawVerificationStatus = String(verificationData.status || 'NOT_EXECUTED').toUpperCase();
    verificationStatus = rawVerificationStatus === 'SUCCESS' ? 'VERIFIED' : rawVerificationStatus;
    verificationAmount = asSafeMoney(verificationData.amountRecovered ?? verificationData.recoveredAmount ?? 0);
  } else if (policyDecisionLabel === 'BLOCKED') {
    verificationStatus = 'BLOCKED';
  } else if (reviewData && String(reviewData.status || '').toUpperCase() === 'REJECTED') {
    verificationStatus = 'NOT_EXECUTED';
  } else if (recoveryStatus === 'NOT_EXECUTED') {
    verificationStatus = 'NOT_EXECUTED';
  }

  events.push(
    createTraceEvent({
      step: reviewData && Object.keys(reviewData).length > 0 ? 8 : 7,
      type: 'VERIFICATION',
      status: verificationStatus,
      data: {
        verified: verificationData.verified === true || verificationStatus === 'VERIFIED' || verificationStatus === 'SUCCESS',
        amountRecovered: verificationAmount,
        message: verificationData.message || 'Verification result recorded',
      },
    })
  );

  const finalRecoveredAmount = asSafeMoney(
    verificationData.amountRecovered ??
    verificationData.recoveredAmount ??
    metricsData.revenueRecovered ??
    metricsData.amountRecovered ??
    0
  );

  events.push(
    createTraceEvent({
      step: reviewData && Object.keys(reviewData).length > 0 ? 9 : 8,
      type: 'REVENUE_RECOVERED',
      status: finalRecoveredAmount > 0 ? 'COMPLETED' : 'COMPLETED',
      data: {
        amount: finalRecoveredAmount,
        source: verificationData.verified === true ? 'VERIFICATION' : 'ZERO_DUE_TO_POLICY_OR_FAILURE',
      },
    })
  );

  return {
    opportunityId: opportunityId || 'UNKNOWN_OPPORTUNITY',
    transactionId: transactionId || 'UNKNOWN_TXN',
    amount: amountValue,
    events: events.map((event, index) => ({
      ...event,
      step: index + 1,
    })),
  };
}

module.exports = {
  createTraceEvent,
  normalizeTraceStatus,
  buildDecisionTrace,
};
