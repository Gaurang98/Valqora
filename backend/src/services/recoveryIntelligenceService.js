const { MIN_SAMPLE_SIZE } = require('./recoveryInsightsService');

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function confidenceForSample(sampleSize) {
  if (sampleSize >= 25) return 'HIGH';
  if (sampleSize >= 10) return 'MEDIUM';
  if (sampleSize >= MIN_SAMPLE_SIZE) return 'LOW';
  return 'INSUFFICIENT_DATA';
}

function actionSampleSize(item) {
  return finiteNumber(item?.totalOutcomes ?? item?.outcomes ?? item?.sampleSize);
}

function compareSuccessRate(left, right) {
  return finiteNumber(right.successRate) - finiteNumber(left.successRate)
    || finiteNumber(right.totalRecoveredAmount) - finiteNumber(left.totalRecoveredAmount)
    || String(left.action || '').localeCompare(String(right.action || ''));
}

function compareRecoveredRevenue(left, right) {
  return finiteNumber(right.recoveredRevenue) - finiteNumber(left.recoveredRevenue)
    || finiteNumber(right.successRate) - finiteNumber(left.successRate)
    || String(left.action || '').localeCompare(String(right.action || ''));
}

function normalizeActionPerformance(analytics) {
  const actionPerformance = Array.isArray(analytics?.actionPerformance)
    ? analytics.actionPerformance
    : [];

  return actionPerformance.map((item) => {
    const sampleSize = actionSampleSize(item);
    return {
      action: String(item.action || 'UNKNOWN'),
      sampleSize,
      successRate: finiteNumber(item.successRate),
      recoveredRevenue: finiteNumber(item.totalRecoveredAmount),
      averageRecoveredAmount: finiteNumber(item.averageRecoveredAmount),
      successfulRecoveries: finiteNumber(item.successfulRecoveries),
      confidenceLevel: confidenceForSample(sampleSize),
      status: sampleSize >= MIN_SAMPLE_SIZE ? 'SUPPORTED' : 'INSUFFICIENT_DATA',
    };
  });
}

function selectSupportedAction(items, comparator) {
  return items
    .filter((item) => item.status === 'SUPPORTED')
    .sort(comparator)[0] || null;
}

function buildContextObservations(items, category) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const supported = item.status === 'SUPPORTED' && item.bestAction;
    const result = {
      context: String(item.segment || 'UNKNOWN'),
      bestAction: supported ? item.bestAction : null,
      sampleSize: finiteNumber(item.sampleSize),
      successRate: supported ? finiteNumber(item.successRate) : 0,
      recoveredRevenue: supported ? finiteNumber(item.totalRecoveredAmount) : 0,
      averageRecoveredAmount: supported ? finiteNumber(item.averageRecoveredAmount) : 0,
      confidenceLevel: item.confidenceLevel || 'INSUFFICIENT_DATA',
      status: supported ? 'SUPPORTED' : 'INSUFFICIENT_DATA',
      observation: supported
        ? `${item.bestAction} showed the highest observed recovery rate for ${item.segment} in the available historical data.`
        : `${item.segment} has insufficient historical evidence for a reliable action comparison.`,
    };

    return { category, ...result };
  });
}

function buildPredictionQuality(analytics) {
  const calibration = Array.isArray(analytics?.calibration) ? analytics.calibration : [];
  const populatedBuckets = calibration.filter((bucket) => finiteNumber(bucket.count) > 0);
  const calibrationError = populatedBuckets.length === 0
    ? null
    : Number((populatedBuckets.reduce((total, bucket) => (
      total + (finiteNumber(bucket.calibrationError) * finiteNumber(bucket.count))
    ), 0) / populatedBuckets.reduce((total, bucket) => total + finiteNumber(bucket.count), 0)).toFixed(6));

  return {
    brierScore: analytics?.brierScore === null ? null : finiteNumber(analytics?.brierScore, null),
    calibrationError,
    meanPredictedProbability: finiteNumber(analytics?.meanPredictedProbability),
    actualRecoveryRate: finiteNumber(analytics?.actualRecoveryRate),
    observation: 'Prediction performance is being evaluated against verified recovery outcomes.',
  };
}

