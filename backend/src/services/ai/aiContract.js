/**
 * Valqora AI Investigation Contract & Schema Validation
 *
 * Defines the structured contract and strict validation rules for AI recovery
 * investigations. Ensures AI recommendations are advisory, schema-conformant,
 * and cannot bypass authoritative deterministic safety rules.
 */

const ALLOWED_RECOVERABILITY = Object.freeze(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
const ALLOWED_ACTIONS = Object.freeze([
  'RETRY',
  'PAYMENT_LINK',
  'PAYMENT_METHOD_UPDATE',
  'WAIT',
  'HUMAN_REVIEW',
  'NONE',
]);

const RECOVERABILITY_SET = new Set(ALLOWED_RECOVERABILITY);
const ACTIONS_SET = new Set(ALLOWED_ACTIONS);

/**
 * Validates a structured AI decision object against the Valqora AI Contract.
 * Throws an Error if the decision is malformed or violates safety invariants.
 *
 * @param {Object} decision - The raw AI decision object to validate.
 * @param {Object} [context] - Optional investigation context for invariant checking.
 * @returns {Object} Validated decision object.
 */
function validateAiDecision(decision, context = null) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new Error('AI decision must be a non-null object');
  }

  // 1. Validate rootCause
  if (typeof decision.rootCause !== 'string' || !decision.rootCause.trim()) {
    throw new Error('AI decision rootCause must be a non-empty string');
  }

  // 2. Validate recoverability enum
  if (!RECOVERABILITY_SET.has(decision.recoverability)) {
    throw new Error(
      `Invalid recoverability: "${decision.recoverability}". Allowed: ${ALLOWED_RECOVERABILITY.join(', ')}`
    );
  }

  // 3. Validate recommendedAction enum
  if (!ACTIONS_SET.has(decision.recommendedAction)) {
    throw new Error(
      `Invalid recommendedAction: "${decision.recommendedAction}". Allowed: ${ALLOWED_ACTIONS.join(', ')}`
    );
  }

  // 4. Validate confidence (number between 0.0 and 1.0)
  if (
    typeof decision.confidence !== 'number' ||
    Number.isNaN(decision.confidence) ||
    decision.confidence < 0.0 ||
    decision.confidence > 1.0
  ) {
    throw new Error(
      `Invalid confidence: ${decision.confidence}. Must be a number between 0.0 and 1.0`
    );
  }

  // 5. Validate expectedRecovery (non-negative number)
  if (
    typeof decision.expectedRecovery !== 'number' ||
    Number.isNaN(decision.expectedRecovery) ||
    decision.expectedRecovery < 0
  ) {
    throw new Error(
      `Invalid expectedRecovery: ${decision.expectedRecovery}. Must be a non-negative number`
    );
  }

  // 6. Validate reasoning (array of non-empty strings)
  if (!Array.isArray(decision.reasoning) || decision.reasoning.length === 0) {
    throw new Error('AI decision reasoning must be a non-empty array of strings');
  }
  for (let i = 0; i < decision.reasoning.length; i++) {
    if (typeof decision.reasoning[i] !== 'string' || !decision.reasoning[i].trim()) {
      throw new Error(`AI decision reasoning[${i}] must be a non-empty string`);
    }
  }

  // 7. Validate riskFactors (array of strings)
  if (!Array.isArray(decision.riskFactors)) {
    throw new Error('AI decision riskFactors must be an array of strings');
  }
  for (let i = 0; i < decision.riskFactors.length; i++) {
    if (typeof decision.riskFactors[i] !== 'string' || !decision.riskFactors[i].trim()) {
      throw new Error(`AI decision riskFactors[${i}] must be a non-empty string`);
    }
  }

  // 8. Validate requiresHumanReview (boolean)
  if (typeof decision.requiresHumanReview !== 'boolean') {
    throw new Error('AI decision requiresHumanReview must be a boolean');
  }

  // ── Invariant Checks Against Context (Deterministic Safety Protection) ──
  if (context) {
    const failureReason = context.failure?.reason;
    const retryCount = context.failure?.retryCount ?? 0;

    // Safety rule 1: SUSPICIOUS_TRANSACTION must require human review
    if (failureReason === 'SUSPICIOUS_TRANSACTION') {
      if (!decision.requiresHumanReview || decision.recommendedAction !== 'HUMAN_REVIEW') {
        throw new Error(
          'Safety violation: SUSPICIOUS_TRANSACTION must always result in requiresHumanReview=true and recommendedAction=HUMAN_REVIEW'
        );
      }
    }

    // Safety rule 2: retryCount >= 2 must NEVER allow RETRY
    if (retryCount >= 2 && decision.recommendedAction === 'RETRY') {
      throw new Error(
        `Safety violation: retryCount is ${retryCount} (>= 2), recommendedAction cannot be RETRY`
      );
    }
  }

  return {
    rootCause: decision.rootCause.trim(),
    recoverability: decision.recoverability,
    recommendedAction: decision.recommendedAction,
    confidence: Number(decision.confidence.toFixed(4)),
    expectedRecovery: Number(decision.expectedRecovery.toFixed(2)),
    reasoning: decision.reasoning.map((r) => r.trim()),
    riskFactors: decision.riskFactors.map((rf) => rf.trim()),
    requiresHumanReview: decision.requiresHumanReview,
  };
}

module.exports = {
  ALLOWED_RECOVERABILITY,
  ALLOWED_ACTIONS,
  validateAiDecision,
};
