/**
 * Valqora Decision Trace Test Suite (Day 4 Step 6)
 */

const assert = require('assert');
const {
  buildDecisionTrace,
  createTraceEvent,
  normalizeTraceStatus,
} = require('../src/services/decisionTraceService');

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
  console.log('     VALQORA — DECISION TRACE TEST SUITE (DAY 4 STEP 6)');
  console.log('='.repeat(88) + '\n');

  test('1. Successful recovery trace', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000100',
      transactionId: 'TXN_000100',
      amount: 8499,
      investigation: {
        rootCause: 'Provider timeout',
        confidence: 0.87,
        mlPrediction: { recoveryProbability: 0.87, isAvailable: true, model: 'RandomForestClassifier' },
      },
      policy: { decision: 'APPROVED', action: 'RETRY', requiresHumanReview: false, reason: 'Temporary failure and policy conditions satisfied' },
      simulation: { simulated: true, executed: true, action: 'RETRY_PAYMENT', status: 'SUCCESS', amountRecovered: 8499 },
      verification: { verified: true, status: 'SUCCESS', amountRecovered: 8499 },
      metrics: { revenueRecovered: 8499 },
    });

    const types = trace.events.map((event) => event.type);
    assert.deepStrictEqual(types.slice(0, 8), [
      'RISK_DETECTED',
      'AI_INVESTIGATION',
      'RECOVERY_PREDICTION',
      'AI_RECOMMENDATION',
      'POLICY_EVALUATION',
      'RECOVERY_ACTION',
      'VERIFICATION',
      'REVENUE_RECOVERED',
    ]);
    assert.strictEqual(trace.events[trace.events.length - 1].data.amount, 8499);
  });

  test('2. Failed recovery', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000200',
      transactionId: 'TXN_000200',
      amount: 4200,
      investigation: {
        rootCause: 'Temporary issue',
        confidence: 0.76,
        mlPrediction: { recoveryProbability: 0.62, isAvailable: true, model: 'RandomForestClassifier' },
      },
      policy: { decision: 'APPROVED', action: 'RETRY', requiresHumanReview: false, reason: 'Temporary failure and policy conditions satisfied' },
      simulation: { simulated: true, executed: true, action: 'RETRY_PAYMENT', status: 'FAILED', amountRecovered: 0 },
      verification: { verified: false, status: 'FAILED', amountRecovered: 0 },
      metrics: { revenueRecovered: 0 },
    });

    const recoveryEvent = trace.events.find((event) => event.type === 'RECOVERY_ACTION');
    const verificationEvent = trace.events.find((event) => event.type === 'VERIFICATION');
    const revenueEvent = trace.events.find((event) => event.type === 'REVENUE_RECOVERED');
    assert.strictEqual(recoveryEvent.status, 'FAILED');
    assert.strictEqual(verificationEvent.status, 'FAILED');
    assert.strictEqual(revenueEvent.data.amount, 0);
  });

  test('3. Policy blocked', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000300',
      transactionId: 'TXN_000300',
      amount: 60000,
      investigation: {
        rootCause: 'High-value failed retry',
        confidence: 0.62,
        mlPrediction: { recoveryProbability: 0.71, isAvailable: true, model: 'RandomForestClassifier' },
      },
      policy: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', requiresHumanReview: true, reason: 'Transaction exceeds automatic recovery limit of 50000', rulesEvaluated: ['HIGH_VALUE_TRANSACTION'] },
    });

    const policyEvent = trace.events.find((event) => event.type === 'POLICY_EVALUATION');
    const recoveryEvent = trace.events.find((event) => event.type === 'RECOVERY_ACTION');
    const revenueEvent = trace.events.find((event) => event.type === 'REVENUE_RECOVERED');
    assert.strictEqual(policyEvent.status, 'BLOCKED');
    assert.strictEqual(recoveryEvent.status, 'NOT_EXECUTED');
    assert.strictEqual(revenueEvent.data.amount, 0);
  });

  test('4. Human review approved', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000400',
      transactionId: 'TXN_000400',
      amount: 54000,
      investigation: {
        rootCause: 'Low confidence / high-value decision',
        confidence: 0.68,
        mlPrediction: { recoveryProbability: 0.69, isAvailable: true, model: 'RandomForestClassifier' },
      },
      policy: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', requiresHumanReview: true, reason: 'AI confidence below minimum policy threshold (0.7)', rulesEvaluated: ['CONFIDENCE_THRESHOLD'] },
      review: { status: 'APPROVED', reviewerDecision: 'APPROVED' },
      simulation: { simulated: true, executed: true, action: 'RETRY_PAYMENT', status: 'SUCCESS', amountRecovered: 54000 },
      verification: { verified: true, status: 'SUCCESS', amountRecovered: 54000 },
      metrics: { revenueRecovered: 54000 },
    });

    const humanEvent = trace.events.find((event) => event.type === 'HUMAN_REVIEW');
    assert.strictEqual(humanEvent.status, 'APPROVED');
  });

  test('5. Human review rejected', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000500',
      transactionId: 'TXN_000500',
      amount: 45000,
      investigation: {
        rootCause: 'Insufficient confidence',
        confidence: 0.65,
        mlPrediction: { recoveryProbability: 0.68, isAvailable: true, model: 'RandomForestClassifier' },
      },
      policy: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', requiresHumanReview: true, reason: 'AI confidence below minimum policy threshold (0.7)', rulesEvaluated: ['CONFIDENCE_THRESHOLD'] },
      review: { status: 'REJECTED', reviewerDecision: 'REJECTED' },
    });

    const humanEvent = trace.events.find((event) => event.type === 'HUMAN_REVIEW');
    const recoveryEvent = trace.events.find((event) => event.type === 'RECOVERY_ACTION');
    const revenueEvent = trace.events.find((event) => event.type === 'REVENUE_RECOVERED');
    assert.strictEqual(humanEvent.status, 'REJECTED');
    assert.strictEqual(recoveryEvent.status, 'NOT_EXECUTED');
    assert.strictEqual(revenueEvent.data.amount, 0);
  });

  test('6. Suspicious transaction', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000600',
      transactionId: 'TXN_000600',
      amount: 3200,
      investigation: {
        rootCause: 'Security escalation',
        confidence: 0.94,
        mlPrediction: { recoveryProbability: 0.96, isAvailable: true, model: 'RandomForestClassifier' },
      },
      policy: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', requiresHumanReview: true, reason: 'Transaction classified as suspicious; automatic recovery is not permitted', rulesEvaluated: ['SUSPICIOUS_TRANSACTION'] },
      review: { status: 'REJECTED', reviewerDecision: 'REJECTED' },
    });

    const policyEvent = trace.events.find((event) => event.type === 'POLICY_EVALUATION');
    const recoveryEvent = trace.events.find((event) => event.type === 'RECOVERY_ACTION');
    assert.strictEqual(policyEvent.status, 'BLOCKED');
    assert.strictEqual(recoveryEvent.status, 'NOT_EXECUTED');
  });

  test('7. Existing successful transaction', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000700',
      transactionId: 'TXN_000700',
      amount: 2500,
      investigation: {
        rootCause: 'Successful transaction should not be recoverable',
        confidence: 0.5,
        mlPrediction: { recoveryProbability: 0.1, isAvailable: true, model: 'RandomForestClassifier' },
      },
      policy: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', requiresHumanReview: true, reason: 'Successful transactions cannot be automatically recovered', rulesEvaluated: ['SUCCESS_TRANSACTION'] },
    });

    const revenueEvent = trace.events.find((event) => event.type === 'REVENUE_RECOVERED');
    assert.strictEqual(revenueEvent.data.amount, 0);
  });

  test('8. Trace ordering is deterministic', () => {
    const traceA = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000800',
      transactionId: 'TXN_000800',
      amount: 1000,
      investigation: { rootCause: 'A', confidence: 0.8, mlPrediction: { recoveryProbability: 0.8, isAvailable: true } },
      policy: { decision: 'APPROVED', action: 'RETRY', requiresHumanReview: false, reason: 'Temporary failure and policy conditions satisfied' },
      verification: { verified: true, status: 'SUCCESS', amountRecovered: 1000 },
    });
    const traceB = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000800',
      transactionId: 'TXN_000800',
      amount: 1000,
      investigation: { rootCause: 'A', confidence: 0.8, mlPrediction: { recoveryProbability: 0.8, isAvailable: true } },
      policy: { decision: 'APPROVED', action: 'RETRY', requiresHumanReview: false, reason: 'Temporary failure and policy conditions satisfied' },
      verification: { verified: true, status: 'SUCCESS', amountRecovered: 1000 },
    });

    assert.deepStrictEqual(traceA.events.map((event) => event.type), traceB.events.map((event) => event.type));
  });

  test('9. Missing optional data does not crash', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000900',
      transactionId: 'TXN_000900',
      amount: 1500,
      investigation: {},
      policy: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', requiresHumanReview: true, reason: 'Manual review required' },
    });

    assert.ok(Array.isArray(trace.events));
    assert.ok(trace.events.length > 0);
  });

  console.log('\n' + '='.repeat(88));
  console.log('      DECISION TRACE TEST SUMMARY: COMPLETE');
  console.log('='.repeat(88));
}

run();
