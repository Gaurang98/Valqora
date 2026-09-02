/**
 * Valqora Recovery Insights Test Suite (Day 5 Step 6)
 */

const assert = require('assert');
const recoveryRoutes = require('../src/routes/recovery');
const {
  calculateRecoveryInsights,
  confidenceLevel,
} = require('../src/services/recoveryInsightsService');

let passed = 0;
let total = 0;

function record(overrides = {}) {
  return {
    opportunity_id: 'OPP_INSIGHT_001',
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

function many(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => record({
    opportunity_id: `OPP_${index}_${overrides.action || 'ACTION'}`,
    ...overrides,
  }));
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

function findSegment(result, collection, segment) {
  return result.insights[collection].find((item) => item.segment === String(segment));
}

function runAllTests() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA - RECOVERY INSIGHTS TEST SUITE (DAY 5 STEP 6)');
  console.log('='.repeat(88) + '\n');

  test('1. Failure reason x action grouping identifies the best action', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { action: 'RETRY', actual_recovered_amount: 1000 }),
      ...many(5, { action: 'PAYMENT_LINK', actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.bestAction, 'RETRY');
    assert.strictEqual(insight.sampleSize, 10);
    assert.strictEqual(insight.actions.length, 2);
  });

  test('2. Failure reason metrics use actual verified amounts', () => {
    const result = calculateRecoveryInsights(many(5, { actual_recovered_amount: 1250, amount: 2000 }));
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.totalRecoveredAmount, 6250);
    assert.strictEqual(insight.averageRecoveredAmount, 1250);
    assert.strictEqual(insight.successRate, 1);
  });

  test('3. Customer type x action insights are calculated', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { customer_type: 'HIGH_VALUE', action: 'HUMAN_REVIEW' }),
      ...many(5, { customer_type: 'HIGH_VALUE', action: 'RETRY', actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    const insight = findSegment(result, 'customerTypes', 'HIGH_VALUE');
    assert.strictEqual(insight.bestAction, 'HUMAN_REVIEW');
    assert.strictEqual(insight.sampleSize, 10);
  });

  test('4. Provider x action insights are calculated', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { provider: 'Provider_B', action: 'PAYMENT_LINK' }),
      ...many(5, { provider: 'Provider_B', action: 'RETRY', actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    assert.strictEqual(findSegment(result, 'providers', 'Provider_B').bestAction, 'PAYMENT_LINK');
  });

  test('5. Retry count x action insights are calculated', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { retry_count: 0, action: 'RETRY' }),
      ...many(5, { retry_count: 2, action: 'RETRY', actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    assert.strictEqual(findSegment(result, 'retryCounts', 0).bestAction, 'RETRY');
    assert.strictEqual(findSegment(result, 'retryCounts', 2).successRate, 0);
  });

  test('6. High-value analysis uses the existing amount threshold', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { amount: 50000.01, action: 'HUMAN_REVIEW' }),
      ...many(5, { amount: 50000.01, action: 'RETRY', actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
      ...many(5, { amount: 50000, action: 'HUMAN_REVIEW' }),
    ]);
    const insight = findSegment(result, 'highValue', 'HIGH_VALUE');
    assert.strictEqual(insight.bestAction, 'HUMAN_REVIEW');
    assert.strictEqual(insight.sampleSize, 10);
  });

  test('7. Action groups below minimum sample size are insufficient', () => {
    const result = calculateRecoveryInsights(many(4));
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.status, 'INSUFFICIENT_DATA');
    assert.strictEqual(insight.bestAction, null);
  });

  test('8. Minimum sample size of five supports an insight', () => {
    const result = calculateRecoveryInsights(many(5));
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.status, 'SUPPORTED');
    assert.strictEqual(insight.confidenceLevel, 'LOW');
  });

  test('9. Confidence labels are deterministic sample-size labels', () => {
    assert.strictEqual(confidenceLevel(4), 'INSUFFICIENT_DATA');
    assert.strictEqual(confidenceLevel(5), 'LOW');
    assert.strictEqual(confidenceLevel(10), 'MEDIUM');
    assert.strictEqual(confidenceLevel(25), 'HIGH');
  });

  test('10. Equal performance uses average amount, total amount, then action name', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { action: 'RETRY', actual_recovered_amount: 100 }),
      ...many(5, { action: 'PAYMENT_LINK', actual_recovered_amount: 100 }),
    ]);
    assert.strictEqual(findSegment(result, 'failureReasons', 'BANK_TIMEOUT').bestAction, 'PAYMENT_LINK');
  });

  test('11. Only verified RECOVERED outcomes count as successful', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { actual_result: 'RECOVERED', verified: false, actual_recovered_amount: 1000 }),
      ...many(5, { opportunity_id: 'OPP_VALID', actual_result: 'RECOVERED', verified: true, actual_recovered_amount: 1000 }),
    ]);
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.successfulRecoveries, 5);
    assert.strictEqual(insight.totalRecoveredAmount, 5000);
  });

  test('12. Predicted recovery is never treated as actual recovery', () => {
    const result = calculateRecoveryInsights(many(5, {
      predicted_probability: 0.99,
      actual_result: 'FAILED',
      actual_recovered_amount: 0,
      verified: false,
    }));
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.successRate, 0);
    assert.strictEqual(insight.totalRecoveredAmount, 0);
  });

  test('13. Simulated or blocked outcomes are not successful recoveries', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { actual_result: 'BLOCKED', actual_recovered_amount: 0, verified: false }),
      ...many(5, { actual_result: 'FAILED', actual_recovered_amount: 0, verified: false }),
    ]);
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.successfulRecoveries, 0);
    assert.strictEqual(insight.totalRecoveredAmount, 0);
  });

  test('14. Invalid records are excluded and counted', () => {
    const result = calculateRecoveryInsights([
      record({ action: '' }),
      record({ failure_reason: '' }),
      record({ customer_type: '' }),
      record({ actual_recovered_amount: -1 }),
      record({ predicted_probability: 2 }),
      ...many(5),
    ]);
    assert.strictEqual(result.invalidRecordCount, 5);
    assert.strictEqual(result.insights.failureReasons[0].sampleSize, 5);
  });

  test('15. Empty dataset returns NO_DATA without fake insights', () => {
    const result = calculateRecoveryInsights([]);
    assert.strictEqual(result.status, 'NO_DATA');
    assert.deepStrictEqual(result.insights, {
      failureReasons: [], customerTypes: [], providers: [], retryCounts: [], highValue: [],
    });
  });

  test('16. Zero recovered amount is finite and non-successful', () => {
    const result = calculateRecoveryInsights(many(5, {
      actual_result: 'FAILED', actual_recovered_amount: 0, verified: false,
    }));
    const insight = findSegment(result, 'failureReasons', 'BANK_TIMEOUT');
    assert.strictEqual(insight.totalRecoveredAmount, 0);
    assert.strictEqual(insight.averageRecoveredAmount, 0);
    assert.strictEqual(insight.successRate, 0);
  });

  test('17. Multiple actions remain separated within each segment', () => {
    const result = calculateRecoveryInsights([
      ...many(5, { action: 'RETRY' }),
      ...many(5, { action: 'PAYMENT_METHOD_UPDATE' }),
      ...many(5, { action: 'NO_ACTION', actual_result: 'NOT_RECOVERED', actual_recovered_amount: 0, verified: false }),
    ]);
    const actions = findSegment(result, 'failureReasons', 'BANK_TIMEOUT').actions;
    assert.deepStrictEqual(actions.map((item) => item.action), ['PAYMENT_METHOD_UPDATE', 'RETRY', 'NO_ACTION']);
  });

  test('18. Repeated execution is deterministic', () => {
    const input = many(5, { action: 'PAYMENT_LINK' });
    assert.deepStrictEqual(calculateRecoveryInsights(input), calculateRecoveryInsights(input));
  });

  test('19. Analytics does not mutate input records', () => {
    const input = many(5);
    const original = JSON.stringify(input);
    calculateRecoveryInsights(input);
    assert.strictEqual(JSON.stringify(input), original);
  });

  test('20. Analytics does not mutate the model or write data', () => {
    const source = require('../src/services/recoveryInsightsService').calculateRecoveryInsights.toString();
    assert.ok(!source.includes('.save('));
    assert.ok(!source.includes('.create('));
    assert.ok(!source.includes('Math.random'));
  });

  test('21. API route exposes read-only analytics and insights GET endpoints', () => {
    for (const path of ['/analytics', '/insights']) {
      const routes = recoveryRoutes.stack.filter((layer) => layer.route?.path === path);
      assert.strictEqual(routes.length, 1);
      assert.strictEqual(routes[0].route.methods.get, true);
      assert.strictEqual(routes[0].route.methods.post, undefined);
    }
  });

  test('22. No action or policy recommendation is changed by insights', () => {
    const result = calculateRecoveryInsights(many(5, { action: 'RETRY' }));
    assert.strictEqual(result.insights.failureReasons[0].bestAction, 'RETRY');
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'policyDecision'));
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      RECOVERY INSIGHTS TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) process.exitCode = 1;
}

runAllTests();
