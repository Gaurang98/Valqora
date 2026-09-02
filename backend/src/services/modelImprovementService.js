const { MIN_SAMPLE_SIZE } = require('./recoveryInsightsService');

const REPORT_BOUNDARY = 'This report identifies evidence for future model improvement. It does not retrain or modify the current model.';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function evidenceLevel(sampleSize) {
  if (sampleSize >= 25) return 'HIGH_EVIDENCE';
  if (sampleSize >= 10) return 'MEDIUM_EVIDENCE';
  if (sampleSize >= MIN_SAMPLE_SIZE) return 'LOW_EVIDENCE';
  return 'INSUFFICIENT_DATA';
}

function normalizeActionPerformance(analytics) {
  const values = Array.isArray(analytics?.actionPerformance) ? analytics.actionPerformance : [];
  return values.map((item) => {
    const sampleSize = finiteNumber(item.totalOutcomes ?? item.outcomes ?? item.sampleSize);
    return {
      action: String(item.action || 'UNKNOWN'),
      sampleSize,
      successRate: finiteNumber(item.successRate),
      recoveredRevenue: finiteNumber(item.totalRecoveredAmount),
      averageRecoveredAmount: finiteNumber(item.averageRecoveredAmount),
      evidenceLevel: evidenceLevel(sampleSize),
      improvementRelevance: sampleSize < MIN_SAMPLE_SIZE ? 'LOW_EVIDENCE' : 'SUFFICIENT_DATA',
    };
  });
}

function buildCalibrationIssues(analytics) {
  const buckets = Array.isArray(analytics?.calibration) ? analytics.calibration : [];
  return buckets
    .filter((bucket) => finiteNumber(bucket.count) >= MIN_SAMPLE_SIZE && finiteNumber(bucket.calibrationError) > 0)
    .map((bucket) => ({
      predictionRange: String(bucket.bucket || 'UNKNOWN'),
      sampleSize: finiteNumber(bucket.count),
      averagePredictedProbability: finiteNumber(bucket.averagePredictedProbability),
      actualRecoveryRate: finiteNumber(bucket.actualRecoveryRate),
      calibrationError: finiteNumber(bucket.calibrationError),
      status: 'CALIBRATION_REVIEW',
      evidenceLevel: evidenceLevel(finiteNumber(bucket.count)),
      reason: 'Observed predicted probability differs from verified recovery rate in this bucket.',
    }));
}

function buildContextualFeedback(recoveryInsights) {
  const dimensions = [
    ['FAILURE_REASON', recoveryInsights?.insights?.failureReasons],
    ['CUSTOMER_TYPE', recoveryInsights?.insights?.customerTypes],
    ['PROVIDER', recoveryInsights?.insights?.providers],
    ['RETRY_COUNT', recoveryInsights?.insights?.retryCounts],
    ['HIGH_VALUE', recoveryInsights?.insights?.highValue],
  ];

  return dimensions.flatMap(([dimension, items]) => (Array.isArray(items) ? items : []).map((item) => {
    const sampleSize = finiteNumber(item.sampleSize);
    const supported = item.status === 'SUPPORTED' && Boolean(item.bestAction);
    const relevance = supported ? 'SUFFICIENT_DATA' : 'LOW_EVIDENCE';
    return {
      dimension,
      context: String(item.segment || 'UNKNOWN'),
      observedBestAction: supported ? item.bestAction : null,
      sampleSize,
      successRate: supported ? finiteNumber(item.successRate) : 0,
      recoveredRevenue: supported ? finiteNumber(item.totalRecoveredAmount) : 0,
      confidence: item.confidenceLevel || 'INSUFFICIENT_DATA',
      improvementRelevance: relevance,
      observation: supported
        ? `Historical outcomes indicate an area worth reviewing for future model improvement: ${item.bestAction} for ${item.segment}.`
        : `Additional data is needed before drawing a reliable conclusion for ${item.segment}.`,
    };
  }));
}

