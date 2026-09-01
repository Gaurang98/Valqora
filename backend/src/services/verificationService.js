/**
 * Valqora Recovery Verification Service
 *
 * Deterministic verification layer for simulated recovery outcomes. It does not
 * execute payment actions and does not override policy or simulator rules.
 */

const SUPPORTED_VERIFICATION_ACTIONS = Object.freeze([
  'RETRY_PAYMENT',
  'SEND_PAYMENT_LINK',
  'REQUEST_PAYMENT_METHOD_UPDATE',
  'WAIT_AND_RETRY',
  'ESCALATE_TO_HUMAN',
  'NO_ACTION',
  'BLOCKED',
]);

function verifyRecovery({
  transaction = null,
  action = null,
  simulation = null,
  policyDecision = null,
} = {}) {
  if (policyDecision && policyDecision.decision === 'BLOCKED') {
    const previousStatus = String(transaction?.status || 'FAILED').toUpperCase();
    return {
      verified: false,
      status: 'BLOCKED',
      action: String(action || simulation?.action || 'BLOCKED').toUpperCase(),
      previousStatus,
      currentStatus: previousStatus,
      amountRecovered: 0,
      message: policyDecision.reason || 'Recovery action blocked by policy',
    };
  }

  if (!simulation || typeof simulation !== 'object') {
    return {
      verified: false,
      status: 'FAILED',
      action: String(action || 'UNKNOWN').toUpperCase(),
      previousStatus: String(transaction?.status || 'UNKNOWN').toUpperCase(),
      currentStatus: String(transaction?.status || 'UNKNOWN').toUpperCase(),
      amountRecovered: 0,
      message: 'Recovery could not be verified',
    };
  }

  const safeAction = String(action || simulation.action || 'UNKNOWN').toUpperCase();
  const previousStatus = String(transaction?.status || 'UNKNOWN').toUpperCase();
  const amount = Number(transaction?.amount ?? NaN);
  const amountRecovered = Number(simulation.amountRecovered ?? 0);
  const simulatorStatus = String(simulation.status || 'FAILED').toUpperCase();
  const currentStatus = simulatorStatus === 'SUCCESS' ? 'SUCCESS' : simulatorStatus === 'FAILED' ? 'FAILED' : 'UNKNOWN';

  if (previousStatus !== 'FAILED') {
    return {
      verified: false,
      status: 'FAILED',
      action: safeAction,
      previousStatus,
      currentStatus,
      amountRecovered: 0,
      message: 'Recovery could not be verified because the transaction was not in a failed state before recovery',
    };
  }

  if (!SUPPORTED_VERIFICATION_ACTIONS.includes(safeAction)) {
    return {
      verified: false,
      status: 'FAILED',
      action: safeAction,
      previousStatus,
      currentStatus,
      amountRecovered: 0,
      message: 'Recovery could not be verified',
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      verified: false,
      status: 'FAILED',
      action: safeAction,
      previousStatus,
      currentStatus,
      amountRecovered: 0,
      message: 'Missing or invalid transaction amount',
    };
  }

  if (simulatorStatus === 'SUCCESS') {
    if (amountRecovered <= 0) {
      return {
        verified: false,
        status: 'FAILED',
        action: safeAction,
        previousStatus,
        currentStatus: 'SUCCESS',
        amountRecovered: 0,
        message: 'Recovery could not be verified because recovered amount was not positive',
      };
    }

    if (currentStatus !== 'SUCCESS') {
      return {
        verified: false,
        status: 'FAILED',
        action: safeAction,
        previousStatus,
        currentStatus,
        amountRecovered: 0,
        message: 'Recovery could not be verified because the simulated current status was invalid',
      };
    }

    return {
      verified: true,
      status: 'SUCCESS',
      action: safeAction,
      previousStatus,
      currentStatus: 'SUCCESS',
      amountRecovered: Number(amountRecovered.toFixed(2)),
      message: 'Recovery verified successfully',
    };
  }

  if (simulatorStatus === 'FAILED') {
    if (amountRecovered > 0) {
      return {
        verified: false,
        status: 'FAILED',
        action: safeAction,
        previousStatus,
        currentStatus: 'FAILED',
        amountRecovered: 0,
        message: 'Recovery could not be verified because the simulator reported failure with a positive recovered amount',
      };
    }

    return {
      verified: false,
      status: 'FAILED',
      action: safeAction,
      previousStatus,
      currentStatus: 'FAILED',
      amountRecovered: 0,
      message: 'Recovery could not be verified',
    };
  }

  return {
    verified: false,
    status: 'FAILED',
    action: safeAction,
    previousStatus,
    currentStatus,
    amountRecovered: 0,
    message: 'Recovery could not be verified',
  };
}

module.exports = {
  SUPPORTED_VERIFICATION_ACTIONS,
  verifyRecovery,
};
