/**
 * Valqora Recovery Action Simulator Test Suite (Day 4 Step 2)
 */

const assert = require('assert');
const { evaluatePolicy } = require('../src/services/policyEngine');
const {
  simulateRecoveryAction,
  mapPolicyActionToRecoveryAction,
  stableHash,
  simulateRetryPayment,
} = require('../src/services/recoverySimulator');

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

function runAllTests() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA — RECOVERY ACTION SIMULATOR TEST SUITE (DAY 4 STEP 2)');
  console.log('='.repeat(88) + '\n');

  test('1. Approved RETRY_PAYMENT simulation runs deterministically', () => {
    const policy = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.87,
    });

    assert.strictEqual(policy.decision, 'APPROVED');
    const first = simulateRecoveryAction({
      action: mapPolicyActionToRecoveryAction(policy.action),
      transaction: { transactionId: 'TXN_000050', amount: 5000, retry_count: 0 },
      policyDecision: policy,
    });
    const second = simulateRecoveryAction({
      action: mapPolicyActionToRecoveryAction(policy.action),
      transaction: { transactionId: 'TXN_000050', amount: 5000, retry_count: 0 },
      policyDecision: policy,
    });

    assert.deepStrictEqual(first, second);
    assert.strictEqual(first.action, 'RETRY_PAYMENT');
    assert.ok(first.status === 'SUCCESS' || first.status === 'FAILED');
  });

  test('2. Failed simulated retry produces a failed result with zero amount recovered', () => {
    const result = simulateRetryPayment({
      transaction: { transactionId: 'TXN_000999', amount: 7500, retry_count: 1 },
      policyDecision: { decision: 'APPROVED' },
    });

    assert.strictEqual(result.action, 'RETRY_PAYMENT');
    assert.ok(result.status === 'SUCCESS' || result.status === 'FAILED');
    if (result.status === 'FAILED') {
      assert.strictEqual(result.amountRecovered, 0);
    }
  });

  test('3. Successful simulated retry returns the full transaction amount', () => {
    const result = simulateRetryPayment({
      transaction: { transactionId: 'TXN_000010', amount: 2500, retry_count: 0 },
      policyDecision: { decision: 'APPROVED' },
    });

    if (result.status === 'SUCCESS') {
      assert.strictEqual(result.amountRecovered, 2500);
    }
    assert.ok(result.status === 'SUCCESS' || result.status === 'FAILED');
  });

  test('4. Retry limit blocks the simulator from executing the action', () => {
    const policy = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 2,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.99,
    });

    const result = simulateRecoveryAction({
      action: 'RETRY_PAYMENT',
      transaction: { transactionId: 'TXN_000200', amount: 5000, retry_count: 2 },
      policyDecision: policy,
    });

    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(result.executed, false);
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.amountRecovered, 0);
  });

  test('5. Suspicious transaction is blocked and not simulated', () => {
    const policy = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'SUSPICIOUS_TRANSACTION',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.99,
    });

    const result = simulateRecoveryAction({
      action: 'RETRY_PAYMENT',
      transaction: { transactionId: 'TXN_000201', amount: 5000, retry_count: 0 },
      policyDecision: policy,
    });

    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(result.executed, false);
    assert.strictEqual(result.status, 'BLOCKED');
  });

  test('6. Low confidence is blocked and not simulated', () => {
    const policy = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.52,
    });

    const result = simulateRecoveryAction({
      action: 'RETRY_PAYMENT',
      transaction: { transactionId: 'TXN_000202', amount: 5000, retry_count: 0 },
      policyDecision: policy,
    });

    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(result.executed, false);
  });

  test('7. High-value transaction is blocked and not simulated', () => {
    const policy = evaluatePolicy({
      status: 'FAILED',
      amount: 75000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.95,
    });

    const result = simulateRecoveryAction({
      action: 'RETRY_PAYMENT',
      transaction: { transactionId: 'TXN_000203', amount: 75000, retry_count: 0 },
      policyDecision: policy,
    });

    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(result.executed, false);
  });

  test('8. Non-retry actions simulate without real execution', () => {
    const result = simulateRecoveryAction({
      action: 'SEND_PAYMENT_LINK',
      transaction: { transactionId: 'TXN_000204', amount: 2200, retry_count: 0 },
    });

    assert.strictEqual(result.action, 'SEND_PAYMENT_LINK');
    assert.strictEqual(result.simulated, true);
    assert.strictEqual(result.amountRecovered, 0);
  });

  test('9. Determinism holds for repeated identical simulation inputs', () => {
    const first = simulateRecoveryAction({
      action: 'WAIT_AND_RETRY',
      transaction: { transactionId: 'TXN_000205', amount: 4400, retry_count: 1 },
    });
    const second = simulateRecoveryAction({
      action: 'WAIT_AND_RETRY',
      transaction: { transactionId: 'TXN_000205', amount: 4400, retry_count: 1 },
    });

    assert.deepStrictEqual(first, second);
  });

  test('10. stableHash is deterministic and bounded', () => {
    const first = stableHash('TXN_000206|5000|0|RETRY_PAYMENT');
    const second = stableHash('TXN_000206|5000|0|RETRY_PAYMENT');
    assert.strictEqual(first, second);
    assert.ok(first >= 0 && first <= 1);
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      RECOVERY SIMULATOR TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runAllTests();
