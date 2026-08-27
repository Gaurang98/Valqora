const mongoose = require('mongoose');

/**
 * Transaction Schema for Valqora
 *
 * Matches the synthetic dataset produced by ml/generate_dataset.py.
 * Ground-truth fields (is_recoverable, ground_truth_action, ground_truth_priority)
 * are preserved for future ML evaluation pipelines.
 */
const transactionSchema = new mongoose.Schema(
  {
    // ─── Core identifiers ────────────────────────────────────────────────────
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customer_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ─── Transaction details ─────────────────────────────────────────────────
    timestamp: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    payment_method: {
      type: String,
      required: true,
      trim: true,
      enum: ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET'],
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },

    // ─── Outcome ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      trim: true,
      enum: ['SUCCESS', 'FAILED'],
    },
    failure_reason: {
      type: String,
      required: true,
      trim: true,
    },
    retry_count: {
      type: Number,
      required: true,
      min: 0,
    },

    // ─── Customer context (denormalised for ML feature access) ───────────────
    customer_type: {
      type: String,
      required: true,
      trim: true,
      enum: ['NEW', 'REGULAR', 'HIGH_VALUE'],
    },
    customer_lifetime_value: {
      type: Number,
      required: true,
      min: 0,
    },
    previous_failures: {
      type: Number,
      required: true,
      min: 0,
    },

    // ─── Ground-truth labels (for ML evaluation) ─────────────────────────────
    is_recoverable: {
      type: String,
      trim: true,
      enum: ['YES', 'POSSIBLY', 'NO', ''],
      default: '',
    },
    ground_truth_action: {
      type: String,
      trim: true,
      default: '',
    },
    ground_truth_priority: {
      type: String,
      trim: true,
      enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', ''],
      default: '',
    },
  },
  {
    timestamps: true,            // adds createdAt / updatedAt
    collection: 'transactions',  // explicit collection name
  }
);

// Compound index for common analytics queries
transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ status: 1, timestamp: -1 });
transactionSchema.index({ customer_id: 1, timestamp: -1 });
transactionSchema.index({ provider: 1, status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
