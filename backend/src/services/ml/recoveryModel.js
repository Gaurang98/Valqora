/**
 * Valqora Recovery Model ML Inference Bridge
 *
 * Provides a secure, isolated inference service that interfaces with the trained
 * ML recovery model (ml/models/recovery_model.joblib).
 *
 * Invariants:
 * 1. Only FAILED transactions can be evaluated.
 * 2. Features strictly mirror the 13 training features.
 * 3. Leakage fields (is_recoverable, ground_truth_action, ground_truth_priority)
 *    and identifiers (transaction_id, customer_id) are NEVER used as features.
 * 4. Returns numeric probability in [0, 1] or fails safely without fabricating numbers.
 * 5. Deterministic opportunity objects are NEVER contaminated.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const INFERENCE_SCRIPT = path.join(REPO_ROOT, 'ml', 'src', 'inference.py');
const MODEL_PATH = path.join(REPO_ROOT, 'ml', 'models', 'recovery_model.joblib');

const FORBIDDEN_FIELDS = Object.freeze([
  'is_recoverable',
  'ground_truth_action',
  'ground_truth_priority',
  'transaction_id',
  'customer_id',
  '_id',
  '__v',
]);

/**
 * Extracts and sanitizes the exact 13 ML features from a transaction.
 *
 * @param {Object} txn - Raw transaction object
 * @returns {Object} Clean feature payload
 */
function extractModelFeatures(txn) {
  if (!txn || typeof txn !== 'object') {
    throw new Error('Transaction object is required for feature extraction');
  }

  // 1. Invariant: Only failed transactions are eligible
  if (txn.status === 'SUCCESS') {
    throw new Error('Successful transactions cannot be evaluated for recovery probability');
  }

  // 2. Derive timestamp features
  const ts = txn.timestamp ? new Date(txn.timestamp) : new Date();
  const validTs = !Number.isNaN(ts.getTime()) ? ts : new Date();

  // In Python pandas: dt.dayofweek is 0 for Monday, 6 for Sunday
  // In JS: getUTCDay() is 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  const jsDay = validTs.getUTCDay();
  const pythonDayOfWeek = (jsDay + 6) % 7;

  const features = {
    amount: Number(txn.amount ?? 0),
    retry_count: Number(txn.retry_count ?? txn.retryCount ?? 0),
    customer_lifetime_value: Number(txn.customer_lifetime_value ?? txn.customerLifetimeValue ?? 0),
    previous_failures: Number(txn.previous_failures ?? txn.previousFailures ?? 0),
    hour: validTs.getUTCHours(),
    day_of_week: pythonDayOfWeek,
    day_of_month: validTs.getUTCDate(),
    month: validTs.getUTCMonth() + 1,
    currency: String(txn.currency || 'INR').trim(),
    payment_method: String(txn.payment_method || txn.paymentMethod || 'UPI').trim(),
    provider: String(txn.provider || 'Provider_A').trim(),
    failure_reason: String(txn.failure_reason || txn.failureReason || 'UNKNOWN').trim(),
    customer_type: String(txn.customer_type || txn.customerType || 'REGULAR').trim(),
  };

  // 3. Strict leakage assertion
  for (const forbidden of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(features, forbidden)) {
      throw new Error(`Leakage violation: feature payload contains forbidden field '${forbidden}'`);
    }
  }

  return features;
}

/**
 * Predicts the numeric recovery probability for a failed transaction using the
 * trained ML recovery model.
 *
 * @param {Object} transaction - Plain transaction object
 * @returns {Object} Result containing recoveryProbability (number in [0,1] or null) and status metadata
 */
function predictRecoveryProbability(transaction) {
  if (!transaction || typeof transaction !== 'object') {
    throw new Error('Transaction object is required for recovery probability prediction');
  }

  if (transaction.status === 'SUCCESS') {
    throw new Error('Successful transactions cannot be evaluated for recovery probability');
  }

  const features = extractModelFeatures(transaction);

  // Check if model artifact exists
  if (!fs.existsSync(MODEL_PATH) || !fs.existsSync(INFERENCE_SCRIPT)) {
    return {
      recoveryProbability: null,
      isAvailable: false,
      model: 'RandomForestClassifier',
      reason: 'Model artifact or inference script not found on disk',
    };
  }

  try {
    const payload = JSON.stringify(features);
    const pythonCmd = process.env.PYTHON_PATH || 'python';

    const child = spawnSync(pythonCmd, [INFERENCE_SCRIPT], {
      input: payload,
      encoding: 'utf8',
      timeout: 5000,
      cwd: REPO_ROOT,
    });

    if (child.error) {
      return {
        recoveryProbability: null,
        isAvailable: false,
        model: 'RandomForestClassifier',
        reason: `Python execution failed: ${child.error.message}`,
      };
    }

    if (child.status !== 0) {
      return {
        recoveryProbability: null,
        isAvailable: false,
        model: 'RandomForestClassifier',
        reason: `Inference process exited with code ${child.status}: ${child.stderr || child.stdout}`,
      };
    }

    const output = JSON.parse(child.stdout.trim());
    if (output.success && typeof output.recoveryProbability === 'number') {
      const prob = output.recoveryProbability;
      if (prob < 0.0 || prob > 1.0 || Number.isNaN(prob)) {
        throw new Error(`Model returned out-of-bounds probability: ${prob}`);
      }
      return {
        recoveryProbability: Number(prob.toFixed(4)),
        isAvailable: true,
        model: output.model || 'RandomForestClassifier',
      };
    }

    return {
      recoveryProbability: null,
      isAvailable: false,
      model: 'RandomForestClassifier',
      reason: output.error || 'Unknown inference error',
    };
  } catch (err) {
    return {
      recoveryProbability: null,
      isAvailable: false,
      model: 'RandomForestClassifier',
      reason: err.message,
    };
  }
}

module.exports = {
  predictRecoveryProbability,
  extractModelFeatures,
  MODEL_PATH,
  INFERENCE_SCRIPT,
};
