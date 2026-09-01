/**
 * Valqora Human Review Service
 *
 * Deterministic, auditable review queue for policy-required manual approval.
 * It does not bypass policy, execute payments, or simulate recovery on its own.
 */

const REVIEW_STATES = Object.freeze(['PENDING', 'APPROVED', 'REJECTED']);
const REVIEWABLE_RULES = new Set(['HIGH_VALUE_TRANSACTION', 'CONFIDENCE_THRESHOLD']);
const HARD_BLOCK_RULES = new Set([
  'SUSPICIOUS_TRANSACTION',
  'RETRY_LIMIT',
  'INVALID_POLICY_INPUT',
  'SUCCESS_TRANSACTION',
]);

const reviews = new Map();
let reviewSequence = 1;

function normalizeStatus(status) {
  const value = String(status || '').toUpperCase();
  return REVIEW_STATES.includes(value) ? value : 'PENDING';
}

function isHardBlock(policyDecision = {}) {
  const reason = String(policyDecision?.reason || '').toUpperCase();
  if (!reason) {
    return false;
  }

  const hardBlockPatterns = [
    'SUSPICIOUS_TRANSACTION',
    'SUSPICIOUS',
    'RETRY_LIMIT',
    'RETRY LIMIT',
    'INVALID_POLICY_INPUT',
    'INVALID POLICY INPUT',
    'SUCCESS_TRANSACTION',
    'SUCCESSFUL TRANSACTION',
    'SUCCESSFUL TRANSACTIONS',
  ];

  return hardBlockPatterns.some((pattern) => reason.includes(pattern));
}

function isReviewEligible(policyDecision = {}) {
  if (!policyDecision || typeof policyDecision !== 'object') {
    return false;
  }

  if (policyDecision.decision !== 'BLOCKED') {
    return false;
  }

  if (policyDecision.requiresHumanReview !== true) {
    return false;
  }

  if (String(policyDecision.action || '').toUpperCase() !== 'HUMAN_REVIEW') {
    return false;
  }

  if (isHardBlock(policyDecision)) {
    return false;
  }

  const ruleCodes = new Set(
    Array.isArray(policyDecision.rulesEvaluated)
      ? policyDecision.rulesEvaluated.map((rule) => String(rule || '').toUpperCase())
      : []
  );

  const reason = String(policyDecision.reason || '').toUpperCase();
  if (!reason && ruleCodes.size === 0) {
    return false;
  }

  const directRuleMatch = Array.from(REVIEWABLE_RULES).some(
    (rule) => ruleCodes.has(rule) || reason.includes(rule)
  );

  if (directRuleMatch) {
    return true;
  }

  return reason.includes('AUTOMATIC RECOVERY LIMIT') || reason.includes('CONFIDENCE BELOW MINIMUM POLICY THRESHOLD');
}

function createReview({
  opportunityId,
  transactionId,
  amount = 0,
  reason = '',
  aiRecommendation = 'HUMAN_REVIEW',
  aiConfidence = 0,
  policyDecision = null,
  reviewerDecision = null,
} = {}) {
  if (!opportunityId || !transactionId) {
    throw new Error('opportunityId and transactionId are required');
  }

  const normalizedPolicyDecision = policyDecision || {};
  if (!isReviewEligible(normalizedPolicyDecision)) {
    throw new Error('This policy decision does not qualify for human review');
  }

  const reviewId = `REV_${reviewSequence++}_${String(opportunityId).replace(/\s+/g, '_').toUpperCase()}`;
  const review = {
    reviewId,
    opportunityId: String(opportunityId),
    transactionId: String(transactionId),
    amount: Number(amount || 0),
    reason: String(reason || normalizedPolicyDecision.reason || 'Manual review required'),
    aiRecommendation: String(aiRecommendation || 'HUMAN_REVIEW').toUpperCase(),
    aiConfidence: Number(aiConfidence ?? 0),
    policyDecision: String(normalizedPolicyDecision.decision || 'BLOCKED').toUpperCase(),
    policyAction: String(normalizedPolicyDecision.action || 'HUMAN_REVIEW').toUpperCase(),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewerDecision: reviewerDecision ? String(reviewerDecision).toUpperCase() : null,
  };

  reviews.set(reviewId, review);
  return { ...review };
}

function getReview(reviewId) {
  const review = reviews.get(reviewId);
  if (!review) {
    return null;
  }
  return { ...review };
}

function listReviews(status = null) {
  const entries = Array.from(reviews.values()).map((review) => ({ ...review }));
  if (!status) {
    return entries;
  }

  const desired = normalizeStatus(status);
  return entries.filter((review) => review.status === desired);
}

function voteReview(reviewId, decision, allowedStatuses = ['APPROVED', 'REJECTED']) {
  const review = reviews.get(reviewId);
  if (!review) {
    throw new Error(`Review not found: ${reviewId}`);
  }

  const normalizedDecision = String(decision || '').toUpperCase();
  if (!allowedStatuses.includes(normalizedDecision)) {
    throw new Error(`Invalid reviewer decision: ${decision}`);
  }

  if (review.status === 'APPROVED' && normalizedDecision === 'REJECTED') {
    throw new Error('A previously approved review cannot be rejected');
  }

  if (review.status === 'REJECTED') {
    throw new Error('A rejected review cannot be changed');
  }

  if (review.status === 'APPROVED' && normalizedDecision === 'APPROVED') {
    throw new Error('This review is already approved');
  }

  if (review.status !== 'PENDING') {
    throw new Error('Only pending reviews can be acted on');
  }

  review.status = normalizedDecision;
  review.reviewedAt = new Date().toISOString();
  review.reviewerDecision = normalizedDecision;

  reviews.set(reviewId, review);
  return { ...review };
}

function approveReview(reviewId, reviewerDecision = 'APPROVED') {
  return voteReview(reviewId, reviewerDecision, ['APPROVED']);
}

function rejectReview(reviewId, reviewerDecision = 'REJECTED') {
  return voteReview(reviewId, reviewerDecision, ['REJECTED']);
}

module.exports = {
  REVIEW_STATES,
  REVIEWABLE_RULES,
  HARD_BLOCK_RULES,
  isReviewEligible,
  createReview,
  getReview,
  listReviews,
  approveReview,
  rejectReview,
};
