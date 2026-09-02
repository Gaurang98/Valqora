const CALIBRATION_BUCKETS = Object.freeze([
  { label: '0.00-0.19', minimum: 0, maximum: 0.2 },
  { label: '0.20-0.39', minimum: 0.2, maximum: 0.4 },
  { label: '0.40-0.59', minimum: 0.4, maximum: 0.6 },
  { label: '0.60-0.79', minimum: 0.6, maximum: 0.8 },
  { label: '0.80-1.00', minimum: 0.8, maximum: 1.000001 },
]);

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function isValidRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;

  const probability = finiteNumber(record.predicted_probability);
  const amount = finiteNumber(record.amount);
  const recoveredAmount = finiteNumber(record.actual_recovered_amount);
  const retryCount = finiteNumber(record.retry_count);
  const action = String(record.action || '').trim();
  const actualResult = String(record.actual_result || '').trim().toUpperCase();

  if (!Number.isFinite(probability) || probability < 0 || probability > 1) return false;
  if (!Number.isFinite(amount) || amount < 0) return false;
  if (!Number.isFinite(recoveredAmount) || recoveredAmount < 0 || recoveredAmount > amount) return false;
  if (!Number.isFinite(retryCount) || retryCount < 0 || !action || typeof record.verified !== 'boolean') return false;
  if (!actualResult) return false;

  const isRecovered = actualResult === 'RECOVERED'
    && record.verified === true
    && recoveredAmount > 0;
  const hasContradictoryRecovery = (actualResult === 'RECOVERED' && !isRecovered)
    || (record.verified === true && recoveredAmount > 0 && actualResult !== 'RECOVERED');

  return !hasContradictoryRecovery;
}

function matchesFilters(record, filters = {}) {
  const matchesValue = (filter, value) => filter === undefined || String(value).toUpperCase() === String(filter).toUpperCase();
  if (!matchesValue(filters.action, record.action)) return false;
  if (!matchesValue(filters.customer_type, record.customer_type)) return false;
  if (!matchesValue(filters.failure_reason, record.failure_reason)) return false;
  if (!matchesValue(filters.provider, record.provider)) return false;

  const timestamp = new Date(record.timestamp);
  if (Number.isNaN(timestamp.getTime())) return false;
  if (filters.startDate !== undefined && timestamp < filters.startDate) return false;
  if (filters.endDate !== undefined && timestamp > filters.endDate) return false;
  return true;
}

function normalizeFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new Error('Analytics filters must be a valid object');
  }

  const normalized = {
    action: filters.action,
    customer_type: filters.customer_type,
    failure_reason: filters.failure_reason,
    provider: filters.provider,
  };

  if (filters.startDate !== undefined) {
    normalized.startDate = new Date(filters.startDate);
    if (Number.isNaN(normalized.startDate.getTime())) throw new Error('Invalid analytics start date');
  }
  if (filters.endDate !== undefined) {
    normalized.endDate = new Date(filters.endDate);
    if (Number.isNaN(normalized.endDate.getTime())) throw new Error('Invalid analytics end date');
  }
  if (normalized.startDate && normalized.endDate && normalized.startDate > normalized.endDate) {
    throw new Error('Analytics start date cannot be after end date');
  }

  return normalized;
}

function getCalibrationBucket(probability) {
  return CALIBRATION_BUCKETS.find((bucket) => probability >= bucket.minimum && probability < bucket.maximum);
}

function getActualSuccess(record) {
  return record.verified === true
    && finiteNumber(record.actual_recovered_amount) > 0
    && String(record.actual_result || '').toUpperCase() === 'RECOVERED';
}

