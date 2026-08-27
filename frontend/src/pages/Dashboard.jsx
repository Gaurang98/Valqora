import React from 'react';
import { 
  AlertOctagon, 
  Coins, 
  CheckCircle, 
  Percent, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import RevenueRiskChart from '../components/dashboard/RevenueRiskChart';
import CriticalOpportunitiesTable from '../components/dashboard/CriticalOpportunitiesTable';
import LiveAnomalyStream from '../components/dashboard/LiveAnomalyStream';
import { mockKPIs } from '../data/mockData';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Top Banner / Core Loop Indicator */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/40 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Valqora Autonomous Recovery Loop Active
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Policy Compliant
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuously diagnosing failed transactions, calculating recovery probabilities, and executing rule-governed actions.
            </p>
          </div>
        </div>

        {/* Quick telemetry metrics */}
        <div className="flex items-center space-x-4 text-xs bg-slate-950/60 border border-slate-800/80 px-3.5 py-2 rounded-xl">
          <div>
            <span className="text-[10px] text-slate-400">Active Monitor</span>
            <p className="font-mono font-bold text-white">4 Acquirers</p>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400">Model Inference</span>
            <p className="font-mono font-bold text-sky-400">38ms Avg</p>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400">Policy Engine</span>
            <p className="font-mono font-bold text-emerald-400">Deterministic</p>
          </div>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue at Risk"
          value={mockKPIs.revenueAtRisk.value}
          change={mockKPIs.revenueAtRisk.change}
          trend={mockKPIs.revenueAtRisk.trend}
          isIncreaseBad={mockKPIs.revenueAtRisk.isIncreaseBad}
          comparisonText={mockKPIs.revenueAtRisk.comparisonText}
          secondaryMetric={mockKPIs.revenueAtRisk.secondaryMetric}
          icon={AlertOctagon}
          tooltip="Total potential revenue stalled in failed or abandoned transaction states"
        />

        <StatCard
          title="Recoverable Revenue"
          value={mockKPIs.recoverableRevenue.value}
          change={mockKPIs.recoverableRevenue.change}
          trend={mockKPIs.recoverableRevenue.trend}
          comparisonText={mockKPIs.recoverableRevenue.comparisonText}
          secondaryMetric={mockKPIs.recoverableRevenue.secondaryMetric}
          icon={Coins}
          tooltip="High-confidence addressable revenue prioritized for immediate automated recovery"
        />

        <StatCard
          title="Revenue Recovered"
          value={mockKPIs.revenueRecovered.value}
          change={mockKPIs.revenueRecovered.change}
          trend={mockKPIs.revenueRecovered.trend}
          comparisonText={mockKPIs.revenueRecovered.comparisonText}
          secondaryMetric={mockKPIs.revenueRecovered.secondaryMetric}
          icon={CheckCircle}
          tooltip="Successfully reclaimed revenue settled into merchant bank accounts"
        />

        <StatCard
          title="Recovery Rate"
          value={mockKPIs.recoveryRate.value}
          change={mockKPIs.recoveryRate.change}
          trend={mockKPIs.recoveryRate.trend}
          comparisonText={mockKPIs.recoveryRate.comparisonText}
          secondaryMetric={mockKPIs.recoveryRate.secondaryMetric}
          icon={Percent}
          tooltip="Overall percentage of flagged revenue successfully converted to settlement"
        />
      </div>

      {/* Main Charts & Live Feed Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueRiskChart />
        </div>
        <div className="lg:col-span-1">
          <LiveAnomalyStream />
        </div>
      </div>

      {/* Critical Opportunities Table */}
      <CriticalOpportunitiesTable />
    </div>
  );
}
