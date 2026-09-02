const assert = require('assert');
const recoveryRoutes = require('../src/routes/recovery');
const {
  REPORT_BOUNDARY,
  evidenceLevel,
  calculateModelImprovementReport,
} = require('../src/services/modelImprovementService');

let passed = 0;
let total = 0;

function action(actionName = 'RETRY', overrides = {}) {
  return {
    action: actionName,
    totalOutcomes: 10,
    successfulRecoveries: 6,
    successRate: 60,
    totalRecoveredAmount: 6000,
    averageRecoveredAmount: 1000,
    ...overrides,
  };
}

function context(segment = 'BANK_TIMEOUT', overrides = {}) {
  return {
    segment,
    status: 'SUPPORTED',
    bestAction: 'RETRY',
    sampleSize: 10,
    successRate: 0.6,
    totalRecoveredAmount: 6000,
    averageRecoveredAmount: 1000,
    confidenceLevel: 'MEDIUM',
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    performanceAnalytics: {
      totalRecords: 20,
      invalidRecordCount: 2,
      verifiedRecoveries: 12,
      meanPredictedProbability: 0.65,
      actualRecoveryRate: 60,
      brierScore: 0.18,
      calibration: [{ bucket: '0.80-1.00', count: 10, averagePredictedProbability: 0.9, actualRecoveryRate: 80, calibrationError: 0.1 }],
      actionPerformance: [action()],
    },
    recoveryInsights: {
      invalidRecordCount: 2,
      insights: {
        failureReasons: [context()],
        customerTypes: [],
        providers: [],
        retryCounts: [],
        highValue: [],
      },
    },
    recoveryIntelligence: {
      insights: { predictionQuality: { calibrationError: 0.1 } },
    },
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

function run() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA - MODEL IMPROVEMENT TEST SUITE (DAY 5 STEP 9)');
  console.log('='.repeat(88) + '\n');

  test('1. Empty dataset returns NO_DATA', () => {
    const result = calculateModelImprovementReport({
      performanceAnalytics: { totalRecords: 0, invalidRecordCount: 0, verifiedRecoveries: 0, brierScore: null, calibration: [], actionPerformance: [] },
      recoveryInsights: { invalidRecordCount: 0, insights: {} },
    });
    assert.strictEqual(result.status, 'NO_DATA');
    assert.deepStrictEqual(result.futureImprovementAreas, []);
  });

  test('2. Valid dataset returns structured report', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.status, 'OK');
    assert.ok(result.summary);
    assert.ok(result.predictionPerformance);
    assert.ok(result.dataQuality);
  });

  test('3. Prediction performance is composed', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.predictionPerformance.sampleSize, 20);
    assert.strictEqual(result.predictionPerformance.brierScore, 0.18);
    assert.strictEqual(result.predictionPerformance.actualRecoveryRate, 60);
  });

  test('4. Calibration review uses existing buckets', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.calibrationIssues[0].predictionRange, '0.80-1.00');
    assert.strictEqual(result.calibrationIssues[0].status, 'CALIBRATION_REVIEW');
  });

  test('5. Action performance includes existing metrics', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.actionPerformance[0].action, 'RETRY');
    assert.strictEqual(result.actionPerformance[0].recoveredRevenue, 6000);
    assert.strictEqual(result.actionPerformance[0].sampleSize, 10);
  });

  test('6. Contextual failure reason feedback is surfaced', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.contextualOpportunities[0].context, 'BANK_TIMEOUT');
    assert.strictEqual(result.contextualOpportunities[0].observedBestAction, 'RETRY');
  });

  test('7. Customer context feedback is surfaced', () => {
    const result = calculateModelImprovementReport(input({ recoveryInsights: { insights: { customerTypes: [context('HIGH_VALUE') ] } } }));
    assert.strictEqual(result.contextualOpportunities[0].dimension, 'CUSTOMER_TYPE');
  });

  test('8. Provider context feedback is surfaced', () => {
    const result = calculateModelImprovementReport(input({ recoveryInsights: { insights: { providers: [context('Provider_A') ] } } }));
    assert.strictEqual(result.contextualOpportunities[0].dimension, 'PROVIDER');
  });

  test('9. Retry-count context feedback is surfaced', () => {
    const result = calculateModelImprovementReport(input({ recoveryInsights: { insights: { retryCounts: [context('2') ] } } }));
    assert.strictEqual(result.contextualOpportunities[0].dimension, 'RETRY_COUNT');
  });

  test('10. High-value context feedback is surfaced', () => {
    const result = calculateModelImprovementReport(input({ recoveryInsights: { insights: { highValue: [context('HIGH_VALUE') ] } } }));
    assert.strictEqual(result.contextualOpportunities[0].dimension, 'HIGH_VALUE');
  });

  test('11. Sufficient evidence is preserved', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.contextualOpportunities[0].improvementRelevance, 'SUFFICIENT_DATA');
    assert.strictEqual(result.contextualOpportunities[0].confidence, 'MEDIUM');
  });

  test('12. Insufficient evidence has no observed action', () => {
    const result = calculateModelImprovementReport(input({ recoveryInsights: { insights: { failureReasons: [context('RARE_ERROR', { status: 'INSUFFICIENT_DATA', bestAction: null, sampleSize: 2, confidenceLevel: 'INSUFFICIENT_DATA' })] } } }));
    assert.strictEqual(result.contextualOpportunities[0].observedBestAction, null);
    assert.strictEqual(result.contextualOpportunities[0].improvementRelevance, 'LOW_EVIDENCE');
  });

  test('13. Evidence labels match existing sample semantics', () => {
    assert.strictEqual(evidenceLevel(4), 'INSUFFICIENT_DATA');
    assert.strictEqual(evidenceLevel(5), 'LOW_EVIDENCE');
    assert.strictEqual(evidenceLevel(10), 'MEDIUM_EVIDENCE');
    assert.strictEqual(evidenceLevel(25), 'HIGH_EVIDENCE');
  });

  test('14. Low evidence action is listed for future review', () => {
    const result = calculateModelImprovementReport(input({ performanceAnalytics: { ...input().performanceAnalytics, actionPerformance: [action('PAYMENT_LINK', { totalOutcomes: 2 })] } }));
    assert.ok(result.futureImprovementAreas.some((item) => item.area.includes('PAYMENT_LINK')));
  });

  test('15. Medium evidence calibration issue is listed', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.futureImprovementAreas[0].evidenceLevel, 'MEDIUM_EVIDENCE');
  });

  test('16. High evidence label is used for large calibration bucket', () => {
    const result = calculateModelImprovementReport(input({ performanceAnalytics: { ...input().performanceAnalytics, calibration: [{ bucket: '0.60-0.79', count: 25, calibrationError: 0.2 }] } }));
    assert.strictEqual(result.calibrationIssues[0].evidenceLevel, 'HIGH_EVIDENCE');
  });

  test('17. Verified recovery values come from analytics output', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.summary.verifiedRecoveries, 12);
    assert.strictEqual(result.actionPerformance[0].recoveredRevenue, 6000);
  });

  test('18. Unverified or simulated recovery is not invented', () => {
    const result = calculateModelImprovementReport(input({ performanceAnalytics: { ...input().performanceAnalytics, verifiedRecoveries: 0, actionPerformance: [action('RETRY', { successfulRecoveries: 0, successRate: 0, totalRecoveredAmount: 0, averageRecoveredAmount: 0 })] } }));
    assert.strictEqual(result.summary.verifiedRecoveries, 0);
    assert.strictEqual(result.actionPerformance[0].recoveredRevenue, 0);
  });

  test('19. Invalid record counts are reported', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.dataQuality.invalidRecords, 2);
    assert.strictEqual(result.dataQuality.validRecords, 20);
  });

  test('20. Malformed report input fails safely', () => {
    assert.throws(() => calculateModelImprovementReport({ performanceAnalytics: null, recoveryInsights: {} }), /Performance analytics/);
    assert.throws(() => calculateModelImprovementReport({ performanceAnalytics: {}, recoveryInsights: null }), /Recovery insights/);
  });

  test('21. Output is deterministic', () => {
    assert.deepStrictEqual(calculateModelImprovementReport(input()), calculateModelImprovementReport(input()));
  });

  test('22. Input is not mutated', () => {
    const value = input();
    const original = JSON.stringify(value);
    calculateModelImprovementReport(value);
    assert.strictEqual(JSON.stringify(value), original);
  });

  test('23. Output has no NaN or Infinity', () => {
    const serialized = JSON.stringify(calculateModelImprovementReport(input()));
    assert.ok(!serialized.includes('NaN'));
    assert.ok(!serialized.includes('Infinity'));
  });

  test('24. Improvement areas have stable ordering and cautious wording', () => {
    const result = calculateModelImprovementReport(input());
    const areas = result.futureImprovementAreas.map((item) => item.area);
    assert.deepStrictEqual(areas, [...areas].sort());
    assert.ok(result.contextualOpportunities[0].observation.includes('reviewing'));
  });

  test('25. Report boundary forbids automatic model changes', () => {
    const result = calculateModelImprovementReport(input());
    assert.strictEqual(result.boundary, REPORT_BOUNDARY);
    const serialized = JSON.stringify(result).toLowerCase();
    assert.ok(!serialized.includes('retrain=true'));
    assert.ok(!serialized.includes('applychanges'));
    assert.ok(!serialized.includes('newmodelparameters'));
  });

  test('26. API route exposes read-only model-improvement GET endpoint', () => {
    const routes = recoveryRoutes.stack.filter((layer) => layer.route?.path === '/model-improvement');
    assert.strictEqual(routes.length, 1);
    assert.strictEqual(routes[0].route.methods.get, true);
    assert.strictEqual(routes[0].route.methods.post, undefined);
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      MODEL IMPROVEMENT TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));
  if (passed !== total) process.exitCode = 1;
}

run();