function calculateModelImprovementReport({ performanceAnalytics = null, recoveryInsights = null, recoveryIntelligence = null } = {}) {
  if (!performanceAnalytics || typeof performanceAnalytics !== 'object' || Array.isArray(performanceAnalytics)) {
    throw new Error('Performance analytics data is required');
  }
  if (!recoveryInsights || typeof recoveryInsights !== 'object' || Array.isArray(recoveryInsights)) {
    throw new Error('Recovery insights data is required');
  }

  const totalRecords = finiteNumber(performanceAnalytics.totalRecords);
  const actionPerformance = normalizeActionPerformance(performanceAnalytics);
  const calibrationIssues = buildCalibrationIssues(performanceAnalytics);
  const contextualOpportunities = buildContextualFeedback(recoveryInsights);
  const futureImprovementAreas = [
    ...calibrationIssues.map((item) => ({
      area: `Calibration ${item.predictionRange}`,
      reason: item.reason,
      supportingEvidence: `${item.sampleSize} historical records with calibration error ${item.calibrationError}.`,
      sampleSize: item.sampleSize,
      evidenceLevel: item.evidenceLevel,
    })),
    ...actionPerformance
      .filter((item) => item.improvementRelevance !== 'SUFFICIENT_DATA' || item.successRate < 50)
      .map((item) => ({
        area: `${item.action} action performance`,
        reason: item.improvementRelevance === 'LOW_EVIDENCE'
          ? 'Additional data is needed before drawing a reliable conclusion.'
          : 'Observed recovery performance may be worth reviewing against other actions.',
        supportingEvidence: `${item.sampleSize} historical records with ${item.successRate}% observed recovery rate.`,
        sampleSize: item.sampleSize,
        evidenceLevel: item.evidenceLevel,
      })),
    ...contextualOpportunities
      .filter((item) => item.improvementRelevance !== 'SUFFICIENT_DATA')
      .map((item) => ({
        area: `${item.context} contextual performance`,
        reason: item.observation,
        supportingEvidence: `${item.sampleSize} historical records.`,
        sampleSize: item.sampleSize,
        evidenceLevel: item.improvementRelevance === 'LOW_EVIDENCE' ? 'LOW_EVIDENCE' : 'INSUFFICIENT_DATA',
      })),
  ].sort((left, right) => left.area.localeCompare(right.area));

  const predictionPerformance = {
    sampleSize: totalRecords,
    meanPredictedProbability: finiteNumber(performanceAnalytics.meanPredictedProbability),
    actualRecoveryRate: finiteNumber(performanceAnalytics.actualRecoveryRate),
    brierScore: performanceAnalytics.brierScore === null ? null : finiteNumber(performanceAnalytics.brierScore, null),
    calibrationError: Array.isArray(recoveryIntelligence?.insights?.predictionQuality)
      ? null
      : finiteNumber(recoveryIntelligence?.insights?.predictionQuality?.calibrationError, null),
    observation: 'Prediction performance can be evaluated using the current verified outcome dataset.',
  };

  const validRecords = Math.max(0, totalRecords);
  const invalidRecords = finiteNumber(performanceAnalytics.invalidRecordCount);
  const report = {
    status: totalRecords === 0 ? 'NO_DATA' : 'OK',
    boundary: REPORT_BOUNDARY,
    summary: {
      totalRecordsConsidered: totalRecords + invalidRecords,
      validRecords,
      invalidRecords,
      usableOutcomeRecords: totalRecords,
      verifiedRecoveries: finiteNumber(performanceAnalytics.verifiedRecoveries),
    },
    predictionPerformance,
    actionPerformance,
    calibrationIssues,
    dataQuality: {
      totalRecordsConsidered: totalRecords + invalidRecords,
      validRecords,
      invalidRecords,
      usableOutcomeRecords: totalRecords,
      verifiedRecoveries: finiteNumber(performanceAnalytics.verifiedRecoveries),
    },
    contextualOpportunities,
    futureImprovementAreas: totalRecords === 0 ? [] : futureImprovementAreas,
  };

  return report;
}

module.exports = {
  REPORT_BOUNDARY,
  evidenceLevel,
  calculateModelImprovementReport,
};
