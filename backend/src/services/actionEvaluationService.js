/**
 * Valqora Action Evaluation Engine
 *
 * Pure deterministic service for evaluating candidate recovery actions for a
 * failed transaction/opportunity. It is not an execution engine, not an
 * authorization layer, and not an ML trainer. It only scores candidate actions
 * based on the available opportunity context and the existing ML probability
 * when present.
 */

const ACTIONS = Object.freeze([
  'RETRY',
  'PAYMENT_METHOD_UPDATE',
  'PAYMENT_LINK',
  'WAIT_AND_RETRY',
  'HUMAN_REVIEW',
  'NO_ACTION',
]);

function asNumber(value, defaultValue = NaN) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : defaultValue;
}

function normalizeAction(action) {
  return String(action || '').trim().toUpperCase();
}

function safeProbability(rawValue, fallback = 0) {
  const numeric = asNumber(rawValue, fallback);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return Number(numeric.toFixed(6));
}

function getBaseProbabilityForAction({ action, recoveryProbability, failureReason, retryCount, customerType }) {
  const normalizedAction = normalizeAction(action);
  const probability = safeProbability(recoveryProbability, 0);

  if (normalizedAction === 'RETRY') {
    if (failureReason === 'SUSPICIOUS_TRANSACTION') return 0.12;
    if (retryCount >= 2) return 0.12;
    return probability > 0 ? probability : 0.78;
  }

  if (normalizedAction === 'PAYMENT_METHOD_UPDATE') {
    if (failureReason === 'INVALID_CARD' || failureReason === 'PAYMENT_METHOD_EXPIRED') {
      return probability > 0 ? probability : 0.72;
    }
    return probability > 0 ? probability : 0.44;
  }

  if (normalizedAction === 'PAYMENT_LINK') {
    if (customerType === 'HIGH_VALUE') return probability > 0 ? probability : 0.58;
    return probability > 0 ? probability : 0.52;
  }

  if (normalizedAction === 'WAIT_AND_RETRY') {
    if (retryCount >= 1) return probability > 0 ? probability : 0.4;
    return probability > 0 ? probability : 0.36;
  }

  if (normalizedAction === 'HUMAN_REVIEW') {
    if (failureReason === 'SUSPICIOUS_TRANSACTION') {
      return probability > 0 ? probability : 0.88;
    }
    return probability > 0 ? probability : 0.7;
  }

  if (normalizedAction === 'NO_ACTION') {
    return 0;
  }

  return 0;
}

function evaluateActionCandidates(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Action evaluation input must be a valid object');
  }

  const opportunityId = String(input.opportunityId || input.opportunity_id || '').trim();
  const amount = asNumber(input.amount ?? input.amountValue ?? input.value, NaN);
  const status = String(input.status || '').trim().toUpperCase();
  const failureReason = String(input.failureReason || input.failure_reason || '').trim().toUpperCase();
  const retryCount = asNumber(input.retryCount ?? input.retry_count ?? 0, 0);
  const customerType = String(input.customerType || input.customer_type || 'REGULAR').trim().toUpperCase();
  const baseRecoveryProbability = safeProbability(input.recoveryProbability ?? input.mlRecoveryProbability ?? input.mlPrediction?.recoveryProbability ?? 0, 0);
  const recommendedAction = normalizeAction(input.aiRecommendation ?? input.ai_recommended_action ?? input.recommendedAction ?? 'WAIT');

  if (!opportunityId) {
    throw new Error('Opportunity ID is required');
  }

  if (!['FAILED', 'PENDING'].includes(status) && status !== '') {
    throw new Error('Invalid transaction status for action evaluation');
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid amount for action evaluation');
  }

  if (!Number.isFinite(retryCount) || retryCount < 0) {
    throw new Error('Invalid retry count for action evaluation');
  }

  if (status === 'SUCCESS') {
    throw new Error('Successful transactions cannot be evaluated for recovery optimization');
  }

  const candidateActions = ACTIONS.map((action) => {
    const normalizedAction = normalizeAction(action);
    const probability = getBaseProbabilityForAction({
      action: normalizedAction,
      recoveryProbability: normalizedAction === 'RETRY' ? baseRecoveryProbability : baseRecoveryProbability,
      failureReason,
      retryCount,
      customerType,
    });

    const expectedRecovery = Number((amount * probability).toFixed(2));

    return {
      action: normalizedAction,
      recoveryProbability: Number(probability.toFixed(6)),
      amount: Number(amount.toFixed(2)),
      expectedRecovery,
    };
  });

  const actionPriority = ['HUMAN_REVIEW', 'PAYMENT_LINK', 'PAYMENT_METHOD_UPDATE', 'RETRY', 'WAIT_AND_RETRY', 'NO_ACTION'];

  const bestCandidate = candidateActions.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    if (candidate.expectedRecovery > best.expectedRecovery) {
      return candidate;
    }

    if (candidate.expectedRecovery === best.expectedRecovery) {
      const candidatePriority = actionPriority.indexOf(candidate.action);
      const bestPriority = actionPriority.indexOf(best.action);

      if (candidatePriority !== -1 && (bestPriority === -1 || candidatePriority < bestPriority)) {
        return candidate;
      }
    }

    return best;
  }, null);

  const reason = `Selected ${bestCandidate.action} because it produced the highest expected recovery (${bestCandidate.expectedRecovery}) versus the remaining candidate actions.`;

  return {
    opportunityId,
    amount: Number(amount.toFixed(2)),
    candidates: candidateActions,
    bestAction: bestCandidate ? bestCandidate.action : 'NO_ACTION',
    bestExpectedRecovery: bestCandidate ? bestCandidate.expectedRecovery : 0,
    selectionReason: reason,
    decisionContext: {
      status,
      failureReason,
      retryCount,
      customerType,
      aiRecommendation: recommendedAction,
      baseRecoveryProbability: Number(baseRecoveryProbability.toFixed(6)),
    },
  };
}

module.exports = {
  ACTIONS,
  evaluateActionCandidates,
  safeProbability,
  getBaseProbabilityForAction,
};
