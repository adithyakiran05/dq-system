'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { middlewareApi } from '@/lib/middleware-client';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    activeRules: 0,
    totalAnomalies: 0,
    tablesMonitored: 0,
    healthScore: 100
  });
  const [tables, setTables] = useState([]);
  const [running, setRunning] = useState(false);
  const [dbWarning, setDbWarning] = useState(null);

  const fetchData = async () => {
    try {
      const dataMetrics = await middlewareApi.getMetrics();
      if (dataMetrics.status === 'db_offline') {
        setDbWarning(dataMetrics.message || "AWS RDS PostgreSQL is unreachable. Please verify RDS security group on port 5432.");
      } else {
        setDbWarning(null);
      }
      if (dataMetrics.data) setMetrics(dataMetrics.data);

      const dataTables = await middlewareApi.getTables();
      if (dataTables.data) setTables(dataTables.data);
    } catch (error) {
      console.warn("Could not fetch dashboard data from middleware:", error);
      setDbWarning("Middleware connection notice: " + error.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunChecks = async () => {
    setRunning(true);
    try {
      await middlewareApi.triggerChecker();
      alert("Checker Lambda triggered successfully via Middleware! It will run in the background.");
      setTimeout(fetchData, 5000); // refresh after a few seconds
    } catch (e) {
      alert("Failed to run checks: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {dbWarning && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-300">
            <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <div>
              <div className="font-semibold text-sm">Database Offline / Network Notice</div>
              <div className="text-xs text-amber-200/80 mt-0.5">{dbWarning}</div>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
              Data Health Dashboard
            </h1>
            <p className="text-slate-400">Monitor and enforce data quality across your infrastructure.</p>
          </div>
          <button 
            onClick={handleRunChecks}
            disabled={running}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {running ? "Triggering..." : "Run DQ Checks"}
          </button>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Global Health Score</h3>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-bold ${metrics.healthScore > 95 ? 'text-emerald-400' : metrics.healthScore > 80 ? 'text-amber-400' : 'text-red-400'}`}>
                {metrics.healthScore}%
              </span>
            </div>
          </div>
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Total Anomalies</h3>
            <div className="text-4xl font-bold text-red-400">{metrics.totalAnomalies}</div>
          </div>
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Active Rules</h3>
            <div className="text-4xl font-bold text-sky-400">{metrics.activeRules}</div>
          </div>
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Tables Monitored</h3>
            <div className="text-4xl font-bold text-purple-400">{metrics.tablesMonitored}</div>
          </div>
        </div>

        {/* Table Health Breakdown */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl mb-12">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold">Table Health Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-300 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b border-slate-700">Table Name</th>
                  <th className="p-4 font-semibold border-b border-slate-700 text-right">Total Rows</th>
                  <th className="p-4 font-semibold border-b border-slate-700 text-right">Active Rules</th>
                  <th className="p-4 font-semibold border-b border-slate-700 text-right">Anomalies</th>
                  <th className="p-4 font-semibold border-b border-slate-700 text-right">Health Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {tables.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">No tables monitored yet. Run the profiler to get started.</td>
                  </tr>
                ) : tables.map((t, i) => (
                  <tr key={i} className="hover:bg-slate-750 transition-colors">
                    <td className="p-4 font-medium text-slate-200">{t.table_name}</td>
                    <td className="p-4 text-right text-slate-400">{t.total_rows?.toLocaleString() || 0}</td>
                    <td className="p-4 text-right text-sky-400 font-semibold">{t.active_rules}</td>
                    <td className="p-4 text-right text-red-400 font-semibold">{t.total_anomalies}</td>
                    <td className="p-4 text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold bg-opacity-20 ${
                        t.health_score > 95 ? 'bg-emerald-500 text-emerald-400 border border-emerald-500/30' : 
                        t.health_score > 80 ? 'bg-amber-500 text-amber-400 border border-amber-500/30' : 
                        'bg-red-500 text-red-400 border border-red-500/30'
                      }`}>
                        {t.health_score}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <h2 className="text-xl font-semibold mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/database" className="group relative bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:bg-slate-750 hover:border-purple-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Database Navigator</h2>
            <p className="text-sm text-slate-400">Explore mapped schemas and column profiles.</p>
          </Link>

          <Link href="/rules" className="group relative bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:bg-slate-750 hover:border-green-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Rules Review</h2>
            <p className="text-sm text-slate-400">Review, trigger, and manage DQ rules.</p>
          </Link>

          <Link href="/configs" className="group relative bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:bg-slate-750 hover:border-orange-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Configurations</h2>
            <p className="text-sm text-slate-400">Manage business constraints and settings.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
