import React from 'react';
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';

export default function StatCard({ 
  title, 
  value, 
  change, 
  comparisonText, 
  secondaryMetric,
  icon: Icon,
  trend = 'neutral',
  isIncreaseBad = false,
  tooltip
}) {
  const isPositive = trend === 'up' && !isIncreaseBad;
  const isNegative = (trend === 'up' && isIncreaseBad) || trend === 'down';

  return (
    <div className="relative overflow-hidden bg-slate-900/75 backdrop-blur-sm border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 transition-all duration-200 shadow-sm group">
      {/* Top row: Title and Icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-slate-400">
          <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
          {tooltip && (
            <div className="group/tooltip relative cursor-help">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-800 border border-slate-700 text-[11px] text-slate-200 rounded shadow-xl z-50">
                {tooltip}
              </div>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 group-hover:text-white transition-colors">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono">
          {value}
        </p>
        
        {change && (
          <div className={`flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
            isPositive 
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
              : isNegative 
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-sky-400 bg-sky-500/10 border-sky-500/20'
          }`}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            <span>{change}</span>
          </div>
        )}
      </div>

      {/* Footer / Context row */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="truncate">{comparisonText}</span>
        {secondaryMetric && (
          <span className="font-mono text-slate-300 font-medium pl-2">{secondaryMetric}</span>
        )}
      </div>
    </div>
  );
}