function calculateRecoveryIntelligence({ performanceAnalytics = null, recoveryInsights = null } = {}) {
  if (!performanceAnalytics || typeof performanceAnalytics !== 'object' || Array.isArray(performanceAnalytics)) {
    throw new Error('Performance analytics data is required');
  }
  if (!recoveryInsights || typeof recoveryInsights !== 'object' || Array.isArray(recoveryInsights)) {
    throw new Error('Recovery insights data is required');
  }

  const totalRecords = finiteNumber(performanceAnalytics.totalRecords);
  const actionPerformance = normalizeActionPerformance(performanceAnalytics);
  const supportedActions = actionPerformance.filter((item) => item.status === 'SUPPORTED');
  const highestSuccessRate = selectSupportedAction(supportedActions, compareSuccessRate);
  const highestRecoveredRevenue = selectSupportedAction(supportedActions, compareRecoveredRevenue);
  const contextualInsights = [
    ...buildContextObservations(recoveryInsights.insights?.failureReasons, 'FAILURE_REASON'),
    ...buildContextObservations(recoveryInsights.insights?.customerTypes, 'CUSTOMER_TYPE'),
    ...buildContextObservations(recoveryInsights.insights?.providers, 'PROVIDER'),
    ...buildContextObservations(recoveryInsights.insights?.retryCounts, 'RETRY_COUNT'),
    ...buildContextObservations(recoveryInsights.insights?.highValue, 'HIGH_VALUE'),
  ];
  const insufficientEvidence = contextualInsights
    .filter((item) => item.status === 'INSUFFICIENT_DATA')
    .map(({ category, context, sampleSize, confidenceLevel, observation }) => ({
      category,
      context,
      sampleSize,
      confidenceLevel,
      observation,
    }));

  if (totalRecords === 0) {
    return {
      status: 'NO_DATA',
      totalRecords: 0,
      invalidRecordCount: Math.max(
        finiteNumber(performanceAnalytics.invalidRecordCount),
        finiteNumber(recoveryInsights.invalidRecordCount)
      ),
      insights: {
        actionPerformance: [],
        highlights: {
          highestObservedSuccessRate: null,
          highestObservedRecoveredRevenue: null,
        },
        failureReasons: [],
        customerTypes: [],
        providers: [],
        retryCounts: [],
        highValue: [],
        predictionQuality: buildPredictionQuality(performanceAnalytics),
        insufficientEvidence: [],
        observations: [],
      },
    };
  }

  const observations = [];
  if (highestSuccessRate) {
    observations.push(`${highestSuccessRate.action} has the highest observed recovery rate among actions with sufficient historical data.`);
  }
  if (highestRecoveredRevenue) {
    observations.push(`${highestRecoveredRevenue.action} has the highest observed recovered revenue among actions with sufficient historical data.`);
  }

  return {
    status: 'OK',
    totalRecords,
    invalidRecordCount: Math.max(
      finiteNumber(performanceAnalytics.invalidRecordCount),
      finiteNumber(recoveryInsights.invalidRecordCount)
    ),
    insights: {
      actionPerformance,
      highlights: {
        highestObservedSuccessRate: highestSuccessRate,
        highestObservedRecoveredRevenue: highestRecoveredRevenue,
      },
      failureReasons: contextualInsights.filter((item) => item.category === 'FAILURE_REASON'),
      customerTypes: contextualInsights.filter((item) => item.category === 'CUSTOMER_TYPE'),
      providers: contextualInsights.filter((item) => item.category === 'PROVIDER'),
      retryCounts: contextualInsights.filter((item) => item.category === 'RETRY_COUNT'),
      highValue: contextualInsights.filter((item) => item.category === 'HIGH_VALUE'),
      predictionQuality: buildPredictionQuality(performanceAnalytics),
      insufficientEvidence,
      observations,
    },
  };
}

module.exports = {
  MIN_SAMPLE_SIZE,
  confidenceForSample,
  normalizeActionPerformance,
  buildPredictionQuality,
  calculateRecoveryIntelligence,
};