function calculatePerformanceAnalytics(records = [], filters = {}) {
  if (!Array.isArray(records)) throw new Error('Learning records must be an array');
  const normalizedFilters = normalizeFilters(filters);
  const filteredRecords = records.filter((record) => matchesFilters(record, normalizedFilters));
  const validRecords = filteredRecords.filter(isValidRecord);
  const invalidRecordCount = filteredRecords.length - validRecords.length;
  const totalRecords = validRecords.length;

  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      invalidRecordCount,
      verifiedRecoveries: 0,
      totalRecoveredAmount: 0,
      actualRecoveryRate: 0,
      meanPredictedProbability: 0,
      brierScore: null,
      calibration: [],
      actionPerformance: [],
      recoveryByAction: [],
    };
  }

  const successfulRecords = validRecords.filter(getActualSuccess);
  const totalRecoveredAmount = Number(successfulRecords
    .reduce((total, record) => total + finiteNumber(record.actual_recovered_amount), 0)
    .toFixed(2));
  const meanPredictedProbability = Number((validRecords
    .reduce((total, record) => total + finiteNumber(record.predicted_probability), 0) / totalRecords)
    .toFixed(6));
  const brierScore = Number((validRecords
    .reduce((total, record) => {
      const difference = finiteNumber(record.predicted_probability) - (getActualSuccess(record) ? 1 : 0);
      return total + (difference * difference);
    }, 0) / totalRecords)
    .toFixed(6));

  const calibration = CALIBRATION_BUCKETS.map((bucket) => {
    const bucketRecords = validRecords.filter((record) => getCalibrationBucket(finiteNumber(record.predicted_probability))?.label === bucket.label);
    const count = bucketRecords.length;
    const averagePredictedProbability = count === 0
      ? 0
      : Number((bucketRecords.reduce((total, record) => total + finiteNumber(record.predicted_probability), 0) / count).toFixed(6));
    const bucketRecoveries = bucketRecords.filter(getActualSuccess).length;
    const actualRecoveryRate = count === 0 ? 0 : Number(((bucketRecoveries / count) * 100).toFixed(2));

    return {
      bucket: bucket.label,
      count,
      averagePredictedProbability,
      actualRecoveryRate,
      calibrationError: Number(Math.abs(averagePredictedProbability - (actualRecoveryRate / 100)).toFixed(6)),
    };
  });

  const actions = Array.from(new Set(validRecords.map((record) => String(record.action).toUpperCase()))).sort();
  const actionPerformance = actions.map((action) => {
    const actionRecords = validRecords.filter((record) => String(record.action).toUpperCase() === action);
    const successful = actionRecords.filter(getActualSuccess);
    const recoveredAmount = Number(successful
      .reduce((total, record) => total + finiteNumber(record.actual_recovered_amount), 0)
      .toFixed(2));
    const successRate = Number(((successful.length / actionRecords.length) * 100).toFixed(2));

    return {
      action,
      totalOutcomes: actionRecords.length,
      successfulRecoveries: successful.length,
      successRate,
      outcomes: actionRecords.length,
      totalRecoveredAmount: recoveredAmount,
      averageRecoveredAmount: successful.length === 0 ? 0 : Number((recoveredAmount / successful.length).toFixed(2)),
      recoveryRate: successRate,
    };
  });

  return {
    totalRecords,
    invalidRecordCount,
    verifiedRecoveries: successfulRecords.length,
    totalRecoveredAmount,
    actualRecoveryRate: Number(((successfulRecords.length / totalRecords) * 100).toFixed(2)),
    meanPredictedProbability,
    brierScore,
    calibration,
    actionPerformance,
    recoveryByAction: actionPerformance.map((item) => ({
      action: item.action,
      outcomes: item.outcomes,
      successfulRecoveries: item.successfulRecoveries,
      totalRecoveredAmount: item.totalRecoveredAmount,
      averageRecoveredAmount: item.averageRecoveredAmount,
      recoveryRate: item.recoveryRate,
    })),
  };
}

module.exports = {
  CALIBRATION_BUCKETS,
  isValidRecord,
  getActualSuccess,
  calculatePerformanceAnalytics,
};
