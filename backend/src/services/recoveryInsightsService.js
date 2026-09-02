const {
  isValidRecord,
  getActualSuccess,
} = require('./performanceAnalyticsService');
const { LEARNING_ACTIONS, LEARNING_RESULTS } = require('../models/LearningRecord');

const MIN_SAMPLE_SIZE = 5;
const HIGH_VALUE_THRESHOLD = 50000;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function isInsightRecord(record) {
  return isValidRecord(record)
    && LEARNING_ACTIONS.includes(String(record.action || '').trim().toUpperCase())
    && LEARNING_RESULTS.includes(String(record.actual_result || '').trim().toUpperCase())
    && String(record.failure_reason || '').trim()
    && String(record.customer_type || '').trim()
    && String(record.provider || '').trim();
}

function confidenceLevel(sampleSize) {
  if (sampleSize >= 25) return 'HIGH';
  if (sampleSize >= 10) return 'MEDIUM';
  if (sampleSize >= MIN_SAMPLE_SIZE) return 'LOW';
  return 'INSUFFICIENT_DATA';
}

function calculateActionMetrics(records) {
  const successfulRecords = records.filter(getActualSuccess);
  const totalRecoveredAmount = Number(successfulRecords
    .reduce((total, record) => total + finiteNumber(record.actual_recovered_amount), 0)
    .toFixed(2));
  const sampleSize = records.length;
  const successfulRecoveries = successfulRecords.length;

  return {
    sampleSize,
    successfulRecoveries,
    successRate: sampleSize === 0 ? 0 : Number((successfulRecoveries / sampleSize).toFixed(6)),
    totalRecoveredAmount,
    averageRecoveredAmount: successfulRecoveries === 0
      ? 0
      : Number((totalRecoveredAmount / successfulRecoveries).toFixed(2)),
  };
}

function compareActionMetrics(left, right) {
  return right.successRate - left.successRate
    || right.averageRecoveredAmount - left.averageRecoveredAmount
    || right.totalRecoveredAmount - left.totalRecoveredAmount
    || left.action.localeCompare(right.action);
}

function buildDimensionInsights(records, dimension, getSegment) {
  const grouped = new Map();

  records.forEach((record) => {
    const segment = String(getSegment(record));
    if (!grouped.has(segment)) grouped.set(segment, new Map());
    const actionGroups = grouped.get(segment);
    const action = String(record.action).trim().toUpperCase();
    if (!actionGroups.has(action)) actionGroups.set(action, []);
    actionGroups.get(action).push(record);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([segment, actionGroups]) => {
      const actions = Array.from(actionGroups.entries())
        .map(([action, actionRecords]) => ({
          action,
          ...calculateActionMetrics(actionRecords),
          status: actionRecords.length >= MIN_SAMPLE_SIZE ? 'SUPPORTED' : 'INSUFFICIENT_DATA',
          confidenceLevel: confidenceLevel(actionRecords.length),
        }))
        .sort(compareActionMetrics);
      const supportedActions = actions.filter((action) => action.sampleSize >= MIN_SAMPLE_SIZE);
      const bestAction = supportedActions[0] || null;
      const sampleSize = actions.reduce((total, action) => total + action.sampleSize, 0);

      return {
        dimension,
        segment,
        status: bestAction ? 'SUPPORTED' : 'INSUFFICIENT_DATA',
        bestAction: bestAction?.action || null,
        sampleSize,
        successfulRecoveries: bestAction?.successfulRecoveries || 0,
        successRate: bestAction?.successRate || 0,
        totalRecoveredAmount: bestAction?.totalRecoveredAmount || 0,
        averageRecoveredAmount: bestAction?.averageRecoveredAmount || 0,
        confidenceLevel: bestAction ? bestAction.confidenceLevel : 'INSUFFICIENT_DATA',
        actions,
      };
    });
}

function calculateRecoveryInsights(records = []) {
  if (!Array.isArray(records)) throw new Error('Learning records must be an array');

  const invalidRecordCount = records.filter((record) => !isInsightRecord(record)).length;
  const validRecords = records.filter(isInsightRecord);

  if (validRecords.length === 0) {
    return {
      status: 'NO_DATA',
      invalidRecordCount,
      insights: {
        failureReasons: [],
        customerTypes: [],
        providers: [],
        retryCounts: [],
        highValue: [],
      },
    };
  }

  return {
    status: 'OK',
    invalidRecordCount,
    insights: {
      failureReasons: buildDimensionInsights(validRecords, 'failure_reason', (record) => record.failure_reason),
      customerTypes: buildDimensionInsights(validRecords, 'customer_type', (record) => record.customer_type),
      providers: buildDimensionInsights(validRecords, 'provider', (record) => record.provider),
      retryCounts: buildDimensionInsights(validRecords, 'retry_count', (record) => record.retry_count),
      highValue: buildDimensionInsights(
        validRecords.filter((record) => finiteNumber(record.amount) > HIGH_VALUE_THRESHOLD),
        'high_value',
        () => 'HIGH_VALUE'
      ),
    },
  };
}

module.exports = {
  MIN_SAMPLE_SIZE,
  HIGH_VALUE_THRESHOLD,
  confidenceLevel,
  isInsightRecord,
  calculateActionMetrics,
  calculateRecoveryInsights,
};
