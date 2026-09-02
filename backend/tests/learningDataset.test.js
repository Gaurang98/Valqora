/**
 * Valqora Learning Dataset Test Suite (Day 5 Step 4)
 */

const assert = require('assert');
const {
  normalizeLearningRecord,
  recordLearningOutcome,
} = require('../src/services/learningDatasetService');

let passed = 0;
let total = 0;

function baseRecord(overrides = {}) {
  return {
    opportunityId: 'OPP_TXN_000301',
    action: 'RETRY',
    predictedProbability: 0.82,
    amount: 10000,
    customerType: 'REGULAR',
    failureReason: 'BANK_TIMEOUT',
    provider: 'Provider_A',
    retryCount: 0,
    actualResult: 'RECOVERED',
    actualRecoveredAmount: 10000,
    verified: true,
    timestamp: '2026-09-02T10:00:00.000Z',
    ...overrides,
  };
}

function test(name, fn) {
  total += 1;
  try {
    fn();
    passed += 1;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (error) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`     Error: ${error.message}`);
  }
}

async function asyncTest(name, fn) {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (error) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`     Error: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA — LEARNING DATASET TEST SUITE (DAY 5 STEP 4)');
  console.log('='.repeat(88) + '\n');

  const store = new Map();
  const fakeModel = {
    async create(record) {
      if (store.has(record.idempotency_key)) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      store.set(record.idempotency_key, record);
      return record;
    },
    findOne(query) {
      return store.get(query.idempotency_key) || null;
    },
  };

  await asyncTest('1. Valid learning record is accepted and normalized', async () => {
    const result = await recordLearningOutcome(baseRecord(), { model: fakeModel });
    assert.strictEqual(result.opportunity_id, 'OPP_TXN_000301');
    assert.strictEqual(result.predicted_probability, 0.82);
    assert.strictEqual(result.actual_result, 'RECOVERED');
  });

  test('2. Opportunity ID is required', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ opportunityId: '' })), /Opportunity ID/);
  });

  test('3. Action is required and must be supported', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ action: '' })), /learning action/);
    assert.throws(() => normalizeLearningRecord(baseRecord({ action: 'EXECUTE' })), /learning action/);
  });

  test('4. Predicted probability is required and numeric', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ predictedProbability: 'bad' })), /predicted probability/);
  });

  test('5. Predicted probability must be within [0, 1]', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ predictedProbability: -0.1 })), /predicted probability/);
    assert.throws(() => normalizeLearningRecord(baseRecord({ predictedProbability: 1.1 })), /predicted probability/);
  });

  test('6. Amount is required and cannot be negative', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ amount: -1 })), /amount/);
    assert.throws(() => normalizeLearningRecord(baseRecord({ amount: 'NaN' })), /amount/);
  });

  test('7. Actual recovered amount is required and numeric', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ actualRecoveredAmount: 'bad' })), /recovered amount/);
  });

  test('8. Actual recovered amount cannot be negative or exceed amount', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ actualRecoveredAmount: -1 })), /recovered amount/);
    assert.throws(() => normalizeLearningRecord(baseRecord({ actualRecoveredAmount: 10001 })), /recovered amount/);
  });

  test('9. Actual result is preserved explicitly', () => {
    const result = normalizeLearningRecord(baseRecord({ actualResult: 'FAILED', verified: false, actualRecoveredAmount: 0 }));
    assert.strictEqual(result.actual_result, 'FAILED');
  });

  test('10. Prediction is preserved as a historical snapshot', () => {
    const result = normalizeLearningRecord(baseRecord({ predictedProbability: 0.8234567 }));
    assert.strictEqual(result.predicted_probability, 0.823457);
  });

  test('11. Verified recovery can be recorded', async () => {
    const result = await recordLearningOutcome(baseRecord({ opportunityId: 'OPP_TXN_000302' }), { model: fakeModel });
    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.actual_recovered_amount, 10000);
  });

  test('12. Unverified simulation cannot be recorded as RECOVERED', () => {
    assert.throws(() => normalizeLearningRecord(baseRecord({ verified: false })), /verified/);
  });

  test('13. Blocked policy outcome is never falsely recorded as recovered', () => {
    const result = normalizeLearningRecord(baseRecord({
      opportunityId: 'OPP_TXN_000303',
      action: 'HUMAN_REVIEW',
      actualResult: 'BLOCKED',
      actualRecoveredAmount: 0,
      verified: false,
    }));
    assert.strictEqual(result.actual_result, 'BLOCKED');
    assert.strictEqual(result.actual_recovered_amount, 0);
  });

  await asyncTest('14. Duplicate outcomes are idempotent', async () => {
    const input = baseRecord({ opportunityId: 'OPP_TXN_000304' });
    const first = await recordLearningOutcome(input, { model: fakeModel });
    const second = await recordLearningOutcome(input, { model: fakeModel });
    assert.deepStrictEqual(second, first);
  });

  await asyncTest('15. Identical input produces deterministic output', async () => {
    const input = baseRecord({ opportunityId: 'OPP_TXN_000305' });
    const first = normalizeLearningRecord(input);
    const second = normalizeLearningRecord(input);
    assert.deepStrictEqual(first, second);
  });

  test('16. Input is not mutated', () => {
    const input = baseRecord({ opportunityId: 'OPP_TXN_000306' });
    const original = JSON.stringify(input);
    normalizeLearningRecord(input);
    assert.strictEqual(JSON.stringify(input), original);
  });

  test('17. Service uses no randomness', () => {
    const source = require('../src/services/learningDatasetService').normalizeLearningRecord.toString();
    assert.ok(!source.includes('Math.random'));
  });

  test('18. Historical timestamp is preserved', () => {
    const result = normalizeLearningRecord(baseRecord({ timestamp: '2024-01-15T08:30:00.000Z' }));
    assert.strictEqual(result.timestamp.toISOString(), '2024-01-15T08:30:00.000Z');
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      LEARNING DATASET TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) process.exitCode = 1;
}

runAllTests();
