/**
 * Valqora Performance Analytics Test Suite (Day 5 Step 5)
 */

const assert = require('assert');
const {
  calculatePerformanceAnalytics,
} = require('../src/services/performanceAnalyticsService');

let passed = 0;
let total = 0;

function record(overrides = {}) {
  return {
    opportunity_id: 'OPP_ANALYTICS_001',
    action: 'RETRY',
    predicted_probability: 0.8,
    amount: 1000,
    customer_type: 'REGULAR',
    failure_reason: 'BANK_TIMEOUT',
    provider: 'Provider_A',
    retry_count: 0,
    actual_result: 'RECOVERED',
    actual_recovered_amount: 1000,
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
    console.log(`  [PASS] ${name}`);
  } catch (error) {
    console.error(`  [FAIL] ${name}`);
    console.error(`     Error: ${error.message}`);
  }
}

function runAllTests() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA - PERFORMANCE ANALYTICS TEST SUITE (DAY 5 STEP 5)');
  console.log('='.repeat(88) + '\n');

  const records = [
    record({ opportunity_id: 'OPP_1', predicted_probability: 0.1, actual_result: 'FAILED', actual_recovered_amount: 0 }),
    record({ opportunity_id: 'OPP_2', action: 'PAYMENT_LINK', predicted_probability: 0.3, amount: 200, actual_recovered_amount: 200 }),
    record({ opportunity_id: 'OPP_3', predicted_probability: 0.6, actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    record({ opportunity_id: 'OPP_4', action: 'PAYMENT_LINK', predicted_probability: 0.8, amount: 500, actual_recovered_amount: 500 }),
    record({ opportunity_id: 'OPP_5', predicted_probability: 1, actual_recovered_amount: 1000 }),
  ];

  test('1. Overall summary uses learning records', () => {
    const result = calculatePerformanceAnalytics(records);
    assert.strictEqual(result.totalRecords, 5);
    assert.strictEqual(result.verifiedRecoveries, 3);
    assert.strictEqual(result.totalRecoveredAmount, 1700);
    assert.strictEqual(result.actualRecoveryRate, 60);
    assert.strictEqual(result.meanPredictedProbability, 0.56);
  });

  test('2. Brier score is calculated from binary verified outcomes', () => {
    const result = calculatePerformanceAnalytics(records);
    assert.strictEqual(result.brierScore, 0.18);
  });

  test('3. Actual recovery rate counts only verified RECOVERED records', () => {
    const result = calculatePerformanceAnalytics([
      record({ actual_result: 'RECOVERED', verified: false, actual_recovered_amount: 1000 }),
      record({ opportunity_id: 'OPP_VALID', actual_result: 'RECOVERED', verified: true, actual_recovered_amount: 1000 }),
    ]);
    assert.strictEqual(result.verifiedRecoveries, 1);
    assert.strictEqual(result.actualRecoveryRate, 100);
  });

  test('4. Mean predicted probability is independent of actual outcome', () => {
    const result = calculatePerformanceAnalytics(records);
    assert.strictEqual(result.meanPredictedProbability, 0.56);
  });

  test('5. Calibration returns the five defined buckets', () => {
    const result = calculatePerformanceAnalytics(records);
    assert.deepStrictEqual(result.calibration.map((bucket) => bucket.bucket), [
      '0.00-0.19', '0.20-0.39', '0.40-0.59', '0.60-0.79', '0.80-1.00',
    ]);
    assert.deepStrictEqual(result.calibration.map((bucket) => bucket.count), [1, 1, 0, 1, 2]);
  });

  test('6. Calibration error is absolute probability versus recovery-rate difference', () => {
    const result = calculatePerformanceAnalytics(records);
    const bucket = result.calibration.find((item) => item.bucket === '0.80-1.00');
    assert.strictEqual(bucket.averagePredictedProbability, 0.9);
    assert.strictEqual(bucket.actualRecoveryRate, 100);
    assert.strictEqual(bucket.calibrationError, 0.1);
  });

  test('7. Probability boundaries belong to exactly one bucket', () => {
    const probabilities = [0, 0.19, 0.2, 0.39, 0.4, 0.59, 0.6, 0.79, 0.8, 1];
    const result = calculatePerformanceAnalytics(probabilities.map((probability, index) => record({
      opportunity_id: `OPP_BOUNDARY_${index}`,
      predicted_probability: probability,
      actual_result: 'FAILED',
      actual_recovered_amount: 0,
      verified: false,
    })));
    assert.strictEqual(result.calibration.reduce((sum, bucket) => sum + bucket.count, 0), probabilities.length);
    assert.deepStrictEqual(result.calibration.map((bucket) => bucket.count), [2, 2, 2, 2, 2]);
  });

  test('8. Calibration records are not double-counted', () => {
    const result = calculatePerformanceAnalytics(records);
    assert.strictEqual(result.calibration.reduce((sum, bucket) => sum + bucket.count, 0), result.totalRecords);
  });

  test('9. Action success rate is grouped by recorded action', () => {
    const result = calculatePerformanceAnalytics(records);
    const retry = result.actionPerformance.find((item) => item.action === 'RETRY');
    const paymentLink = result.actionPerformance.find((item) => item.action === 'PAYMENT_LINK');
    assert.strictEqual(retry.totalOutcomes, 3);
    assert.strictEqual(retry.successfulRecoveries, 1);
    assert.strictEqual(retry.successRate, 33.33);
    assert.strictEqual(paymentLink.totalOutcomes, 2);
    assert.strictEqual(paymentLink.successfulRecoveries, 2);
    assert.strictEqual(paymentLink.successRate, 100);
  });

  test('10. Recovery by action uses verified recovery amounts only', () => {
    const result = calculatePerformanceAnalytics(records);
    const retry = result.recoveryByAction.find((item) => item.action === 'RETRY');
    assert.strictEqual(retry.outcomes, 3);
    assert.strictEqual(retry.totalRecoveredAmount, 1000);
    assert.strictEqual(retry.averageRecoveredAmount, 1000);
    assert.strictEqual(retry.recoveryRate, 33.33);
  });

  test('11. Predicted or unverified amounts are not actual recovered revenue', () => {
    const result = calculatePerformanceAnalytics([
      record({ predicted_probability: 0.99, actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
      record({ opportunity_id: 'OPP_UNVERIFIED', actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    assert.strictEqual(result.totalRecoveredAmount, 0);
    assert.strictEqual(result.verifiedRecoveries, 0);
  });

  test('12. Empty dataset is zero-safe', () => {
    const result = calculatePerformanceAnalytics([]);
    assert.deepStrictEqual(result, {
      totalRecords: 0,
      invalidRecordCount: 0,
      verifiedRecoveries: 0,
      totalRecoveredAmount: 0,
      actualRecoveryRate: 0,
      meanPredictedProbability: 0,
      brierScore: null,
      calibration: [],
      actionPerformance: [],
      recoveryByAction: [],
    });
  });

  test('13. Invalid probabilities are excluded and counted', () => {
    const result = calculatePerformanceAnalytics([
      record({ opportunity_id: 'OPP_INVALID_LOW', predicted_probability: -0.1 }),
      record({ opportunity_id: 'OPP_INVALID_HIGH', predicted_probability: 1.1 }),
      record({ opportunity_id: 'OPP_VALID', predicted_probability: 0.5, actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    assert.strictEqual(result.totalRecords, 1);
    assert.strictEqual(result.invalidRecordCount, 2);
  });

  test('14. Invalid recovered amounts are excluded and never counted', () => {
    const result = calculatePerformanceAnalytics([
      record({ opportunity_id: 'OPP_NEGATIVE', actual_recovered_amount: -1 }),
      record({ opportunity_id: 'OPP_OVER_AMOUNT', actual_recovered_amount: 1001 }),
      record({ opportunity_id: 'OPP_VALID', actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    assert.strictEqual(result.totalRecords, 1);
    assert.strictEqual(result.invalidRecordCount, 2);
    assert.strictEqual(result.totalRecoveredAmount, 0);
  });

  test('15. Multiple action results are deterministic and ordered', () => {
    const result = calculatePerformanceAnalytics([
      ...records,
      record({ opportunity_id: 'OPP_6', action: 'HUMAN_REVIEW', actual_result: 'BLOCKED', actual_recovered_amount: 0, verified: false }),
    ]);
    assert.deepStrictEqual(result.actionPerformance.map((item) => item.action), ['HUMAN_REVIEW', 'PAYMENT_LINK', 'RETRY']);
  });

  test('16. Filters restrict every aggregate', () => {
    const result = calculatePerformanceAnalytics(records, { action: 'PAYMENT_LINK' });
    assert.strictEqual(result.totalRecords, 2);
    assert.strictEqual(result.verifiedRecoveries, 2);
    assert.strictEqual(result.totalRecoveredAmount, 700);
  });

  test('17. Date filters are deterministic', () => {
    const result = calculatePerformanceAnalytics(records, {
      startDate: '2026-09-02T10:00:00.000Z',
      endDate: '2026-09-02T10:00:00.000Z',
    });
    assert.strictEqual(result.totalRecords, records.length);
  });

  test('18. Invalid filters fail safely', () => {
    assert.throws(() => calculatePerformanceAnalytics(records, { startDate: 'bad-date' }), /start date/);
    assert.throws(() => calculatePerformanceAnalytics(records, {
      startDate: '2026-09-03',
      endDate: '2026-09-02',
    }), /after end date/);
  });

  test('19. Analytics does not mutate input records', () => {
    const original = JSON.stringify(records);
    calculatePerformanceAnalytics(records);
    assert.strictEqual(JSON.stringify(records), original);
  });

  test('20. Analytics contains no random or retraining behavior', () => {
    const source = require('../src/services/performanceAnalyticsService').calculatePerformanceAnalytics.toString();
    assert.ok(!source.includes('Math.random'));
    assert.ok(!source.includes('.fit('));
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      PERFORMANCE ANALYTICS TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) process.exitCode = 1;
}

runAllTests();
