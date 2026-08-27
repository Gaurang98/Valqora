import React from 'react';

export function PriorityBadge({ priority }) {
  const normalized = (priority || '').toUpperCase();
  if (normalized === 'HIGH' || normalized === 'CRITICAL') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse" />
        HIGH
      </span>
    );
  }
  if (normalized === 'MEDIUM') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
        MEDIUM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
      LOW
    </span>
  );
}

export function StatusBadge({ status }) {
  const normalized = (status || '').toLowerCase();
  
  if (normalized.includes('recover') || normalized === 'success' || normalized === 'approved') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
        {status}
      </span>
    );
  }
  if (normalized.includes('progress') || normalized === 'resolving') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mr-1.5 animate-pulse" />
        {status}
      </span>
    );
  }
  if (normalized.includes('investigat') || normalized === 'pending' || normalized === 'scheduled') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
        {status}
      </span>
    );
  }
  if (normalized === 'blocked' || normalized === 'failed' || normalized === 'alert') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
      {status}
    </span>
  );
}

export function ProbabilityBadge({ probability }) {
  const num = typeof probability === 'number' ? probability : parseInt(probability, 10) || 0;
  
  let color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let barColor = 'bg-emerald-500';
  
  if (num < 60) {
    color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    barColor = 'bg-amber-500';
  } else if (num < 40) {
    color = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    barColor = 'bg-rose-500';
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${num}%` }} />
      </div>
      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-mono font-semibold border ${color}`}>
        {num}%
      </span>
    </div>
  );
}
