/**
 * Valqora Action Evaluation Engine Test Suite (Day 5 Step 1)
 */

const assert = require('assert');
const { evaluateActionCandidates } = require('../src/services/actionEvaluationService');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

function run() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA — ACTION EVALUATION TEST SUITE (DAY 5 STEP 1)');
  console.log('='.repeat(88) + '\n');

  test('1. Deterministic output for multiple candidate actions', () => {
    const first = evaluateActionCandidates({
      opportunityId: 'OPP_TXN_000101',
      amount: 10000,
      status: 'FAILED',
      failureReason: 'BANK_TIMEOUT',
      retryCount: 0,
      customerType: 'REGULAR',
      recoveryProbability: 0.82,
      aiRecommendation: 'RETRY',
    });

    const second = evaluateActionCandidates({
      opportunityId: 'OPP_TXN_000101',
      amount: 10000,
      status: 'FAILED',
      failureReason: 'BANK_TIMEOUT',
      retryCount: 0,
      customerType: 'REGULAR',
      recoveryProbability: 0.82,
      aiRecommendation: 'RETRY',
    });

    assert.deepStrictEqual(first.candidates, second.candidates);
    assert.strictEqual(first.bestAction, second.bestAction);
  });

  test('2. Expected recovery is amount times probability', () => {
    const result = evaluateActionCandidates({
      opportunityId: 'OPP_TXN_000102',
      amount: 25000,
      status: 'FAILED',
      failureReason: 'PAYMENT_METHOD_EXPIRED',
      retryCount: 1,
      customerType: 'REGULAR',
      recoveryProbability: 0.62,
      aiRecommendation: 'PAYMENT_METHOD_UPDATE',
    });

    const retryCandidate = result.candidates.find((candidate) => candidate.action === 'RETRY');
    assert.strictEqual(retryCandidate.expectedRecovery, 15500);
  });

  test('3. Best candidate selection chooses the largest expected recovery', () => {
    const result = evaluateActionCandidates({
      opportunityId: 'OPP_TXN_000103',
      amount: 10000,
      status: 'FAILED',
      failureReason: 'SUSPICIOUS_TRANSACTION',
      retryCount: 0,
      customerType: 'HIGH_VALUE',
      recoveryProbability: 0.88,
      aiRecommendation: 'HUMAN_REVIEW',
    });

    assert.strictEqual(result.bestAction, 'HUMAN_REVIEW');
    assert.strictEqual(result.bestExpectedRecovery, 8800);
  });

  test('4. NO_ACTION is handled safely', () => {
    const result = evaluateActionCandidates({
      opportunityId: 'OPP_TXN_000104',
      amount: 5000,
      status: 'FAILED',
      failureReason: 'UNKNOWN',
      retryCount: 0,
      customerType: 'REGULAR',
      recoveryProbability: 0,
      aiRecommendation: 'WAIT',
    });

    const noAction = result.candidates.find((candidate) => candidate.action === 'NO_ACTION');
    assert.strictEqual(noAction.recoveryProbability, 0);
    assert.strictEqual(noAction.expectedRecovery, 0);
  });

  test('5. Zero amount is handled without NaN or Infinity', () => {
    const result = evaluateActionCandidates({
      opportunityId: 'OPP_TXN_000105',
      amount: 0,
      status: 'FAILED',
      failureReason: 'BANK_TIMEOUT',
      retryCount: 0,
      customerType: 'REGULAR',
      recoveryProbability: 0.8,
      aiRecommendation: 'RETRY',
    });

    assert.strictEqual(result.amount, 0);
    assert.strictEqual(result.bestExpectedRecovery, 0);
    assert.ok(Number.isFinite(result.bestExpectedRecovery));
  });

  test('6. Invalid or missing safety-critical inputs fail closed', () => {
    assert.throws(() => {
      evaluateActionCandidates({
        opportunityId: 'OPP_TXN_000106',
        amount: -10,
        status: 'SUCCESS',
        failureReason: '',
        retryCount: -1,
        customerType: 'REGULAR',
      });
    }, /Invalid|required|status|amount|retry/i);
  });

  test('7. Service does not use nondeterministic random behavior', () => {
    const result = evaluateActionCandidates({
      opportunityId: 'OPP_TXN_000107',
      amount: 12000,
      status: 'FAILED',
      failureReason: 'BANK_TIMEOUT',
      retryCount: 0,
      customerType: 'REGULAR',
      recoveryProbability: 0.71,
      aiRecommendation: 'RETRY',
    });

    assert.ok(!String(result.selectionReason).toLowerCase().includes('random'));
    assert.ok(Array.isArray(result.candidates));
  });

  test('8. The service does not mutate input data', () => {
    const input = {
      opportunityId: 'OPP_TXN_000108',
      amount: 9000,
      status: 'FAILED',
      failureReason: 'NETWORK_ERROR',
      retryCount: 1,
      customerType: 'REGULAR',
      recoveryProbability: 0.68,
      aiRecommendation: 'RETRY',
    };

    const original = JSON.stringify(input);
    evaluateActionCandidates(input);
    assert.strictEqual(JSON.stringify(input), original);
  });

  console.log('\n' + '='.repeat(88));
  console.log('      ACTION EVALUATION TEST SUMMARY: COMPLETE');
  console.log('='.repeat(88));
}

run();
