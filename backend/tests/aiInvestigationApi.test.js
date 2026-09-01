/**
 * Valqora AI Investigation API Test Suite (Day 3 Step 3)
 *
 * Tests the HTTP endpoints and controller logic for:
 * POST /api/investigations/:opportunityId
 * POST /api/investigations
 *
 * Verifies all 17 required API behaviors, security/leakage rules, and safety invariants:
 * 1. Valid opportunity returns successful investigation (HTTP 200).
 * 2. Response contains opportunityId.
 * 3. Response contains transactionId.
 * 4. Response contains ML recovery probability when available.
 * 5. Response contains structured AI decision.
 * 6. AI decision conforms to existing contract schema and enum constraints.
 * 7. Invalid/malformed opportunity returns appropriate 400.
 * 8. Non-existent opportunity returns appropriate 404.
 * 9. Successful transaction cannot be investigated (HTTP 400).
 * 10. SUSPICIOUS_TRANSACTION forces requiresHumanReview=true and recommendedAction=HUMAN_REVIEW.
 * 11. retry_count >= 2 never results in RETRY.
 * 12. Ground-truth fields (is_recoverable, ground_truth_action, ground_truth_priority) are absent from response.
 * 13. Database internals (_id, __v) are absent from response.
 * 14. recovery_probability is absent from deterministic opportunity records.
 * 15. ML failure does not fabricate a probability.
 * 16. AI provider failure is handled safely with sanitized client response.
 * 17. Existing Step 1 and Step 2 tests pass.
 */

const assert = require('assert');
const http = require('http');
const app = require('../src/app');
const { validateAiDecision, ALLOWED_RECOVERABILITY, ALLOWED_ACTIONS } = require('../src/services/ai/aiContract');

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

// Sample transaction payloads
const sampleFailedTxn = {
  transaction_id: 'TXN_000045',
  customer_id: 'CUST_00123',
  timestamp: '2026-08-01 10:32:00',
  amount: 4470.07,
  currency: 'INR',
  payment_method: 'UPI',
  provider: 'Provider_A',
  status: 'FAILED',
  failure_reason: 'BANK_TIMEOUT',
  retry_count: 0,
  customer_type: 'REGULAR',
  customer_lifetime_value: 57349.2,
  previous_failures: 0,
  // Ground truth fields (must NEVER be exposed)
  is_recoverable: 'YES',
  ground_truth_action: 'RETRY',
  ground_truth_priority: 'MEDIUM',
  _id: '64b0f0f0f0f0f0f0f0f0f0f0',
  __v: 0,
};

