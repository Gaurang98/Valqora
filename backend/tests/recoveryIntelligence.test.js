/**
 * Valqora Recovery Intelligence Test Suite (Day 5 Step 8)
 */

const assert = require('assert');
const recoveryRoutes = require('../src/routes/recovery');
const {
  calculateRecoveryIntelligence,
  confidenceForSample,
} = require('../src/services/recoveryIntelligenceService');

let passed = 0;
let total = 0;

function actionPerformance(overrides = {}) {
  return {
    action: 'RETRY',
    totalOutcomes: 10,
    successfulRecoveries: 8,
    successRate: 80,
    totalRecoveredAmount: 8000,
    averageRecoveredAmount: 1000,
    ...overrides,
  };
}

function contextInsight(overrides = {}) {
  return {
    dimension: 'failure_reason',
    segment: 'BANK_TIMEOUT',
    status: 'SUPPORTED',
    bestAction: 'RETRY',
    sampleSize: 10,
    successfulRecoveries: 8,
    successRate: 0.8,
    totalRecoveredAmount: 8000,
    averageRecoveredAmount: 1000,
    confidenceLevel: 'MEDIUM',
    ...overrides,
  };
}

function performance(overrides = {}) {
  return {
    totalRecords: 20,
    invalidRecordCount: 0,
    verifiedRecoveries: 12,
    totalRecoveredAmount: 12000,
    actualRecoveryRate: 60,
    meanPredictedProbability: 0.65,
    brierScore: 0.18,
    calibration: [
      { bucket: '0.80-1.00', count: 20, calibrationError: 0.1 },
    ],
    actionPerformance: [actionPerformance()],
    ...overrides,
  };
}

