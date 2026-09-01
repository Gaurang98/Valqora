/**
 * Valqora Recovery Metrics Service
 *
 * Deterministic KPI calculations based on the existing recovery flow:
 * Investigation -> Policy Evaluation -> Recovery Simulation -> Verification -> Metrics.
 *
 * The verification layer is authoritative for completed recoveries. Metrics never
 * count blocked, invalid, or unverified outcomes as recovered revenue.
 */

function asSafeMoney(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function getTransactionAmount(transaction = {}) {
  const candidate = transaction?.amount ?? transaction?.amountValue ?? transaction?.value ?? 0;
  return asSafeMoney(candidate);
}

function getTransactionStatus(transaction = {}) {
  return String(transaction?.status || '').toUpperCase();
}

function calculateRevenueAtRisk(transactions = []) {
  const list = Array.isArray(transactions) ? transactions : [];

  return list.reduce((total, transaction) => {
    const amount = getTransactionAmount(transaction);
    if (getTransactionStatus(transaction) === 'FAILED' && amount > 0) {
      return Number((total + amount).toFixed(2));
    }
    return total;
  }, 0);
}

function calculateRecoverableRevenue(transactions = [], recoveryResults = []) {
  const transactionList = Array.isArray(transactions) ? transactions : [];
  const recoveryList = Array.isArray(recoveryResults) ? recoveryResults : [];

  const approvedRevenue = recoveryList.reduce((total, result) => {
    const policyDecision = result?.policy?.decision || result?.policyDecision || 'BLOCKED';
    const transaction = result?.transaction || {};
    const amount = getTransactionAmount(transaction);

    if (policyDecision === 'APPROVED' && amount > 0 && getTransactionStatus(transaction) !== 'SUCCESS') {
      return Number((total + amount).toFixed(2));
    }

    return total;
  }, 0);

  if (recoveryList.length > 0) {
    return asSafeMoney(approvedRevenue);
  }

  return transactionList.reduce((total, transaction) => {
    if (getTransactionStatus(transaction) === 'FAILED') {
      return Number((total + getTransactionAmount(transaction)).toFixed(2));
    }
    return total;
  }, 0);
}

function calculateRevenueRecovered(recoveryResults = []) {
  const list = Array.isArray(recoveryResults) ? recoveryResults : [];

  return list.reduce((total, result) => {
    const verification = result?.verification || {};
    const transaction = result?.transaction || {};

    if (verification?.verified !== true) {
      return total;
    }

    const originalStatus = getTransactionStatus(transaction);
    const amountRecovered = asSafeMoney(verification?.amountRecovered ?? verification?.recoveredAmount ?? 0);
    const amount = getTransactionAmount(transaction);

    if (originalStatus === 'FAILED' && amountRecovered > 0 && amount > 0) {
      return Number((total + amountRecovered).toFixed(2));
    }

    return total;
  }, 0);
}

function calculateRecoveryRate(recoverableRevenue = 0, revenueRecovered = 0) {
  const recoverable = asSafeMoney(recoverableRevenue);
  const recovered = asSafeMoney(revenueRecovered);

  if (recoverable <= 0) {
    return 0;
  }

  const rate = (recovered / recoverable) * 100;
  if (!Number.isFinite(rate)) {
    return 0;
  }

  return Number(rate.toFixed(2));
}

function calculateRecoveryMetrics({ transactions = [], recoveryResults = [] } = {}) {
  const revenueAtRisk = calculateRevenueAtRisk(transactions);
  const recoverableRevenue = calculateRecoverableRevenue(transactions, recoveryResults);
  const revenueRecovered = calculateRevenueRecovered(recoveryResults);
  const recoveryRate = calculateRecoveryRate(recoverableRevenue, revenueRecovered);

  return {
    revenueAtRisk: asSafeMoney(revenueAtRisk),
    recoverableRevenue: asSafeMoney(recoverableRevenue),
    revenueRecovered: asSafeMoney(revenueRecovered),
    recoveryRate,
  };
}

module.exports = {
  asSafeMoney,
  calculateRevenueAtRisk,
  calculateRecoverableRevenue,
  calculateRevenueRecovered,
  calculateRecoveryRate,
  calculateRecoveryMetrics,
};
