import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  BrainCircuit,
  ShieldAlert,
  Loader2,
  ArrowRight,
  CircleDashed,
  ArrowDown,
} from 'lucide-react';
import { mockAllOpportunities, mockKPIs } from '../data/mockData';
import { PriorityBadge, StatusBadge, ProbabilityBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

const formatCurrency = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

const formatPercent = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'Unavailable';
  return `${(numericValue * 100).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
};

const formatActionLabel = (value) => {
  if (!value) return 'N/A';
  return String(value).replace(/_/g, ' ');
};

const getInvestigationRouteId = (opportunity) => {
  if (!opportunity || !opportunity.id) return '';
  return String(opportunity.id).trim();
};

const getFriendlyInvestigationError = (status, message) => {
  const normalizedMessage = (message || '').toLowerCase();

  if (normalizedMessage.includes('not found')) {
    return 'This opportunity is not available for AI investigation right now.';
  }

  if (status === 400 || normalizedMessage.includes('successful transactions')) {
    return 'This transaction cannot be investigated in its current state.';
  }

  if (status === 404) {
    return 'The investigation endpoint could not find this opportunity.';
  }

  if (status >= 500) {
    return 'Unable to complete AI investigation. Please try again.';
  }

  if (normalizedMessage.includes('invalid') || normalizedMessage.includes('required')) {
    return 'Unable to complete AI investigation. Please try again.';
  }

  return 'Unable to complete AI investigation. Please try again.';
};

const buildDecisionTrace = (opportunity, investigation) => {
  if (!investigation) return [];

  const decision = investigation.aiDecision || {};
  const mlPrediction = investigation.mlPrediction || {};
  const provider = investigation.provider || {};
  const customer = investigation.customer || {};
  const failure = investigation.failure || {};

  const amountLabel = opportunity?.revenueAtRisk || formatCurrency(investigation.amount || 0);
  const riskText = opportunity?.failureReason || failure.reason || 'Failure reviewed';
  const providerText = provider.currentSuccessRate
    ? `${provider.currentSuccessRate}% current success rate`
    : provider.name
      ? `${provider.name} telemetry available`
      : 'Provider health not returned by backend';

  const mlText = mlPrediction.isAvailable && Number.isFinite(Number(mlPrediction.recoveryProbability))
    ? formatPercent(mlPrediction.recoveryProbability)
    : 'Unavailable';

  return [
    { title: 'Revenue Risk Detected', value: amountLabel, detail: 'Opportunity value identified for AI review' },
    { title: 'Failure Analyzed', value: riskText, detail: 'Cause and failure context reviewed' },
    { title: 'Customer / Transaction Context Checked', value: customer.customerType || 'Customer context available', detail: customer.customerId ? `Customer: ${customer.customerId}` : 'Relevant history reviewed' },
    { title: 'Provider Health Evaluated', value: providerText, detail: provider.name ? `Provider: ${provider.name}` : 'No provider telemetry returned' },
    { title: 'ML Recovery Probability', value: mlText, detail: mlPrediction.model ? `Model: ${mlPrediction.model}` : 'Baseline probability evaluated' },
    { title: 'AI Investigation', value: decision.rootCause || 'Root cause identified', detail: 'Structured reasoning and evidence considered' },
    { title: 'AI Recommendation', value: decision.recommendedAction || 'Pending', detail: 'Advisory recommendation presented to user' },
    { title: 'Policy Check', value: 'Pending — Day 4', detail: 'Policy engine is not yet implemented in this phase' },
  ];
};

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
  const [investigatingId, setInvestigatingId] = useState(null);
  const [aiInvestigation, setAiInvestigation] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiOpportunity, setAiOpportunity] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [decisionTraceOpen, setDecisionTraceOpen] = useState(false);

  const failureReasons = useMemo(() => {
    const set = new Set(mockAllOpportunities.map((o) => o.failureReason));
    return Array.from(set);
  }, []);

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
    setExecutedMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setExecutedMap((prev) => ({ ...prev, [id]: 'done' }));
    }, 1200);
  };

  const handleInvestigateOpportunity = async (opportunity, e) => {
    if (e) e.stopPropagation();

    const routeId = getInvestigationRouteId(opportunity);
    if (!routeId || investigatingId === routeId) return;

    setInvestigatingId(routeId);
    setAiOpportunity(opportunity);
    setAiInvestigation(null);
    setAiError('');
    setDecisionTraceOpen(false);

    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(routeId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok || !payload?.success || !payload?.investigation) {
        throw new Error(
          getFriendlyInvestigationError(response.status, payload?.error || 'Investigation failed')
        );
      }

      setAiInvestigation(payload.investigation);
      setAiError('');
      setAiModalOpen(true);
    } catch (error) {
      setAiInvestigation(null);
      setAiError(error?.message || 'Unable to complete AI investigation. Please try again.');
      setAiModalOpen(true);
    } finally {
      setInvestigatingId(null);
    }
  };

  const closeAiModal = () => {
    setAiModalOpen(false);
    setAiError('');
    setAiInvestigation(null);
    setAiOpportunity(null);
    setDecisionTraceOpen(false);
  };

  const traceSteps = useMemo(
    () => buildDecisionTrace(aiOpportunity, aiInvestigation),
    [aiOpportunity, aiInvestigation]
  );

  const totalFilteredRisk = filteredData.reduce((acc, curr) => acc + curr.rawAmount, 0);

  return (
    <div className="space-y-6">
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
            {mockAllOpportunities.filter((o) => o.priority === 'HIGH').length} Targets
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Immediate SLA action needed</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Pipeline Recovery Rate</span>
          <p className="text-2xl font-bold font-mono text-sky-400 mt-1">{mockKPIs.recoveryRate.value}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">+4.1% above target baseline</p>
        </div>
      </div>

      <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
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
                  const isInvestigating = investigatingId === row.id;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedOpp(row)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        <div>
                          <p className="font-semibold text-white group-hover:text-sky-400 transition-colors">{row.customer}</p>
                          <p className="text-[11px] text-slate-400">{row.tier} • {row.customerEmail}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-slate-200">{row.opportunity}</p>
                          <p className="text-[10px] font-mono text-slate-500">{row.id}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                        {row.revenueAtRisk}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px]">
                          {row.failureReason}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <ProbabilityBadge probability={row.recoveryProbability} />
                      </td>

                      <td className="py-3.5 px-4">
                        <PriorityBadge priority={row.priority} />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1 text-slate-200 font-medium">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>{row.recommendedAction}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={isDone ? 'In Progress' : row.status} />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={(e) => handleTriggerAction(row.id, e)}
                            disabled={isExecuting || isInvestigating || isDone}
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

                          <button
                            onClick={(e) => handleInvestigateOpportunity(row, e)}
                            disabled={isInvestigating || isExecuting || isDone}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                              isInvestigating
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse'
                                : 'bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 hover:border-sky-500/40'
                            }`}
                          >
                            {isInvestigating ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Investigating...</span>
                              </>
                            ) : (
                              <>
                                <BrainCircuit className="w-3 h-3" />
                                <span>Investigate with AI</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  Policy Check: Pending — Day 4
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
                  handleInvestigateOpportunity(selectedOpp, e);
                  setSelectedOpp(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 flex items-center gap-2"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                Investigate with AI
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={aiModalOpen}
        onClose={closeAiModal}
        title="AI Investigation"
        subtitle={aiOpportunity ? `Opportunity: ${aiOpportunity.opportunity} • Ref: ${aiOpportunity.id}` : 'Recovery analysis'}
        maxWidth="max-w-4xl"
      >
        {investigatingId && !aiInvestigation && !aiError && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-300">
            <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
            <p className="mt-3 text-sm font-medium">Investigating opportunity...</p>
          </div>
        )}

        {!investigatingId && aiError && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-300 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Unable to complete AI investigation</p>
                  <p className="mt-1 text-sm text-rose-100/90">{aiError}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => aiOpportunity && handleInvestigateOpportunity(aiOpportunity)}
                className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {aiInvestigation && (
          <div className="space-y-5 text-xs text-slate-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Transaction</div>
                <p className="mt-2 font-mono text-sm text-white">{aiInvestigation.transactionId}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Amount</div>
                <p className="mt-2 font-mono text-sm text-rose-400">{formatCurrency(aiInvestigation.amount || 0)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Failure</div>
                <p className="mt-2 text-sm text-slate-100">{aiInvestigation.failure?.reason || 'Unknown'}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Confidence</div>
                <p className="mt-2 text-lg font-bold font-mono text-sky-400">
                  {Number(aiInvestigation.aiDecision?.confidence || 0) * 100 >= 0 ? `${Math.round((Number(aiInvestigation.aiDecision?.confidence || 0)) * 100)}%` : '0%'}
                </p>
              </div>
            </div>

            {aiInvestigation.aiDecision?.requiresHumanReview && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-amber-100 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-300 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-200">⚠ Human Review Required</p>
                  <p className="text-xs text-amber-100/90">This is an advisory recommendation and is not automatically executable.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Root Cause</div>
                  <p className="mt-2 text-sm text-slate-100">{aiInvestigation.aiDecision?.rootCause || 'Root cause unavailable'}</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Recoverability</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-300 font-semibold text-[11px] uppercase">
                      {aiInvestigation.aiDecision?.recoverability || 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Recommended Action</div>
                  <div className="mt-2 flex items-center gap-2 text-base font-semibold text-amber-300">
                    <Zap className="w-4 h-4" />
                    <span>{formatActionLabel(aiInvestigation.aiDecision?.recommendedAction || 'N/A')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">ML Recovery Probability</div>
                  <p className="mt-2 text-xl font-bold font-mono text-emerald-400">
                    {aiInvestigation.mlPrediction?.isAvailable && Number.isFinite(Number(aiInvestigation.mlPrediction?.recoveryProbability))
                      ? formatPercent(aiInvestigation.mlPrediction.recoveryProbability)
                      : 'Unavailable'}
                  </p>
                  {aiInvestigation.mlPrediction?.isAvailable && aiInvestigation.mlPrediction?.model && (
                    <p className="mt-1 text-[11px] text-slate-400">Model: {aiInvestigation.mlPrediction.model}</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Expected Recovery</div>
                  <p className="mt-2 text-lg font-bold font-mono text-emerald-400">
                    {formatCurrency(aiInvestigation.aiDecision?.expectedRecovery || 0)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">AI Confidence</div>
                  <p className="mt-2 text-lg font-bold font-mono text-sky-400">
                    {formatPercent(aiInvestigation.aiDecision?.confidence || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-white font-semibold">
                <CircleDashed className="w-4 h-4 text-sky-400" />
                <span>Why this decision?</span>
              </div>
              <ul className="mt-3 space-y-2 text-slate-300">
                {(aiInvestigation.aiDecision?.reasoning || []).map((point, index) => (
                  <li key={`${point}-${index}`} className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-sky-400 mt-0.5 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              {Array.isArray(aiInvestigation.aiDecision?.riskFactors) && aiInvestigation.aiDecision.riskFactors.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Risk Factors</span>
                  </div>
                  <ul className="mt-3 space-y-2 text-slate-300">
                    {aiInvestigation.aiDecision.riskFactors.map((factor, index) => (
                      <li key={`${factor}-${index}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>No significant risk factors detected</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setDecisionTraceOpen((prev) => !prev)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
              >
                {decisionTraceOpen ? 'Hide Decision Trace' : 'View Decision Trace'}
              </button>
            </div>

            {decisionTraceOpen && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-white font-semibold">
                  <BrainCircuit className="w-4 h-4 text-sky-400" />
                  <span>DECISION TRACE</span>
                </div>
                <div className="space-y-3">
                  {traceSteps.map((step, index) => (
                    <div key={`${step.title}-${index}`} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-[10px] font-semibold text-sky-300">
                          {index + 1}
                        </div>
                        <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white">{step.title}</span>
                            <span className="font-mono text-[10px] text-slate-400">{step.value}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">{step.detail}</p>
                        </div>
                      </div>
                      {index < traceSteps.length - 1 && (
                        <div className="flex justify-center text-slate-600">
                          <ArrowDown className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
