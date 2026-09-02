const mongoose = require('mongoose');

const LEARNING_ACTIONS = Object.freeze([
  'RETRY',
  'PAYMENT_METHOD_UPDATE',
  'PAYMENT_LINK',
  'WAIT_AND_RETRY',
  'HUMAN_REVIEW',
  'NO_ACTION',
]);

const LEARNING_RESULTS = Object.freeze([
  'RECOVERED',
  'NOT_RECOVERED',
  'FAILED',
  'HUMAN_REVIEW',
  'BLOCKED',
]);

const learningRecordSchema = new mongoose.Schema(
  {
    opportunity_id: { type: String, required: true, trim: true },
    action: { type: String, required: true, enum: LEARNING_ACTIONS, trim: true },
    predicted_probability: { type: Number, required: true, min: 0, max: 1 },
    amount: { type: Number, required: true, min: 0 },
    customer_type: { type: String, required: true, trim: true },
    failure_reason: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true },
    retry_count: { type: Number, required: true, min: 0 },
    actual_result: { type: String, required: true, enum: LEARNING_RESULTS, trim: true },
    actual_recovered_amount: { type: Number, required: true, min: 0 },
    verified: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    idempotency_key: { type: String, required: true, unique: true, index: true },
  },
  { collection: 'learning_records' }
);

const LearningRecord = mongoose.model('LearningRecord', learningRecordSchema);

module.exports = LearningRecord;
module.exports.LEARNING_ACTIONS = LEARNING_ACTIONS;
module.exports.LEARNING_RESULTS = LEARNING_RESULTS;
