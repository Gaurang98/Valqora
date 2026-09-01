/**
 * Valqora AI Investigation Service
 *
 * Coordinates AI investigation workflows:
 * 1. Takes a structured investigation context.
 * 2. Formats a compact prompt with explicit JSON schema directives.
 * 3. Dispatches to the modular AI provider.
 * 4. Strictly validates the AI response against the Valqora AI Contract.
 * 5. Guarantees that deterministic safety rules cannot be overridden.
 */

const { validateAiDecision, ALLOWED_RECOVERABILITY, ALLOWED_ACTIONS } = require('./ai/aiContract');
const { getAiProvider } = require('./ai/aiProvider');
const { buildInvestigationContext, buildInvestigationContextFromDb } = require('./investigationService');

/**
 * Formats a compact, high-signal LLM prompt from the investigation context.
 *
 * @param {Object} context - Compact investigation context
 * @returns {string} Compact LLM prompt
 */
function formatInvestigationPrompt(context) {
  const schemaDescription = JSON.stringify(
    {
      rootCause: '<string describing the specific technical/business root cause>',
      recoverability: `<one of: ${ALLOWED_RECOVERABILITY.join(' | ')}>`,
      recommendedAction: `<one of: ${ALLOWED_ACTIONS.join(' | ')}>`,
      confidence: '<float between 0.0 and 1.0>',
      expectedRecovery: '<non-negative number in original currency>',
      reasoning: ['<string step 1>', '<string step 2>'],
      riskFactors: ['<string risk factor 1>'],
      requiresHumanReview: '<boolean>',
    },
    null,
    2
  );

  return `You are the Valqora AI Revenue Decision & Recovery Engine investigation agent.
Analyze the following failed transaction recovery opportunity and return your diagnostic assessment as strict, valid JSON matching the exact schema below.

CRITICAL INVARIANTS:
1. If the failure reason is SUSPICIOUS_TRANSACTION, you MUST set "requiresHumanReview": true and "recommendedAction": "HUMAN_REVIEW".
2. If retryCount is 2 or higher, NEVER recommend "RETRY" (recommend PAYMENT_LINK, WAIT, or PAYMENT_METHOD_UPDATE instead).
3. Do not include markdown ticks (\`\`\`json) or commentary outside the JSON object.

--- INVESTIGATION CONTEXT ---
${JSON.stringify(context, null, 2)}

--- REQUIRED JSON OUTPUT SCHEMA ---
${schemaDescription}`;
}

/**
 * Enforces safety guardrails to ensure AI advisory output never violates
 * authoritative deterministic safety rules.
 *
 * @param {Object} decision - Validated AI decision object
 * @param {Object} context - Investigation context
 * @returns {Object} Guardrail-enforced decision object
 */
function applySafetyGuardrails(decision, context) {
  const guarded = { ...decision };
  const failureReason = context?.failure?.reason;
  const retryCount = context?.failure?.retryCount ?? 0;

  // Guardrail 1: Fraud / Suspicious transaction safety override
  if (failureReason === 'SUSPICIOUS_TRANSACTION') {
    guarded.requiresHumanReview = true;
    guarded.recommendedAction = 'HUMAN_REVIEW';
    guarded.recoverability = 'LOW';
    if (!guarded.riskFactors.includes('Flagged for mandatory fraud / compliance review')) {
      guarded.riskFactors.unshift('Flagged for mandatory fraud / compliance review');
    }
  }

  // Guardrail 2: Retry count safety override (>= 2 retries cannot RETRY)
  if (retryCount >= 2 && guarded.recommendedAction === 'RETRY') {
    const customerType = context?.customer?.customerType;
    guarded.recommendedAction = customerType === 'HIGH_VALUE' ? 'PAYMENT_LINK' : 'WAIT';
    guarded.riskFactors.push(`Automated retries prohibited (retry count: ${retryCount} >= 2)`);
  }

  return guarded;
}

/**
 * Executes an AI investigation on an opportunity context or transaction.
 *
 * @param {Object} contextOrTxn - Plain transaction object, Mongoose doc, or ready investigation context
 * @param {Object} [options] - Optional settings (custom provider, custom prompt, etc.)
 * @returns {Promise<Object>} Object containing validated AI decision and context
 */
async function investigateOpportunity(contextOrTxn, options = {}) {
  // 1. Build or normalize investigation context
  let context;
  if (contextOrTxn && contextOrTxn.opportunityId && contextOrTxn.customer && contextOrTxn.failure) {
    // Already structured context
    context = contextOrTxn;
  } else {
    // Transaction object needing transformation
    context = buildInvestigationContext(contextOrTxn, options.providerStats);
  }

  // 2. Format prompt
  const prompt = options.customPrompt || formatInvestigationPrompt(context);

  // 3. Resolve AI provider
  const provider = options.provider || getAiProvider();

  // 4. Invoke AI provider
  const rawDecision = await provider.generateDecision(prompt, context);

  // 5. Strictly validate schema
  const validatedDecision = validateAiDecision(rawDecision, context);

  // 6. Apply deterministic safety guardrails
  const finalDecision = applySafetyGuardrails(validatedDecision, context);

  return {
    success: true,
    opportunityId: context.opportunityId,
    transactionId: context.transactionId,
    decision: finalDecision,
    context,
    isAdvisory: true,
  };
}

/**
 * Investigates a transaction by ID from the database.
 *
 * @param {string} transactionId - Transaction ID
 * @param {Object} [options] - Optional settings
 * @returns {Promise<Object>} Investigation result
 */
async function investigateTransactionById(transactionId, options = {}) {
  const context = await buildInvestigationContextFromDb(transactionId);
  return investigateOpportunity(context, options);
}

module.exports = {
  investigateOpportunity,
  investigateTransactionById,
  formatInvestigationPrompt,
  applySafetyGuardrails,
};
