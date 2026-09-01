/**
 * Valqora Recovery Verification Test Suite (Day 4 Step 3)
 */

const assert = require('assert');
const { verifyRecovery } = require('../src/services/verificationService');

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

function runAllTests() {
  console.log('\n' + '='.repeat(88));
  console.log('     VALQORA — RECOVERY VERIFICATION TEST SUITE (DAY 4 STEP 3)');
  console.log('='.repeat(88) + '\n');

  test('1. Successful recovery verifies as success', () => {
    const result = verifyRecovery({
      transaction: { status: 'FAILED', amount: 8499 },
      action: 'RETRY_PAYMENT',
      simulation: { action: 'RETRY_PAYMENT', status: 'SUCCESS', amountRecovered: 8499 },
    });

    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.status, 'SUCCESS');
    assert.strictEqual(result.amountRecovered, 8499);
  });

  test('2. Failed recovery verifies as failed', () => {
    const result = verifyRecovery({
      transaction: { status: 'FAILED', amount: 5000 },
      action: 'RETRY_PAYMENT',
      simulation: { action: 'RETRY_PAYMENT', status: 'FAILED', amountRecovered: 0 },
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, 'FAILED');
    assert.strictEqual(result.amountRecovered, 0);
  });

  test('3. Success with zero recovery does not verify', () => {
    const result = verifyRecovery({
      transaction: { status: 'FAILED', amount: 5000 },
      action: 'RETRY_PAYMENT',
      simulation: { action: 'RETRY_PAYMENT', status: 'SUCCESS', amountRecovered: 0 },
    });

    assert.strictEqual(result.verified, false);
  });

  test('4. Success with invalid prior status does not verify', () => {
    const result = verifyRecovery({
      transaction: { status: 'SUCCESS', amount: 5000 },
      action: 'RETRY_PAYMENT',
      simulation: { action: 'RETRY_PAYMENT', status: 'SUCCESS', amountRecovered: 5000 },
      policyDecision: { decision: 'APPROVED' },
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.previousStatus, 'SUCCESS');
  });

  test('5. Failed simulator with positive recovery is never verified', () => {
    const result = verifyRecovery({
      transaction: { status: 'FAILED', amount: 5000 },
      action: 'RETRY_PAYMENT',
      simulation: { action: 'RETRY_PAYMENT', status: 'FAILED', amountRecovered: 5000 },
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.amountRecovered, 0);
  });

  test('6. Missing simulation fails closed', () => {
    const result = verifyRecovery({
      transaction: { status: 'FAILED', amount: 5000 },
      action: 'RETRY_PAYMENT',
    });

    assert.strictEqual(result.verified, false);
  });

  test('7. Missing amount fails closed', () => {
    const result = verifyRecovery({
      transaction: { status: 'FAILED' },
      action: 'RETRY_PAYMENT',
      simulation: { action: 'RETRY_PAYMENT', status: 'SUCCESS', amountRecovered: 5000 },
    });

    assert.strictEqual(result.verified, false);
  });

  test('8. Blocked policy cannot verify a successful recovery', () => {
    const result = verifyRecovery({
      transaction: { status: 'FAILED', amount: 5000 },
      action: 'RETRY_PAYMENT',
      simulation: { action: 'RETRY_PAYMENT', status: 'SUCCESS', amountRecovered: 5000 },
      policyDecision: { decision: 'BLOCKED', reason: 'Blocked by policy' },
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, 'BLOCKED');
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      VERIFICATION SERVICE TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runAllTests();
