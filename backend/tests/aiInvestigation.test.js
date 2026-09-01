/**
 * Valqora AI Investigation Engine Foundation — Test Suite (Day 3 Step 1)
 *
 * Verifies all 13 core contract, leakage, safety, and validation requirements:
 * 1. Valid investigation context constructed from real opportunity/transaction.
 * 2. Context contains only relevant fields.
 * 3. No ground_truth_action is passed to AI context.
 * 4. No ground_truth_priority is passed to AI context.
 * 5. is_recoverable is not passed directly to AI context.
 * 6. No recovery_probability field is added to deterministic opportunity objects.
 * 7. SUSPICIOUS_TRANSACTION remains HUMAN_REVIEW + requiresHumanReview: true.
 * 8. retry_count >= 2 never becomes RETRY.
 * 9. Successful transactions cannot be investigated as recovery opportunities.
 * 10. AI response validation rejects invalid confidence values.
 * 11. AI response validation rejects invalid recommended actions.
 * 12. AI response validation rejects malformed reasoning / riskFactors.
 * 13. Investigation context is deterministic for identical inputs.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateAiDecision, ALLOWED_RECOVERABILITY, ALLOWED_ACTIONS } = require('../src/services/ai/aiContract');
const { buildInvestigationContext, extractEvidence } = require('../src/services/investigationService');
const { investigateOpportunity, formatInvestigationPrompt } = require('../src/services/aiService');
const { MockAiProvider } = require('../src/services/ai/aiProvider');

// Helper to parse sample rows from transactions.csv if available
function loadSampleTransactions() {
  const csvPath = path.resolve(__dirname, '../../data/transactions.csv');
  if (!fs.existsSync(csvPath)) {
    return null;
  }
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < Math.min(lines.length, 500); i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = values[idx];
    });
    // Cast numeric fields
    obj.amount = Number(obj.amount);
    obj.retry_count = Number(obj.retry_count);
    obj.customer_lifetime_value = Number(obj.customer_lifetime_value);
    obj.previous_failures = Number(obj.previous_failures);
    rows.push(obj);
  }
  return rows;
}

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

async function asyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('       VALQORA — AI INVESTIGATION ENGINE FOUNDATION TESTS (DAY 3 STEP 1)');
  console.log('='.repeat(80) + '\n');

  const sampleRows = loadSampleTransactions() || [];
  const realFailedTxn = sampleRows.find((r) => r.status === 'FAILED' && r.failure_reason === 'BANK_TIMEOUT') || {
    transaction_id: 'TXN_000023',
    customer_id: 'CUST_09274',
    timestamp: '2026-08-01 10:32:00',
    amount: 4999.0,
    currency: 'INR',
    payment_method: 'UPI',
    provider: 'Provider_A',
    status: 'FAILED',
    failure_reason: 'BANK_TIMEOUT',
    retry_count: 0,
    customer_type: 'REGULAR',
    customer_lifetime_value: 57349.2,
    previous_failures: 0,
    is_recoverable: 'YES',
    ground_truth_action: 'RETRY',
    ground_truth_priority: 'MEDIUM',
  };

  const realSuccessTxn = sampleRows.find((r) => r.status === 'SUCCESS') || {
    transaction_id: 'TXN_000001',
    customer_id: 'CUST_00001',
    timestamp: '2026-08-01 09:00:00',
    amount: 1500.0,
    currency: 'INR',
    payment_method: 'UPI',
    provider: 'Provider_B',
    status: 'SUCCESS',
    failure_reason: 'NONE',
    retry_count: 0,
    customer_type: 'REGULAR',
    customer_lifetime_value: 12000.0,
    previous_failures: 0,
    is_recoverable: 'NO',
    ground_truth_action: 'NO_ACTION',
    ground_truth_priority: 'NONE',
  };

  const suspiciousTxn = sampleRows.find((r) => r.status === 'FAILED' && r.failure_reason === 'SUSPICIOUS_TRANSACTION') || {
    transaction_id: 'TXN_000999',
    customer_id: 'CUST_08888',
    timestamp: '2026-08-01 12:00:00',
    amount: 75000.0,
    currency: 'INR',
    payment_method: 'CREDIT_CARD',
    provider: 'Provider_A',
    status: 'FAILED',
    failure_reason: 'SUSPICIOUS_TRANSACTION',
    retry_count: 0,
    customer_type: 'NEW',
    customer_lifetime_value: 0.0,
    previous_failures: 0,
    is_recoverable: 'NO',
    ground_truth_action: 'HUMAN_REVIEW',
    ground_truth_priority: 'CRITICAL',
  };

  // ── TEST 1: Valid context construction from real opportunity/transaction ──
  test('1. Valid investigation context is constructed with all required structured sections', () => {
    const context = buildInvestigationContext(realFailedTxn, {
      name: 'Provider_A',
      currentSuccessRate: 61.3,
      baselineSuccessRate: 94.8,
    });

    assert.ok(context.opportunityId.startsWith('OPP_'));
    assert.strictEqual(context.transactionId, realFailedTxn.transaction_id);
    assert.strictEqual(context.amount, realFailedTxn.amount);
    assert.strictEqual(context.customer.customerId, realFailedTxn.customer_id);
    assert.strictEqual(context.customer.customerType, realFailedTxn.customer_type);
    assert.strictEqual(context.failure.reason, 'BANK_TIMEOUT');
    assert.strictEqual(context.failure.retryCount, 0);
    assert.strictEqual(context.provider.name, 'Provider_A');
    assert.strictEqual(context.provider.currentSuccessRate, 61.3);
    assert.ok(Array.isArray(context.evidence));
    assert.ok(context.evidence.length >= 2);
  });

  // ── TEST 2: Context contains ONLY relevant fields ──
  test('2. Context contains only relevant fields and no internal DB attributes', () => {
    const rawWithExtra = {
      ...realFailedTxn,
      _id: '64b0f0f0f0f0f0f0f0f0f0f0',
      __v: 0,
      internal_notes: 'confidential audit',
    };
    const context = buildInvestigationContext(rawWithExtra);

    const topLevelKeys = Object.keys(context);
    const expectedKeys = [
      'opportunityId',
      'transactionId',
      'amount',
      'currency',
      'paymentMethod',
      'timestamp',
      'customer',
      'failure',
      'provider',
      'evidence',
    ];
    assert.deepStrictEqual(topLevelKeys.sort(), expectedKeys.sort());
    assert.strictEqual(context._id, undefined);
    assert.strictEqual(context.__v, undefined);
    assert.strictEqual(context.internal_notes, undefined);
  });

  // ── TEST 3, 4, 5: Leakage Prevention (ground_truth_action, ground_truth_priority, is_recoverable) ──
  test('3. No ground_truth_action is present in the context or prompt', () => {
    const context = buildInvestigationContext(realFailedTxn);
    const serialized = JSON.stringify(context);
    const prompt = formatInvestigationPrompt(context);

    assert.strictEqual(context.ground_truth_action, undefined);
    assert.ok(!serialized.includes('ground_truth_action'));
    assert.ok(!prompt.includes('ground_truth_action'));
  });

  test('4. No ground_truth_priority is present in the context or prompt', () => {
    const context = buildInvestigationContext(realFailedTxn);
    const serialized = JSON.stringify(context);
    const prompt = formatInvestigationPrompt(context);

    assert.strictEqual(context.ground_truth_priority, undefined);
    assert.ok(!serialized.includes('ground_truth_priority'));
    assert.ok(!prompt.includes('ground_truth_priority'));
  });

  test('5. is_recoverable is not passed directly to AI context or prompt', () => {
    const context = buildInvestigationContext(realFailedTxn);
    const serialized = JSON.stringify(context);
    const prompt = formatInvestigationPrompt(context);

    assert.strictEqual(context.is_recoverable, undefined);
    assert.ok(!serialized.includes('"is_recoverable"'));
    assert.ok(!prompt.includes('"is_recoverable"'));
  });

  // ── TEST 6: No recovery_probability field added to deterministic opportunity objects ──
  test('6. No recovery_probability field is added to deterministic opportunity objects', () => {
    const context = buildInvestigationContext(realFailedTxn);
    assert.strictEqual(context.recovery_probability, undefined);
    assert.strictEqual(context.recoveryProbability, undefined);
  });

  // ── TEST 7: SUSPICIOUS_TRANSACTION remains HUMAN_REVIEW + requiresHumanReview: true ──
  await asyncTest('7. SUSPICIOUS_TRANSACTION mandates requiresHumanReview=true and recommendedAction=HUMAN_REVIEW', async () => {
    const result = await investigateOpportunity(suspiciousTxn);
    assert.strictEqual(result.decision.requiresHumanReview, true);
    assert.strictEqual(result.decision.recommendedAction, 'HUMAN_REVIEW');
    assert.strictEqual(result.decision.recoverability, 'LOW');

    // Validation must reject any attempt by AI to bypass this
    const badAiDecision = {
      rootCause: 'Normal fraud check',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.9,
      expectedRecovery: 75000,
      reasoning: ['Retry payment immediately'],
      riskFactors: [],
      requiresHumanReview: false,
    };
    const context = buildInvestigationContext(suspiciousTxn);
    assert.throws(() => {
      validateAiDecision(badAiDecision, context);
    }, /Safety violation: SUSPICIOUS_TRANSACTION/);
  });

  // ── TEST 8: retry_count >= 2 never becomes RETRY ──
  await asyncTest('8. retry_count >= 2 never results in RETRY (deterministic safety enforcement)', async () => {
    const highRetryTxn = {
      ...realFailedTxn,
      transaction_id: 'TXN_RETRY_2',
      retry_count: 2,
    };

    const result = await investigateOpportunity(highRetryTxn);
    assert.notStrictEqual(result.decision.recommendedAction, 'RETRY');

    // Validation must reject AI returning RETRY for retryCount >= 2
    const badRetryAiDecision = {
      rootCause: 'Temporary gateway lag',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.85,
      expectedRecovery: 4999,
      reasoning: ['Gateway might succeed on retry #3'],
      riskFactors: [],
      requiresHumanReview: false,
    };
    const context = buildInvestigationContext(highRetryTxn);
    assert.throws(() => {
      validateAiDecision(badRetryAiDecision, context);
    }, /Safety violation: retryCount is 2/);
  });

  // ── TEST 9: Successful transactions cannot be investigated as recovery opportunities ──
  test('9. Successful transactions cannot be investigated as recovery opportunities', () => {
    assert.throws(() => {
      buildInvestigationContext(realSuccessTxn);
    }, /Successful transactions cannot be investigated as recovery opportunities/);
  });

  // ── TEST 10: AI response validation rejects invalid confidence values ──
  test('10. AI response validation rejects invalid confidence values (<0, >1, NaN, string)', () => {
    const baseValid = {
      rootCause: 'Network glitch',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.9,
      expectedRecovery: 1000,
      reasoning: ['Valid reason'],
      riskFactors: [],
      requiresHumanReview: false,
    };

    assert.throws(() => validateAiDecision({ ...baseValid, confidence: -0.1 }), /Invalid confidence/);
    assert.throws(() => validateAiDecision({ ...baseValid, confidence: 1.05 }), /Invalid confidence/);
    assert.throws(() => validateAiDecision({ ...baseValid, confidence: '0.9' }), /Invalid confidence/);
    assert.throws(() => validateAiDecision({ ...baseValid, confidence: NaN }), /Invalid confidence/);
    assert.doesNotThrow(() => validateAiDecision({ ...baseValid, confidence: 0.0 }));
    assert.doesNotThrow(() => validateAiDecision({ ...baseValid, confidence: 1.0 }));
  });

  // ── TEST 11: AI response validation rejects invalid actions ──
  test('11. AI response validation rejects invalid actions not in allowed enum', () => {
    const baseValid = {
      rootCause: 'Network glitch',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.9,
      expectedRecovery: 1000,
      reasoning: ['Valid reason'],
      riskFactors: [],
      requiresHumanReview: false,
    };

    assert.throws(() => validateAiDecision({ ...baseValid, recommendedAction: 'AUTO_CHARGE' }), /Invalid recommendedAction/);
    assert.throws(() => validateAiDecision({ ...baseValid, recommendedAction: 'DISCOUNT_REFUND' }), /Invalid recommendedAction/);
    assert.throws(() => validateAiDecision({ ...baseValid, recommendedAction: '' }), /Invalid recommendedAction/);

    for (const action of ALLOWED_ACTIONS) {
      assert.doesNotThrow(() => validateAiDecision({ ...baseValid, recommendedAction: action }));
    }
  });

  // ── TEST 12: AI response validation rejects malformed reasoning / riskFactors ──
  test('12. AI response validation rejects malformed reasoning or riskFactors', () => {
    const baseValid = {
      rootCause: 'Network glitch',
      recoverability: 'HIGH',
      recommendedAction: 'RETRY',
      confidence: 0.9,
      expectedRecovery: 1000,
      reasoning: ['Valid reason'],
      riskFactors: ['Valid risk'],
      requiresHumanReview: false,
    };

    // reasoning must be non-empty array of non-empty strings
    assert.throws(() => validateAiDecision({ ...baseValid, reasoning: [] }), /reasoning must be a non-empty array/);
    assert.throws(() => validateAiDecision({ ...baseValid, reasoning: 'single string' }), /reasoning must be a non-empty array/);
    assert.throws(() => validateAiDecision({ ...baseValid, reasoning: [123] }), /reasoning\[0\] must be a non-empty string/);
    assert.throws(() => validateAiDecision({ ...baseValid, reasoning: [''] }), /reasoning\[0\] must be a non-empty string/);

    // riskFactors must be array of strings
    assert.throws(() => validateAiDecision({ ...baseValid, riskFactors: 'not an array' }), /riskFactors must be an array/);
    assert.throws(() => validateAiDecision({ ...baseValid, riskFactors: [null] }), /riskFactors\[0\] must be a non-empty string/);

    // recoverability enum check
    assert.throws(() => validateAiDecision({ ...baseValid, recoverability: 'MAYBE' }), /Invalid recoverability/);
  });

  // ── TEST 13: Investigation context is deterministic for identical inputs ──
  test('13. Investigation context is completely deterministic for identical inputs', () => {
    const context1 = buildInvestigationContext(realFailedTxn, {
      name: 'Provider_A',
      currentSuccessRate: 60.0,
      baselineSuccessRate: 94.0,
    });
    const context2 = buildInvestigationContext(realFailedTxn, {
      name: 'Provider_A',
      currentSuccessRate: 60.0,
      baselineSuccessRate: 94.0,
    });

    assert.deepStrictEqual(context1, context2);
    assert.strictEqual(JSON.stringify(context1), JSON.stringify(context2));
  });

  // ── End-to-End Investigation Flow Sample ──
  await asyncTest('14. End-to-End AI Investigation returns valid advisory decision object', async () => {
    const result = await investigateOpportunity(realFailedTxn, {
      providerStats: {
        name: 'Provider_A',
        currentSuccessRate: 61.3,
        baselineSuccessRate: 94.8,
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isAdvisory, true);
    assert.ok(result.decision);
    assert.ok(result.decision.rootCause.length > 0);
    assert.ok(ALLOWED_RECOVERABILITY.includes(result.decision.recoverability));
    assert.ok(ALLOWED_ACTIONS.includes(result.decision.recommendedAction));
    assert.ok(typeof result.decision.confidence === 'number');
    assert.ok(result.decision.confidence >= 0 && result.decision.confidence <= 1);
    assert.ok(Array.isArray(result.decision.reasoning));
    assert.ok(Array.isArray(result.decision.riskFactors));
    assert.strictEqual(typeof result.decision.requiresHumanReview, 'boolean');

    console.log('\n  [SAMPLE STRUCTURED AI INVESTIGATION DECISION]:');
    console.log(JSON.stringify(result.decision, null, 4));
  });

  console.log('\n' + '='.repeat(80));
  console.log(`  TEST RESULTS: ${passed}/${total} checks passed (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('='.repeat(80) + '\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
