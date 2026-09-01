/**
 * Valqora Policy Engine Test Suite (Day 4 Step 1)
 */

const assert = require('assert');
const { evaluatePolicy, normalizePolicyInput, POLICY_CONSTANTS } = require('../src/services/policyEngine');

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
  console.log('\n' + '='.repeat(84));
  console.log('    VALQORA — POLICY ENGINE TEST SUITE (DAY 4 STEP 1)');
  console.log('='.repeat(84) + '\n');

  test('1. Safe retry is approved when all policy conditions pass', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.87,
    });

    assert.strictEqual(result.decision, 'APPROVED');
    assert.strictEqual(result.action, 'RETRY');
    assert.strictEqual(result.requiresHumanReview, false);
    assert.ok(result.rulesEvaluated.includes('SAFE_TEMPORARY_FAILURE'));
  });

  test('2. Retry limit blocks retry even when AI recommends retry', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 2,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.99,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
    assert.strictEqual(result.requiresHumanReview, true);
    assert.ok(result.rulesEvaluated.includes('RETRY_LIMIT'));
  });

  test('3. Suspicious transactions are always blocked and require human review', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'SUSPICIOUS_TRANSACTION',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.99,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
    assert.strictEqual(result.requiresHumanReview, true);
    assert.ok(result.rulesEvaluated.includes('SUSPICIOUS_TRANSACTION'));
  });

  test('4. Low confidence blocks automatic recovery', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.52,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
    assert.strictEqual(result.requiresHumanReview, true);
    assert.ok(result.rulesEvaluated.includes('CONFIDENCE_THRESHOLD'));
  });

  test('5. High-value transactions block automatic recovery', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 75000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.95,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
    assert.strictEqual(result.requiresHumanReview, true);
    assert.ok(result.rulesEvaluated.includes('HIGH_VALUE_TRANSACTION'));
  });

  test('6. Wrong failure reason does not allow retry', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'INSUFFICIENT_FUNDS',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.95,
    });

    assert.notStrictEqual(result.decision, 'APPROVED');
    assert.notStrictEqual(result.action, 'RETRY');
  });

  test('7. AI must recommend retry for retry approval to be valid', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'WAIT',
      aiConfidence: 0.95,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
  });

  test('8. Successful transactions can never be auto-approved', () => {
    const result = evaluatePolicy({
      status: 'SUCCESS',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'NONE',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.95,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
    assert.ok(result.rulesEvaluated.includes('SUCCESS_TRANSACTION'));
  });

  test('9. Safety precedence keeps the result blocked when multiple bad conditions apply', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 75000,
      retry_count: 2,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'SUSPICIOUS_TRANSACTION',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.4,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
    assert.strictEqual(result.requiresHumanReview, true);
  });

  test('10. Boundary confidence of 0.70 satisfies the threshold', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.70,
    });

    assert.strictEqual(result.decision, 'APPROVED');
    assert.strictEqual(result.action, 'RETRY');
  });

  test('11. Boundary amount of 50000 is allowed, 50000.01 is blocked', () => {
    const allowed = evaluatePolicy({
      status: 'FAILED',
      amount: 50000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.70,
    });

    const blocked = evaluatePolicy({
      status: 'FAILED',
      amount: 50000.01,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.70,
    });

    assert.strictEqual(allowed.decision, 'APPROVED');
    assert.strictEqual(blocked.decision, 'BLOCKED');
    assert.strictEqual(blocked.action, 'HUMAN_REVIEW');
    assert.ok(blocked.rulesEvaluated.includes('HIGH_VALUE_TRANSACTION'));
  });

  test('12. Retry count 1 is allowed when all other conditions pass; retry count 2 blocks', () => {
    const allowed = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 1,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.75,
    });

    const blocked = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 2,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.75,
    });

    assert.strictEqual(allowed.decision, 'APPROVED');
    assert.strictEqual(blocked.decision, 'BLOCKED');
  });

  test('13. Missing safety-critical inputs fail closed and never approve', () => {
    const result = evaluatePolicy({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: null,
    });

    assert.strictEqual(result.decision, 'BLOCKED');
    assert.strictEqual(result.action, 'HUMAN_REVIEW');
    assert.ok(result.reason.includes('missing') || result.reason.includes('invalid'));
  });

  test('14. Deterministic behavior is stable for the same input', () => {
    const input = {
      status: 'FAILED',
      amount: 4000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.87,
    };

    const first = evaluatePolicy(input);
    const second = evaluatePolicy({ ...input });
    assert.deepStrictEqual(first, second);
  });

  test('15. Policy constant values are exposed and usable', () => {
    assert.strictEqual(POLICY_CONSTANTS.MIN_AI_CONFIDENCE, 0.7);
    assert.strictEqual(POLICY_CONSTANTS.MAX_AUTO_RECOVERY_AMOUNT, 50000);
    assert.strictEqual(POLICY_CONSTANTS.RETRY_LIMIT, 2);
  });

  test('16. normalizePolicyInput rejects raw DB fields and keeps only policy-safe data', () => {
    const normalized = normalizePolicyInput({
      status: 'FAILED',
      amount: 5000,
      retry_count: 0,
      failure_reason: 'BANK_TIMEOUT',
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.87,
      _id: 'abc',
      __v: 1,
      ground_truth_action: 'RETRY',
      is_recoverable: 'YES',
    });

    assert.strictEqual(normalized._id, undefined);
    assert.strictEqual(normalized.__v, undefined);
    assert.strictEqual(normalized.is_recoverable, undefined);
    assert.strictEqual(normalized.ground_truth_action, undefined);
    assert.strictEqual(normalized.aiRecommendedAction, 'RETRY');
  });

  console.log('\n' + '='.repeat(84));
  console.log(`      POLICY ENGINE TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(84));

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runAllTests();
