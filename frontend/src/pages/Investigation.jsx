import React, { useState } from 'react';
import { 
  AlertTriangle, 
  HelpCircle, 
  Search, 
  TrendingUp, 
  Zap, 
  CheckCircle2, 
  FileText, 
  Clock, 
  ChevronRight,
  Shield,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import { mockIncidents } from '../data/mockData';
import InvestigationFlow from '../components/investigations/InvestigationFlow';
import { PriorityBadge, StatusBadge, ProbabilityBadge } from '../components/ui/Badge';

export default function Investigation() {
  const [selectedIncidentId, setSelectedIncidentId] = useState(mockIncidents[0].id);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  const incident = mockIncidents.find(i => i.id === selectedIncidentId) || mockIncidents[0];

  const handleSimulateAction = () => {
    setIsSimulating(true);
    setSimulationResult(null);
    setTimeout(() => {
      setIsSimulating(false);
      setSimulationResult({
        success: true,
        recoveredProjected: '₹2.81L (81.5% Recovery Rate)',
        rerouteLatency: '240ms',
        tokensValidated: '142 / 142 Sessions'
      });
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Incident Switcher & Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-rose-400">{incident.id}</span>
              <span className="text-slate-400">•</span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">{incident.title}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Detected on {incident.detectedAt} • Severity: <span className="text-rose-400 font-semibold">{incident.severity}</span>
            </p>
          </div>
        </div>

        {/* Incident Selector Dropdown / Pills */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Select Incident:</span>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {mockIncidents.map(inc => (
              <button
                key={inc.id}
                onClick={() => {
                  setSelectedIncidentId(inc.id);
                  setSimulationResult(null);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                  selectedIncidentId === inc.id
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {inc.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incident Overview Card */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-800/80">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Revenue at Risk</span>
            <p className="font-mono text-xl font-bold text-rose-400 mt-1">{incident.revenueAtRisk}</p>
            <span className="text-[10px] text-slate-400">Unsettled transaction volume</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Affected Txns</span>
            <p className="font-mono text-xl font-bold text-white mt-1">{incident.affectedTransactions} Txns</p>
            <span className="text-[10px] text-slate-400">{incident.affectedMerchants} merchant accounts</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Model Confidence</span>
            <p className="font-mono text-xl font-bold text-sky-400 mt-1">{incident.modelConfidence}%</p>
            <span className="text-[10px] text-slate-400">Valqora-RecovNet Diagnostic</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Recovery Probability</span>
            <p className="font-mono text-xl font-bold text-emerald-400 mt-1">{incident.recoveryProbability}%</p>
            <span className="text-[10px] text-slate-400">Projected addressable gain</span>
          </div>
        </div>

        {/* AI Analysis Summary Box */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">AI Forensic Analysis</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {incident.aiAnalysis}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 border-t border-slate-800/60">
            <span className="text-slate-400">
              <strong className="text-slate-300">Root Cause:</strong> {incident.rootCause}
            </span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Recommended: {incident.recommendedAction}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Investigation Flow (Incident -> Root Cause -> Prob -> Action) */}
      <InvestigationFlow incident={incident} />

      {/* 4 Deep Reasoning Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: What happened? */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-sky-400">
            <Clock className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">What happened?</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {incident.sections.whatHappened.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 2: Why did it happen? */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-amber-400">
            <Search className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">Why did it happen?</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {incident.sections.whyDidItHappen.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 3: What should Valqora do? */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Zap className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">What should Valqora do?</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {incident.sections.whatShouldValqoraDo.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 4: Why this action? */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-purple-400">
            <TrendingUp className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">Why this action?</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {incident.sections.whyThisAction.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Autonomous Action Simulation / Execution Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-white">Action Execution & Policy Gate</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Run automated fallback routing and generate authenticated recovery sessions under Policy POL-AUTO-RETRY-L1.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={handleSimulateAction}
            disabled={isSimulating}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Simulating Strategy...' : 'Execute Recovery Strategy'}</span>
          </button>
        </div>
      </div>

      {/* Simulation Result Box */}
      {simulationResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 animate-fadeIn text-xs text-emerald-200 space-y-2">
          <div className="flex items-center justify-between font-semibold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Strategy Simulation Passed Policy Checks
            </span>
            <span className="font-mono text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded">
              COMPLIANT
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20 text-[11px]">
            <div><span className="text-slate-400">Projected Recovery:</span> <strong className="text-white">{simulationResult.recoveredProjected}</strong></div>
            <div><span className="text-slate-400">Fallback Switch Latency:</span> <strong className="text-white">{simulationResult.rerouteLatency}</strong></div>
            <div><span className="text-slate-400">Token Validation:</span> <strong className="text-white">{simulationResult.tokensValidated}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
