import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, ExternalLink, CheckCircle2, Eye } from 'lucide-react';
import { PriorityBadge, StatusBadge, ProbabilityBadge } from '../ui/Badge';
import { mockCriticalOpportunities } from '../../data/mockData';
import Modal from '../ui/Modal';

export default function CriticalOpportunitiesTable() {
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [actionTriggered, setActionTriggered] = useState({});

  const handleTriggerAction = (id, e) => {
    e.stopPropagation();
    setActionTriggered(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setActionTriggered(prev => ({ ...prev, [id]: 'done' }));
    }, 1200);
  };

  return (
    <div className="bg-slate-900/75 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Table Header */}
      <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-semibold text-white tracking-tight">Critical Recovery Opportunities</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Immediate Action Recommended
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            High-value leakage vectors prioritized by recovery likelihood and customer Lifetime Value
          </p>
        </div>

        <Link
          to="/opportunities"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-400 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 transition group w-fit"
        >
          <span>View All Opportunities</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 sm:px-6">Opportunity</th>
              <th className="py-3 px-4">Revenue at Risk</th>
              <th className="py-3 px-4">Recovery Probability</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Recommended Action</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Quick Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {mockCriticalOpportunities.map((row) => {
              const isExecuting = actionTriggered[row.id] === true;
              const isDone = actionTriggered[row.id] === 'done';

              return (
                <tr 
                  key={row.id}
                  onClick={() => setSelectedOpp(row)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  {/* Opportunity & Customer */}
                  <td className="py-3.5 px-4 sm:px-6">
                    <div>
                      <span className="font-medium text-white group-hover:text-sky-400 transition-colors">
                        {row.opportunity}
                      </span>
                      <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-400">
                        <span>{row.customer}</span>
                        <span>•</span>
                        <span className="text-slate-500">{row.detectedAt}</span>
                      </div>
                    </div>
                  </td>

                  {/* Revenue at Risk */}
                  <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                    {row.revenueAtRisk}
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
                    <div className="flex items-center space-x-1.5 font-medium text-slate-200">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>{row.recommendedAction}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <StatusBadge status={isDone ? 'In Progress' : row.status} />
                  </td>

                  {/* Quick Action Button */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => handleTriggerAction(row.id, e)}
                      disabled={isExecuting || isDone}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                        isDone 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
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
                        <span>Executing...</span>
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
            })}
          </tbody>
        </table>
      </div>

      {/* Opportunity Detail Modal */}
      <Modal
        isOpen={!!selectedOpp}
        onClose={() => setSelectedOpp(null)}
        title={selectedOpp?.opportunity}
        subtitle={`Target ID: ${selectedOpp?.id} • Account: ${selectedOpp?.customer}`}
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
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">Diagnosis & Root Cause</h4>
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-slate-300">
                <p><span className="text-slate-400 font-medium">Failure Reason:</span> {selectedOpp.failureReason}</p>
                <p className="mt-1"><span className="text-slate-400 font-medium">Target Email:</span> {selectedOpp.customerEmail}</p>
                <p className="mt-1"><span className="text-slate-400 font-medium">Account Tier:</span> {selectedOpp.tier}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">AI Recommended Strategy</h4>
              <div className="bg-sky-500/10 border border-sky-500/25 rounded-lg p-3 text-sky-200">
                <div className="flex items-center space-x-2 font-semibold text-sky-400">
                  <Zap className="w-4 h-4" />
                  <span>{selectedOpp.recommendedAction}</span>
                </div>
                <p className="mt-1 text-xs text-sky-100/90">{selectedOpp.actionDetail}</p>
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
                Execute Autonomous Action
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
