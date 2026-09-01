const Transaction = require('../models/Transaction');
const { investigateOpportunity, investigateTransactionById } = require('../services/aiService');

const TEMPORARY_FAILURES = new Set(['BANK_TIMEOUT', 'PROVIDER_TIMEOUT', 'NETWORK_ERROR']);
const PAYMENT_METHOD_FAILURES = new Set(['CARD_EXPIRED', 'PAYMENT_METHOD_EXPIRED', 'INVALID_CARD']);
const ALLOWED_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const ALLOWED_ACTIONS = new Set(['NO_ACTION', 'RETRY', 'PAYMENT_METHOD_UPDATE', 'PAYMENT_LINK', 'WAIT', 'HUMAN_REVIEW']);
const MAX_LIMIT = 500;

function parsePagination(query) {
  const pageValue = Number(query.page ?? 1);
  const limitValue = Number(query.limit ?? 50);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : null;
  const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, MAX_LIMIT) : null;
  return { page, limit };
}

function determineDecision(transaction) {
  const { status, failure_reason: reason, retry_count: retryCount, customer_type: customerType } = transaction;
  if (status === 'SUCCESS') return { recommendedAction: 'NO_ACTION', recoverable: false, priority: 'NONE' };
  if (reason === 'SUSPICIOUS_TRANSACTION') return { recommendedAction: 'HUMAN_REVIEW', recoverable: false, priority: 'CRITICAL' };

  let recommendedAction;
  let recoverable = true;
  if (TEMPORARY_FAILURES.has(reason)) {
    recommendedAction = retryCount < 2 ? 'RETRY' : (customerType === 'HIGH_VALUE' ? 'PAYMENT_LINK' : 'WAIT');
  } else if (PAYMENT_METHOD_FAILURES.has(reason)) {
    recommendedAction = 'PAYMENT_METHOD_UPDATE';
  } else if (reason === 'RECURRING_PAYMENT_FAILED') {
    recommendedAction = customerType === 'HIGH_VALUE' && transaction.previous_failures <= 1
      ? 'PAYMENT_LINK' : 'PAYMENT_METHOD_UPDATE';
  } else if (reason === 'INSUFFICIENT_FUNDS') {
    const day = new Date(transaction.timestamp).getUTCDate();
    recommendedAction = day >= 28 || day <= 5 ? 'WAIT' : 'PAYMENT_LINK';
  } else {
    recommendedAction = 'PAYMENT_LINK';
  }

  if (retryCount >= 2 && recommendedAction === 'RETRY') {
    recommendedAction = customerType === 'HIGH_VALUE' ? 'PAYMENT_LINK' : 'WAIT';
  }

  if (customerType === 'HIGH_VALUE' && (transaction.amount >= 25000 || transaction.customer_lifetime_value >= 150000)) {
    return { recommendedAction, recoverable, priority: transaction.amount >= 60000 ? 'CRITICAL' : 'HIGH' };
  }
  if (recoverable && (transaction.amount >= 8000 || customerType === 'HIGH_VALUE')) {
    return { recommendedAction, recoverable, priority: 'HIGH' };
  }
  if (recoverable && customerType === 'REGULAR' && transaction.amount >= 3000) {
    return { recommendedAction, recoverable, priority: 'MEDIUM' };
  }
  if (recoverable && transaction.amount >= 5000) {
    return { recommendedAction, recoverable, priority: 'MEDIUM' };
  }
  if (recoverable && recommendedAction === 'RETRY') {
    return { recommendedAction, recoverable, priority: 'MEDIUM' };
  }
  return { recommendedAction, recoverable, priority: transaction.previous_failures >= 3 || transaction.amount < 1000 ? 'LOW' : 'MEDIUM' };
}

function validateDecision(transaction, decision) {
  if (!ALLOWED_PRIORITIES.has(decision.priority) || !ALLOWED_ACTIONS.has(decision.recommendedAction)) {
    throw new Error('Runtime decision produced an invalid opportunity value');
  }
  if (typeof decision.recoverable !== 'boolean') throw new Error('Runtime recoverable value must be boolean');
  if (transaction.status === 'SUCCESS' && (decision.priority !== 'NONE' || decision.recommendedAction !== 'NO_ACTION')) {
    throw new Error('Successful transactions cannot become opportunities');
  }
  if (transaction.retry_count >= 2 && decision.recommendedAction === 'RETRY') {
    throw new Error('Transactions with two or more retries cannot receive RETRY');
  }
}

function toOpportunity(transaction) {
  const decision = determineDecision(transaction);
  validateDecision(transaction, decision);
  return {
    opportunityId: `OPP_${transaction.transaction_id}`,
    transactionId: transaction.transaction_id,
    customerId: transaction.customer_id,
    amount: Number(transaction.amount.toFixed(2)),
    revenueAtRisk: Number(transaction.amount.toFixed(2)),
    recoverable: decision.recoverable,
    failureReason: transaction.failure_reason,
    priority: decision.priority,
    recommendedAction: decision.recommendedAction,
  };
}

exports.getOpportunities = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    if (!page || !limit) return res.status(400).json({ error: 'page and limit must be positive integers' });

    const filters = { status: 'FAILED' };
    if (req.query.status !== undefined) {
      if (!['FAILED', 'SUCCESS'].includes(req.query.status)) return res.status(400).json({ error: 'status must be FAILED or SUCCESS' });
      if (req.query.status === 'SUCCESS') return res.status(200).json({ data: [], page, limit, total: 0 });
    }
    if (req.query.failureReason !== undefined) {
      if (typeof req.query.failureReason !== 'string' || !req.query.failureReason.trim()) return res.status(400).json({ error: 'failureReason must be non-empty' });
      filters.failure_reason = req.query.failureReason.trim();
    }
    if (req.query.priority !== undefined && !ALLOWED_PRIORITIES.has(req.query.priority)) {
      return res.status(400).json({ error: 'Invalid priority filter' });
    }

    const transactions = await Transaction.find(filters)
      .select('transaction_id customer_id amount timestamp status failure_reason retry_count customer_type customer_lifetime_value previous_failures')
      .sort({ timestamp: -1, transaction_id: 1 })
      .lean();
    const allOpportunities = transactions.map(toOpportunity).filter((opportunity) => !req.query.priority || opportunity.priority === req.query.priority);
    const start = (page - 1) * limit;
    const data = allOpportunities.slice(start, start + limit);
    const ids = new Set(data.map((opportunity) => opportunity.opportunityId));
    if (ids.size !== data.length) throw new Error('Duplicate opportunity IDs detected');
    return res.status(200).json({ data, page, limit, total: allOpportunities.length });
  } catch (err) {
    console.error('[getOpportunities] Unexpected error:', err.message);
    return res.status(500).json({ error: 'An unexpected server error occurred while fetching opportunities.' });
  }
};

exports.investigateOpportunityHandler = async (req, res) => {
  try {
    const { id } = req.params;
    let result;

    if (id) {
      const cleanTxnId = id.startsWith('OPP_') ? id.replace(/^OPP_/, '') : id;
      result = await investigateTransactionById(cleanTxnId);
    } else if (req.body && Object.keys(req.body).length > 0) {
      result = await investigateOpportunity(req.body);
    } else {
      return res.status(400).json({ error: 'Transaction ID in URL parameter or transaction payload in request body is required' });
    }

    return res.status(200).json({ data: result });
  } catch (err) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message && err.message.includes('Successful transactions cannot be investigated')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[investigateOpportunityHandler] Error:', err.message);
    return res.status(500).json({ error: err.message || 'AI investigation failed' });
  }
};