const LearningRecord = require('../models/LearningRecord');
const { LEARNING_ACTIONS, LEARNING_RESULTS } = require('../models/LearningRecord');

function readNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid ${fieldName}`);
  return number;
}

function normalizeTimestamp(value) {
  const timestamp = value === undefined ? new Date() : new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new Error('Invalid timestamp');
  return timestamp;
}

function buildIdempotencyKey({ opportunityId, action, retryCount }) {
  return `${opportunityId}|${action}|${retryCount}`;
}

function normalizeLearningRecord(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Learning record input must be a valid object');
  }

  const opportunityId = String(input.opportunity_id ?? input.opportunityId ?? '').trim();
  const action = String(input.action || '').trim().toUpperCase();
  const customerType = String(input.customer_type ?? input.customerType ?? '').trim().toUpperCase();
  const failureReason = String(input.failure_reason ?? input.failureReason ?? '').trim().toUpperCase();
  const provider = String(input.provider || '').trim();
  const predictedProbability = readNumber(input.predicted_probability ?? input.predictedProbability, 'predicted probability');
  const amount = readNumber(input.amount, 'amount');
  const retryCount = readNumber(input.retry_count ?? input.retryCount, 'retry count');
  const actualRecoveredAmount = readNumber(
    input.actual_recovered_amount ?? input.actualRecoveredAmount,
    'actual recovered amount'
  );
  const actualResult = String(input.actual_result ?? input.actualResult ?? '').trim().toUpperCase();
  const verified = input.verified === true;

  if (!opportunityId) throw new Error('Opportunity ID is required');
  if (!LEARNING_ACTIONS.includes(action)) throw new Error('Invalid learning action');
  if (!Number.isFinite(predictedProbability) || predictedProbability < 0 || predictedProbability > 1) {
    throw new Error('Invalid predicted probability');
  }
  if (amount < 0) throw new Error('Invalid amount');
  if (!customerType) throw new Error('Customer type is required');
  if (!failureReason) throw new Error('Failure reason is required');
  if (!provider) throw new Error('Provider is required');
  if (retryCount < 0) throw new Error('Invalid retry count');
  if (!LEARNING_RESULTS.includes(actualResult)) throw new Error('Invalid actual result');
  if (actualRecoveredAmount < 0 || actualRecoveredAmount > amount) {
    throw new Error('Invalid actual recovered amount');
  }
  if (actualResult === 'RECOVERED' && (!verified || actualRecoveredAmount <= 0)) {
    throw new Error('Recovered outcome must be verified with a positive recovered amount');
  }
  if (actualResult !== 'RECOVERED' && verified && actualRecoveredAmount > 0) {
    throw new Error('Verified positive recovery must be recorded as RECOVERED');
  }

  const timestamp = normalizeTimestamp(input.timestamp);
  const normalizedProbability = Number(predictedProbability.toFixed(6));
  const normalizedAmount = Number(amount.toFixed(2));
  const normalizedRecoveredAmount = Number(actualRecoveredAmount.toFixed(2));

  return {
    opportunity_id: opportunityId,
    action,
    predicted_probability: normalizedProbability,
    amount: normalizedAmount,
    customer_type: customerType,
    failure_reason: failureReason,
    provider,
    retry_count: retryCount,
    actual_result: actualResult,
    actual_recovered_amount: normalizedRecoveredAmount,
    verified,
    timestamp,
    idempotency_key: buildIdempotencyKey({ opportunityId, action, retryCount }),
  };
}

async function recordLearningOutcome(input, options = {}) {
  const model = options.model || LearningRecord;
  const normalized = normalizeLearningRecord(input);

  try {
    return await model.create(normalized);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    if (typeof model.findOne !== 'function') throw error;
    return model.findOne({ idempotency_key: normalized.idempotency_key });
  }
}

module.exports = {
  buildIdempotencyKey,
  normalizeLearningRecord,
  recordLearningOutcome,
};
