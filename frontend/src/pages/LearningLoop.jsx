import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Database,
  Gauge,
  History,
  Lightbulb,
  ShieldCheck,
  Target,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const pipelineStages = [
  { label: 'Prediction', detail: 'Recovery probability estimate', icon: BrainCircuit },
  { label: 'Action', detail: 'Candidate action evaluation', icon: Target },
  { label: 'Outcome', detail: 'Verified recovery result', icon: CheckCircle2 },
  { label: 'Learning Dataset', detail: 'Historical outcome snapshot', icon: Database },
  { label: 'Performance Analysis', detail: 'Accuracy and action measures', icon: BarChart3 },
  { label: 'What Worked?', detail: 'Observed historical patterns', icon: Lightbulb },
];

const insightGroups = [
  ['failureReasons', 'Failure Reason'],
  ['customerTypes', 'Customer Type'],
  ['providers', 'Provider'],
  ['retryCounts', 'Retry Count'],
  ['highValue', 'High-Value Transactions'],
];

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatPercent(value, isRatio = true) {
  const number = safeNumber(value);
  if (number === null) return 'Unavailable';
  const percentage = isRatio ? number * 100 : number;
  return `${percentage.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatCurrency(value) {
  const number = safeNumber(value);
  if (number === null) return 'Unavailable';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function validateAnalytics(payload) {
  const analytics = payload?.analytics;
  if (!payload?.success || !analytics || typeof analytics !== 'object') return null;
  if (!Array.isArray(analytics.actionPerformance) || !Array.isArray(analytics.calibration)) return null;
  return analytics;
}

function validateInsights(payload) {
  const insights = payload?.insights;
  if (!payload?.success || !insights || typeof insights !== 'object') return null;
  if (!insightGroups.every(([key]) => Array.isArray(insights[key]))) return null;
  return payload;
}

function validateIntelligence(payload) {
  const intelligence = payload?.intelligence;
  if (!payload?.success || !intelligence || typeof intelligence !== 'object') return null;
  if (!intelligence.insights || typeof intelligence.insights !== 'object') return null;
  return intelligence;
}

function validateImprovementReport(payload) {
  const report = payload?.report;
  if (!payload?.success || !report || typeof report !== 'object') return null;
  if (!report.summary || !report.predictionPerformance || !Array.isArray(report.futureImprovementAreas)) return null;
  return report;
}

function EmptyState({ title = 'No data available', detail = 'The backend has not returned records for this view.' }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ErrorState({ title }) {
  return <EmptyState title={title} detail="Check the backend connection and try again later." />;
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-xs text-slate-400" aria-live="polite">
      <Activity className="h-4 w-4 animate-pulse text-sky-400" />
      Loading backend analytics...
    </div>
  );
}

function RecoveryIntelligenceSection({ state }) {
  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState title="Recovery intelligence unavailable" />;

  const intelligence = state.data?.insights;
  if (!intelligence) return <EmptyState title="No recovery intelligence yet" detail="Historical observations will appear after valid learning records are available." />;

  const successHighlight = intelligence.highlights?.highestObservedSuccessRate;
  const revenueHighlight = intelligence.highlights?.highestObservedRecoveredRevenue;
  const insufficientEvidence = Array.isArray(intelligence.insufficientEvidence) ? intelligence.insufficientEvidence : [];
  const observations = Array.isArray(intelligence.observations) ? intelligence.observations : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Highest Observed Recovery Rate</p>
          <p className="mt-2 text-sm font-bold text-emerald-300">{successHighlight?.action || 'Insufficient data'}</p>
          <p className="mt-1 text-xs text-slate-400">
            {successHighlight ? `${formatPercent(successHighlight.successRate, false)} across ${safeNumber(successHighlight.sampleSize, 0)} outcomes` : 'No action has enough historical evidence.'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Highest Observed Recovered Revenue</p>
          <p className="mt-2 text-sm font-bold text-emerald-300">{revenueHighlight?.action || 'Insufficient data'}</p>
          <p className="mt-1 text-xs text-slate-400">
            {revenueHighlight ? `${formatCurrency(revenueHighlight.recoveredRevenue)} across ${safeNumber(revenueHighlight.sampleSize, 0)} outcomes` : 'No action has enough historical evidence.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-sky-400" /><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Prediction Quality</h4></div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-slate-500">Brier Score</p><p className="mt-1 font-mono font-semibold text-amber-300">{intelligence.predictionQuality?.brierScore === null ? 'Unavailable' : safeNumber(intelligence.predictionQuality?.brierScore, 'Unavailable')}</p></div>
            <div><p className="text-slate-500">Calibration Error</p><p className="mt-1 font-mono font-semibold text-amber-300">{formatPercent(intelligence.predictionQuality?.calibrationError)}</p></div>
            <div><p className="text-slate-500">Mean Predicted</p><p className="mt-1 font-mono font-semibold text-sky-300">{formatPercent(intelligence.predictionQuality?.meanPredictedProbability)}</p></div>
            <div><p className="text-slate-500">Actual Recovery</p><p className="mt-1 font-mono font-semibold text-emerald-300">{formatPercent(intelligence.predictionQuality?.actualRecoveryRate, false)}</p></div>
          </div>
          <p className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-500">{intelligence.predictionQuality?.observation || 'Prediction performance is being evaluated against verified recovery outcomes.'}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-300" /><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Data Confidence</h4></div>
          {insufficientEvidence.length === 0 ? <p className="text-xs text-slate-400">No insufficient-evidence areas were returned.</p> : <div className="space-y-2">{insufficientEvidence.slice(0, 5).map((item) => <div key={`${item.category}-${item.context}`} className="flex items-center justify-between gap-3 border-b border-slate-800/70 pb-2 text-xs"><span className="text-slate-300">{item.context || 'Unavailable'}</span><span className="font-mono text-slate-500">{safeNumber(item.sampleSize, 0)} sample{safeNumber(item.sampleSize, 0) === 1 ? '' : 's'} • {item.confidenceLevel || 'Unavailable'}</span></div>)}</div>}
        </div>
      </div>

      {observations.length > 0 && <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Observed Patterns</p><ul className="space-y-2 text-xs text-slate-300">{observations.map((observation) => <li key={observation} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" />{observation}</li>)}</ul></div>}
    </div>
  );
}

function ModelImprovementSection({ state }) {
  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState title="Model improvement feedback unavailable" />;
  const report = state.data;
  if (!report || report.status === 'NO_DATA') return <EmptyState title="No model improvement evidence yet" detail="Verified historical outcomes are needed before feedback can be prepared." />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-100">
        <p className="font-semibold text-amber-200">Evidence for future model improvement</p>
        <p className="mt-1">{report.boundary}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div><p className="text-[10px] uppercase text-slate-500">Valid Records</p><p className="mt-1 font-mono text-lg font-semibold text-white">{safeNumber(report.dataQuality?.validRecords, 0)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Invalid Records</p><p className="mt-1 font-mono text-lg font-semibold text-amber-300">{safeNumber(report.dataQuality?.invalidRecords, 0)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Verified Recoveries</p><p className="mt-1 font-mono text-lg font-semibold text-emerald-300">{safeNumber(report.dataQuality?.verifiedRecoveries, 0)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Review Areas</p><p className="mt-1 font-mono text-lg font-semibold text-sky-300">{safeNumber(report.futureImprovementAreas?.length, 0)}</p></div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-sky-400" /><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Prediction Feedback</h4></div>
        <div className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-5"><div><p className="text-slate-500">Sample</p><p className="mt-1 font-mono text-slate-200">{safeNumber(report.predictionPerformance?.sampleSize, 0)}</p></div><div><p className="text-slate-500">Mean Predicted</p><p className="mt-1 font-mono text-sky-300">{formatPercent(report.predictionPerformance?.meanPredictedProbability)}</p></div><div><p className="text-slate-500">Actual Rate</p><p className="mt-1 font-mono text-emerald-300">{formatPercent(report.predictionPerformance?.actualRecoveryRate, false)}</p></div><div><p className="text-slate-500">Brier Score</p><p className="mt-1 font-mono text-amber-300">{report.predictionPerformance?.brierScore === null ? 'Unavailable' : safeNumber(report.predictionPerformance?.brierScore, 'Unavailable')}</p></div><div><p className="text-slate-500">Calibration Error</p><p className="mt-1 font-mono text-amber-300">{formatPercent(report.predictionPerformance?.calibrationError)}</p></div></div>
        <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">{report.predictionPerformance?.observation || 'Prediction performance can be evaluated using the verified outcome dataset.'}</p>
      </div>
      {report.calibrationIssues?.length > 0 && <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Calibration Review Areas</p><div className="space-y-2">{report.calibrationIssues.map((item) => <div key={item.predictionRange} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2 text-xs"><span className="font-mono text-slate-200">{item.predictionRange}</span><span className="text-slate-400">{safeNumber(item.sampleSize, 0)} samples • error {formatPercent(item.calibrationError)} • {item.evidenceLevel || 'Unavailable'}</span></div>)}</div></div>}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Future Improvement Areas</p>{report.futureImprovementAreas.length === 0 ? <p className="text-xs text-slate-500">No additional areas were identified from the available evidence.</p> : <div className="space-y-3">{report.futureImprovementAreas.slice(0, 8).map((item) => <div key={item.area} className="border-l border-amber-400/40 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-200">{item.area}</p><span className="font-mono text-[10px] uppercase text-amber-300">{item.evidenceLevel || 'Unavailable'}</span></div><p className="mt-1 text-[11px] text-slate-400">{item.reason}</p><p className="mt-1 text-[10px] text-slate-500">{item.supportingEvidence}</p></div>)}</div>}</div>
    </div>
  );
}

function InsightTable({ items, title }) {
  if (items.length === 0) return <EmptyState title={`No ${title.toLowerCase()} insights`} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-3 py-2.5">Context</th>
            <th className="px-3 py-2.5">Observed Best Action</th>
            <th className="px-3 py-2.5">Sample</th>
            <th className="px-3 py-2.5">Success Rate</th>
            <th className="px-3 py-2.5 text-right">Recovered</th>
            <th className="px-3 py-2.5">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {items.map((item) => {
            const supported = item.status === 'SUPPORTED' && item.bestAction;
            return (
              <tr key={`${item.segment}-${item.dimension}`} className="bg-slate-900/50">
                <td className="px-3 py-3 font-medium text-slate-200">{item.segment || 'Unavailable'}</td>
                <td className="px-3 py-3">
                  {supported ? (
                    <span className="font-semibold text-emerald-300">{item.bestAction}</span>
                  ) : (
                    <span className="text-slate-500">Insufficient data</span>
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-slate-300">{safeNumber(item.sampleSize, 0)}</td>
                <td className="px-3 py-3 font-mono text-slate-300">{supported ? formatPercent(item.successRate) : 'Unavailable'}</td>
                <td className="px-3 py-3 text-right font-mono text-slate-200">{supported ? formatCurrency(item.totalRecoveredAmount) : 'Unavailable'}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${
                    supported ? 'border-sky-500/25 bg-sky-500/10 text-sky-300' : 'border-slate-700 bg-slate-800 text-slate-500'
                  }`}>
                    {item.confidenceLevel || 'Unavailable'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LearningLoop() {
  const [analyticsState, setAnalyticsState] = useState({ loading: true, data: null, error: false });
  const [insightsState, setInsightsState] = useState({ loading: true, data: null, error: false });
  const [intelligenceState, setIntelligenceState] = useState({ loading: true, data: null, error: false });
  const [improvementState, setImprovementState] = useState({ loading: true, data: null, error: false });

  useEffect(() => {
    let active = true;

    const load = async (url, validate, setState) => {
      try {
        const response = await fetch(url);
        const payload = await response.json().catch(() => null);
        const data = validate(payload);
        if (!response.ok || !data) throw new Error('Malformed analytics response');
        if (active) setState({ loading: false, data, error: false });
      } catch {
        if (active) setState({ loading: false, data: null, error: true });
      }
    };

    load('/api/recovery/analytics', validateAnalytics, setAnalyticsState);
    load('/api/recovery/insights', validateInsights, setInsightsState);
    load('/api/recovery/intelligence', validateIntelligence, setIntelligenceState);
    load('/api/recovery/model-improvement', validateImprovementReport, setImprovementState);

    return () => {
      active = false;
    };
  }, []);

  const analytics = analyticsState.data;
  const insightData = insightsState.data;
  const intelligence = intelligenceState.data?.insights;
  const insightCount = insightData
    ? insightGroups.reduce((count, [key]) => count + insightData.insights[key].length, 0)
    : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/40 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-2.5 text-sky-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">Learning Loop</h2>
              <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-emerald-400">Read-only analytics</span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">Valqora measures outcomes after policy-controlled recovery. Historical insights are collected for future model improvement and do not change current decisions.</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Learning pipeline">
        {pipelineStages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.label}>
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-sky-400" />
                  <span className="font-mono text-[10px] text-slate-600">0{index + 1}</span>
                </div>
                <p className="mt-3 text-xs font-semibold text-white">{stage.label}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{stage.detail}</p>
              </div>
              {index < pipelineStages.length - 1 && <ArrowRight className="hidden self-center text-slate-700 xl:block" aria-hidden="true" />}
            </React.Fragment>
          );
        })}
      </section>

      {analyticsState.loading ? <LoadingState /> : analyticsState.error ? <ErrorState title="Performance analytics unavailable" /> : analytics?.totalRecords === 0 ? <EmptyState title="No performance records yet" detail="Verified learning outcomes will appear here when available." /> : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mean Predicted Probability</p><p className="mt-2 font-mono text-2xl font-bold text-sky-400">{formatPercent(analytics.meanPredictedProbability)}</p></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Actual Recovery Rate</p><p className="mt-2 font-mono text-2xl font-bold text-emerald-400">{formatPercent(analytics.actualRecoveryRate, false)}</p></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Brier Score</p><p className="mt-2 font-mono text-2xl font-bold text-amber-300">{analytics.brierScore === null ? 'Unavailable' : safeNumber(analytics.brierScore, 'Unavailable')}</p></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Verified Recoveries</p><p className="mt-2 font-mono text-2xl font-bold text-white">{safeNumber(analytics.verifiedRecoveries, 0)}</p></div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2"><Gauge className="h-4 w-4 text-emerald-400" /><div><h3 className="text-sm font-semibold text-white">Action Performance</h3><p className="text-[11px] text-slate-500">Backend-defined outcomes and verified recovered revenue.</p></div></div>
            {analytics.actionPerformance.length === 0 ? <EmptyState title="No action outcomes available" /> : <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">Sample Size</th><th className="px-3 py-2.5">Success Rate</th><th className="px-3 py-2.5">Recovered Revenue</th><th className="px-3 py-2.5 text-right">Average Recovered</th></tr></thead><tbody className="divide-y divide-slate-800/70">{analytics.actionPerformance.map((item) => <tr key={item.action} className="bg-slate-900/50"><td className="px-3 py-3 font-semibold text-slate-200">{item.action || 'Unavailable'}</td><td className="px-3 py-3 font-mono text-slate-300">{safeNumber(item.totalOutcomes, 0)}</td><td className="px-3 py-3 font-mono text-slate-300">{formatPercent(item.successRate, false)}</td><td className="px-3 py-3 font-mono text-emerald-300">{formatCurrency(item.totalRecoveredAmount)}</td><td className="px-3 py-3 text-right font-mono text-slate-200">{formatCurrency(item.averageRecoveredAmount)}</td></tr>)}</tbody></table></div>}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-sky-400" /><div><h3 className="text-sm font-semibold text-white">Calibration</h3><p className="text-[11px] text-slate-500">Prediction ranges compared with verified recovery rates.</p></div></div>{analytics.calibration.length === 0 ? <EmptyState title="No calibration data available" /> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.calibration} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}><CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.4} vertical={false} /><XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#334155' }} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} formatter={(value, name) => [`${value}%`, name === 'actualRecoveryRate' ? 'Actual recovery' : 'Predicted probability']} /><Bar dataKey="actualRecoveryRate" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}</div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-amber-300" /><div><h3 className="text-sm font-semibold text-white">Calibration Detail</h3><p className="text-[11px] text-slate-500">All buckets come directly from Performance Analytics.</p></div></div>{analytics.calibration.length === 0 ? <EmptyState title="No calibration detail available" /> : <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-2.5">Range</th><th className="px-3 py-2.5">Sample</th><th className="px-3 py-2.5">Avg Predicted</th><th className="px-3 py-2.5">Actual Rate</th><th className="px-3 py-2.5">Error</th></tr></thead><tbody className="divide-y divide-slate-800/70">{analytics.calibration.map((item) => <tr key={item.bucket} className="bg-slate-900/50"><td className="px-3 py-3 font-mono text-slate-200">{item.bucket || 'Unavailable'}</td><td className="px-3 py-3 font-mono text-slate-300">{safeNumber(item.count, 0)}</td><td className="px-3 py-3 font-mono text-slate-300">{formatPercent(item.averagePredictedProbability)}</td><td className="px-3 py-3 font-mono text-emerald-300">{formatPercent(item.actualRecoveryRate, false)}</td><td className="px-3 py-3 font-mono text-amber-300">{formatPercent(item.calibrationError)}</td></tr>)}</tbody></table></div>}</div>
          </section>
        </>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-300" /><div><h3 className="text-sm font-semibold text-white">What Worked?</h3><p className="text-[11px] text-slate-500">Observed Outcome Insights from historical verified results.</p></div></div><span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-amber-300">Informational</span></div>{insightsState.loading ? <LoadingState /> : insightsState.error ? <ErrorState title="Recovery insights unavailable" /> : insightData?.status === 'NO_DATA' || insightCount === 0 ? <EmptyState title="No observed outcome insights yet" detail="Insights will appear after enough verified outcomes are collected." /> : <div className="space-y-5">{insightGroups.map(([key, label]) => <div key={key}><div className="mb-2 flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-sky-400" /><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</h4></div><InsightTable items={insightData.insights[key]} title={label} /></div>)}</div>}<p className="mt-5 border-t border-slate-800 pt-4 text-[11px] text-slate-500">These insights describe historical outcomes only. They do not override the Policy Engine, change recommendations, or trigger recovery.</p></section>

      <section className="rounded-xl border border-sky-500/20 bg-slate-900/75 p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-sky-300" /><div><h3 className="text-sm font-semibold text-white">Recovery Intelligence</h3><p className="text-[11px] text-slate-500">Business-level observations composed from Performance Analytics and What Worked.</p></div></div><span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-sky-300">Read-only</span></div><RecoveryIntelligenceSection state={intelligenceState} /><p className="mt-5 border-t border-slate-800 pt-4 text-[11px] text-slate-500">Recovery Intelligence supports human understanding only. It does not change policy, predictions, action selection, or recovery execution.</p></section>

      <section className="rounded-xl border border-amber-500/20 bg-slate-900/75 p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="h-4 w-4 text-amber-300" /><div><h3 className="text-sm font-semibold text-white">Model Improvement Feedback</h3><p className="text-[11px] text-slate-500">Structured evidence for future model improvement, based on verified outcomes.</p></div></div><span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-amber-300">No automatic changes</span></div><ModelImprovementSection state={improvementState} /></section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6"><div className="mb-5 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h3 className="text-sm font-semibold text-white">How Valqora Learns</h3></div><div className="grid grid-cols-1 gap-4 text-xs text-slate-300 md:grid-cols-2 xl:grid-cols-4">{[
        ['Prediction', 'The model estimates recovery probability.'],
        ['Action', 'The Revenue Optimization Engine evaluates candidate actions.'],
        ['Outcome', 'Recovery proceeds only through the existing policy-controlled flow.'],
        ['Learning Dataset', 'The verified outcome is recorded as a historical snapshot.'],
        ['Performance Analysis', 'Prediction accuracy and action performance are measured.'],
        ['What Worked?', 'Historical patterns are identified by transaction context.'],
        ['Future Improvement', 'Insights are collected for future model improvement.'],
      ].map(([title, detail], index) => <div key={title} className="border-l border-sky-500/30 pl-3"><p className="font-semibold text-sky-300">{index + 1}. {title}</p><p className="mt-1 leading-relaxed text-slate-500">{detail}</p></div>)}</div></section>
    </div>
  );
}
