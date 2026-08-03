'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [rules, setRules] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');

  const fetchRules = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      setRules(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    
    // Poll every 5 seconds for real-time updates from AgentCore
    const interval = setInterval(() => {
      fetchRules(true);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to trigger");
      }
      alert("Generation started in AWS Agentcore! Rules will appear here shortly.");
    } catch (e) {
      console.error(e);
      alert("Failed to start generation: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id) => {
    await fetch('/api/rules/approve', {
      method: 'POST',
      body: JSON.stringify({ rule_id: id }),
    });
    fetchRules();
  };

  const handleReject = async (id) => {
    await fetch('/api/rules/reject', {
      method: 'POST',
      body: JSON.stringify({ rule_id: id }),
    });
    fetchRules();
  };

  const handleApproveAll = async () => {
    const ids = filteredRules.map(r => r.id);
    if (!ids.length) return;
    await fetch('/api/rules/approve-all', {
      method: 'POST',
      body: JSON.stringify({ rule_ids: ids }),
    });
    fetchRules();
  };

  const handleRejectAll = async () => {
    const ids = filteredRules.map(r => r.id);
    if (!ids.length) return;
    await fetch('/api/rules/reject-all', {
      method: 'POST',
      body: JSON.stringify({ rule_ids: ids }),
    });
    fetchRules();
  };

  // Derive unique DQ types for the filter dropdown
  const dqTypes = ['All', ...new Set(rules.map(r => r.dq_type).filter(Boolean))];

  // Filter rules based on dropdown
  const filteredRules = rules.filter(r => 
    filterType === 'All' ? true : r.dq_type === filterType
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            DQ Rules Review
          </h1>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {generating ? "Triggering..." : "Generate New Rules"}
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
          {/* Toolbar for bulk actions and filtering */}
          <div className="p-4 border-b border-slate-700 bg-slate-900/30 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <label className="text-sm text-slate-400 font-medium">Filter by DQ Type:</label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
              >
                {dqTypes.map(type => (
                  <option key={type} value={type}>{type || 'Unknown'}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleApproveAll}
                disabled={filteredRules.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve All ({filteredRules.length})
              </button>
              <button 
                onClick={handleRejectAll}
                disabled={filteredRules.length === 0}
                className="bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject All ({filteredRules.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading rules...</div>
          ) : filteredRules.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No proposed rules found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">Table</th>
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">Column</th>
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">DQ Type</th>
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">Rule</th>
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">Config</th>
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map(rule => (
                  <tr key={rule.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="p-4 text-sm font-medium">{rule.table_name}</td>
                    <td className="p-4 text-sm">{rule.column_name}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-xs font-semibold">
                        {rule.dq_type || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold">
                        {rule.rule_type}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-300">
                      {JSON.stringify(rule.rule_config)}
                    </td>
                    <td className="p-4 flex gap-2">
                      <button 
                        onClick={() => handleApprove(rule.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleReject(rule.id)}
                        className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
