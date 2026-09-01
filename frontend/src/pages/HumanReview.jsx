import React, { useMemo, useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Clock3, ArrowRight } from 'lucide-react';

const sampleReviews = [
  {
    id: 'REV_1_OPP_TXN_000101',
    transactionId: 'TXN_000101',
    amount: 75000,
    reason: 'High-value transaction',
    aiRecommendation: 'RETRY',
    aiConfidence: 0.91,
    policyDecision: 'HUMAN_REVIEW',
    status: 'PENDING',
  },
  {
    id: 'REV_2_OPP_TXN_000201',
    transactionId: 'TXN_000201',
    amount: 60000,
    reason: 'AI confidence below threshold',
    aiRecommendation: 'RETRY',
    aiConfidence: 0.68,
    policyDecision: 'HUMAN_REVIEW',
    status: 'APPROVED',
  },
  {
    id: 'REV_3_OPP_TXN_000301',
    transactionId: 'TXN_000301',
    amount: 30000,
    reason: 'Manual review required',
    aiRecommendation: 'RETRY',
    aiConfidence: 0.73,
    policyDecision: 'HUMAN_REVIEW',
    status: 'REJECTED',
  },
  {
    id: 'REV_4_OPP_TXN_000401',
    transactionId: 'TXN_000401',
    amount: 100000,
    reason: 'Policy-required human review',
    aiRecommendation: 'HUMAN_REVIEW',
    aiConfidence: 0.55,
    policyDecision: 'BLOCKED',
    status: 'BLOCKED',
  },
];

const formatCurrency = (value) => {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

const statusStyles = {
  PENDING: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  APPROVED: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  REJECTED: 'bg-rose-500/10 text-rose-300 border border-rose-500/30',
  BLOCKED: 'bg-slate-700 text-slate-200 border border-slate-500',
};

export default function HumanReview() {
  const [reviews, setReviews] = useState(sampleReviews);

  const summary = useMemo(() => {
    return {
      pending: reviews.filter((item) => item.status === 'PENDING').length,
      approved: reviews.filter((item) => item.status === 'APPROVED').length,
      rejected: reviews.filter((item) => item.status === 'REJECTED').length,
      blocked: reviews.filter((item) => item.status === 'BLOCKED').length,
    };
  }, [reviews]);

  const handleDecision = (id, decision) => {
    setReviews((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: decision }
          : item
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Human Review Queue</h2>
            <p className="text-xs text-slate-400">Policy-required approvals are separated from hard blocks.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['PENDING', summary.pending],
          ['APPROVED', summary.approved],
          ['REJECTED', summary.rejected],
          ['BLOCKED', summary.blocked],
        ].map(([label, value]) => (
          <div key={label} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-2 text-xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-sky-400">{review.transactionId}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[review.status] || statusStyles.BLOCKED}`}>
                    {review.status}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(review.amount)}</div>
              </div>

              <div className="text-sm text-slate-300 space-y-1">
                <div>Reason: {review.reason}</div>
                <div>AI Recommendation: {review.aiRecommendation}</div>
                <div>AI Confidence: {(review.aiConfidence * 100).toFixed(0)}%</div>
                <div>Policy: {review.policyDecision}</div>
              </div>
            </div>

            {review.status === 'PENDING' ? (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleDecision(review.id, 'APPROVED')}
                  className="inline-flex items-center gap-2 bg-emerald-500 text-slate-950 font-semibold px-4 py-2 rounded-lg hover:bg-emerald-400"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(review.id, 'REJECTED')}
                  className="inline-flex items-center gap-2 bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-rose-400"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-300 flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-slate-400" />
                Decision recorded as {review.status}.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
