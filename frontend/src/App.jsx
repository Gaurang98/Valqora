import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  Server, 
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const sampleChartData = [
  { month: 'Jan', revenue: 4000, recovered: 2400 },
  { month: 'Feb', revenue: 3000, recovered: 1398 },
  { month: 'Mar', revenue: 6000, recovered: 3800 },
  { month: 'Apr', revenue: 8780, recovered: 3908 },
  { month: 'May', revenue: 5890, recovered: 4800 },
  { month: 'Jun', revenue: 7390, recovered: 5800 },
];

export default function App() {
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setBackendStatus(data.status || 'Connected');
    } catch (err) {
      setBackendStatus('Backend unreachable (Ensure server is running on port 5000)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Valqora
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Setup Ready
              </span>
            </h1>
            <p className="text-xs text-slate-400">AI-Powered Revenue Decision & Recovery Engine</p>
          </div>
        </div>

        {/* Backend status indicator */}
        <div className="flex items-center space-x-3 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <Server className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400">Backend API:</span>
          <span className="font-mono text-emerald-400">{backendStatus}</span>
          <button 
            onClick={checkHealth} 
            disabled={loading}
            className="p-1 text-slate-400 hover:text-white transition disabled:opacity-50"
            title="Refresh health status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Metric Cards Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-sm font-medium">Stack Configuration</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold mt-2 text-white">React + Vite</p>
            <p className="text-xs text-slate-400 mt-1">Tailwind CSS, Lucide, Recharts configured</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-sm font-medium">API Health</span>
              <Activity className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-2xl font-bold mt-2 text-white">Express.js</p>
            <p className="text-xs text-slate-400 mt-1">GET /api/health endpoint active</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-sm font-medium">ML & Data Pipeline</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold mt-2 text-white">Ready for ML</p>
            <p className="text-xs text-slate-400 mt-1">Python ml/ and data/ scaffolding initialized</p>
          </div>
        </div>

        {/* Visual Chart Placeholder */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Revenue & Recovery Overview</h2>
              <p className="text-xs text-slate-400">Sample visualization validating Recharts integration</p>
            </div>
            <TrendingUp className="w-5 h-5 text-sky-400" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sampleChartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="recovered" stroke="#10b981" fillOpacity={1} fill="url(#colorRec)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        Valqora &copy; 2026 - Hackathon Starter
      </footer>
    </div>
  );
}
