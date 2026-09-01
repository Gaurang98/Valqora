/**
 * Valqora Recovery Metrics Test Suite (Day 4 Step 4)
 */

const assert = require('assert');
const {
  calculateRecoveryMetrics,
  calculateRevenueRecovered,
  calculateRecoveryRate,
} = require('../src/services/recoveryMetricsService');

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
  console.log('     VALQORA — RECOVERY METRICS TEST SUITE (DAY 4 STEP 4)');
  console.log('='.repeat(88) + '\n');

  test('1. No recoveries -> revenueRecovered is 0', () => {
    const metrics = calculateRecoveryMetrics({
      transactions: [{ status: 'FAILED', amount: 2500 }, { status: 'FAILED', amount: 4000 }],
      recoveryResults: [
        { transaction: { status: 'FAILED', amount: 2500 }, policy: { decision: 'BLOCKED' }, verification: { verified: false, amountRecovered: 0 } },
        { transaction: { status: 'FAILED', amount: 4000 }, policy: { decision: 'BLOCKED' }, verification: { verified: false, amountRecovered: 0 } },
      ],
    });

    assert.strictEqual(metrics.revenueRecovered, 0);
  });

  test('2. Successful verified recovery includes the recovered amount', () => {
    const metrics = calculateRecoveryMetrics({
      transactions: [{ status: 'FAILED', amount: 5000 }],
      recoveryResults: [{
        transaction: { status: 'FAILED', amount: 5000 },
        policy: { decision: 'APPROVED' },
        verification: { verified: true, amountRecovered: 5000 },
      }],
    });

    assert.strictEqual(metrics.revenueRecovered, 5000);
  });

  test('3. Failed recovery does not count the amount', () => {
    const metrics = calculateRecoveryMetrics({
      transactions: [{ status: 'FAILED', amount: 5000 }],
      recoveryResults: [{
        transaction: { status: 'FAILED', amount: 5000 },
        policy: { decision: 'APPROVED' },
        verification: { verified: false, amountRecovered: 0 },
      }],
    });

    assert.strictEqual(metrics.revenueRecovered, 0);
  });

  test('4. Policy blocked recovery contributes 0', () => {
    const metrics = calculateRecoveryMetrics({
      transactions: [{ status: 'FAILED', amount: 5000 }],
      recoveryResults: [{
        transaction: { status: 'FAILED', amount: 5000 },
        policy: { decision: 'BLOCKED', reason: 'suspicious' },
        verification: { verified: false, amountRecovered: 0 },
      }],
    });

    assert.strictEqual(metrics.revenueRecovered, 0);
  });

  test('5. Multiple verified recoveries sum correctly', () => {
    const metrics = calculateRecoveryMetrics({
      transactions: [{ status: 'FAILED', amount: 5000 }, { status: 'FAILED', amount: 8000 }, { status: 'FAILED', amount: 3000 }],
      recoveryResults: [
        { transaction: { status: 'FAILED', amount: 5000 }, policy: { decision: 'APPROVED' }, verification: { verified: true, amountRecovered: 5000 } },
        { transaction: { status: 'FAILED', amount: 8000 }, policy: { decision: 'APPROVED' }, verification: { verified: true, amountRecovered: 8000 } },
        { transaction: { status: 'FAILED', amount: 3000 }, policy: { decision: 'APPROVED' }, verification: { verified: false, amountRecovered: 0 } },
      ],
    });

    assert.strictEqual(metrics.revenueRecovered, 13000);
  });

  test('6. Recovery rate matches the percentage formula', () => {
    const metrics = calculateRecoveryMetrics({
      transactions: [{ status: 'FAILED', amount: 20000 }],
      recoveryResults: [{
        transaction: { status: 'FAILED', amount: 20000 },
        policy: { decision: 'APPROVED' },
        verification: { verified: true, amountRecovered: 13000 },
      }],
    });

    assert.strictEqual(metrics.recoveryRate, 65);
  });

  test('7. Zero recoverable revenue returns 0 and no NaN/Infinity', () => {
    const rate = calculateRecoveryRate(0, 0);
    assert.strictEqual(rate, 0);
    assert.strictEqual(Number.isNaN(rate), false);
    assert.strictEqual(Number.isFinite(rate), true);
  });

  test('8. Successful transactions must not be counted as recovered revenue', () => {
    const metrics = calculateRecoveryMetrics({
      transactions: [{ status: 'SUCCESS', amount: 5000 }, { status: 'FAILED', amount: 8000 }],
      recoveryResults: [
        { transaction: { status: 'SUCCESS', amount: 5000 }, policy: { decision: 'APPROVED' }, verification: { verified: true, amountRecovered: 5000 } },
        { transaction: { status: 'FAILED', amount: 8000 }, policy: { decision: 'APPROVED' }, verification: { verified: true, amountRecovered: 8000 } },
      ],
    });

    assert.strictEqual(metrics.revenueRecovered, 8000);
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      RECOVERY METRICS TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runAllTests();