function insights(overrides = {}) {
  return {
    status: 'OK',
    invalidRecordCount: 0,
    insights: {
      failureReasons: [contextInsight()],
      customerTypes: [],
      providers: [],
      retryCounts: [],
      highValue: [],
      ...overrides,
    },
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
  console.log('     VALQORA - RECOVERY INTELLIGENCE TEST SUITE (DAY 5 STEP 8)');
  console.log('='.repeat(88) + '\n');

  test('1. Empty dataset returns NO_DATA', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({ totalRecords: 0, brierScore: null, actionPerformance: [] }),
      recoveryInsights: insights({ failureReasons: [] }),
    });
    assert.strictEqual(result.status, 'NO_DATA');
    assert.deepStrictEqual(result.insights.actionPerformance, []);
  });

  test('2. Valid action aggregation is surfaced', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({ actionPerformance: [actionPerformance()] }),
      recoveryInsights: insights(),
    });
    assert.deepStrictEqual(result.insights.actionPerformance[0], {
      action: 'RETRY',
      sampleSize: 10,
      successRate: 80,
      recoveredRevenue: 8000,
      averageRecoveredAmount: 1000,
      successfulRecoveries: 8,
      confidenceLevel: 'MEDIUM',
      status: 'SUPPORTED',
    });
  });

  test('3. Highest observed success rate is identified', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({
        actionPerformance: [
          actionPerformance({ action: 'RETRY', successRate: 70 }),
          actionPerformance({ action: 'PAYMENT_LINK', successRate: 90, totalRecoveredAmount: 5000 }),
        ],
      }),
      recoveryInsights: insights(),
    });
    assert.strictEqual(result.insights.highlights.highestObservedSuccessRate.action, 'PAYMENT_LINK');
  });

  test('4. Highest observed recovered revenue is identified independently', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({
        actionPerformance: [
          actionPerformance({ action: 'RETRY', successRate: 90, totalRecoveredAmount: 3000 }),
          actionPerformance({ action: 'PAYMENT_LINK', successRate: 70, totalRecoveredAmount: 9000 }),
        ],
      }),
      recoveryInsights: insights(),
    });
    assert.strictEqual(result.insights.highlights.highestObservedRecoveredRevenue.action, 'PAYMENT_LINK');
    assert.strictEqual(result.insights.highlights.highestObservedSuccessRate.action, 'RETRY');
  });

  test('5. Tiny action samples do not produce highlights', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({ actionPerformance: [actionPerformance({ totalOutcomes: 4 })] }),
      recoveryInsights: insights(),
    });
    assert.strictEqual(result.insights.highlights.highestObservedSuccessRate, null);
  });

  test('6. Insufficient contextual data is explicit', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance(),
      recoveryInsights: insights({ failureReasons: [contextInsight({ status: 'INSUFFICIENT_DATA', bestAction: null, sampleSize: 2, confidenceLevel: 'INSUFFICIENT_DATA' })] }),
    });
    assert.strictEqual(result.insights.failureReasons[0].status, 'INSUFFICIENT_DATA');
    assert.strictEqual(result.insights.failureReasons[0].bestAction, null);
    assert.strictEqual(result.insights.insufficientEvidence.length, 1);
  });

  test('7. LOW confidence is preserved', () => {
    assert.strictEqual(confidenceForSample(5), 'LOW');
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance(),
      recoveryInsights: insights({ failureReasons: [contextInsight({ sampleSize: 5, confidenceLevel: 'LOW' })] }),
    });
    assert.strictEqual(result.insights.failureReasons[0].confidenceLevel, 'LOW');
  });

  test('8. MEDIUM confidence is preserved', () => {
    assert.strictEqual(confidenceForSample(10), 'MEDIUM');
  });

  test('9. HIGH confidence is preserved', () => {
    assert.strictEqual(confidenceForSample(25), 'HIGH');
  });

  test('10. Failure reason insight is surfaced as an observation', () => {
    const result = calculateRecoveryIntelligence({ performanceAnalytics: performance(), recoveryInsights: insights() });
    assert.strictEqual(result.insights.failureReasons[0].bestAction, 'RETRY');
    assert.ok(result.insights.failureReasons[0].observation.includes('observed'));
  });

  test('11. Customer type insight is surfaced', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance(),
      recoveryInsights: insights({ customerTypes: [contextInsight({ segment: 'HIGH_VALUE' })] }),
    });
    assert.strictEqual(result.insights.customerTypes[0].context, 'HIGH_VALUE');
  });

  test('12. Provider insight is surfaced without causal language', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance(),
      recoveryInsights: insights({ providers: [contextInsight({ segment: 'Provider_A' })] }),
    });
    assert.ok(result.insights.providers[0].observation.includes('observed'));
    assert.ok(!result.insights.providers[0].observation.includes('causes'));
  });

  test('13. Retry-count insight is surfaced', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance(),
      recoveryInsights: insights({ retryCounts: [contextInsight({ segment: '2', bestAction: null, status: 'INSUFFICIENT_DATA', sampleSize: 2, confidenceLevel: 'INSUFFICIENT_DATA' })] }),
    });
    assert.strictEqual(result.insights.retryCounts[0].context, '2');
  });

  test('14. High-value insight is surfaced', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance(),
      recoveryInsights: insights({ highValue: [contextInsight({ segment: 'HIGH_VALUE' })] }),
    });
    assert.strictEqual(result.insights.highValue[0].context, 'HIGH_VALUE');
  });

  test('15. Prediction metrics are composed from Performance Analytics', () => {
    const result = calculateRecoveryIntelligence({ performanceAnalytics: performance(), recoveryInsights: insights() });
    assert.deepStrictEqual(result.insights.predictionQuality, {
      brierScore: 0.18,
      calibrationError: 0.1,
      meanPredictedProbability: 0.65,
      actualRecoveryRate: 60,
      observation: 'Prediction performance is being evaluated against verified recovery outcomes.',
    });
  });

  test('16. Verified recovery semantics remain delegated to existing analytics', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({ verifiedRecoveries: 3, totalRecoveredAmount: 3000 }),
      recoveryInsights: insights(),
    });
    assert.strictEqual(result.insights.predictionQuality.actualRecoveryRate, 60);
    assert.strictEqual(result.insights.actionPerformance[0].recoveredRevenue, 8000);
  });

  test('17. Unverified and simulated recovery are not introduced', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({ actionPerformance: [actionPerformance({ totalRecoveredAmount: 0, successfulRecoveries: 0, successRate: 0 })] }),
      recoveryInsights: insights(),
    });
    assert.strictEqual(result.insights.actionPerformance[0].recoveredRevenue, 0);
  });

  test('18. Invalid record counts are preserved', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({ invalidRecordCount: 3 }),
      recoveryInsights: { ...insights(), invalidRecordCount: 4 },
    });
    assert.strictEqual(result.invalidRecordCount, 4);
  });

  test('19. Malformed analytics input fails safely', () => {
    assert.throws(() => calculateRecoveryIntelligence({ performanceAnalytics: null, recoveryInsights: insights() }), /Performance analytics/);
    assert.throws(() => calculateRecoveryIntelligence({ performanceAnalytics: performance(), recoveryInsights: null }), /Recovery insights/);
  });

  test('20. Repeated execution is deterministic', () => {
    const input = { performanceAnalytics: performance(), recoveryInsights: insights() };
    assert.deepStrictEqual(calculateRecoveryIntelligence(input), calculateRecoveryIntelligence(input));
  });

  test('21. Input objects are not mutated', () => {
    const input = { performanceAnalytics: performance(), recoveryInsights: insights() };
    const original = JSON.stringify(input);
    calculateRecoveryIntelligence(input);
    assert.strictEqual(JSON.stringify(input), original);
  });

  test('22. Output contains no NaN or Infinity', () => {
    const result = calculateRecoveryIntelligence({ performanceAnalytics: performance(), recoveryInsights: insights() });
    assert.ok(!JSON.stringify(result).includes('NaN'));
    assert.ok(!JSON.stringify(result).includes('Infinity'));
  });

  test('23. Stable tie-breaking is action-name ordered', () => {
    const result = calculateRecoveryIntelligence({
      performanceAnalytics: performance({ actionPerformance: [
        actionPerformance({ action: 'RETRY', successRate: 80, totalRecoveredAmount: 8000 }),
        actionPerformance({ action: 'PAYMENT_LINK', successRate: 80, totalRecoveredAmount: 8000 }),
      ] }),
      recoveryInsights: insights(),
    });
    assert.strictEqual(result.insights.highlights.highestObservedSuccessRate.action, 'PAYMENT_LINK');
  });

  test('24. Intelligence output remains observational', () => {
    const result = calculateRecoveryIntelligence({ performanceAnalytics: performance(), recoveryInsights: insights() });
    const serialized = JSON.stringify(result).toLowerCase();
    assert.ok(serialized.includes('observed'));
    assert.ok(!serialized.includes('always use'));
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'policyDecision'));
  });

  test('25. API route exposes read-only intelligence GET endpoint', () => {
    const routes = recoveryRoutes.stack.filter((layer) => layer.route?.path === '/intelligence');
    assert.strictEqual(routes.length, 1);
    assert.strictEqual(routes[0].route.methods.get, true);
    assert.strictEqual(routes[0].route.methods.post, undefined);
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      RECOVERY INTELLIGENCE TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) process.exitCode = 1;
}

runAllTests();
