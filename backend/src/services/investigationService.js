/**
 * Valqora AI Investigation Service — Context Builder
 *
 * Constructs compact, structured, and leak-free investigation contexts
 * for failed transactions / recovery opportunities.
 *
 * Ground-truth fields (ground_truth_action, ground_truth_priority, is_recoverable)
 * are strictly isolated and never included in the investigation context.
 */

const Transaction = require('../models/Transaction');
const { predictRecoveryProbability } = require('./ml/recoveryModel');

/**
 * Synthesizes factual, leakage-free evidence bullet points from the transaction,
 * provider telemetry, and baseline ML prediction.
 *
 * @param {Object} txn - Sanitized transaction details
 * @param {Object} [providerStats] - Optional provider telemetry
 * @param {Object} [mlPrediction] - Optional ML prediction result
 * @returns {string[]} Array of factual evidence statements
 */
function extractEvidence(txn, providerStats = null, mlPrediction = null) {
  const evidence = [];

  // Failure reason evidence
  if (txn.failure_reason === 'BANK_TIMEOUT') {
    evidence.push('Failure reason is BANK_TIMEOUT (temporary banking gateway response delay)');
  } else if (txn.failure_reason === 'PROVIDER_TIMEOUT') {
    evidence.push('Failure reason is PROVIDER_TIMEOUT (upstream acquirer gateway timeout)');
  } else if (txn.failure_reason === 'NETWORK_ERROR') {
    evidence.push('Failure reason is NETWORK_ERROR (transient network connectivity drop)');
  } else if (txn.failure_reason === 'CARD_EXPIRED' || txn.failure_reason === 'PAYMENT_METHOD_EXPIRED') {
    evidence.push('Failure reason is card/payment method expiration');
  } else if (txn.failure_reason === 'INVALID_CARD') {
    evidence.push('Failure reason is invalid card details or incorrect CVV/expiry');
  } else if (txn.failure_reason === 'INSUFFICIENT_FUNDS') {
    evidence.push('Failure reason is INSUFFICIENT_FUNDS on customer account');
  } else if (txn.failure_reason === 'RECURRING_PAYMENT_FAILED') {
    evidence.push('Failure reason is recurring auto-debit / mandate execution failure');
  } else if (txn.failure_reason === 'SUSPICIOUS_TRANSACTION') {
    evidence.push('CRITICAL RISK: Transaction flagged as SUSPICIOUS_TRANSACTION (fraud/security risk)');
  } else if (txn.failure_reason) {
    evidence.push(`Failure reason: ${txn.failure_reason}`);
  }

  // Retry status evidence
  const retryCount = Number(txn.retry_count || 0);
  if (retryCount === 0) {
    evidence.push('Transaction has not been retried yet (retry count: 0)');
  } else if (retryCount === 1) {
    evidence.push('Transaction has been retried once (retry count: 1)');
  } else {
    evidence.push(`Transaction has undergone ${retryCount} retries (automated retries exhausted)`);
  }

  // Customer tier & relationship evidence
  const clv = Number(txn.customer_lifetime_value || 0);
  const prevFailures = Number(txn.previous_failures || 0);
  const customerType = txn.customer_type || 'REGULAR';

  if (customerType === 'HIGH_VALUE') {
    evidence.push(`High-value customer account with ₹${clv.toLocaleString('en-IN')} lifetime value`);
  } else if (customerType === 'NEW') {
    evidence.push('First-time / new customer with no prior transaction history');
  }

  if (prevFailures === 0 && customerType !== 'NEW') {
    evidence.push('Customer has a clean historical payment record with 0 previous failures');
  } else if (prevFailures >= 3) {
    evidence.push(`Customer has high failure history (${prevFailures} previous failed attempts)`);
  }

  // Provider health evidence
  if (providerStats && typeof providerStats.currentSuccessRate === 'number') {
    const current = providerStats.currentSuccessRate;
    const baseline = providerStats.baselineSuccessRate ?? 93.3;
    if (current < baseline - 5.0) {
      evidence.push(
        `Provider ${providerStats.name || txn.provider} success rate dropped significantly to ${current.toFixed(1)}% (baseline: ${baseline.toFixed(1)}%)`
      );
    } else {
      evidence.push(
        `Provider ${providerStats.name || txn.provider} is operating normally at ${current.toFixed(1)}% success rate`
      );
    }
  }

  // ML recovery prediction evidence
  if (mlPrediction && mlPrediction.isAvailable && typeof mlPrediction.recoveryProbability === 'number') {
    evidence.push(
      `Baseline ML recovery probability: ${(mlPrediction.recoveryProbability * 100).toFixed(1)}% (${mlPrediction.model || 'RandomForestClassifier'})`
    );
  } else if (mlPrediction && mlPrediction.isAvailable === false) {
    evidence.push(
      `Baseline ML recovery prediction: unavailable (${mlPrediction.reason || 'offline'})`
    );
  }

  return evidence;
}

/**
 * Builds a compact structured investigation context for an opportunity / transaction.
 *
 * @param {Object} rawTxn - Plain transaction object or Mongoose document
 * @param {Object} [providerStats] - Optional provider telemetry
 * @param {Object} [customMlPrediction] - Optional precomputed ML prediction
 * @returns {Object} Compact investigation context
 */
