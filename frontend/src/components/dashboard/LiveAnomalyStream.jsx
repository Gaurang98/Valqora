import React from 'react';
import { Activity, ArrowUpRight, ShieldAlert, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const liveStreamEvents = [
  {
    id: 'EVT-1',
    time: '2 mins ago',
    type: 'RISK_FLAGGED',
    title: 'HDFC Netbanking 504 Timeout Spike',
    metric: '₹3.45L Risk (142 Txns)',
    severity: 'critical'
  },
  {
    id: 'EVT-2',
    time: '14 mins ago',
    type: 'AUTONOMOUS_RESOLVE',
    title: 'Smart Fallback Routing Triggered',
    metric: 'Rerouted to Axis Rail',
    severity: 'success'
  },
  {
    id: 'EVT-3',
    time: '29 mins ago',
    type: 'DUNNING_DISPATCH',
    title: 'Instant WhatsApp Link Delivered',
    metric: 'Apex Cloud (₹3.2L)',
    severity: 'info'
  },
  {
    id: 'EVT-4',
    time: '48 mins ago',
    type: 'REVENUE_CAPTURED',
    title: 'Settlement Reconciled',
    metric: '+₹78,500 Recovered',
    severity: 'success'
  }
];

export default function LiveAnomalyStream() {
  return (
    <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Live Engine Telemetry</h3>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Stream Active
        </span>
      </div>

      <div className="divide-y divide-slate-800/60 mt-2">
        {liveStreamEvents.map((evt) => (
          <div key={evt.id} className="py-2.5 flex items-start justify-between text-xs group">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  evt.severity === 'critical' ? 'bg-rose-500' :
                  evt.severity === 'success' ? 'bg-emerald-500' : 'bg-sky-500'
                }`} />
                <span className="font-medium text-slate-200 group-hover:text-sky-300 transition-colors">
                  {evt.title}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 pl-3.5">{evt.metric}</p>
            </div>
            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap pl-2">
              {evt.time}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex justify-between items-center text-[11px]">
        <span className="text-slate-400">Core Loop Status</span>
        <Link to="/decisions" className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1">
          Inspect Decision Engine <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
