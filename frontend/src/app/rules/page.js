'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [rules, setRules] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [customConfigText, setCustomConfigText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [showManageConfigs, setShowManageConfigs] = useState(false);

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

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/configs/list');
      const data = await res.json();
      setConfigs(data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchConfigs();
    
    // Poll every 5 seconds for real-time updates from AgentCore
    const interval = setInterval(() => {
      fetchRules(true);
      fetchConfigs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

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
        
        // 1. Get Presigned URL
        const presignRes = await fetch(process.env.NEXT_PUBLIC_PRESIGNED_URL_API || 'http://localhost:8000/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.type
          })
        });
        
        if (!presignRes.ok) throw new Error("Failed to get presigned URL");
        const { url } = await presignRes.json();
        
        // 2. Upload directly to S3
        const uploadRes = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': selectedFile.type
          },
          body: selectedFile
        });
        
        if (!uploadRes.ok) throw new Error("Failed to upload to S3");
        alert("File uploaded successfully! Processing will happen in the background.");
        setSelectedFile(null);
        setTimeout(fetchConfigs, 3000); // Wait for Lambda to process
        
      } else {
        // Plain text flow directly to Lambda
        const res = await fetch(process.env.NEXT_PUBLIC_PROCESSOR_API || '/api/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config_text: customConfigText })
        });
        if (!res.ok) throw new Error("Failed to save configs");
        alert("Custom configurations saved successfully!");
        setCustomConfigText('');
        fetchConfigs();
      }
    } catch (e) {
      console.error(e);
      alert("Error saving configs: " + e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteConfig = async (id) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    try {
      await fetch('/api/configs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: id })
      });
      fetchConfigs();
    } catch (e) {
      console.error("Failed to delete config:", e);
    }
  };

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
          <div className="flex gap-4">
            <button 
              onClick={() => setShowAddConfig(!showAddConfig)}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-slate-200"
            >
              {showAddConfig ? "Hide Add Config" : "Add Custom Config"}
            </button>
            <button 
              onClick={() => setShowManageConfigs(!showManageConfigs)}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-slate-200"
            >
              {showManageConfigs ? "Hide Manage Configs" : "Manage Configs"}
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

        {showAddConfig && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8 shadow-xl">
          <h2 className="text-xl font-semibold mb-2 text-slate-200">Custom Business Constraints (Optional)</h2>
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
            {savingConfig ? "Saving..." : "Save Custom Configs"}
          </button>
        </div>
        )}

        {showManageConfigs && configs.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-slate-200">Active Configurations</h2>
            <div className="space-y-3">
              {configs.map(conf => (
                <div key={conf.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex justify-between items-center">
                  <div className="flex-1 pr-4">
                    <p className="text-slate-300 text-sm font-mono truncate max-w-4xl">{conf.config_text.substring(0, 150)}{conf.config_text.length > 150 ? '...' : ''}</p>
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
          </div>
        )}

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
