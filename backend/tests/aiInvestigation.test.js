/**
 * Valqora AI Investigation & ML Recovery Integration Test Suite (Day 3 Step 1 & 2)
 *
 * Verifies all Step 1 and Step 2 requirements:
 * 1. recovery_model.joblib can be loaded and executed safely.
 * 2. Valid failed transaction produces a recovery probability.
 * 3. Recovery probability is numeric and strictly bounded in [0.0, 1.0].
 * 4. Probability predictions are deterministic for identical transaction inputs.
 * 5. Successful transactions are strictly rejected from ML inference and opportunity investigation.
 * 6. ML feature construction is free of ground-truth leakage (is_recoverable, ground_truth_action, ground_truth_priority).
 * 7. Identifiers (transaction_id, customer_id) are NOT passed as ML features.
 * 8. recovery_probability is NOT added to deterministic opportunity objects.
 * 9. SUSPICIOUS_TRANSACTION safety override mandates requiresHumanReview=true and recommendedAction=HUMAN_REVIEW.
 * 10. retry_count >= 2 never results in RETRY (deterministic safety enforcement).
 * 11. AI response validation rejects invalid confidence values, actions, and malformed reasoning/riskFactors.
 * 12. ML inference failure / offline status fails safely without fabricating probabilities.
 * 13. Investigation context contains the mlPrediction object with numeric probability and metadata.
 * 14. End-to-end AI investigation returns a valid structured advisory decision with evidence.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateAiDecision, ALLOWED_RECOVERABILITY, ALLOWED_ACTIONS } = require('../src/services/ai/aiContract');
const { buildInvestigationContext, extractEvidence } = require('../src/services/investigationService');
const { investigateOpportunity, formatInvestigationPrompt } = require('../src/services/aiService');
const { predictRecoveryProbability, extractModelFeatures, MODEL_PATH } = require('../src/services/ml/recoveryModel');
const { getOpportunities } = require('../src/controllers/opportunityController');

// Helper to parse sample rows from transactions.csv if available
function loadSampleTransactions() {
  const csvPath = path.resolve(__dirname, '../../data/transactions.csv');
  if (!fs.existsSync(csvPath)) {
    return null;
  }
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < Math.min(lines.length, 500); i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = values[idx];
    });
    // Cast numeric fields
    obj.amount = Number(obj.amount);
    obj.retry_count = Number(obj.retry_count);
    obj.customer_lifetime_value = Number(obj.customer_lifetime_value);
    obj.previous_failures = Number(obj.previous_failures);
    rows.push(obj);
  }
  return rows;
}

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(84));
  console.log('    VALQORA — AI INVESTIGATION & ML RECOVERY INTEGRATION TEST SUITE (DAY 3)');
  console.log('='.repeat(84) + '\n');

  const sampleRows = loadSampleTransactions() || [];
  const realFailedTxn = sampleRows.find((r) => r.status === 'FAILED' && r.failure_reason === 'BANK_TIMEOUT') || {
    transaction_id: 'TXN_000023',
    customer_id: 'CUST_09274',
    timestamp: '2026-08-01 10:32:00',
    amount: 4999.0,
    currency: 'INR',
    payment_method: 'UPI',
    provider: 'Provider_A',
    status: 'FAILED',
    failure_reason: 'BANK_TIMEOUT',
    retry_count: 0,
    customer_type: 'REGULAR',
    customer_lifetime_value: 57349.2,
    previous_failures: 0,
    is_recoverable: 'YES',
    ground_truth_action: 'RETRY',
    ground_truth_priority: 'MEDIUM',
  };

  const realSuccessTxn = sampleRows.find((r) => r.status === 'SUCCESS') || {
    transaction_id: 'TXN_000001',
    customer_id: 'CUST_00001',
    timestamp: '2026-08-01 09:00:00',
    amount: 1500.0,
    currency: 'INR',
    payment_method: 'UPI',
    provider: 'Provider_B',
    status: 'SUCCESS',
    failure_reason: 'NONE',
    retry_count: 0,
    customer_type: 'REGULAR',
    customer_lifetime_value: 12000.0,
    previous_failures: 0,
    is_recoverable: 'NO',
    ground_truth_action: 'NO_ACTION',
    ground_truth_priority: 'NONE',
  };

  const suspiciousTxn = sampleRows.find((r) => r.status === 'FAILED' && r.failure_reason === 'SUSPICIOUS_TRANSACTION') || {
    transaction_id: 'TXN_000999',
    customer_id: 'CUST_08888',
    timestamp: '2026-08-01 12:00:00',
    amount: 75000.0,
    currency: 'INR',
    payment_method: 'CREDIT_CARD',
    provider: 'Provider_A',
    status: 'FAILED',
    failure_reason: 'SUSPICIOUS_TRANSACTION',
    retry_count: 0,
    customer_type: 'NEW',
    customer_lifetime_value: 0.0,
    previous_failures: 0,
    is_recoverable: 'NO',
    ground_truth_action: 'HUMAN_REVIEW',
    ground_truth_priority: 'CRITICAL',
  };

  // ── 1. Model Artifact Loading Check ──
  test('1. recovery_model.joblib artifact exists and is accessible', () => {
    assert.ok(fs.existsSync(MODEL_PATH), `Model artifact missing at ${MODEL_PATH}`);
  });

  // ── 2 & 3. ML Prediction Produces Valid Probability ──
  test('2. Valid failed transaction produces a numeric probability bounded in [0.0, 1.0]', () => {
    const mlResult = predictRecoveryProbability(realFailedTxn);
    assert.strictEqual(mlResult.isAvailable, true);
    assert.strictEqual(typeof mlResult.recoveryProbability, 'number');
    assert.ok(mlResult.recoveryProbability >= 0.0 && mlResult.recoveryProbability <= 1.0);
    assert.strictEqual(mlResult.model, 'RandomForestClassifier');
  });

  // ── 4. Deterministic ML Prediction ──
  test('3. ML probability prediction is deterministic for identical transaction inputs', () => {
    const mlResult1 = predictRecoveryProbability(realFailedTxn);
    const mlResult2 = predictRecoveryProbability(realFailedTxn);
    assert.strictEqual(mlResult1.recoveryProbability, mlResult2.recoveryProbability);
  });

  // ── 5. Successful Transactions Rejected ──
  test('4. Successful transactions are rejected by ML inference layer', () => {
    assert.throws(() => {
      predictRecoveryProbability(realSuccessTxn);
    }, /Successful transactions cannot be evaluated/);
  });

  // ── 6 & 7. ML Feature Construction Leakage Protection ──
  test('5. ML features contain exactly the 13 training features with zero leakage or identifiers', () => {
    const txnWithLeakage = {
      ...realFailedTxn,
      is_recoverable: 'YES',
      ground_truth_action: 'RETRY',
      ground_truth_priority: 'HIGH',
      transaction_id: 'TXN_999999',
      customer_id: 'CUST_88888',
      _id: 'mongodb_object_id',
      __v: 0,
    };

    const features = extractModelFeatures(txnWithLeakage);
    const featureKeys = Object.keys(features).sort();
    const expectedKeys = [
      'amount',
      'currency',
      'customer_lifetime_value',
      'customer_type',
      'day_of_month',
      'day_of_week',
      'failure_reason',
      'hour',
      'month',
      'payment_method',
      'previous_failures',
      'provider',
      'retry_count',
    ].sort();

    assert.deepStrictEqual(featureKeys, expectedKeys);
    assert.strictEqual(features.is_recoverable, undefined);
    assert.strictEqual(features.ground_truth_action, undefined);
    assert.strictEqual(features.ground_truth_priority, undefined);
    assert.strictEqual(features.transaction_id, undefined);
    assert.strictEqual(features.customer_id, undefined);
    assert.strictEqual(features._id, undefined);
  });

  // ── 8. No recovery_probability on Deterministic Opportunity Objects ──
  test('6. recovery_probability is NOT added to deterministic opportunity objects', () => {
    const context = buildInvestigationContext(realFailedTxn);
    // Top-level opportunity fields
    assert.strictEqual(context.recovery_probability, undefined);
    assert.strictEqual(context.recoveryProbability, undefined);

    // Context contains mlPrediction sub-object
    assert.ok(context.mlPrediction);
    assert.strictEqual(typeof context.mlPrediction.recoveryProbability, 'number');
  });

  // ── 9. Context Construction with ML Prediction & Evidence ──
  test('7. Investigation context contains mlPrediction metadata and evidence entry', () => {
    const context = buildInvestigationContext(realFailedTxn, {
      name: 'Provider_A',
      currentSuccessRate: 61.3,
      baselineSuccessRate: 94.8,
    });

    assert.strictEqual(context.mlPrediction.isAvailable, true);
    assert.ok(context.mlPrediction.recoveryProbability >= 0.0);
    const hasMlEvidence = context.evidence.some((e) => e.includes('Baseline ML recovery probability'));
    assert.ok(hasMlEvidence, 'Evidence list should contain baseline ML recovery probability');
  });

  // ── 10. SUSPICIOUS_TRANSACTION Safety Override ──
  await asyncTest('8. SUSPICIOUS_TRANSACTION preserves HUMAN_REVIEW override regardless of ML score', async () => {
    const result = await investigateOpportunity(suspiciousTxn);
    assert.strictEqual(result.decision.requiresHumanReview, true);
    assert.strictEqual(result.decision.recommendedAction, 'HUMAN_REVIEW');
    assert.strictEqual(result.decision.recoverability, 'LOW');

    // Reject attempt to bypass fraud review
    const badDecision = {
      rootCause: 'Normal card check',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.95,
      expectedRecovery: 75000,
      reasoning: ['Model predicts 99% recovery'],
      riskFactors: [],
      requiresHumanReview: false,
    };
    const context = buildInvestigationContext(suspiciousTxn);
    assert.throws(() => {
      validateAiDecision(badDecision, context);
    }, /Safety violation: SUSPICIOUS_TRANSACTION/);
  });

  // ── 11. retry_count >= 2 Safety Ceiling ──
  await asyncTest('9. retry_count >= 2 never produces RETRY (safety override enforced)', async () => {
    const highRetryTxn = {
      ...realFailedTxn,
      transaction_id: 'TXN_RETRY_MAX',
      retry_count: 2,
    };

    const result = await investigateOpportunity(highRetryTxn);
    assert.notStrictEqual(result.decision.recommendedAction, 'RETRY');

    const badRetryDecision = {
      rootCause: 'Transient lag',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.90,
      expectedRecovery: 4999,
      reasoning: ['ML model predicts high recovery'],
      riskFactors: [],
      requiresHumanReview: false,
    };
    const context = buildInvestigationContext(highRetryTxn);
    assert.throws(() => {
      validateAiDecision(badRetryDecision, context);
    }, /Safety violation: retryCount is 2/);
  });

  // ── 12. Successful Transaction Rejection from Context ──
  test('10. Successful transactions cannot be investigated as recovery opportunities', () => {
    assert.throws(() => {
      buildInvestigationContext(realSuccessTxn);
    }, /Successful transactions cannot be investigated as recovery opportunities/);
  });

  // ── 13. Schema Validation Checks ──
  test('11. AI response validation strictly enforces schema contract and ranges', () => {
    const baseValid = {
      rootCause: 'Infrastructure network drop',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.92,
      expectedRecovery: 4999.0,
      reasoning: ['Transient network timeout'],
      riskFactors: [],
      requiresHumanReview: false,
    };

    assert.throws(() => validateAiDecision({ ...baseValid, confidence: 1.5 }), /Invalid confidence/);
    assert.throws(() => validateAiDecision({ ...baseValid, recommendedAction: 'AUTO_REFUND' }), /Invalid recommendedAction/);
    assert.throws(() => validateAiDecision({ ...baseValid, reasoning: [] }), /reasoning must be a non-empty array/);
    assert.doesNotThrow(() => validateAiDecision(baseValid));
  });

  // ── 14. ML Failure Safe Fallback ──
  test('12. ML inference failure does not fabricate fake probabilities and reports offline state safely', () => {
    const fakeBrokenTxn = {
      ...realFailedTxn,
      amount: 5000,
    };

    // Simulate custom offline/broken prediction
    const offlineContext = buildInvestigationContext(fakeBrokenTxn, null, {
      recoveryProbability: null,
      isAvailable: false,
      model: 'RandomForestClassifier',
      reason: 'Simulated inference offline mode',
    });

    assert.strictEqual(offlineContext.mlPrediction.recoveryProbability, null);
    assert.strictEqual(offlineContext.mlPrediction.isAvailable, false);
    assert.strictEqual(offlineContext.mlPrediction.reason, 'Simulated inference offline mode');

    const hasOfflineEvidence = offlineContext.evidence.some((e) => e.includes('Baseline ML recovery prediction: unavailable'));
    assert.ok(hasOfflineEvidence);
  });

  // ── 15. End-to-End AI Investigation with Integrated ML Prediction ──
  await asyncTest('13. End-to-End AI Investigation incorporates ML probability into advisory decision', async () => {
    const result = await investigateOpportunity(realFailedTxn, {
      providerStats: {
        name: 'Provider_A',
        currentSuccessRate: 61.3,
        baselineSuccessRate: 94.8,
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isAdvisory, true);
    assert.ok(result.context.mlPrediction);
    assert.strictEqual(typeof result.context.mlPrediction.recoveryProbability, 'number');
    assert.ok(ALLOWED_RECOVERABILITY.includes(result.decision.recoverability));
    assert.ok(ALLOWED_ACTIONS.includes(result.decision.recommendedAction));

    console.log('\n  [SAMPLE ML PREDICTION & INVESTIGATION CONTEXT]:');
    console.log(JSON.stringify({
      opportunityId: result.opportunityId,
      transactionId: result.transactionId,
      amount: result.context.amount,
      mlPrediction: result.context.mlPrediction,
      evidence: result.context.evidence,
      aiDecision: result.decision,
    }, null, 4));
  });

  console.log('\n' + '='.repeat(84));
  console.log(`  TEST RESULTS: ${passed}/${total} checks passed (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('='.repeat(84) + '\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
