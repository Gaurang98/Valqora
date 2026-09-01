import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sparkles, 
  Target, 
  GitFork, 
  ShieldCheck, 
  Activity, 
  Layers, 
  ChevronRight,
  Shield,
  Zap
} from 'lucide-react';
import { mockSystemStatus } from '../../data/mockData';

const navItems = [
  {
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    badge: null
  },
  {
    name: 'AI Investigation',
    path: '/investigations',
    icon: Sparkles,
    badge: '2 Active'
  },
  {
    name: 'Recovery Opportunities',
    path: '/opportunities',
    icon: Target,
    badge: '10'
  },
  {
    name: 'Human Review',
    path: '/human-review',
    icon: Shield,
    badge: '3'
  },
  {
    name: 'Decision Trace',
    path: '/decisions',
    icon: GitFork,
    badge: null
  },
  {
    name: 'Audit Logs',
    path: '/audit',
    icon: ShieldCheck,
    badge: null
  },
];

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50
        w-64 bg-slate-900/95 border-r border-slate-800/80
        flex flex-col justify-between
        transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Logo & Header */}
        <div>
          <div className="h-16 px-6 border-b border-slate-800/80 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-sky-500/20">
              <Zap className="w-5 h-5 text-white fill-white/20" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-bold tracking-tight text-white font-sans">Valqora</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/25">
                  Engine
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                Revenue Recovery Platform
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Platform Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `
                    group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150
                    ${isActive 
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isActive 
                            ? 'bg-sky-500/20 text-sky-300' 
                            : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Engine Guardrails & System Status Bottom Card */}
        <div className="p-4 space-y-3 border-t border-slate-800/80 bg-slate-900/60">
          {/* Autonomous Guardrails Box */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-300">
            <div className="flex items-center justify-between text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Policy Guardrails
              </span>
              <span className="text-[10px] font-mono text-emerald-400">ACTIVE</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">14 policies enforced • 0 SLA breaches</p>
          </div>

          {/* System Status */}
          <div className="flex items-center justify-between px-1 text-xs">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 text-xs font-medium">{mockSystemStatus.status}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{mockSystemStatus.engineVersion}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
