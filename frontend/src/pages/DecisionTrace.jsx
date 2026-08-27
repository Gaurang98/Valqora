import React, { useState } from 'react';
import { 
  GitCommit, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Zap, 
  ArrowDown, 
  BrainCircuit, 
  Sliders, 
  Terminal, 
  Cpu,
  Clock,
  Coins,
  Check,
  ChevronRight
} from 'lucide-react';
import { mockDecisionTraces } from '../data/mockData';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';

export default function DecisionTrace() {
  const [selectedTraceId, setSelectedTraceId] = useState(mockDecisionTraces[0].id);
  const trace = mockDecisionTraces.find(t => t.id === selectedTraceId) || mockDecisionTraces[0];

  return (
    <div className="space-y-6">
      {/* Header & Transaction Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-sky-400">{trace.transactionId}</span>
              <span className="text-slate-400">•</span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">{trace.customer}</h2>
              <span className="font-mono text-xs font-bold text-white px-2 py-0.5 bg-slate-800 rounded">
                {trace.amount}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Decision executed at {trace.timestamp} • Model: <span className="text-slate-300 font-mono">{trace.model}</span>
            </p>
          </div>
        </div>

        {/* Trace Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Select Txn:</span>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {mockDecisionTraces.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTraceId(t.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                  selectedTraceId === t.id
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.transactionId}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Decision Metadata Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Model Confidence</span>
          <p className="text-lg font-bold font-mono text-sky-400 mt-1">{trace.modelConfidence}</p>
          <span className="text-[10px] text-slate-400">{trace.model}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Policy Check</span>
          <p className="text-lg font-bold font-mono text-emerald-400 mt-1">{trace.policyResult}</p>
          <span className="text-[10px] text-slate-400">SLA & Quota Compliant</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Action Execution</span>
          <p className="text-lg font-bold font-mono text-white mt-1">{trace.actionResult}</p>
          <span className="text-[10px] text-slate-400">Autonomous Trigger</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Revenue Recovered</span>
          <p className="text-lg font-bold font-mono text-emerald-400 mt-1">{trace.recoveredAmount}</p>
          <span className="text-[10px] text-slate-400">100% Reclaimed</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Decision Timestamp</span>
          <p className="text-xs font-mono font-medium text-slate-300 mt-1.5">{trace.timestamp}</p>
          <span className="text-[10px] text-emerald-400 font-mono">Deterministic Trace ID</span>
        </div>
      </div>

      {/* Main 9-Step Visual Timeline / Decision Tree */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/75 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                Deterministic Decision Flow
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Fully Explainable
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every deduction step from initial failure to final settlement
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">9 Stages Evaluated</span>
          </div>

          {/* Timeline Nodes */}
          <div className="relative mt-6 space-y-4">
            {/* Connecting Vertical Line */}
            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-800" />

            {trace.steps.map((s, idx) => {
              const isLast = idx === trace.steps.length - 1;
              const isHighlight = s.status === 'highlight';
              const isRisk = s.status === 'risk';
              const isPolicy = s.status === 'policy';
              const isSuccess = s.status === 'success';

              return (
                <div key={s.step} className="relative flex items-start space-x-4 group">
                  {/* Step Node Icon */}
                  <div className={`relative z-10 w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 border transition-all ${
                    isSuccess 
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/10'
                      : isRisk
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-md shadow-rose-500/10'
                        : isPolicy
                          ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                          : isHighlight
                            ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    {isSuccess ? <CheckCircle2 className="w-5 h-5" /> : `0${s.step}`}
                  </div>

                  {/* Step Card Content */}
                  <div className={`flex-1 bg-slate-950/70 border rounded-xl p-3.5 transition-all ${
                    isSuccess 
                      ? 'border-emerald-500/30 bg-emerald-950/10'
                      : isRisk 
                        ? 'border-rose-500/30 bg-rose-950/10'
                        : 'border-slate-800 hover:border-slate-700/80'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                        {s.title}
                      </h4>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                        isSuccess ? 'bg-emerald-500/20 text-emerald-400' :
                        isRisk ? 'bg-rose-500/20 text-rose-400' :
                        isPolicy ? 'bg-purple-500/20 text-purple-400' :
                        isHighlight ? 'bg-sky-500/20 text-sky-300' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {s.value}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      {s.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Telemetry & Feature Weights */}
        <div className="space-y-4">
          {/* Policy Guardrails Card */}
          <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-purple-400">
              <ShieldCheck className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-white">Policy Check Details</h3>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Enforced Rule:</span>
                <span className="font-mono text-purple-300 font-medium">{trace.telemetry.policyRule.split(' ')[0]}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {trace.telemetry.policyRule}
              </p>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-[11px]">
                <span className="text-slate-400">Guardrail Status:</span>
                <span className="text-emerald-400 font-mono font-bold">APPROVED (0 Breaches)</span>
              </div>
            </div>
          </div>

          {/* Model Features & Telemetry */}
          <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-sky-400">
              <Sliders className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-white">Feature Attribution</h3>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Customer LTV</span>
                <span className="font-mono text-white font-semibold">{trace.telemetry.customerLTV}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Historical Failures</span>
                <span className="font-mono text-white font-semibold">{trace.telemetry.previousFailures}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Calculated Risk Factor</span>
                <span className="font-mono text-emerald-400 font-semibold">{trace.telemetry.riskScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Dynamic Backoff Delay</span>
                <span className="font-mono text-sky-300 font-semibold">{trace.telemetry.recommendedDelayMs / 1000}s</span>
              </div>
            </div>
          </div>

          {/* Engine Signature */}
          <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-slate-300 font-semibold">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Immutable Execution Hash</span>
            </div>
            <p className="font-mono text-[10px] text-slate-500 break-all bg-slate-950 p-2.5 rounded border border-slate-800">
              SHA256: 7f8a92b10492e8c392f4410a831e78041a99d701ec32b84299b1a590c1284fa2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
