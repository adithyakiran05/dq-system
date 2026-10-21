'use client';
import { useState, useEffect } from 'react';
import { middlewareApi } from '@/lib/middleware-client';

export default function Home() {
  const [rules, setRules] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [customConfigText, setCustomConfigText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [showConfigs, setShowConfigs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTable, setFilterTable] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [rulesPerPage, setRulesPerPage] = useState(15);
  const [profiling, setProfiling] = useState(false);
  const [activeTab, setActiveTab] = useState('review');
  const [history, setHistory] = useState([]);
  
  // Rule Parameterization State
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editConfigText, setEditConfigText] = useState('');

  const fetchRules = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await middlewareApi.getProposedRules();
      setRules(res.data || []);
    } catch (e) {
      console.warn("Could not fetch rules:", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await middlewareApi.getRulesHistory();
      setHistory(res.data || []);
    } catch (e) {
      console.warn("Could not fetch history:", e);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await middlewareApi.getConfigs();
      setConfigs(res.data || []);
    } catch (e) {
      console.warn("Could not fetch configs:", e);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchConfigs();
    fetchHistory();
    
    // Background polling: sync proposed rules every 15s without saturating the connection
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchRules(true);
      }
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch history when user switches to the history tab
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // Fetch configs when user opens the custom configs panel
  useEffect(() => {
    if (showConfigs) {
      fetchConfigs();
    }
  }, [showConfigs]);

  const handleSaveConfig = async () => {
    if (!customConfigText.trim() && !selectedFile) {
      alert("Please enter configuration text or select a PDF file.");
      return;
    }
    
    setSavingConfig(true);
    try {
      if (selectedFile) {
        if (selectedFile.type !== 'application/pdf' && selectedFile.type !== 'text/plain') {
          throw new Error("Only PDF and TXT files are supported");
        }
        
        // 1. Get Presigned URL directly from Middleware
        const presignRes = await middlewareApi.getPresignedUrl(selectedFile.name, selectedFile.type);
        const { url } = presignRes.data;
        
        // 2. Upload directly to S3
        const uploadRes = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': selectedFile.type
          },
          body: selectedFile
        });
        
        if (!uploadRes.ok) throw new Error("Failed to upload to S3");
        setSavingConfig(false);
        alert("File uploaded successfully! Processing will happen in the background.");
        setSelectedFile(null);
        setTimeout(fetchConfigs, 3000); // Wait for processing
        
      } else {
        // Plain text flow via Middleware
        await middlewareApi.saveConfig(customConfigText);
        setSavingConfig(false);
        setCustomConfigText('');
        fetchConfigs();
        alert("Custom configurations saved successfully!");
      }
    } catch (e) {
      console.warn("Save config error:", e);
      setSavingConfig(false);
      alert("Error saving configs: " + e.message);
    }
  };

  const handleDeleteConfig = async (id) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    try {
      // Optimistically remove from list
      setConfigs(prev => prev.filter(c => c.id !== id));
      await middlewareApi.deleteConfig(id);
      fetchConfigs();
    } catch (e) {
      console.warn("Failed to delete config:", e);
      fetchConfigs();
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await middlewareApi.triggerAgent();
      setGenerating(false);
      alert("Generation started in AWS AgentCore via Middleware! Rules will appear here shortly.");
    } catch (e) {
      console.warn("Generate error:", e);
      setGenerating(false);
      alert("Failed to start generation: " + e.message);
    }
  };

  const handleProfile = async () => {
    setProfiling(true);
    try {
      await middlewareApi.triggerProfiler();
      setProfiling(false);
      alert("Profiler Lambda started via Middleware! It will take about 60 seconds to scan the database.");
    } catch (e) {
      console.warn("Profiler error:", e);
      setProfiling(false);
      alert("Failed to start profiler: " + e.message);
    }
  };

  const handleApprove = async (id) => {
    // Instant optimistic update in the UI (0ms perceived latency)
    setRules(prev => prev.filter(r => r.id !== id));
    try {
      await middlewareApi.approveRule(id);
    } catch (e) {
      console.warn("Approve error:", e);
      fetchRules(true); // Re-sync on failure
    }
  };

  const handleReject = async (id) => {
    // Instant optimistic update in the UI (0ms perceived latency)
    setRules(prev => prev.filter(r => r.id !== id));
    try {
      await middlewareApi.rejectRule(id);
    } catch (e) {
      console.warn("Reject error:", e);
      fetchRules(true); // Re-sync on failure
    }
  };

  const handleApproveAll = async () => {
    const ids = filteredRules.map(r => r.id);
    if (!ids.length) return;
    // Instant optimistic update in the UI (0ms perceived latency)
    setRules(prev => prev.filter(r => !ids.includes(r.id)));
    try {
      await middlewareApi.approveAllRules(ids);
    } catch (e) {
      console.warn("Approve all error:", e);
      fetchRules(true); // Re-sync on failure
    }
  };

  const handleRejectAll = async () => {
    const ids = filteredRules.map(r => r.id);
    if (!ids.length) return;
    // Instant optimistic update in the UI (0ms perceived latency)
    setRules(prev => prev.filter(r => !ids.includes(r.id)));
    try {
      await middlewareApi.rejectAllRules(ids);
    } catch (e) {
      console.warn("Reject all error:", e);
      fetchRules(true); // Re-sync on failure
    }
  };

  const handleSaveEdit = async (ruleId) => {
    try {
      const parsedConfig = JSON.parse(editConfigText);
      await middlewareApi.updateRule(ruleId, parsedConfig);
      setEditingRuleId(null);
      fetchRules(); // Refresh the rules list
    } catch (e) {
      alert("Invalid JSON configuration or failed to save. Error: " + e.message);
    }
  };

  // Derive unique values for dropdowns
  const dqTypes = ['All', ...new Set(rules.map(r => r.dq_type).filter(Boolean))];
  const tableNames = ['All', ...new Set(rules.map(r => r.table_name).filter(Boolean))];

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterTable, searchQuery, rulesPerPage]);

  // Filter rules
  const filteredRules = rules.filter(r => {
    const matchType = filterType === 'All' ? true : r.dq_type === filterType;
    const matchTable = filterTable === 'All' ? true : r.table_name === filterTable;
    const matchSearch = searchQuery === '' ? true : 
      (r.table_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       r.column_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       r.rule_type?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchTable && matchSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRules.length / rulesPerPage);
  const currentRules = filteredRules.slice((currentPage - 1) * rulesPerPage, currentPage * rulesPerPage);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-4">
            DQ Rules Review
          </h1>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowConfigs(!showConfigs)}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-slate-200"
            >
              {showConfigs ? "Hide Custom Configs" : "Manage Custom Configs"}
            </button>
            <button 
              onClick={handleProfile}
              disabled={profiling}
              className="bg-sky-600 hover:bg-sky-700 px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {profiling ? "Profiling..." : "Run Profiler"}
            </button>
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {generating ? "Triggering..." : "Generate New Rules"}
            </button>
          </div>
        </div>

        <div className="flex space-x-4 mb-8 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('review')}
            className={`pb-2 px-1 font-medium transition-colors ${
              activeTab === 'review'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rules Review
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-1 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Generation History
          </button>
        </div>

        {activeTab === 'review' ? (
          <>
            {showConfigs && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8 shadow-xl grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-slate-200">Add New Configuration</h2>
              <p className="text-slate-400 text-sm mb-4">
                Provide specific requirements for rule generation as plain text or upload a PDF document.
              </p>
              <div className="flex flex-col gap-4 mb-4">
                <textarea
                  value={customConfigText}
                  onChange={(e) => setCustomConfigText(e.target.value)}
                  disabled={!!selectedFile}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-sm text-slate-200 h-32 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  placeholder="Type your custom requirements here..."
                />
                <div className="flex items-center gap-4">
                  <span className="text-slate-400 text-sm font-medium">OR upload a PDF:</span>
                  <input 
                    type="file" 
                    accept=".pdf,.txt"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    disabled={customConfigText.length > 0}
                    className="text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {savingConfig ? "Saving..." : "Save Custom Config"}
              </button>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 text-slate-200">Active Configurations</h2>
              {configs.length === 0 ? (
                <div className="text-slate-500 text-sm italic p-4 bg-slate-900/30 rounded-lg border border-slate-700/50">No custom configurations active.</div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {configs.map(conf => (
                    <div key={conf.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        <p className="text-slate-300 text-sm font-mono truncate max-w-sm">{conf.config_text.substring(0, 150)}{conf.config_text.length > 150 ? '...' : ''}</p>
                        <p className="text-slate-500 text-xs mt-1">Uploaded: {new Date(conf.created_at).toLocaleString()}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteConfig(conf.id)}
                        className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
          {/* Toolbar for bulk actions and filtering */}
          <div className="p-4 border-b border-slate-700 bg-slate-900/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto flex-1">
              <input
                type="text"
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 w-full max-w-xs"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400 font-medium">Table:</label>
                <select 
                  value={filterTable}
                  onChange={(e) => setFilterTable(e.target.value)}
                  className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 max-w-[150px]"
                >
                  {tableNames.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400 font-medium">Type:</label>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 max-w-[150px]"
                >
                  {dqTypes.map(type => (
                    <option key={type} value={type}>{type || 'Unknown'}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-sm text-slate-400 font-medium">Rows:</label>
                <select 
                  value={rulesPerPage}
                  onChange={(e) => setRulesPerPage(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleApproveAll}
                disabled={filteredRules.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Approve All ({filteredRules.length})
              </button>
              <button 
                onClick={handleRejectAll}
                disabled={filteredRules.length === 0}
                className="bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">Source</th>
                  <th className="p-4 text-slate-400 font-semibold text-sm uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRules.map(rule => (
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
                    <td className="p-4">
                      {editingRuleId === rule.id ? (
                        <textarea 
                          className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-xs font-mono text-slate-300 resize-y min-h-[60px]"
                          value={editConfigText}
                          onChange={(e) => setEditConfigText(e.target.value)}
                        />
                      ) : (
                        <span className="text-xs font-mono text-slate-300 max-w-xs block truncate" title={JSON.stringify(rule.rule_config)}>
                          {JSON.stringify(rule.rule_config)}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        rule.generated_by === 'agent 1' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                        rule.generated_by === 'agent 2 rule based' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                        rule.generated_by === 'agent 2 llm' ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' : 
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {rule.generated_by || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2 flex-wrap">
                      {editingRuleId === rule.id ? (
                        <>
                          <button 
                            onClick={() => handleSaveEdit(rule.id)}
                            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingRuleId(null)}
                            className="bg-slate-600 hover:bg-slate-700 px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setEditingRuleId(rule.id);
                              setEditConfigText(JSON.stringify(rule.rule_config, null, 2));
                            }}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs font-medium transition-colors text-slate-200"
                          >
                            Edit
                          </button>
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
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {/* Pagination Controls */}
          {filteredRules.length > 0 && !loading && (
            <div className="p-4 border-t border-slate-700 bg-slate-900/30 flex justify-between items-center">
              <span className="text-sm text-slate-400">
                Showing {Math.min((currentPage - 1) * rulesPerPage + 1, filteredRules.length)} to {Math.min(currentPage * rulesPerPage, filteredRules.length)} of {filteredRules.length} rules
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 text-slate-200"
                >
                  Previous
                </button>
                <div className="flex items-center px-4 text-sm font-medium text-slate-300">
                  Page {currentPage} of {totalPages || 1}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 text-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <p>No history available.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-300 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold border-b border-slate-700">Generation Time</th>
                    <th className="p-4 font-semibold border-b border-slate-700">Source</th>
                    <th className="p-4 font-semibold border-b border-slate-700">Total Generated</th>
                    <th className="p-4 font-semibold border-b border-slate-700">Approved</th>
                    <th className="p-4 font-semibold border-b border-slate-700">Rejected</th>
                    <th className="p-4 font-semibold border-b border-slate-700">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {history.map((run, i) => (
                    <tr key={i} className="hover:bg-slate-750 transition-colors">
                      <td className="p-4 text-sm font-medium">{new Date(run.generation_time).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${
                          run.generated_by === 'agent 1' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {run.generated_by || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-sky-400">{run.total_generated}</td>
                      <td className="p-4 text-sm font-bold text-emerald-400">{run.approved_count}</td>
                      <td className="p-4 text-sm font-bold text-red-400">{run.rejected_count}</td>
                      <td className="p-4 text-sm font-bold text-amber-400">{run.pending_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
