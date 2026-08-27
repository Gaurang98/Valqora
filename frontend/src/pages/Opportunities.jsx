import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Zap, 
  Coins, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  SlidersHorizontal,
  RefreshCw,
  Download
} from 'lucide-react';
import { mockAllOpportunities, mockKPIs } from '../data/mockData';
import { PriorityBadge, StatusBadge, ProbabilityBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

export default function Opportunities() {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reasonFilter, setReasonFilter] = useState('ALL');
  const [minProbability, setMinProbability] = useState(0);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [sortField, setSortField] = useState('rawAmount');
  const [sortAsc, setSortAsc] = useState(false);
  const [executedMap, setExecutedMap] = useState({});

  // Unique failure reasons for filter
  const failureReasons = useMemo(() => {
    const set = new Set(mockAllOpportunities.map(o => o.failureReason));
    return Array.from(set);
  }, []);

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    return mockAllOpportunities.filter((opp) => {
      const matchSearch = 
        opp.customer.toLowerCase().includes(search.toLowerCase()) ||
        opp.opportunity.toLowerCase().includes(search.toLowerCase()) ||
        opp.id.toLowerCase().includes(search.toLowerCase()) ||
        opp.customerEmail.toLowerCase().includes(search.toLowerCase());
      
      const matchPriority = priorityFilter === 'ALL' || opp.priority === priorityFilter;
      const matchStatus = statusFilter === 'ALL' || opp.status.toLowerCase() === statusFilter.toLowerCase();
      const matchReason = reasonFilter === 'ALL' || opp.failureReason === reasonFilter;
      const matchProb = opp.recoveryProbability >= minProbability;

      return matchSearch && matchPriority && matchStatus && matchReason && matchProb;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [search, priorityFilter, statusFilter, reasonFilter, minProbability, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleTriggerAction = (id, e) => {
    if (e) e.stopPropagation();
    setExecutedMap(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setExecutedMap(prev => ({ ...prev, [id]: 'done' }));
    }, 1200);
  };

  const totalFilteredRisk = filteredData.reduce((acc, curr) => acc + curr.rawAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Total Opportunities</span>
          <p className="text-2xl font-bold font-mono text-white mt-1">{mockAllOpportunities.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Active in recovery pipeline</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Total Recoverable Revenue</span>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{mockKPIs.recoverableRevenue.value}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Addressable with high intent</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400">High-Priority Targets</span>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {mockAllOpportunities.filter(o => o.priority === 'HIGH').length} Targets
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Immediate SLA action needed</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Pipeline Recovery Rate</span>
          <p className="text-2xl font-bold font-mono text-sky-400 mt-1">{mockKPIs.recoveryRate.value}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">+4.1% above target baseline</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by customer, opportunity type, email or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
            />
          </div>

          {/* Quick Clear & Export button */}
          <div className="flex items-center space-x-2">
            {(search || priorityFilter !== 'ALL' || statusFilter !== 'ALL' || reasonFilter !== 'ALL' || minProbability > 0) && (
              <button
                onClick={() => {
                  setSearch('');
                  setPriorityFilter('ALL');
                  setStatusFilter('ALL');
                  setReasonFilter('ALL');
                  setMinProbability(0);
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={() => alert('Opportunities exported as CSV (Mock)')}
              className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Priority Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="investigating">Investigating</option>
              <option value="in progress">In Progress</option>
              <option value="recovered">Recovered</option>
            </select>
          </div>

          {/* Failure Reason Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Failure Reason</label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Failure Reasons</option>
              {failureReasons.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Probability Range Slider */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400 mb-1">
              <span>Min Recovery Prob</span>
              <span className="font-mono text-emerald-400">{minProbability}%+</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minProbability}
              onChange={(e) => setMinProbability(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Main Sortable Table */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 text-xs">
          <span className="text-slate-400">
            Showing <strong className="text-white">{filteredData.length}</strong> of {mockAllOpportunities.length} opportunities
          </span>
          <span className="text-slate-400">
            Filtered Risk: <strong className="font-mono text-rose-400">₹{(totalFilteredRisk / 100000).toFixed(2)}L</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 sm:px-6 cursor-pointer hover:text-white" onClick={() => handleSort('customer')}>
                  <div className="flex items-center space-x-1">
                    <span>Customer & Plan</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('opportunity')}>
                  <div className="flex items-center space-x-1">
                    <span>Opportunity / Txn</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('rawAmount')}>
                  <div className="flex items-center space-x-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Failure Reason</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('recoveryProbability')}>
                  <div className="flex items-center space-x-1">
                    <span>Recovery Prob</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Recommended Action</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500 text-xs">
                    No recovery opportunities match the specified filters.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => {
                  const isExecuting = executedMap[row.id] === true;
                  const isDone = executedMap[row.id] === 'done';

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedOpp(row)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Customer */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div>
                          <p className="font-semibold text-white group-hover:text-sky-400 transition-colors">{row.customer}</p>
                          <p className="text-[11px] text-slate-400">{row.tier} • {row.customerEmail}</p>
                        </div>
                      </td>

                      {/* Opportunity / Txn */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-slate-200">{row.opportunity}</p>
                          <p className="text-[10px] font-mono text-slate-500">{row.id}</p>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                        {row.revenueAtRisk}
                      </td>

                      {/* Failure Reason */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px]">
                          {row.failureReason}
                        </span>
                      </td>

                      {/* Recovery Probability */}
                      <td className="py-3.5 px-4">
                        <ProbabilityBadge probability={row.recoveryProbability} />
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        <PriorityBadge priority={row.priority} />
                      </td>

                      {/* Recommended Action */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1 text-slate-200 font-medium">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>{row.recommendedAction}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={isDone ? 'In Progress' : row.status} />
                      </td>

                      {/* Action Trigger */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => handleTriggerAction(row.id, e)}
                          disabled={isExecuting || isDone}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                            isDone 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isExecuting 
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse'
                                : 'bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 hover:border-sky-500/40'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Dispatched</span>
                            </>
                          ) : isExecuting ? (
                            <span>Running...</span>
                          ) : (
                            <>
                              <span>Execute</span>
                              <ExternalLink className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opportunity Deep-Dive Modal */}
      <Modal
        isOpen={!!selectedOpp}
        onClose={() => setSelectedOpp(null)}
        title={selectedOpp?.customer}
        subtitle={`Opportunity: ${selectedOpp?.opportunity} • Ref: ${selectedOpp?.id}`}
      >
        {selectedOpp && (
          <div className="space-y-5 text-xs text-slate-300">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Revenue at Risk</span>
                <p className="font-mono text-base font-bold text-rose-400 mt-0.5">{selectedOpp.revenueAtRisk}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Recovery Prob</span>
                <p className="font-mono text-base font-bold text-emerald-400 mt-0.5">{selectedOpp.recoveryProbability}%</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Priority Level</span>
                <div className="mt-1"><PriorityBadge priority={selectedOpp.priority} /></div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Current Status</span>
                <div className="mt-1"><StatusBadge status={selectedOpp.status} /></div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">Account Details & Telemetry</h4>
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1.5 text-slate-300">
                <div className="flex justify-between"><span className="text-slate-400">Billing Contact:</span> <span className="font-mono text-white">{selectedOpp.customerEmail}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Subscription Tier:</span> <span>{selectedOpp.tier}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Failure Reason:</span> <span className="text-rose-300">{selectedOpp.failureReason}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Detected At:</span> <span>{selectedOpp.detectedAt}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">AI Recommendation Engine</h4>
              <div className="bg-sky-500/10 border border-sky-500/25 rounded-lg p-3 text-sky-200 space-y-1">
                <div className="flex items-center space-x-2 font-semibold text-sky-400">
                  <Zap className="w-4 h-4" />
                  <span>{selectedOpp.recommendedAction}</span>
                </div>
                <p className="text-xs text-sky-100/90">{selectedOpp.actionDetail}</p>
                <p className="text-[11px] text-sky-300/80 pt-1 border-t border-sky-500/20">
                  Policy Check: Passed standard rate limit & compliance guardrails.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                onClick={() => setSelectedOpp(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close
              </button>
              <button
                onClick={(e) => {
                  handleTriggerAction(selectedOpp.id, e);
                  setSelectedOpp(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20"
              >
                Dispatch Autonomous Action
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
