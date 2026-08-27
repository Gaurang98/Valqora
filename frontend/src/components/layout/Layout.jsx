import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Persistent Left Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <TopNav setMobileOpen={setMobileOpen} />

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Valqora AI Revenue Decision & Recovery Engine &copy; 2026</span>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>Deterministic Policy Guardrails Active</span>
            <span>•</span>
            <span className="font-mono text-slate-400">API Gateway: Online</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
