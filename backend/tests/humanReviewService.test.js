/**
 * Valqora Human Review Test Suite (Day 4 Step 5)
 */

const assert = require('assert');
const {
  createReview,
  approveReview,
  rejectReview,
  isReviewEligible,
  listReviews,
} = require('../src/services/humanReviewService');

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
  console.log('     VALQORA — HUMAN REVIEW TEST SUITE (DAY 4 STEP 5)');
  console.log('='.repeat(88) + '\n');

  test('1. Human review created for policy-required case', () => {
    const review = createReview({
      opportunityId: 'OPP_TXN_000101',
      transactionId: 'TXN_000101',
      amount: 75000,
      reason: 'High-value transaction',
      aiRecommendation: 'RETRY',
      aiConfidence: 0.91,
      policyDecision: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'Transaction exceeds automatic recovery limit of 50000', requiresHumanReview: true },
    });

    assert.strictEqual(review.status, 'PENDING');
  });

  test('2. Low confidence triggers human review', () => {
    const eligible = isReviewEligible({ decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'AI confidence below minimum policy threshold (0.7)', requiresHumanReview: true });
    assert.strictEqual(eligible, true);
  });

  test('3. High-value transaction triggers human review', () => {
    const eligible = isReviewEligible({ decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'Transaction exceeds automatic recovery limit of 50000', requiresHumanReview: true });
    assert.strictEqual(eligible, true);
  });

  test('4. Approve review stores reviewer decision and timestamp', () => {
    const review = createReview({
      opportunityId: 'OPP_TXN_000201',
      transactionId: 'TXN_000201',
      amount: 60000,
      reason: 'Manual approval required',
      aiRecommendation: 'RETRY',
      aiConfidence: 0.82,
      policyDecision: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'AI confidence below minimum policy threshold (0.7)', requiresHumanReview: true },
    });

    const approved = approveReview(review.reviewId);
    assert.strictEqual(approved.status, 'APPROVED');
    assert.strictEqual(approved.reviewerDecision, 'APPROVED');
    assert.strictEqual(approved.reviewedAt !== null, true);
  });

  test('5. Reject review records decision without recovery', () => {
    const review = createReview({
      opportunityId: 'OPP_TXN_000301',
      transactionId: 'TXN_000301',
      amount: 30000,
      reason: 'Manual review required',
      aiRecommendation: 'RETRY',
      aiConfidence: 0.78,
      policyDecision: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'AI confidence below minimum policy threshold (0.7)', requiresHumanReview: true },
    });

    const rejected = rejectReview(review.reviewId);
    assert.strictEqual(rejected.status, 'REJECTED');
    assert.strictEqual(rejected.reviewerDecision, 'REJECTED');
    assert.strictEqual(rejected.reviewedAt !== null, true);
  });

  test('6. Suspicious transaction remains a hard block', () => {
    const eligible = isReviewEligible({ decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'Transaction classified as suspicious; automatic recovery is not permitted', requiresHumanReview: true });
    assert.strictEqual(eligible, false);
  });

  test('7. Retry limit remains a hard block', () => {
    const eligible = isReviewEligible({ decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'Retry limit reached (2); RETRY is forbidden', requiresHumanReview: true });
    assert.strictEqual(eligible, false);
  });

  test('8. Duplicate review decision is rejected deterministically', () => {
    const review = createReview({
      opportunityId: 'OPP_TXN_000401',
      transactionId: 'TXN_000401',
      amount: 42000,
      reason: 'Manual review required',
      aiRecommendation: 'RETRY',
      aiConfidence: 0.75,
      policyDecision: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'AI confidence below minimum policy threshold (0.7)', requiresHumanReview: true },
    });

    approveReview(review.reviewId);
    assert.throws(() => approveReview(review.reviewId), /already approved|Only pending reviews/i);
  });

  test('9. Reject after approval is rejected deterministically', () => {
    const review = createReview({
      opportunityId: 'OPP_TXN_000501',
      transactionId: 'TXN_000501',
      amount: 44000,
      reason: 'Manual review required',
      aiRecommendation: 'RETRY',
      aiConfidence: 0.78,
      policyDecision: { decision: 'BLOCKED', action: 'HUMAN_REVIEW', reason: 'AI confidence below minimum policy threshold (0.7)', requiresHumanReview: true },
    });

    const approved = approveReview(review.reviewId);
    assert.throws(() => rejectReview(review.reviewId), /cannot be rejected|Only pending reviews/i);
    assert.strictEqual(approved.status, 'APPROVED');
  });

  test('10. Review listing returns queue state', () => {
    const reviews = listReviews('PENDING');
    assert.ok(Array.isArray(reviews));
  });

  console.log('\n' + '='.repeat(88));
  console.log(`      HUMAN REVIEW TEST SUMMARY: ${passed}/${total} passed`);
  console.log('='.repeat(88));

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runAllTests();
