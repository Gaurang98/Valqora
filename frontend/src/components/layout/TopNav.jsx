import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Search, 
  Bell, 
  Building2, 
  Menu, 
  Server, 
  RefreshCw, 
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';

const routeTitleMap = {
  '/': { title: 'Revenue Operations Dashboard', subtitle: 'Real-time overview of revenue at risk, leakage vectors, and recovery velocity' },
  '/investigations': { title: 'AI Root Cause Investigation', subtitle: 'Automated telemetry analysis and actionable intervention strategies' },
  '/opportunities': { title: 'Recovery Opportunity Pipeline', subtitle: 'Prioritized queue of addressable failed transactions and dunning targets' },
  '/decisions': { title: 'Autonomous Decision Trace', subtitle: 'Deterministic explainability log of ML inference, policies, and actions' },
  '/audit': { title: 'Enterprise Audit Trail', subtitle: 'Immutable compliance log of system events, policies, and actor overrides' }
};

export default function TopNav({ setMobileOpen }) {
  const location = useLocation();
  const currentRoute = routeTitleMap[location.pathname] || { title: 'Valqora Platform', subtitle: 'AI Revenue Decision & Recovery Engine' };

  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [isBackendHealthy, setIsBackendHealthy] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const checkBackend = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (res.ok && data.status) {
        setBackendStatus(data.status);
        setIsBackendHealthy(true);
      } else {
        setBackendStatus('Degraded');
        setIsBackendHealthy(false);
      }
    } catch {
      setBackendStatus('Offline (Port 5000)');
      setIsBackendHealthy(false);
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            {currentRoute.title}
          </h1>
          <p className="hidden md:block text-[11px] text-slate-400 font-normal">
            {currentRoute.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Search, Live Backend Status, Notifications, Merchant Area */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Search Bar */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search txn, incident, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 lg:w-64 bg-slate-950/70 border border-slate-800 focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Backend API live indicator */}
        <div 
          className="hidden sm:flex items-center space-x-2 text-xs bg-slate-950/80 border border-slate-800 px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-slate-700 transition"
          title="Click to re-ping backend server"
          onClick={checkBackend}
        >
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400">API:</span>
          <span className={`text-[11px] font-mono font-medium ${isBackendHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
            {backendStatus}
          </span>
          <RefreshCw className="w-3 h-3 text-slate-500 hover:text-slate-300" />
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-white">System Alerts</span>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">2 New</span>
              </div>
              <div className="divide-y divide-slate-800/60 mt-1 max-h-64 overflow-y-auto">
                <div className="py-2.5 text-xs">
                  <div className="flex items-center justify-between text-rose-400 font-medium">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> High Spike Detected
                    </span>
                    <span className="text-[10px] text-slate-400">12m ago</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">INC-8941: Gateway 504 surge on HDFC/SBI Netbanking.</p>
                </div>
                <div className="py-2.5 text-xs">
                  <div className="flex items-center justify-between text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Revenue Recovered
                    </span>
                    <span className="text-[10px] text-slate-400">42m ago</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">₹78,500 settled for Vanguard Industrial Supplies.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Merchant / Account Switcher */}
        <div className="relative">
          <button
            onClick={() => setMerchantOpen(!merchantOpen)}
            className="flex items-center space-x-2 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs transition"
          >
            <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
              A
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-white leading-none">Acme FinTech Corp</p>
              <p className="text-[10px] text-slate-400 leading-none mt-1">Production (INR)</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {merchantOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs animate-fadeIn">
              <div className="px-2 py-1.5 text-[10px] uppercase font-semibold text-slate-400">Active Merchant Workspace</div>
              <div className="px-2 py-2 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Acme FinTech Corp</p>
                  <p className="text-[10px] text-slate-400">MID: ACM_90812</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-1 pt-1 border-t border-slate-800 px-2 py-1 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Auto-Recovery Mode</span>
                <span className="text-emerald-400 font-mono">ENABLED</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
