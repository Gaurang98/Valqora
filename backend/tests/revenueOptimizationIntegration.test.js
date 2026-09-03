const assert = require('assert');
const { evaluatePolicy } = require('../src/services/policyEngine');
const { buildDecisionTrace } = require('../src/services/decisionTraceService');
const {
  buildActionEvaluationInput,
  evaluateOpportunityActions,
} = require('../src/controllers/recoveryController');

let passed = 0;
let total = 0;

function investigation(overrides = {}) {
  return {
    opportunityId: 'OPP_TXN_000501',
    decision: {
      recommendedAction: 'RETRY',
      confidence: 0.9,
    },
    context: {
      opportunityId: 'OPP_TXN_000501',
      transactionId: 'TXN_000501',
      amount: 10000,
      status: 'FAILED',
      failure: { reason: 'BANK_TIMEOUT', retryCount: 0 },
      customer: { customerType: 'REGULAR' },
      mlPrediction: { recoveryProbability: 0.82, isAvailable: true },
      ...overrides,
    },
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

function policyFor(optimizerRecommendation, contextOverrides = {}) {
  const result = investigation(contextOverrides);
  const policyInput = {
    status: result.context.status,
    amount: result.context.amount,
    retry_count: result.context.failure.retryCount,
    failure_reason: result.context.failure.reason,
    riskClassification: result.context.failure.reason === 'SUSPICIOUS_TRANSACTION' ? 'SUSPICIOUS_TRANSACTION' : 'NORMAL',
    aiRecommendedAction: optimizerRecommendation.bestAction,
    aiConfidence: result.decision.confidence,
  };
  return evaluatePolicy(policyInput);
}

function run() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA - REVENUE OPTIMIZATION INTEGRATION TEST SUITE (DAY 5 STEP 10)');
  console.log('='.repeat(88) + '\n');

  test('1. Optimizer evaluates an opportunity through the existing evaluator', () => {
    const result = evaluateOpportunityActions(investigation());
    assert.ok(Array.isArray(result.candidates));
    assert.strictEqual(result.candidates.length, 6);
    assert.ok(result.bestAction);
    assert.ok(Number.isFinite(result.bestExpectedRecovery));
  });

  test('2. Optimizer recommendation is passed to policy as recommendation input', () => {
    const optimizer = { bestAction: 'RETRY' };
    const policy = policyFor(optimizer);
    assert.strictEqual(policy.decision, 'APPROVED');
    assert.strictEqual(policy.action, 'RETRY');
  });

  test('3. Policy blocks an optimizer recommendation without being overridden', () => {
    const policy = policyFor({ bestAction: 'RETRY' }, { failure: { reason: 'BANK_TIMEOUT', retryCount: 2 } });
    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(policy.action, 'HUMAN_REVIEW');
  });

  test('4. Suspicious transactions remain human-review blocks', () => {
    const policy = policyFor({ bestAction: 'RETRY' }, { failure: { reason: 'SUSPICIOUS_TRANSACTION', retryCount: 0 } });
    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(policy.action, 'HUMAN_REVIEW');
  });

  test('5. High-value transactions remain policy-controlled', () => {
    const policy = policyFor({ bestAction: 'RETRY' }, { amount: 50000.01 });
    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(policy.action, 'HUMAN_REVIEW');
  });

  test('6. Low confidence remains a human-review decision', () => {
    const result = investigation();
    const policy = evaluatePolicy({
      status: result.context.status,
      amount: result.context.amount,
      retry_count: result.context.failure.retryCount,
      failure_reason: result.context.failure.reason,
      riskClassification: 'NORMAL',
      aiRecommendedAction: 'RETRY',
      aiConfidence: 0.5,
    });
    assert.strictEqual(policy.decision, 'BLOCKED');
    assert.strictEqual(policy.action, 'HUMAN_REVIEW');
  });

  test('7. Malformed optimization data fails closed', () => {
    assert.throws(() => evaluateOpportunityActions({ context: { amount: 'bad' } }), /Invalid amount|Opportunity ID/);
  });

  test('8. Trace preserves AI, optimizer, policy, and outcome distinctions', () => {
    const trace = buildDecisionTrace({
      opportunityId: 'OPP_TXN_000508',
      transactionId: 'TXN_000508',
      amount: 10000,
      investigation: { aiDecision: { recommendedAction: 'RETRY', confidence: 0.9 }, mlPrediction: { recoveryProbability: 0.82 } },
      optimizerRecommendation: { bestAction: 'RETRY', bestExpectedRecovery: 8200, candidates: [{ action: 'RETRY' }], selectionReason: 'Highest expected recovery' },
      policy: { decision: 'APPROVED', action: 'RETRY', requiresHumanReview: false },
      verification: { verified: false, status: 'FAILED', amountRecovered: 0 },
    });
    assert.deepStrictEqual(trace.events.map((event) => event.type).slice(0, 6), [
      'RISK_DETECTED', 'AI_INVESTIGATION', 'RECOVERY_PREDICTION', 'AI_RECOMMENDATION', 'REVENUE_OPTIMIZATION', 'POLICY_EVALUATION',
    ]);
    assert.strictEqual(trace.events.find((event) => event.type === 'REVENUE_OPTIMIZATION').data.bestAction, 'RETRY');
    assert.strictEqual(trace.events.find((event) => event.type === 'POLICY_EVALUATION').data.decision, 'APPROVED');
    assert.strictEqual(trace.events.find((event) => event.type === 'REVENUE_RECOVERED').data.amount, 0);
  });

  test('9. Optimizer input is derived without mutating investigation data', () => {
    const value = investigation();
    const original = JSON.stringify(value);
    const input = buildActionEvaluationInput(value);
    assert.strictEqual(input.opportunityId, 'OPP_TXN_000501');
    assert.strictEqual(input.recoveryProbability, 0.82);
    assert.strictEqual(JSON.stringify(value), original);
  });

  test('10. Integration contains no execution or randomness in the orchestration helper', () => {
    const source = evaluateOpportunityActions.toString();
    assert.ok(!source.includes('simulateRecoveryAction'));
    assert.ok(!source.includes('Math.random'));
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      REVENUE OPTIMIZATION INTEGRATION SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));
  if (passed !== total) process.exitCode = 1;
}

run();
