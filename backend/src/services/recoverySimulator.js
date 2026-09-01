/**
 * Valqora Recovery Action Simulator
 *
 * Deterministic, auditable, provider-independent simulation of recovery actions.
 * This service does not move real money, call external payment APIs, or act as an
 * authoritative decision engine. It only simulates the result of a policy-approved action.
 */

const SUPPORTED_SIMULATION_ACTIONS = Object.freeze([
  'RETRY_PAYMENT',
  'SEND_PAYMENT_LINK',
  'REQUEST_PAYMENT_METHOD_UPDATE',
  'WAIT_AND_RETRY',
  'ESCALATE_TO_HUMAN',
  'NO_ACTION',
]);

const POLICY_ACTION_TO_SIMULATOR = Object.freeze({
  RETRY: 'RETRY_PAYMENT',
  PAYMENT_LINK: 'SEND_PAYMENT_LINK',
  PAYMENT_METHOD_UPDATE: 'REQUEST_PAYMENT_METHOD_UPDATE',
  WAIT: 'WAIT_AND_RETRY',
  HUMAN_REVIEW: 'ESCALATE_TO_HUMAN',
  NONE: 'NO_ACTION',
});

function stableHash(seedValue) {
  const input = String(seedValue ?? '');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    hash ^= code;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function buildBlockedSimulation(message = 'Recovery action blocked by policy') {
  return {
    simulated: true,
    executed: false,
    action: 'BLOCKED',
    status: 'BLOCKED',
    amountRecovered: 0,
    message,
  };
}

function simulateRetryPayment({ transaction = {}, policyDecision = null } = {}) {
  const transactionId = transaction.transactionId || transaction.transaction_id || 'UNKNOWN_TXN';
  const amount = Number(transaction.amount ?? 0);
  const retryCount = Number(transaction.retry_count ?? transaction.retryCount ?? 0);

  if (policyDecision && policyDecision.decision === 'BLOCKED') {
    return buildBlockedSimulation('Recovery action blocked by policy');
  }

  const baseProbability = retryCount === 0 ? 0.82 : retryCount === 1 ? 0.57 : 0.12;
  const deterministicValue = stableHash(`${transactionId}|${amount}|${retryCount}|RETRY_PAYMENT`);
  const success = deterministicValue <= baseProbability;

  return {
    simulated: true,
    executed: true,
    action: 'RETRY_PAYMENT',
    status: success ? 'SUCCESS' : 'FAILED',
    amountRecovered: success ? Number(amount.toFixed(2)) : 0,
    message: success ? 'Payment retry simulated successfully' : 'Simulated payment retry failed',
  };
}

function simulateNonRetryAction(actionName) {
  const normalized = String(actionName || '').toUpperCase();

  const actionMap = {
    SEND_PAYMENT_LINK: {
      simulated: true,
      executed: true,
      action: 'SEND_PAYMENT_LINK',
      status: 'QUEUED',
      amountRecovered: 0,
      message: 'Payment link would be sent to the customer',
    },
    REQUEST_PAYMENT_METHOD_UPDATE: {
      simulated: true,
      executed: true,
      action: 'REQUEST_PAYMENT_METHOD_UPDATE',
      status: 'PENDING',
      amountRecovered: 0,
      message: 'Customer would be asked to update their payment method',
    },
    WAIT_AND_RETRY: {
      simulated: true,
      executed: true,
      action: 'WAIT_AND_RETRY',
      status: 'DEFERRED',
      amountRecovered: 0,
      message: 'Recovery is deferred and would be retried later',
    },
    ESCALATE_TO_HUMAN: {
      simulated: true,
      executed: true,
      action: 'ESCALATE_TO_HUMAN',
      status: 'ESCALATED',
      amountRecovered: 0,
      message: 'Escalation to human review would be triggered',
    },
    NO_ACTION: {
      simulated: true,
      executed: true,
      action: 'NO_ACTION',
      status: 'NO_CHANGE',
      amountRecovered: 0,
      message: 'No automated recovery action would be taken',
    },
  };

  const result = actionMap[normalized];
  if (!result) {
    throw new Error(`Unsupported simulator action: ${actionName}`);
  }

  return { ...result };
}

function mapPolicyActionToRecoveryAction(policyAction) {
  if (!policyAction || typeof policyAction !== 'string') {
    throw new Error('Policy action is required to map to a recovery simulator action');
  }

  const normalized = String(policyAction).trim().toUpperCase();
  const mapped = POLICY_ACTION_TO_SIMULATOR[normalized];
  if (!mapped) {
    throw new Error(`Policy action '${policyAction}' does not map to a supported recovery simulation action`);
  }

  return mapped;
}

function simulateRecoveryAction({ action, transaction, policyDecision = null } = {}) {
  if (!action || typeof action !== 'string') {
    throw new Error('Simulator action is required');
  }

  const normalizedAction = String(action).trim().toUpperCase();

  if (policyDecision && policyDecision.decision === 'BLOCKED') {
    return buildBlockedSimulation(policyDecision.reason || 'Recovery action blocked by policy');
  }

  if (normalizedAction === 'RETRY_PAYMENT') {
    return simulateRetryPayment({ transaction, policyDecision });
  }

  return simulateNonRetryAction(normalizedAction);
}

module.exports = {
  SUPPORTED_SIMULATION_ACTIONS,
  POLICY_ACTION_TO_SIMULATOR,
  mapPolicyActionToRecoveryAction,
  simulateRecoveryAction,
  stableHash,
  simulateRetryPayment,
  simulateNonRetryAction,
};