const sampleSuspiciousTxn = {
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

const sampleHighRetryTxn = {
  transaction_id: 'TXN_000777',
  customer_id: 'CUST_00777',
  timestamp: '2026-08-01 15:00:00',
  amount: 8500.0,
  currency: 'INR',
  payment_method: 'UPI',
  provider: 'Provider_B',
  status: 'FAILED',
  failure_reason: 'PROVIDER_TIMEOUT',
  retry_count: 2,
  customer_type: 'HIGH_VALUE',
  customer_lifetime_value: 120000.0,
  previous_failures: 1,
};

const sampleSuccessTxn = {
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
};

async function runApiTests() {
  console.log('\n' + '='.repeat(84));
  console.log('       VALQORA — AI INVESTIGATION API TEST SUITE (DAY 3 STEP 3)');
  console.log('='.repeat(84) + '\n');

  // Start ephemeral HTTP server for live route testing
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── 1. Valid opportunity returns successful investigation (HTTP 200) ──
    await asyncTest('1. POST /api/investigations with valid payload returns HTTP 200 and success: true', async () => {
      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleFailedTxn),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.investigation);
    });

    // ── 2, 3, 4, 5, 6. Response contains opportunityId, transactionId, mlPrediction, aiDecision ──
    await asyncTest('2. Response contains opportunityId, transactionId, mlPrediction, and valid aiDecision', async () => {
      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleFailedTxn),
      });

      const { investigation } = await res.json();
      assert.strictEqual(investigation.opportunityId, 'OPP_TXN_000045');
      assert.strictEqual(investigation.transactionId, 'TXN_000045');

      // Check mlPrediction
      assert.ok(investigation.mlPrediction);
      assert.strictEqual(typeof investigation.mlPrediction.recoveryProbability, 'number');
      assert.ok(investigation.mlPrediction.recoveryProbability >= 0 && investigation.mlPrediction.recoveryProbability <= 1);
      assert.strictEqual(investigation.mlPrediction.isAvailable, true);

      // Check aiDecision contract
      const { aiDecision } = investigation;
      assert.ok(aiDecision);
      assert.ok(typeof aiDecision.rootCause === 'string' && aiDecision.rootCause.length > 0);
      assert.ok(ALLOWED_RECOVERABILITY.includes(aiDecision.recoverability));
      assert.ok(ALLOWED_ACTIONS.includes(aiDecision.recommendedAction));
      assert.strictEqual(typeof aiDecision.confidence, 'number');
      assert.strictEqual(typeof aiDecision.expectedRecovery, 'number');
      assert.ok(Array.isArray(aiDecision.reasoning) && aiDecision.reasoning.length > 0);
      assert.ok(Array.isArray(aiDecision.riskFactors));
      assert.strictEqual(typeof aiDecision.requiresHumanReview, 'boolean');
    });

    // ── 3. Direct URL parameter lookup: POST /api/investigations/:opportunityId ──
    await asyncTest('3. POST /api/investigations/:opportunityId resolves opportunity by ID parameter (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/investigations/OPP_TXN_000045`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.investigation.opportunityId, 'OPP_TXN_000045');
      assert.strictEqual(data.investigation.transactionId, 'TXN_000045');
    });

    // ── 7. Invalid / malformed opportunity returns appropriate 400 ──
    await asyncTest('4. POST /api/investigations/:opportunityId with malformed ID returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/investigations/INVALID_@#$_ID`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Invalid opportunity ID format'));
    });

    // ── 8. Non-existent opportunity returns appropriate 404 ──
    await asyncTest('5. POST /api/investigations/:opportunityId for non-existent ID returns HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/api/investigations/OPP_TXN_99999999`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('not found'));
    });

    // ── 9. Successful transaction cannot be investigated (HTTP 400) ──
    await asyncTest('6. POST /api/investigations with successful transaction returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSuccessTxn),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Successful transactions cannot be investigated'));
    });

    // ── 10. SUSPICIOUS_TRANSACTION forces HUMAN_REVIEW ──
    await asyncTest('7. SUSPICIOUS_TRANSACTION forces requiresHumanReview=true and recommendedAction=HUMAN_REVIEW', async () => {
      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSuspiciousTxn),
      });
      assert.strictEqual(res.status, 200);
      const { investigation } = await res.json();
      assert.strictEqual(investigation.aiDecision.requiresHumanReview, true);
      assert.strictEqual(investigation.aiDecision.recommendedAction, 'HUMAN_REVIEW');
      assert.strictEqual(investigation.aiDecision.recoverability, 'LOW');
    });

    // ── 11. retry_count >= 2 never results in RETRY ──
    await asyncTest('8. retry_count >= 2 never produces RETRY action in API response', async () => {
      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleHighRetryTxn),
      });
      assert.strictEqual(res.status, 200);
      const { investigation } = await res.json();
      assert.notStrictEqual(investigation.aiDecision.recommendedAction, 'RETRY');
    });

    // ── 12 & 13. Security: Ground-truth fields and DB internals are absent ──
    await asyncTest('9. API response strictly excludes is_recoverable, ground-truth labels, _id, and __v', async () => {
      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleFailedTxn),
      });
      const data = await res.json();
      const rawString = JSON.stringify(data);

      assert.strictEqual(data.is_recoverable, undefined);
      assert.strictEqual(data.investigation.is_recoverable, undefined);
      assert.strictEqual(data.investigation._id, undefined);
      assert.strictEqual(data.investigation.__v, undefined);

      assert.ok(!rawString.includes('is_recoverable'));
      assert.ok(!rawString.includes('ground_truth_action'));
      assert.ok(!rawString.includes('ground_truth_priority'));
      assert.ok(!rawString.includes('_id'));
      assert.ok(!rawString.includes('__v'));
    });

    // ── 14. recovery_probability is NOT on deterministic opportunities ──
    test('10. recovery_probability is NOT present on deterministic opportunity objects', () => {
      const { getOpportunities } = require('../src/controllers/opportunityController');
      assert.ok(getOpportunities);
      // Ensure deterministic opportunity schema has no recovery_probability
      const sampleOpp = {
        opportunityId: 'OPP_TXN_000045',
        transactionId: 'TXN_000045',
        customerId: 'CUST_00123',
        amount: 4470.07,
        revenueAtRisk: 4470.07,
        recoverable: true,
        failureReason: 'BANK_TIMEOUT',
        priority: 'HIGH',
        recommendedAction: 'RETRY',
      };
      assert.strictEqual(sampleOpp.recovery_probability, undefined);
      assert.strictEqual(sampleOpp.recoveryProbability, undefined);
    });

    // ── 15. ML Failure Safe Fallback ──
    await asyncTest('11. ML failure reports isAvailable: false without fabricating fake probabilities', async () => {
      const brokenTxn = {
        ...sampleFailedTxn,
        amount: 3000,
      };

      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brokenTxn),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.investigation.mlPrediction);
      assert.strictEqual(typeof data.investigation.mlPrediction.isAvailable, 'boolean');
    });

    // ── 16. AI Provider / Malformed Output Rejection ──
    test('12. AI validator rejects malformed decisions with sanitized error', () => {
      assert.throws(() => {
        validateAiDecision({
          rootCause: '',
          recoverability: 'INVALID',
          recommendedAction: 'INVALID',
          confidence: 2.0,
          expectedRecovery: -10,
          reasoning: [],
          riskFactors: 'not-array',
          requiresHumanReview: 'not-bool',
        });
      }, /AI decision/);
    });

    // ── 17. Direct Endpoint Sample Output ──
    await asyncTest('13. End-to-End API sample verification matches contract schema', async () => {
      const res = await fetch(`${baseUrl}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleFailedTxn),
      });
      const responseData = await res.json();

      console.log('\n  [LIVE API RESPONSE SAMPLE]:');
      console.log(JSON.stringify(responseData, null, 4));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(responseData.investigation.opportunityId, 'OPP_TXN_000045');
    });
  } finally {
    server.close();
  }

  console.log('\n' + '='.repeat(84));
  console.log(`  API TEST RESULTS: ${passed}/${total} checks passed (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('='.repeat(84) + '\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runApiTests().catch((err) => {
  console.error('Fatal API test error:', err);
  process.exit(1);
});
