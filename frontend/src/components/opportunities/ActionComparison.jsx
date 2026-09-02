import React from 'react';
import { AlertCircle, CheckCircle2, Gauge, Loader2, Zap } from 'lucide-react';

const ACTION_LABELS = {
  RETRY: 'Retry Payment',
  PAYMENT_METHOD_UPDATE: 'Update Payment Method',
  PAYMENT_LINK: 'Send Payment Link',
  WAIT_AND_RETRY: 'Wait & Retry',
  HUMAN_REVIEW: 'Human Review',
  NO_ACTION: 'No Action',
};

const formatCurrency = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'Unavailable';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

const formatProbability = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 1) return 'Unavailable';
  return `${(numericValue * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
};

function isValidEvaluation(evaluation) {
  return evaluation
    && typeof evaluation.bestAction === 'string'
    && Number.isFinite(Number(evaluation.bestExpectedRecovery))
    && Array.isArray(evaluation.candidates)
    && evaluation.candidates.length > 0
    && evaluation.candidates.every((candidate) => (
      candidate
      && typeof candidate.action === 'string'
      && Number.isFinite(Number(candidate.recoveryProbability))
      && Number.isFinite(Number(candidate.expectedRecovery))
    ));
}

export default function ActionComparison({ evaluation, loading, error }) {
  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" aria-live="polite">
        <div className="flex items-center gap-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
          <span className="text-xs font-medium">Loading action evaluation...</span>
        </div>
      </section>
    );
  }

  if (error || !isValidEvaluation(evaluation)) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" aria-live="polite">
        <div className="flex items-start gap-3 text-slate-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-white">Action evaluation unavailable</p>
            <p className="mt-1 text-xs text-slate-400">Candidate values were not returned by the backend.</p>
          </div>
        </div>
      </section>
    );
  }

  const recommendedCandidate = evaluation.candidates.find(
    (candidate) => candidate.action === evaluation.bestAction
  );

  return (
    <section className="space-y-3" aria-label="Action comparison">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Gauge className="h-4 w-4 text-sky-400" />
            Action Comparison
          </h4>
          <p className="mt-1 text-[11px] text-slate-500">Backend recommendation only; policy approval is still required.</p>
        </div>
        <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-sky-300">
          Advisory
        </span>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Recommended Action</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold text-white">
              <Zap className="h-4 w-4 text-emerald-300" />
              {ACTION_LABELS[evaluation.bestAction] || evaluation.bestAction}
            </p>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-[10px] uppercase text-slate-400">Expected Recovery</p>
              <p className="mt-1 font-mono text-sm font-bold text-emerald-300">{formatCurrency(evaluation.bestExpectedRecovery)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400">Probability</p>
              <p className="mt-1 font-mono text-sm font-bold text-emerald-300">
                {formatProbability(recommendedCandidate?.recoveryProbability)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2.5">Action</th>
              <th className="px-3 py-2.5">Recovery Probability</th>
              <th className="px-3 py-2.5 text-right">Expected Recovery</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {evaluation.candidates.map((candidate) => {
              const isRecommended = candidate.action === evaluation.bestAction;
              return (
                <tr key={candidate.action} className={isRecommended ? 'bg-emerald-500/10' : 'bg-slate-900/50'}>
                  <td className="px-3 py-3 font-medium text-slate-200">
                    <span className="flex items-center gap-2">
                      {isRecommended && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                      {ACTION_LABELS[candidate.action] || candidate.action}
                      {isRecommended && <span className="text-[10px] font-semibold uppercase text-emerald-400">Recommended</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-300">{formatProbability(candidate.recoveryProbability)}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-slate-200">{formatCurrency(candidate.expectedRecovery)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
