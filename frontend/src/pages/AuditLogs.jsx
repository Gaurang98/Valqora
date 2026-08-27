import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ShieldCheck, 
  Download, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  Code, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  User,
  Bot
} from 'lucide-react';
import { mockAuditLogs } from '../data/mockData';
import { StatusBadge } from '../components/ui/Badge';

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [actorFilter, setActorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Extract unique events and actors for filters
  const eventTypes = useMemo(() => Array.from(new Set(mockAuditLogs.map(l => l.event))), []);
  const actors = useMemo(() => Array.from(new Set(mockAuditLogs.map(l => l.actor))), []);

  const filteredLogs = useMemo(() => {
    return mockAuditLogs.filter((log) => {
      const matchSearch = 
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.incident.toLowerCase().includes(search.toLowerCase()) ||
        log.actor.toLowerCase().includes(search.toLowerCase()) ||
        log.id.toLowerCase().includes(search.toLowerCase());

      const matchEvent = eventFilter === 'ALL' || log.event === eventFilter;
      const matchActor = actorFilter === 'ALL' || log.actor === actorFilter;
      const matchStatus = statusFilter === 'ALL' || log.status === statusFilter;

      return matchSearch && matchEvent && matchActor && matchStatus;
    });
  }, [search, eventFilter, actorFilter, statusFilter]);

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredLogs, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `valqora_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Enterprise Compliance & Audit Trail</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cryptographically verified, immutable event stream of all AI decisions, policy evaluations, and manual overrides.
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-2 transition shadow-sm w-fit"
        >
          <Download className="w-4 h-4" />
          <span>Export Compliance Log</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, incident ref, actor or log ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          {/* Event Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Event Type</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Events</option>
              {eventTypes.map((evt) => (
                <option key={evt} value={evt}>{evt}</option>
              ))}
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Actor / Subsystem</label>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Actors</option>
              {actors.map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Execution Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="APPROVED">APPROVED</option>
              <option value="ALERT">ALERT</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 text-xs">
          <span className="text-slate-400">
            Showing <strong className="text-white">{filteredLogs.length}</strong> immutable audit entries
          </span>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Ledger Verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 sm:px-6">Timestamp</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Incident / Ref</th>
                <th className="py-3 px-4">Action Taken</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500 text-xs">
                    No audit records match the specified query filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const isBot = log.actor.includes('Engine') || log.actor.includes('Detector') || log.actor.includes('Guardrails');

                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {log.timestamp}
                        </td>

                        {/* Event */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                            {log.event}
                          </span>
                        </td>

                        {/* Actor */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5 font-medium text-slate-200">
                            {isBot ? (
                              <Bot className="w-3.5 h-3.5 text-sky-400" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-purple-400" />
                            )}
                            <span className="truncate max-w-[140px]">{log.actor}</span>
                          </div>
                        </td>

                        {/* Incident / Ref */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                          {log.incident}
                        </td>

                        {/* Action Taken */}
                        <td className="py-3.5 px-4 text-slate-200 max-w-xs truncate">
                          {log.action}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={log.status} />
                        </td>

                        {/* Details toggle */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(log.id);
                            }}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-sky-400" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON Payload Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80">
                          <td colSpan="7" className="p-4 sm:px-6 border-b border-slate-800">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                                  <Code className="w-3.5 h-3.5 text-sky-400" /> Raw Telemetry & Decision Payload ({log.id})
                                </span>
                                <span className="font-mono text-[10px] text-slate-500">FORMAT: JSON-STRICT</span>
                              </div>
                              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] text-emerald-400 overflow-x-auto">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