function buildInvestigationContext(rawTxn, providerStats = null, customMlPrediction = null) {
  if (!rawTxn || typeof rawTxn !== 'object') {
    throw new Error('Transaction data is required to build investigation context');
  }

  // Extract raw properties (supports both Mongoose doc and plain JSON)
  const txn = typeof rawTxn.toObject === 'function' ? rawTxn.toObject() : { ...rawTxn };

  // Validation: Only failed transactions can be investigated
  if (txn.status === 'SUCCESS') {
    throw new Error('Successful transactions cannot be investigated as recovery opportunities');
  }

  const transactionId = txn.transaction_id || txn.transactionId;
  if (!transactionId) {
    throw new Error('Transaction must contain a valid transaction_id');
  }

  const amount = Number(txn.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error('Transaction amount must be a positive number');
  }

  const customerId = txn.customer_id || txn.customerId || 'UNKNOWN';
  const customerType = txn.customer_type || txn.customerType || 'REGULAR';
  const clv = Number(txn.customer_lifetime_value ?? txn.customerLifetimeValue ?? 0);
  const prevFailures = Number(txn.previous_failures ?? txn.previousFailures ?? 0);

  const failureReason = txn.failure_reason || txn.failureReason || 'UNKNOWN';
  const retryCount = Number(txn.retry_count ?? txn.retryCount ?? 0);

  const providerName = txn.provider || 'UNKNOWN';

  // Formatted provider statistics
  let providerInfo = {
    name: providerName,
  };

  if (providerStats && typeof providerStats === 'object') {
    providerInfo.name = providerStats.name || providerName;
    if (typeof providerStats.currentSuccessRate === 'number') {
      providerInfo.currentSuccessRate = Number(providerStats.currentSuccessRate.toFixed(1));
    }
    if (typeof providerStats.baselineSuccessRate === 'number') {
      providerInfo.baselineSuccessRate = Number(providerStats.baselineSuccessRate.toFixed(1));
    }
  }

  // Execute isolated ML recovery prediction
  let mlPrediction = customMlPrediction;
  if (!mlPrediction) {
    try {
      mlPrediction = predictRecoveryProbability(txn);
    } catch (err) {
      mlPrediction = {
        recoveryProbability: null,
        isAvailable: false,
        model: 'RandomForestClassifier',
        reason: err.message,
      };
    }
  }

  // Generate evidence bullet points
  const evidence = extractEvidence(
    {
      failure_reason: failureReason,
      retry_count: retryCount,
      customer_type: customerType,
      customer_lifetime_value: clv,
      previous_failures: prevFailures,
      provider: providerName,
    },
    providerStats,
    mlPrediction
  );

  // Return strictly sanitized and compact context
  // NOTE: ground_truth_action, ground_truth_priority, is_recoverable, and internal DB ids are NEVER included
  return {
    opportunityId: txn.opportunityId || `OPP_${transactionId}`,
    transactionId,
    amount: Number(amount.toFixed(2)),
    currency: txn.currency || 'INR',
    paymentMethod: txn.payment_method || txn.paymentMethod || 'UPI',
    timestamp: txn.timestamp instanceof Date ? txn.timestamp.toISOString() : String(txn.timestamp || ''),
    customer: {
      customerId,
      customerType,
      customerLifetimeValue: Number(clv.toFixed(2)),
      previousFailures: prevFailures,
    },
    failure: {
      reason: failureReason,
      retryCount,
    },
    provider: providerInfo,
    mlPrediction: {
      recoveryProbability: mlPrediction.recoveryProbability,
      isAvailable: Boolean(mlPrediction.isAvailable),
      model: mlPrediction.model || 'RandomForestClassifier',
      ...(mlPrediction.reason ? { reason: mlPrediction.reason } : {}),
    },
    evidence,
  };
}

/**
 * Builds an investigation context by retrieving transaction and provider telemetry from MongoDB.
 *
 * @param {string} transactionId - The transaction ID to investigate
 * @returns {Promise<Object>} Compact investigation context
 */
async function buildInvestigationContextFromDb(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') {
    throw new Error('Valid transactionId string is required');
  }

  const transaction = await Transaction.findOne({ transaction_id: transactionId.trim() })
    .select('transaction_id customer_id amount currency payment_method timestamp provider status failure_reason retry_count customer_type customer_lifetime_value previous_failures')
    .lean();

  if (!transaction) {
    throw new Error(`Transaction with ID ${transactionId} not found`);
  }

  if (transaction.status === 'SUCCESS') {
    throw new Error('Successful transactions cannot be investigated as recovery opportunities');
  }

  // Calculate recent provider health if transactions exist
  let providerStats = null;
  try {
    const [providerAgg, baselineAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { provider: transaction.provider } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            success: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            success: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    if (providerAgg.length > 0 && baselineAgg.length > 0) {
      const pTotal = providerAgg[0].total;
      const pSucc = providerAgg[0].success;
      const bTotal = baselineAgg[0].total;
      const bSucc = baselineAgg[0].success;

      providerStats = {
        name: transaction.provider,
        currentSuccessRate: pTotal > 0 ? (pSucc / pTotal) * 100 : 0,
        baselineSuccessRate: bTotal > 0 ? (bSucc / bTotal) * 100 : 0,
      };
    }
  } catch (err) {
    // Non-fatal: continue with basic provider info if aggregation fails
  }

  return buildInvestigationContext(transaction, providerStats);
}

module.exports = {
  buildInvestigationContext,
  buildInvestigationContextFromDb,
  extractEvidence,
};
