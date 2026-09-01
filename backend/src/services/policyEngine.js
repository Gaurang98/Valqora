/**
 * Valqora Policy Engine
 *
 * Deterministic, auditable, and provider-independent governance layer for AI
 * recommendations. The Policy Engine is responsible only for validating an
 * already-generated AI recommendation against hard-coded safety policies.
 *
 * It must never call an LLM, never modify the ML model, and never retrain.
 */

const POLICY_CONSTANTS = Object.freeze({
  RETRY_LIMIT: 2,
  MIN_AI_CONFIDENCE: 0.70,
  MAX_AUTO_RECOVERY_AMOUNT: 50000,
  ALLOWED_DECISIONS: Object.freeze(['APPROVED', 'BLOCKED']),
  ALLOWED_ACTIONS: Object.freeze(['RETRY', 'HUMAN_REVIEW']),
  ALLOWED_STATUSES: Object.freeze(['SUCCESS', 'FAILED']),
  ALLOWED_RISK_CLASSIFICATIONS: Object.freeze(['NORMAL', 'SUSPICIOUS_TRANSACTION']),
});

const FORBIDDEN_POLICY_INPUT_FIELDS = new Set([
  '_id',
  '__v',
  'is_recoverable',
  'ground_truth_action',
  'ground_truth_priority',
  'transaction_id',
  'customer_id',
  'apiKey',
  'api_key',
  'environment',
  'rawProviderResponse',
]);

function asString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value, defaultValue = NaN) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

function normalizePolicyInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const normalized = {};

  const statusValue = asString(
    input.status ?? input.transactionStatus ?? input.transaction_status ?? input.state
  );
  const amountValue = asNumber(input.amount ?? input.amountValue ?? input.transactionAmount, NaN);
  const retryCountValue = asNumber(input.retry_count ?? input.retryCount ?? 0, 0);
  const failureReasonValue = asString(
    input.failure_reason ?? input.failureReason ?? input.failureReasonCode
  );
  const riskClassificationValue = asString(
    input.riskClassification ?? input.risk_classification ?? input.riskStatus ?? input.risk
  );
  const aiRecommendedActionValue = asString(
    input.aiRecommendedAction ?? input.ai_recommended_action ?? input.recommendedAction ?? input.action
  );
  const aiConfidenceValue = asNumber(
    input.aiConfidence ?? input.ai_confidence ?? input.confidence ?? undefined,
    NaN
  );

  if (statusValue) normalized.status = statusValue.toUpperCase();
  if (!Number.isNaN(amountValue)) normalized.amount = amountValue;
  if (!Number.isNaN(retryCountValue)) normalized.retry_count = retryCountValue;
  if (failureReasonValue) normalized.failure_reason = failureReasonValue.toUpperCase();
  if (riskClassificationValue) normalized.riskClassification = riskClassificationValue.toUpperCase();
  if (aiRecommendedActionValue) normalized.aiRecommendedAction = aiRecommendedActionValue.toUpperCase();
  if (!Number.isNaN(aiConfidenceValue)) normalized.aiConfidence = aiConfidenceValue;

  Object.keys(input).forEach((key) => {
    if (FORBIDDEN_POLICY_INPUT_FIELDS.has(key)) {
      delete normalized[key];
    }
  });

  return normalized;
}

function buildApprovedDecision(reason, rulesEvaluated) {
  return {
    decision: 'APPROVED',
    action: 'RETRY',
    reason,
    requiresHumanReview: false,
    rulesEvaluated,
  };
}

function buildBlockedDecision(reason, rulesEvaluated, action = 'HUMAN_REVIEW') {
  return {
    decision: 'BLOCKED',
    action,
    reason,
    requiresHumanReview: true,
    rulesEvaluated,
  };
}

function evaluatePolicy(rawInput) {
  const input = normalizePolicyInput(rawInput);

  const status = asString(input.status).toUpperCase();
  const amount = asNumber(input.amount, NaN);
  const retryCount = asNumber(input.retry_count, NaN);
  const failureReason = asString(input.failure_reason).toUpperCase();
  const riskClassification = asString(input.riskClassification).toUpperCase();
  const aiRecommendedAction = asString(input.aiRecommendedAction).toUpperCase();
  const aiConfidence = asNumber(input.aiConfidence, NaN);

  const invalidInput =
    !POLICY_CONSTANTS.ALLOWED_STATUSES.includes(status) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(retryCount) ||
    retryCount < 0 ||
    status === 'FAILED' && !failureReason ||
    !riskClassification ||
    !aiRecommendedAction ||
    Number.isNaN(aiConfidence) ||
    aiConfidence < 0 ||
    aiConfidence > 1;

  if (invalidInput) {
    return buildBlockedDecision(
      'Missing or invalid safety-critical policy input; automatic recovery is denied by fail-closed validation',
      ['INVALID_POLICY_INPUT']
    );
  }

  if (status === 'SUCCESS') {
    return buildBlockedDecision(
      'Successful transactions cannot be automatically recovered',
      ['SUCCESS_TRANSACTION']
    );
  }

  if (riskClassification === 'SUSPICIOUS_TRANSACTION') {
    return buildBlockedDecision(
      'Transaction classified as suspicious; automatic recovery is not permitted',
      ['SUSPICIOUS_TRANSACTION']
    );
  }

  if (retryCount >= POLICY_CONSTANTS.RETRY_LIMIT) {
    return buildBlockedDecision(
      `Retry limit reached (${POLICY_CONSTANTS.RETRY_LIMIT}); RETRY is forbidden`,
      ['RETRY_LIMIT']
    );
  }

  if (amount > POLICY_CONSTANTS.MAX_AUTO_RECOVERY_AMOUNT) {
    return buildBlockedDecision(
      `Transaction exceeds automatic recovery limit of ${POLICY_CONSTANTS.MAX_AUTO_RECOVERY_AMOUNT}`,
      ['HIGH_VALUE_TRANSACTION']
    );
  }

  if (aiConfidence < POLICY_CONSTANTS.MIN_AI_CONFIDENCE) {
    return buildBlockedDecision(
      `AI confidence below minimum policy threshold (${POLICY_CONSTANTS.MIN_AI_CONFIDENCE})`,
      ['CONFIDENCE_THRESHOLD']
    );
  }

  const safeRetryApproved =
    status === 'FAILED' &&
    failureReason === 'BANK_TIMEOUT' &&
    retryCount < POLICY_CONSTANTS.RETRY_LIMIT &&
    riskClassification !== 'SUSPICIOUS_TRANSACTION' &&
    aiRecommendedAction === 'RETRY' &&
    aiConfidence >= POLICY_CONSTANTS.MIN_AI_CONFIDENCE &&
    amount <= POLICY_CONSTANTS.MAX_AUTO_RECOVERY_AMOUNT;

  if (safeRetryApproved) {
    return buildApprovedDecision(
      'Temporary failure and policy conditions satisfied',
      ['SAFE_TEMPORARY_FAILURE']
    );
  }

  return buildBlockedDecision(
    'Automatic recovery is denied because the safe retry conditions were not satisfied',
    ['SAFE_TEMPORARY_FAILURE']
  );
}

module.exports = {
  POLICY_CONSTANTS,
  normalizePolicyInput,
  evaluatePolicy,
  buildApprovedDecision,
  buildBlockedDecision,
};
