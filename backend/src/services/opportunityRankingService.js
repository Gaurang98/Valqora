/**
 * Valqora Opportunity Ranking Engine
 *
 * Pure deterministic prioritization over action-evaluation results. This
 * service ranks recommendations only; it does not authorize or execute them.
 */

const { evaluateActionCandidates } = require('./actionEvaluationService');

const PRIORITY_URGENCY = Object.freeze({
  CRITICAL: 1,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.35,
  NONE: 0,
});

const CUSTOMER_TYPE_VALUE = Object.freeze({
  HIGH_VALUE: 1,
  REGULAR: 0.7,
  NEW: 0.5,
});

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function round(value, decimals = 6) {
  return Number(value.toFixed(decimals));
}

function readFactor(value, fieldName) {
  const factor = toFiniteNumber(value);
  if (!Number.isFinite(factor) || factor < 0 || factor > 1) {
    throw new Error(`Invalid ${fieldName}; expected a finite number between 0 and 1`);
  }
  return factor;
}

function getUrgency(opportunity) {
  if (opportunity.urgency !== undefined) return readFactor(opportunity.urgency, 'urgency');

  const priority = String(opportunity.priority || '').trim().toUpperCase();
  if (priority && Object.prototype.hasOwnProperty.call(PRIORITY_URGENCY, priority)) {
    return PRIORITY_URGENCY[priority];
  }

  return 0.5;
}

function getCustomerValue(opportunity) {
  if (opportunity.customerValue !== undefined) return readFactor(opportunity.customerValue, 'customer value');

  const lifetimeValue = toFiniteNumber(
    opportunity.customerLifetimeValue ?? opportunity.customer_lifetime_value
  );
  if (Number.isFinite(lifetimeValue)) {
    if (lifetimeValue < 0) throw new Error('Invalid customer lifetime value');
    return round(Math.min(lifetimeValue / 150000, 1));
  }

  const customerType = String(opportunity.customerType || opportunity.customer_type || 'REGULAR')
    .trim()
    .toUpperCase();
  return CUSTOMER_TYPE_VALUE[customerType] ?? 0.7;
}

function getConfidence(opportunity, evaluation) {
  const confidence = opportunity.confidence
    ?? opportunity.aiConfidence
    ?? opportunity.ai_confidence
    ?? opportunity.aiDecision?.confidence
    ?? opportunity.aiDecision?.confidenceScore;

  if (confidence !== undefined) return readFactor(confidence, 'confidence');

  // The evaluator is still usable without AI confidence, but ranking remains
  // conservative and explicit about the deterministic fallback.
  return 0.5;
}

function validateEvaluation(evaluation, opportunityId) {
  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    throw new Error(`Missing action evaluation for opportunity ${opportunityId}`);
  }

  if (!Array.isArray(evaluation.candidates) || evaluation.candidates.length === 0) {
    throw new Error(`Invalid action evaluation for opportunity ${opportunityId}`);
  }

  for (const candidate of evaluation.candidates) {
    const probability = toFiniteNumber(candidate.recoveryProbability);
    const expectedRecovery = toFiniteNumber(candidate.expectedRecovery);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new Error(`Invalid recovery probability for opportunity ${opportunityId}`);
    }
    if (!Number.isFinite(expectedRecovery) || expectedRecovery < 0) {
      throw new Error(`Invalid expected recovery for opportunity ${opportunityId}`);
    }
  }

  const bestCandidate = evaluation.candidates.reduce((best, candidate) => (
    !best || candidate.expectedRecovery > best.expectedRecovery ? candidate : best
  ), null);

  return {
    bestAction: bestCandidate?.action || 'NO_ACTION',
    bestExpectedRecovery: round(bestCandidate?.expectedRecovery || 0, 2),
  };
}

function rankOpportunity(opportunity, evaluation = undefined) {
  if (!opportunity || typeof opportunity !== 'object' || Array.isArray(opportunity)) {
    throw new Error('Opportunity is required for ranking');
  }

  const opportunityId = String(opportunity.opportunityId || opportunity.opportunity_id || '').trim();
  if (!opportunityId) throw new Error('Opportunity ID is required for ranking');

  const amount = toFiniteNumber(opportunity.amount ?? opportunity.value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid amount for opportunity ${opportunityId}`);

  const actionEvaluation = evaluation === undefined
    ? (opportunity.actionEvaluation || evaluateActionCandidates(opportunity))
    : evaluation;
  const evaluated = validateEvaluation(actionEvaluation, opportunityId);
  const rankingFactors = {
    expectedRecovery: evaluated.bestExpectedRecovery,
    urgency: round(getUrgency(opportunity)),
    customerValue: round(getCustomerValue(opportunity)),
    confidence: round(getConfidence(opportunity, actionEvaluation)),
  };
  const priorityScore = round(
    rankingFactors.expectedRecovery
      * rankingFactors.urgency
      * rankingFactors.customerValue
      * rankingFactors.confidence,
    6
  );

  return {
    opportunityId,
    amount: round(amount, 2),
    bestAction: evaluated.bestAction,
    bestExpectedRecovery: evaluated.bestExpectedRecovery,
    priorityScore: Number.isFinite(priorityScore) ? priorityScore : 0,
    rankingFactors,
    rankingReason: `Priority score combines expected recovery (${rankingFactors.expectedRecovery}), urgency (${rankingFactors.urgency}), customer value (${rankingFactors.customerValue}), and confidence (${rankingFactors.confidence}).`,
  };
}

function rankOpportunities(opportunities = []) {
  if (!Array.isArray(opportunities)) throw new Error('Opportunities must be an array');

  const rankedOpportunities = opportunities.map((opportunity) => rankOpportunity(
    opportunity,
    opportunity?.actionEvaluation
  ));

  rankedOpportunities.sort((left, right) => (
    right.priorityScore - left.priorityScore
      || right.bestExpectedRecovery - left.bestExpectedRecovery
      || (toFiniteNumber(right.amount) || 0) - (toFiniteNumber(left.amount) || 0)
      || left.opportunityId.localeCompare(right.opportunityId)
  ));

  return {
    rankedOpportunities,
    topOpportunityId: rankedOpportunities[0]?.opportunityId || null,
  };
}

module.exports = {
  PRIORITY_URGENCY,
  CUSTOMER_TYPE_VALUE,
  rankOpportunity,
  rankOpportunities,
};
