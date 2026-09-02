/**
 * Valqora Opportunity Ranking Engine Test Suite (Day 5 Step 2)
 */

const assert = require('assert');
const {
  rankOpportunity,
  rankOpportunities,
} = require('../src/services/opportunityRankingService');

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

function opportunity(id, amount = 10000, factors = {}) {
  return {
    opportunityId: id,
    amount,
    priority: 'HIGH',
    urgency: 0.8,
    customerValue: 0.7,
    confidence: 0.82,
    ...factors,
  };
}

function evaluation(action, expectedRecovery, probability = 0.8) {
  return {
    candidates: [
      { action, recoveryProbability: probability, expectedRecovery },
      { action: 'NO_ACTION', recoveryProbability: 0, expectedRecovery: 0 },
    ],
  };
}

function run() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA — OPPORTUNITY RANKING TEST SUITE (DAY 5 STEP 2)');
  console.log('='.repeat(88) + '\n');

  test('1. Consumes best expected recovery from Action Evaluation output', () => {
    const result = rankOpportunity(opportunity('OPP_001', 10000), evaluation('RETRY', 8200));
    assert.strictEqual(result.bestAction, 'RETRY');
    assert.strictEqual(result.bestExpectedRecovery, 8200);
    assert.strictEqual(result.rankingFactors.expectedRecovery, 8200);
  });

  test('2. Calculates the transparent priority score', () => {
    const result = rankOpportunity(opportunity('OPP_002'), evaluation('RETRY', 8200));
    assert.strictEqual(result.priorityScore, 3765.44);
  });

  test('3. Higher expected recovery outranks higher recovery probability', () => {
    const result = rankOpportunities([
      opportunity('OPP_LOW_AMOUNT', 2000, { confidence: 0.95 }),
      opportunity('OPP_HIGH_AMOUNT', 50000, { confidence: 0.6 }),
    ].map((item, index) => ({
      ...item,
      actionEvaluation: index === 0 ? evaluation('RETRY', 1900, 0.95) : evaluation('RETRY', 30000, 0.6),
    })));
    assert.strictEqual(result.topOpportunityId, 'OPP_HIGH_AMOUNT');
  });

  test('4. Urgency affects priority', () => {
    const low = rankOpportunity(opportunity('OPP_LOW', 10000, { urgency: 0.4 }), evaluation('RETRY', 5000));
    const high = rankOpportunity(opportunity('OPP_HIGH', 10000, { urgency: 1 }), evaluation('RETRY', 5000));
    assert.ok(high.priorityScore > low.priorityScore);
  });

  test('5. Customer value affects priority', () => {
    const low = rankOpportunity(opportunity('OPP_LOW', 10000, { customerValue: 0.4 }), evaluation('RETRY', 5000));
    const high = rankOpportunity(opportunity('OPP_HIGH', 10000, { customerValue: 1 }), evaluation('RETRY', 5000));
    assert.ok(high.priorityScore > low.priorityScore);
  });

  test('6. Confidence affects priority', () => {
    const low = rankOpportunity(opportunity('OPP_LOW', 10000, { confidence: 0.4 }), evaluation('RETRY', 5000));
    const high = rankOpportunity(opportunity('OPP_HIGH', 10000, { confidence: 1 }), evaluation('RETRY', 5000));
    assert.ok(high.priorityScore > low.priorityScore);
  });

  test('7. Equal scores use expected recovery, amount, then ID', () => {
    const result = rankOpportunities([
      { ...opportunity('OPP_Z', 10000), actionEvaluation: evaluation('RETRY', 5000) },
      { ...opportunity('OPP_A', 9000), actionEvaluation: evaluation('RETRY', 5000) },
    ]);
    assert.deepStrictEqual(result.rankedOpportunities.map((item) => item.opportunityId), ['OPP_Z', 'OPP_A']);
  });

  test('8. Single opportunity returns a top opportunity', () => {
    const result = rankOpportunities([{ ...opportunity('OPP_SINGLE'), actionEvaluation: evaluation('PAYMENT_LINK', 4000) }]);
    assert.strictEqual(result.rankedOpportunities.length, 1);
    assert.strictEqual(result.topOpportunityId, 'OPP_SINGLE');
  });

  test('9. Multiple opportunities are sorted descending by score', () => {
    const result = rankOpportunities([
      { ...opportunity('OPP_1'), actionEvaluation: evaluation('RETRY', 1000) },
      { ...opportunity('OPP_2'), actionEvaluation: evaluation('RETRY', 9000) },
      { ...opportunity('OPP_3'), actionEvaluation: evaluation('RETRY', 5000) },
    ]);
    assert.deepStrictEqual(result.rankedOpportunities.map((item) => item.opportunityId), ['OPP_2', 'OPP_3', 'OPP_1']);
  });

  test('10. Zero amount produces a finite zero score', () => {
    const result = rankOpportunity(opportunity('OPP_ZERO', 0), evaluation('NO_ACTION', 0));
    assert.strictEqual(result.priorityScore, 0);
    assert.ok(Number.isFinite(result.priorityScore));
  });

  test('11. Invalid and negative amounts fail closed', () => {
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD', -1), evaluation('RETRY', 1)), /Invalid amount/);
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD', 'NaN'), evaluation('RETRY', 1)), /Invalid amount/);
  });

  test('12. Missing evaluation fails closed when explicitly supplied', () => {
    assert.throws(() => rankOpportunity(opportunity('OPP_MISSING'), null), /Missing action evaluation/);
  });

  test('13. Invalid and outside-range probabilities fail closed', () => {
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_PROB'), evaluation('RETRY', 100, NaN)), /Invalid recovery probability/);
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_PROB'), evaluation('RETRY', 100, 1.1)), /Invalid recovery probability/);
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_PROB'), evaluation('RETRY', 100, -0.1)), /Invalid recovery probability/);
  });

  test('14. Invalid ranking factors fail closed', () => {
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_URGENCY', 100, { urgency: 2 }), evaluation('RETRY', 50)), /Invalid urgency/);
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_VALUE', 100, { customerValue: Infinity }), evaluation('RETRY', 50)), /Invalid customer value/);
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_CONFIDENCE', 100, { confidence: 'bad' }), evaluation('RETRY', 50)), /Invalid confidence/);
  });

  test('15. Missing factors use documented finite defaults', () => {
    const result = rankOpportunity({ opportunityId: 'OPP_DEFAULTS', amount: 1000 }, evaluation('RETRY', 500));
    assert.deepStrictEqual(result.rankingFactors, {
      expectedRecovery: 500,
      urgency: 0.5,
      customerValue: 0.7,
      confidence: 0.5,
    });
    assert.ok(Number.isFinite(result.priorityScore));
  });

  test('16. Invalid expected recovery and missing candidates fail closed', () => {
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_EVAL'), { candidates: [] }), /Invalid action evaluation/);
    assert.throws(() => rankOpportunity(opportunity('OPP_BAD_EVAL'), evaluation('RETRY', Infinity)), /Invalid expected recovery/);
  });

  test('17. Ranking is deterministic and does not use randomness', () => {
    const inputs = [
      { ...opportunity('OPP_A'), actionEvaluation: evaluation('RETRY', 5000) },
      { ...opportunity('OPP_B'), actionEvaluation: evaluation('PAYMENT_LINK', 5000) },
    ];
    const first = rankOpportunities(inputs);
    const second = rankOpportunities(inputs);
    assert.deepStrictEqual(first, second);
    assert.ok(!JSON.stringify(first).toLowerCase().includes('random'));
  });

  test('18. The service does not mutate input objects', () => {
    const input = { ...opportunity('OPP_IMMUTABLE'), actionEvaluation: evaluation('RETRY', 5000) };
    const original = JSON.stringify(input);
    rankOpportunities([input]);
    assert.strictEqual(JSON.stringify(input), original);
  });

  console.log('\n' + '='.repeat(88));
  console.log('      OPPORTUNITY RANKING TEST SUMMARY: COMPLETE');
  console.log('='.repeat(88));
}

run();
