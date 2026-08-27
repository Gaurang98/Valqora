import React from 'react';
import { AlertCircle, Search, Gauge, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

export default function InvestigationFlow({ incident }) {
  const { flow } = incident;

  return (
    <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            AI Diagnostic Pipeline
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              End-to-End Trace
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic step-by-step diagnostic breakdown from anomaly detection to automated intervention
          </p>
        </div>
      </div>

      {/* 4 Step Visual Flow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 relative">
        {/* Step 1: Incident */}
        <div className="relative bg-slate-950/80 border border-rose-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
              1. Incident
            </span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-sm font-bold text-white tracking-tight">{flow.incident.title}</p>
          <div className="pt-2 border-t border-slate-800/80 text-xs">
            <p className="font-mono text-rose-300 font-semibold">{flow.incident.metric}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Detected: {flow.incident.timestamp}</p>
          </div>
        </div>

        {/* Step 2: Root Cause */}
        <div className="relative bg-slate-950/80 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              2. Root Cause
            </span>
            <Search className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-sm font-bold text-white tracking-tight">{flow.rootCause.title}</p>
          <div className="pt-2 border-t border-slate-800/80 text-xs">
            <p className="text-slate-300 text-[11px] leading-tight">{flow.rootCause.detail}</p>
            <p className="font-mono text-[10px] text-amber-400 mt-1">{flow.rootCause.confidence}</p>
          </div>
        </div>

        {/* Step 3: Recovery Probability */}
        <div className="relative bg-slate-950/80 border border-sky-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
              3. Recovery Prob
            </span>
            <Gauge className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-sm font-bold text-white tracking-tight">{flow.recoveryProb.title}</p>
          <div className="pt-2 border-t border-slate-800/80 text-xs">
            <p className="font-mono text-emerald-400 font-bold">{flow.recoveryProb.probability}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{flow.recoveryProb.factors}</p>
          </div>
        </div>

        {/* Step 4: Recommended Action */}
        <div className="relative bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              4. Recommended Action
            </span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-white tracking-tight">{flow.recommendedAction.title}</p>
          <div className="pt-2 border-t border-slate-800/80 text-xs">
            <p className="text-slate-300 text-[11px] leading-tight">{flow.recommendedAction.strategy}</p>
            <p className="font-mono text-emerald-400 font-semibold mt-1">{flow.recommendedAction.expectedRecovery}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
