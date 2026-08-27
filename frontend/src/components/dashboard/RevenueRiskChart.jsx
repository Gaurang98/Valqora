import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { mockRiskTrends } from '../../data/mockData';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 min-w-[170px]">
        <p className="font-semibold text-white border-b border-slate-800 pb-1">{label}</p>
        <div className="flex items-center justify-between text-rose-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Revenue at Risk:
          </span>
          <span className="font-mono font-bold">₹{payload[0].value}L</span>
        </div>
        <div className="flex items-center justify-between text-emerald-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Recovered:
          </span>
          <span className="font-mono font-bold">₹{payload[1].value}L</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function RevenueRiskChart() {
  const [timeframe, setTimeframe] = useState('30D');

  return (
    <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-5 sm:p-6 transition-all shadow-sm">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-semibold text-white tracking-tight">Revenue Risk & Recovery Trend</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Tracking identified leakage vs. automated recovery velocity across all billing channels
          </p>
        </div>

        {/* Timeframe Controls & Legend Indicators */}
        <div className="flex items-center space-x-2">
          {['7D', '30D', '90D'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                timeframe === tf 
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Recharts Chart Area */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockRiskTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Risk Gradient */}
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
              </linearGradient>
              {/* Recovery Gradient */}
              <linearGradient id="recoveredGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#64748b" 
              fontSize={11} 
              tickLine={false} 
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={11} 
              tickLine={false} 
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(val) => `₹${val}L`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="top" 
              align="right"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              formatter={(value) => (
                <span className="text-xs text-slate-300 mr-2">{value}</span>
              )}
            />

            <Area 
              name="Revenue at Risk" 
              type="monotone" 
              dataKey="risk" 
              stroke="#f43f5e" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#riskGradient)" 
            />
            <Area 
              name="Revenue Recovered" 
              type="monotone" 
              dataKey="recovered" 
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#recoveredGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Summary Cards */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
        <div>
          <span className="text-[11px] text-slate-500">Peak Risk Surge</span>
          <p className="font-mono font-semibold text-rose-400">₹18.4L (Aug 25)</p>
        </div>
        <div>
          <span className="text-[11px] text-slate-500">Recovery Trajectory</span>
          <p className="font-mono font-semibold text-emerald-400">+18.2% acceleration</p>
        </div>
        <div>
          <span className="text-[11px] text-slate-500">Autonomous Resolves</span>
          <p className="font-mono font-semibold text-sky-400">76% no human loop</p>
        </div>
        <div>
          <span className="text-[11px] text-slate-500">Target Efficiency</span>
          <p className="font-mono font-semibold text-slate-200">65.4% capture rate</p>
        </div>
      </div>
    </div>
  );
}
