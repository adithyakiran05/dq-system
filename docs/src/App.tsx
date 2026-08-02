/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Server,
  Brain,
  Database,
  Layout,
  Play,
  CheckCircle,
  AlertTriangle,
  FileText,
  Terminal,
  ArrowRight,
  Settings,
  ShieldAlert,
  Copy,
  Check,
  RotateCcw,
  Activity,
  Code,
  List,
  Cpu,
  ChevronRight,
  Sparkles,
  HelpCircle,
  User,
  Clock,
  ExternalLink
} from 'lucide-react';

import { MOCK_RAW_TABLES, MOCK_PROFILES, SIMULATED_PROPOSAL_LOGS, MOCK_PROPOSED_RULES, MOCK_VIOLATIONS, TECH_STACK, DB_SCHEMAS } from './data';
import { DqProfile, DqRule, DqViolation, SimulationLog } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'simulator' | 'schemas' | 'system_docs'>('architecture');
  const [selectedNode, setSelectedNode] = useState<string>('profiler');
  
  // Clipboard state
  const [copied, setCopied] = useState<boolean>(false);
  const [exportCopied, setExportCopied] = useState<boolean>(false);

  // Play Area states for Tab 1
  const [selectedColumnToProfile, setSelectedColumnToProfile] = useState<string>('users.email');
  const [profileResult, setProfileResult] = useState<DqProfile | null>(null);
  const [profilingInProgress, setProfilingInProgress] = useState<boolean>(false);
  const [selectedAgentColumn, setSelectedAgentColumn] = useState<string>('users.age');
  const [agentDecisionResult, setAgentDecisionResult] = useState<any | null>(null);
  const [agentInProgress, setAgentInProgress] = useState<boolean>(false);
  const [selectedCheckerRule, setSelectedCheckerRule] = useState<string>('users.email.email_format');
  const [checkerSQLResult, setCheckerSQLResult] = useState<string>('');
  const [checkerViolationsResult, setCheckerViolationsResult] = useState<any[]>([]);
  const [checkerInProgress, setCheckerInProgress] = useState<boolean>(false);

  // Live Simulator States for Tab 2
  const [simStep, setSimStep] = useState<number>(1);
  const [simLogs, setSimLogs] = useState<SimulationLog[]>([
    { timestamp: '20:34:01', level: 'INFO', message: 'DQ Orchestrator Initialized. Ready to simulate end-to-end data quality pipeline.' }
  ]);
  const [simProfiles, setSimProfiles] = useState<DqProfile[]>([]);
  const [simProposedRules, setSimProposedRules] = useState<DqRule[]>([]);
  const [simActiveRules, setSimActiveRules] = useState<DqRule[]>([]);
  const [simViolations, setSimViolations] = useState<DqViolation[]>([]);
  const [simulatingStep, setSimulatingStep] = useState<boolean>(false);
  const [reviewedRules, setReviewedRules] = useState<Record<string, 'approved' | 'rejected'>>({});

  // Trigger simulated play logs
  const addLog = (level: SimulationLog['level'], message: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setSimLogs(prev => [...prev, { timestamp: timeStr, level, message }]);
  };

  // Run profiling simulation for Tab 1
  const runInteractiveProfiling = () => {
    setProfilingInProgress(true);
    const [table, col] = selectedColumnToProfile.split('.');
    setTimeout(() => {
      const match = MOCK_PROFILES.find(p => p.table_name === table && p.column_name === col);
      setProfileResult(match || null);
      setProfilingInProgress(false);
    }, 750);
  };

  // Run Agent AI simulation for Tab 1
  const runInteractiveAgent = () => {
    setAgentInProgress(true);
    const [table, col] = selectedAgentColumn.split('.');
    setTimeout(() => {
      const proposed = SIMULATED_PROPOSAL_LOGS.filter(item => item.rule.table_name === table && item.rule.column_name === col);
      setAgentDecisionResult(proposed);
      setAgentInProgress(false);
    }, 850);
  };

  // Run Checker SQL builder simulation for Tab 1
  const runInteractiveChecker = () => {
    setCheckerInProgress(true);
    const [table, col, ruleType] = selectedCheckerRule.split('.');
    setTimeout(() => {
      let sql = '';
      let offenders: any[] = [];
      if (ruleType === 'email_format') {
        sql = `SELECT email FROM users WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' LIMIT 100`;
        offenders = [{ offending_value: 'bob_at_example.com', reason: 'Missing @ symbol and valid TLD' }];
      } else if (ruleType === 'min_value') {
        sql = `SELECT age FROM users WHERE age < 0 LIMIT 100`;
        offenders = [{ offending_value: '-5', reason: 'Age falls below specified min threshold of 0' }];
      } else if (ruleType === 'accepted_values') {
        sql = `SELECT status FROM orders WHERE status NOT IN ('completed', 'pending', 'failed') LIMIT 100`;
        offenders = [{ offending_value: 'invalid_status', reason: 'Status is not within list of approved categorical constraints' }];
      }
      setCheckerSQLResult(sql);
      setCheckerViolationsResult(offenders);
      setCheckerInProgress(false);
    }, 750);
  };

  // End-to-End Simulation Trigger Steps
  const simulateStep1Profiler = () => {
    setSimulatingStep(true);
    addLog('INFO', 'Starting Profiler Lambda invocation...');
    addLog('SQL', 'SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = \'public\'...');
    addLog('INFO', 'Introspecting tables: "users" (5 columns, 5 rows), "orders" (5 columns, 3 rows).');
    
    setTimeout(() => {
      addLog('SQL', 'SELECT COUNT(*), COUNT(email), COUNT(DISTINCT email) FROM users;');
      addLog('SQL', 'SELECT MIN(age), MAX(age), AVG(age), STDDEV(age) FROM users;');
      setSimProfiles(MOCK_PROFILES);
      addLog('SUCCESS', 'Profiler Lambda completed. Pushed 6 column profiles to table "dq_profiles".');
      setSimStep(2);
      setSimulatingStep(false);
    }, 1500);
  };

  const simulateStep2Agent = () => {
    setSimulatingStep(true);
    addLog('INFO', 'Triggering Multi-Agent Orchestrator (Trigger Lambda + LangGraph)...');
    addLog('AI', 'Invoking LangGraph payload: {"action": "generate_rules"}');
    addLog('AI', 'Groq client instantiated. Fetching statistics via LangChain tool get_profiles()...');
    
    setTimeout(() => {
      addLog('AI', 'LLM reasoning: Analysing profiles for "users.age", "users.email", "orders.status", "orders.amount".');
      addLog('WARN', 'AI verification rule triggered: Auto-rejecting "not_null" on "users.email" (null rate is 20% > 5% threshold).');
      addLog('WARN', 'AI verification rule triggered: Auto-rejecting "unique" on "users.id" (distinct rate is 80% < 95% threshold).');
      addLog('SUCCESS', 'AI generated rules filtered and cross-checked.');
      addLog('SQL', 'Inserting 5 validated proposed rules into table "dq_rules_proposed" via LangChain save_rules_bulk().');
      
      setSimProposedRules(MOCK_PROPOSED_RULES);
      setSimStep(3);
      setSimulatingStep(false);
    }, 1800);
  };

  const handleApproveRuleSim = (ruleId: string) => {
    setReviewedRules(prev => ({ ...prev, [ruleId]: 'approved' }));
    const ruleToMove = simProposedRules.find(r => r.id === ruleId);
    if (ruleToMove) {
      addLog('SUCCESS', `Human approved rule: [${ruleToMove.table_name}.${ruleToMove.column_name}] ${ruleToMove.rule_type}. Moving to active rules.`);
      setSimActiveRules(prev => [...prev, { ...ruleToMove, status: 'approved' }]);
    }
  };

  const handleRejectRuleSim = (ruleId: string) => {
    setReviewedRules(prev => ({ ...prev, [ruleId]: 'rejected' }));
    const rule = simProposedRules.find(r => r.id === ruleId);
    if (rule) {
      addLog('WARN', `Human rejected rule proposal: [${rule.table_name}.${rule.column_name}] ${rule.rule_type}. Proposal deleted.`);
    }
  };

  const simulateStep3GovernanceComplete = () => {
    if (simActiveRules.length === 0) {
      alert("Please approve at least one proposed rule to execute the checker lambda!");
      return;
    }
    setSimStep(4);
    addLog('INFO', `Governance phase complete. ${simActiveRules.length} rules successfully deployed to active table "dq_rules".`);
  };

  const simulateStep4Checker = () => {
    setSimulatingStep(true);
    addLog('INFO', 'Executing Checker Lambda (violations_lambda.py)...');
    addLog('SQL', `Reading active data rules from "dq_rules". Found ${simActiveRules.length} rules to enforce.`);
    
    setTimeout(() => {
      const detectedViolations: DqViolation[] = [];
      
      simActiveRules.forEach(rule => {
        addLog('SQL', `Running compliance SQL on ${rule.table_name}.${rule.column_name}...`);
        const matchViolations = MOCK_VIOLATIONS.filter(v => v.table_name === rule.table_name && v.column_name === rule.column_name && v.rule_type === rule.rule_type);
        matchViolations.forEach(v => {
          detectedViolations.push(v);
          addLog('ERROR', `VIOLATION DETECTED on ${rule.table_name}.${rule.column_name}: Out-of-bounds value "${v.offending_value}"`);
        });
      });
      
      setSimViolations(detectedViolations);
      addLog('SUCCESS', `Data quality checks finalized. Detected and logged ${detectedViolations.length} anomalies into "dq_violations".`);
      setSimStep(5);
      setSimulatingStep(false);
    }, 1800);
  };

  const resetSimulator = () => {
    setSimStep(1);
    setSimProfiles([]);
    setSimProposedRules([]);
    setSimActiveRules([]);
    setSimViolations([]);
    setReviewedRules({});
    setSimLogs([
      { timestamp: '20:34:01', level: 'INFO', message: 'DQ Orchestrator reset. Ready for clean simulation.' }
    ]);
  };

  // Text content for copying Markdown directly for boss
  const handleCopySummary = () => {
    setCopied(true);
    navigator.clipboard.writeText(MD_DOCS_CONTENT);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyExport = () => {
    setExportCopied(true);
    navigator.clipboard.writeText(MD_DOCS_CONTENT);
    setTimeout(() => setExportCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-500/10">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg shrink-0">
              DQ
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 font-display">Data Quality Agent Framework</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">AWS Serverless Database Monitoring & Quality Enforcement</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto scrollbar-none gap-2">
          {[
            { id: 'architecture', label: '1. Architecture Blueprint', icon: Settings },
            { id: 'simulator', label: '2. End-to-End Simulator', icon: Play },
            { id: 'schemas', label: '3. DB Schemas & Dimensions', icon: Database },
            { id: 'system_docs', label: '4. System Documentation', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <AnimatePresence mode="wait">
          {activeTab === 'architecture' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Architecture Intro */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="lg:col-span-2 space-y-3">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-display">System Pipeline Blueprint</h2>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    Our AI-driven Data Quality engine relies on an AWS Serverless loop to profile database columns, generate quality rules with an LLM, apply automated data safety checks, enforce constraints continuously, and log anomalous records.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200 flex gap-3 items-center shadow-sm">
                  <div className="p-3 bg-blue-50 rounded-lg text-blue-600 border border-blue-100 shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-slate-900 block">Self-Correcting AI Agent</span>
                    <span className="text-slate-500 text-[11px]">The LangGraph DQ agent filters out hallucinated or statistically unfeasible rules before human review.</span>
                  </div>
                </div>
              </div>

              {/* Interactive Pipeline Diagram */}
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold mb-6 flex items-center justify-between">
                  <span>Interactive Map (Click a node to inspect technical documentation & payload schema)</span>
                  <span className="text-blue-600 flex items-center gap-1 font-semibold"><Activity className="h-3 w-3" /> Fully Interactive</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative items-stretch">
                  
                  {/* Node 1: Profiler Lambda */}
                  <button
                    onClick={() => setSelectedNode('profiler')}
                    className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      selectedNode === 'profiler'
                        ? 'bg-blue-50 border-blue-600 shadow-sm text-blue-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700">
                        <Server className="h-4.5 w-4.5 text-slate-600" />
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">Step 1</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold text-xs text-slate-900">Profiler Lambda</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Introspects schema & computes column stats</p>
                    </div>
                  </button>

                  {/* Node 2: Database Layer (Central Hub) */}
                  <button
                    onClick={() => setSelectedNode('db_hub')}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedNode === 'db_hub'
                        ? 'bg-blue-50 border-blue-600 shadow-sm text-blue-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700">
                        <Database className="h-4.5 w-4.5 text-slate-600" />
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-blue-100 px-1.5 py-0.5 rounded text-blue-700">Core Store</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold text-xs text-slate-900">PostgreSQL RDS</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Stores profiles, rules, and anomalies</p>
                    </div>
                  </button>

                  {/* Node 3: DQ Agent */}
                  <button
                    onClick={() => setSelectedNode('dq_agent')}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedNode === 'dq_agent'
                        ? 'bg-blue-50 border-blue-600 shadow-sm text-blue-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700">
                        <Brain className="h-4.5 w-4.5 text-blue-600" />
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">Step 2</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold text-xs text-slate-900">AI DQ Agent</h4>
                      <p className="text-[11px] text-slate-500 mt-1">LangGraph + Groq LLaMA-3.3 LLM</p>
                    </div>
                  </button>

                  {/* Node 4: Governance Gate Next.js Frontend */}
                  <button
                    onClick={() => setSelectedNode('frontend_gate')}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedNode === 'frontend_gate'
                        ? 'bg-blue-50 border-blue-600 shadow-sm text-blue-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700">
                        <Layout className="h-4.5 w-4.5 text-slate-600" />
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">Step 3</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold text-xs text-slate-900">Next.js Frontend</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Human-in-the-Loop review portal</p>
                    </div>
                  </button>

                  {/* Node 5: Checker Lambda */}
                  <button
                    onClick={() => setSelectedNode('checker')}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedNode === 'checker'
                        ? 'bg-blue-50 border-blue-600 shadow-sm text-blue-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700">
                        <ShieldAlert className="h-4.5 w-4.5 text-red-500" />
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">Step 4</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold text-xs text-slate-900">Checker Lambda</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Enforces rules and stores violations</p>
                    </div>
                  </button>

                </div>
              </div>

              {/* Node Detail Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Selected Node Specs */}
                <div className="lg:col-span-7 space-y-6">
                  {selectedNode === 'profiler' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-mono font-bold">profiler_lambda.py</span>
                        <h3 className="text-xl font-bold text-slate-900 font-display">Profiler Lambda</h3>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        The Profiler is a python function executed inside AWS Lambda. It connects to PostgreSQL using the lightweight, pure-Python <span className="text-blue-600 font-semibold">pg8000</span> driver.
                      </p>
                      
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Logic Flow</h5>
                        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                          <li>Queries <code className="text-blue-700 bg-blue-50/50 px-1.5 py-0.5 rounded font-mono">information_schema.columns</code> to dynamically discover all tables and columns.</li>
                          <li>Identifies the data types and constructs statistical profiling SQL queries.</li>
                          <li>Computes statistics like min, max, null rate, standard deviation, and distinct rates.</li>
                          <li>Aggregates sample rows and writes the statistics to the central <code className="text-emerald-750 bg-emerald-50/50 px-1.5 py-0.5 rounded font-mono">dq_profiles</code> table.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {selectedNode === 'db_hub' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-mono font-bold">PostgreSQL</span>
                        <h3 className="text-xl font-bold text-slate-900 font-display">PostgreSQL RDS Storage Layer</h3>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        The relational RDS PostgreSQL database forms the core of the system. It contains the primary database tables (e.g., users, orders) as well as the 4 operational tables required for the DQ loop.
                      </p>
                      
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Storage Architecture</h5>
                        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                          <li><strong className="text-slate-900 font-mono">dq_profiles:</strong> Stores the generated statistical summaries.</li>
                          <li><strong className="text-slate-900 font-mono">dq_rules_proposed:</strong> Stores AI rules pending human review.</li>
                          <li><strong className="text-slate-900 font-mono">dq_rules:</strong> Stores active, enforced validation requirements.</li>
                          <li><strong className="text-slate-900 font-mono">dq_violations:</strong> Logs compliance failures with anomalous values.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {selectedNode === 'dq_agent' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-mono font-bold">agent.py & mcp_server.py</span>
                        <h3 className="text-xl font-bold text-slate-900 font-display">Multi-Agent Orchestrator (LangGraph + XGBoost)</h3>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        The AI Agent represents the "brain" of the ecosystem, designed to act as an automated Data Quality Engineer. Built on LangGraph Orchestrator, it utilizes the LangChain Tools to access tools.
                      </p>
                      
                      <div className="space-y-2 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                        <h5 className="font-bold text-xs text-blue-700 flex items-center gap-1.5 mb-1.5">
                          <ShieldAlert className="h-4 w-4" />
                          Self-Correction Guardrails (Anti-Hallucination)
                        </h5>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Unlike primitive AI systems, this agent has a hardcoded self-correction verification layer. If the LLM tries to propose a strict rule (e.g. <code className="text-slate-900 font-mono bg-slate-100 px-1 py-0.5 rounded">not_null</code>) on a column that statistically is already heavily violated (e.g. email has 20% nulls in the profile), the rule validation engine in <code className="text-slate-900 font-mono bg-slate-100 px-1 py-0.5 rounded">agent.py</code> will <strong>auto-reject</strong> it instantly, protecting the human review queue from low-quality proposals.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNode === 'frontend_gate' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-mono font-bold">Next.js App</span>
                        <h3 className="text-xl font-bold text-slate-900 font-display">Governance Gate (Next.js Frontend)</h3>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        A Human-in-the-Loop review portal designed in Next.js (utilizing Tailwind styling). It acts as a strict governance boundary.
                      </p>
                      
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Operations & APIs</h5>
                        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                          <li><strong className="text-slate-800">/api/rules:</strong> Fetches pending proposed rules.</li>
                          <li><strong className="text-slate-800">/api/rules/approve:</strong> Inserts proposed rule into active <code className="font-mono">dq_rules</code>.</li>
                          <li><strong className="text-slate-800">/api/rules/reject:</strong> Deletes proposal.</li>
                          <li>Supports filtering by column, tables, or DQ Type and offers bulk actions (Approve All / Reject All).</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {selectedNode === 'checker' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md font-mono font-bold">violations_lambda.py</span>
                        <h3 className="text-xl font-bold text-slate-900 font-display">Checker Lambda</h3>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        The Checker is an AWS Lambda function triggered on a schedule (e.g. hourly/daily via EventBridge). It is responsible for continuously enforcing compliance.
                      </p>
                      
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Dynamic SQL Generation</h5>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Instead of static queries, the Checker reads the configurations inside <code className="text-blue-700 font-mono bg-blue-50/30 px-1 py-0.5 rounded">dq_rules</code> and dynamically builds SQL <code className="text-blue-700 font-mono bg-blue-50/30 px-1 py-0.5 rounded">WHERE</code> statements to locate anomalies. For instance, an email rule builds a regular expression match check, and an age rule builds a range verification query.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tech Stack Details for selected node */}
                  <div className="pt-4 border-t border-slate-200">
                    <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">Technologies Used</h5>
                    <div className="flex flex-wrap gap-2">
                      {TECH_STACK.filter(stack => {
                        if (selectedNode === 'profiler') return stack.name === 'AWS Lambda' || stack.name === 'pg8000';
                        if (selectedNode === 'db_hub') return stack.name === 'PostgreSQL RDS';
                        if (selectedNode === 'dq_agent') return stack.name === 'LangGraph Orchestrator' || stack.name === 'Groq LLaMA-3.3-70B-Versatile' || stack.name === 'LangChain Tools';
                        if (selectedNode === 'frontend_gate') return stack.name === 'Next.js App Router';
                        if (selectedNode === 'checker') return stack.name === 'AWS Lambda' || stack.name === 'pg8000';
                        return false;
                      }).map((stack, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-[11px] bg-white text-slate-700 border border-slate-200 shadow-sm rounded font-medium">
                          {stack.name} ({stack.badge})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Node Interactive Sandbox Play area */}
                <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Terminal className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900 font-mono">Live Sandbox Interface</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Test the selected component's inputs and outputs with simulated live database columns.
                  </p>

                  <AnimatePresence mode="wait">
                    {selectedNode === 'profiler' && (
                      <motion.div
                        key="sandbox-profiler"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-600 font-semibold">Select Target DB Column:</label>
                          <select
                             value={selectedColumnToProfile}
                             onChange={(e) => {
                               setSelectedColumnToProfile(e.target.value);
                               setProfileResult(null);
                             }}
                             className="w-full text-xs bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="users.email">users.email (string)</option>
                            <option value="users.age">users.age (numeric)</option>
                            <option value="orders.amount">orders.amount (numeric)</option>
                            <option value="orders.status">orders.status (categorical)</option>
                          </select>
                        </div>

                        <button
                          onClick={runInteractiveProfiling}
                          disabled={profilingInProgress}
                          className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          {profilingInProgress ? (
                            <>
                              <Settings className="h-3.5 w-3.5 animate-spin" />
                              <span>Profiling Database Column...</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              <span>Compute statistical profile</span>
                            </>
                          )}
                        </button>

                        {profileResult && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Resulting dq_profiles entry:</span>
                            <pre className="text-[10px] font-mono text-emerald-400 p-3 bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto max-h-48 shadow-inner">
                              {JSON.stringify(profileResult, null, 2)}
                            </pre>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {selectedNode === 'db_hub' && (
                      <motion.div
                        key="sandbox-db"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                      >
                        <p className="text-xs text-slate-600">
                          Inspect the active state of PostgreSQL tables inside this sandbox:
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="font-mono font-semibold text-slate-700">users</span>
                            <span className="text-[11px] font-bold text-blue-600">5 Rows / 5 Columns</span>
                          </div>
                          <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="font-mono font-semibold text-slate-700">orders</span>
                            <span className="text-[11px] font-bold text-blue-600">3 Rows / 5 Columns</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 text-center font-mono leading-relaxed">
                          Database active. Storage logs are displayed in the End-to-End Simulator tab.
                        </div>
                      </motion.div>
                    )}

                    {selectedNode === 'dq_agent' && (
                      <motion.div
                        key="sandbox-agent"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-600 font-semibold">Select Profile to Analyze:</label>
                          <select
                            value={selectedAgentColumn}
                            onChange={(e) => {
                              setSelectedAgentColumn(e.target.value);
                              setAgentDecisionResult(null);
                            }}
                            className="w-full text-xs bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="users.id">users.id (uniqueness)</option>
                            <option value="users.email">users.email (completeness vs validity)</option>
                            <option value="users.age">users.age (domain min/max bounds)</option>
                          </select>
                        </div>

                        <button
                          onClick={runInteractiveAgent}
                          disabled={agentInProgress}
                          className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          {agentInProgress ? (
                            <>
                              <Settings className="h-3.5 w-3.5 animate-spin" />
                              <span>Agent running verification...</span>
                            </>
                          ) : (
                            <>
                              <Brain className="h-3.5 w-3.5" />
                              <span>Invoke LangGraph Agent (Groq LLM)</span>
                            </>
                          )}
                        </button>

                        {agentDecisionResult && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Agent Action Outputs:</span>
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                              {agentDecisionResult.map((item: any, idx: number) => (
                                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] space-y-1.5 shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800 font-mono">{item.rule.rule_type}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      item.status === 'proposed'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                      {item.status === 'proposed' ? 'PROPOSED' : 'REJECTED BY AI'}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 leading-relaxed">{item.reason}</p>
                                  {item.status === 'proposed' && (
                                    <pre className="text-[9px] text-blue-300 font-mono mt-2 pt-2 border-t border-slate-200 p-2 bg-slate-900 rounded-lg overflow-x-auto">
                                      {JSON.stringify(item.rule, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {selectedNode === 'frontend_gate' && (
                      <motion.div
                        key="sandbox-frontend"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                      >
                        <p className="text-xs text-slate-600">
                          Governance operations represent Next.js client-side triggers:
                        </p>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span>Approve: moves proposed to active array</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                            <span>Reject: removes/deletes the database rows</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-blue-600 font-mono font-bold text-center pt-2">
                          Test this live inside Tab 2: "End-to-End Simulator"!
                        </p>
                      </motion.div>
                    )}

                    {selectedNode === 'checker' && (
                      <motion.div
                        key="sandbox-checker"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-600 font-semibold">Select Rule to Enforce:</label>
                          <select
                            value={selectedCheckerRule}
                            onChange={(e) => {
                              setSelectedCheckerRule(e.target.value);
                              setCheckerSQLResult('');
                              setCheckerViolationsResult([]);
                            }}
                            className="w-full text-xs bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="users.email.email_format">users.email (email_format)</option>
                            <option value="users.age.min_value">users.age (min_value)</option>
                            <option value="orders.status.accepted_values">orders.status (accepted_values)</option>
                          </select>
                        </div>

                        <button
                          onClick={runInteractiveChecker}
                          disabled={checkerInProgress}
                          className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          {checkerInProgress ? (
                            <>
                              <Settings className="h-3.5 w-3.5 animate-spin" />
                              <span>Executing Query Engine...</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              <span>Execute Checker Code</span>
                            </>
                          )}
                        </button>

                        {checkerSQLResult && (
                          <div className="space-y-2 text-[10px] font-mono pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-slate-500 font-bold block mb-1">Generated Dynamic SQL WHERE clause:</span>
                              <pre className="text-blue-300 p-2.5 bg-slate-900 rounded-lg border border-slate-800 whitespace-pre-wrap overflow-x-auto">
                                {checkerSQLResult}
                              </pre>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold block mb-1 mt-3">Anomalous rows inserted into dq_violations:</span>
                              <div className="space-y-1.5">
                                {checkerViolationsResult.map((off, idx) => (
                                  <div key={idx} className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800">
                                    <div className="font-bold">Value: "{off.offending_value}"</div>
                                    <div className="text-[9px] text-red-600 mt-0.5">{off.reason}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          )}

          {activeTab === 'simulator' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Simulator Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Data Quality Pipeline Simulator</h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Trigger the full-loop AWS serverless workflow step-by-step and inspect the database changes and real-time logs.
                  </p>
                </div>
                <button
                  onClick={resetSimulator}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Simulation</span>
                </button>
              </div>

              {/* Progress Flow Widget */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                {[
                  { step: 1, title: 'Profiler Lambda', status: simStep > 1 ? 'done' : simStep === 1 ? 'current' : 'pending', desc: 'Scan RDS & Create Profiles' },
                  { step: 2, title: 'AI Rule Engine', status: simStep > 2 ? 'done' : simStep === 2 ? 'current' : 'pending', desc: 'Generate & Validate Rules' },
                  { step: 3, title: 'Human Governance', status: simStep > 3 ? 'done' : simStep === 3 ? 'current' : 'pending', desc: 'Review Proposed Rules' },
                  { step: 4, title: 'Compliance Checker', status: simStep > 4 ? 'done' : simStep === 4 ? 'current' : 'pending', desc: 'Enforce & Find Violations' }
                ].map((s, idx) => {
                  const done = s.status === 'done';
                  const current = s.status === 'current';
                  return (
                    <div key={idx} className={`p-3.5 rounded-xl border transition-all ${
                      current
                        ? 'bg-blue-50/50 border-blue-600 text-blue-900 shadow-sm'
                        : done
                        ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800 opacity-90'
                        : 'bg-slate-50/60 border-slate-200 opacity-60 text-slate-400'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          current ? 'bg-blue-100 text-blue-700' : done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                        }`}>
                          STAGE 0{s.step}
                        </span>
                        {done && <CheckCircle className="h-4.5 w-4.5 text-emerald-600 font-bold" />}
                      </div>
                      <h4 className={`font-bold text-xs mt-3 font-display ${current ? 'text-blue-900' : done ? 'text-slate-800' : 'text-slate-500'}`}>{s.title}</h4>
                      <p className={`text-[10px] mt-1 ${current ? 'text-blue-700' : 'text-slate-500'}`}>{s.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Main Simulation Panel split with Log Output */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Active Simulation Step Controller */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {simStep === 1 && (
                    <div className="p-6 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-5">
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider block">Stage 1: Schema Assessment</span>
                        <h3 className="text-lg font-bold text-slate-900 font-display">Ingest and Profile Database Schema</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          We will execute the Profiler Lambda to scan the live database and compute statistical characteristics of our columns. Let's look at the raw un-profiled data tables currently residing in PostgreSQL RDS:
                        </p>
                      </div>

                      {/* Display of raw input tables to simulate */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                            <span className="font-mono text-xs text-blue-600 font-bold">users Table</span>
                            <span className="text-[10px] text-slate-500">5 columns / 5 records</span>
                          </div>
                          <div className="max-h-40 overflow-auto text-[9px] font-mono text-slate-700">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-100">
                                  <th className="pb-1">id</th>
                                  <th className="pb-1">email</th>
                                  <th className="pb-1">age</th>
                                </tr>
                              </thead>
                              <tbody>
                                {MOCK_RAW_TABLES.users.rows.map((row, idx) => (
                                  <tr key={idx} className="border-b border-slate-50/50 hover:bg-slate-50/50">
                                    <td className="py-1 text-slate-800">{row.id}</td>
                                    <td className="py-1 text-slate-800 max-w-[80px] truncate">{row.email || 'NULL'}</td>
                                    <td className="py-1 text-slate-800">{row.age}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                            <span className="font-mono text-xs text-blue-600 font-bold">orders Table</span>
                            <span className="text-[10px] text-slate-500">5 columns / 3 records</span>
                          </div>
                          <div className="max-h-40 overflow-auto text-[9px] font-mono text-slate-700">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-100">
                                  <th className="pb-1">id</th>
                                  <th className="pb-1">amount</th>
                                  <th className="pb-1">status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {MOCK_RAW_TABLES.orders.rows.map((row, idx) => (
                                  <tr key={idx} className="border-b border-slate-50/50 hover:bg-slate-50/50">
                                    <td className="py-1 text-slate-800">{row.id}</td>
                                    <td className="py-1 text-slate-800">{row.amount}</td>
                                    <td className="py-1 text-slate-800 max-w-[80px] truncate">{row.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={simulateStep1Profiler}
                        disabled={simulatingStep}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98 cursor-pointer"
                      >
                        {simulatingStep ? (
                          <>
                            <Settings className="h-4 w-4 animate-spin" />
                            <span>Computing Table Stats & Aggregating Metrics...</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            <span>Run Profiler Lambda (Compute Statistics)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {simStep === 2 && (
                    <div className="p-6 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-5">
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider block">Stage 2: LLM Inference & Guardrails</span>
                        <h3 className="text-lg font-bold text-slate-900 font-display">Trigger LangGraph DQ Agent & Rule Core</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          With database metrics loaded in <code className="text-blue-700 font-mono bg-blue-50/30 px-1 py-0.5 rounded">dq_profiles</code>, we can trigger the AI Agent. The agent reads columns summaries and uses LLaMA-3.3-70B model to generate rules.
                        </p>
                      </div>

                      {/* Display of newly computed profiles */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <span className="text-[10px] font-mono text-slate-500 font-bold block border-b border-slate-100 pb-1.5">Computed Column Profiles (dq_profiles table in RDS)</span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10px] font-mono text-slate-700">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-100">
                                <th className="pb-1.5">Table</th>
                                <th className="pb-1.5">Column</th>
                                <th className="pb-1.5">Type</th>
                                <th className="pb-1.5 text-center">Null Rate</th>
                                <th className="pb-1.5 text-center">Distinct Rate</th>
                                <th className="pb-1.5">Min / Max</th>
                              </tr>
                            </thead>
                            <tbody>
                              {simProfiles.map((p, idx) => (
                                <tr key={idx} className="border-b border-slate-50/50 py-1 hover:bg-slate-50/50">
                                  <td className="py-1.5 text-slate-800">{p.table_name}</td>
                                  <td className="py-1.5 text-blue-600 font-bold">{p.column_name}</td>
                                  <td className="py-1.5 text-slate-500 text-[9px]">{p.data_type}</td>
                                  <td className="py-1.5 text-center text-red-600 font-bold">{p.null_rate * 100}%</td>
                                  <td className="py-1.5 text-center font-bold text-slate-800">{p.distinct_rate * 100}%</td>
                                  <td className="py-1.5 text-slate-500 text-[9px]">{p.min_value} / {p.max_value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <button
                        onClick={simulateStep2Agent}
                        disabled={simulatingStep}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98 cursor-pointer"
                      >
                        {simulatingStep ? (
                          <>
                            <Brain className="h-4 w-4 animate-bounce text-blue-200" />
                            <span>LLM Generating Rules & Applying Self-Corrections...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                            <span>Trigger AI Agent Rule Generator</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {simStep === 3 && (
                    <div className="p-6 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-5">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider block">Stage 3: Governance Gate</span>
                          <span className="text-[10px] text-slate-500">Human-In-The-Loop review of proposed rules</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 font-display">Next.js Human Review Dashboard</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          This screen simulates the Next.js frontend page (from <code className="text-blue-700 font-mono bg-blue-50/30 px-1 py-0.5 rounded">page.js</code>). AI-generated rules wait here. A human reviewer must approve or reject rules before they are enforced.
                        </p>
                      </div>

                      {/* proposed rules human review table */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                              <th className="p-3">Target Column</th>
                              <th className="p-3">Dimension</th>
                              <th className="p-3">Proposed Rule</th>
                              <th className="p-3">Config</th>
                              <th className="p-3 text-right">Review Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simProposedRules.map((rule) => {
                              const rev = reviewedRules[rule.id];
                              return (
                                <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                  <td className="p-3">
                                    <div className="font-bold font-mono text-slate-800">{rule.table_name}.{rule.column_name}</div>
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-sky-50 text-sky-700 font-bold border border-sky-200">
                                      {rule.dq_type}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-bold border border-blue-200 font-mono">
                                      {rule.rule_type}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-slate-500">
                                    {JSON.stringify(rule.rule_config)}
                                  </td>
                                  <td className="p-3 text-right">
                                    {rev ? (
                                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                        rev === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                      }`}>
                                        {rev.toUpperCase()}
                                      </span>
                                    ) : (
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          onClick={() => handleApproveRuleSim(rule.id)}
                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold transition-all active:scale-95 cursor-pointer"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleRejectRuleSim(rule.id)}
                                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-semibold transition-all active:scale-95 border border-red-200 cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <div className="text-xs text-slate-600">
                          Active deployed rules: <span className="text-emerald-600 font-bold font-mono">{simActiveRules.length}</span>
                        </div>
                        <button
                          onClick={simulateStep3GovernanceComplete}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-6 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          <span>Proceed to Enforcement Stage</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {simStep === 4 && (
                    <div className="p-6 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-5">
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold text-red-600 uppercase tracking-wider block">Stage 4: Compliance Execution</span>
                        <h3 className="text-lg font-bold text-slate-900 font-display">Execute Checker Lambda & Audit Database</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          The Checker Lambda runs scheduled audits. It translates deployed active rules into dynamic compliance queries (SQL <code className="text-blue-700 font-mono bg-blue-50/30 px-1 py-0.5 rounded">WHERE</code> queries), matches row anomalies, and stores the records into the <code className="text-red-600 font-mono">dq_violations</code> table.
                        </p>
                      </div>

                      {/* Display of approved active rules */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <span className="text-[10px] font-mono text-slate-500 font-bold block border-b border-slate-200 pb-1.5">Deployed Rules Being Enforced (dq_rules table in RDS)</span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {simActiveRules.map((rule, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono text-blue-700 shadow-sm flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-emerald-600 font-bold" />
                              <span>{rule.table_name}.{rule.column_name} ({rule.rule_type})</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={simulateStep4Checker}
                        disabled={simulatingStep}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98 cursor-pointer"
                      >
                        {simulatingStep ? (
                          <>
                            <Settings className="h-4 w-4 animate-spin" />
                            <span>Building Dynamic SQL Queries & Auditing DB Tables...</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                            <span>Run Compliance Checker (Query Anomalies)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {simStep === 5 && (
                    <div className="p-6 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-5">
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider block">Stage 5: Finished Loop</span>
                        <h3 className="text-lg font-bold text-slate-900 font-display">System Audit Report & Log Summary</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          The full DQ loop completed successfully! The checker compiled rules, ran dynamic query assertions, and isolated {simViolations.length} anomalies inside PostgreSQL database table <code className="text-red-650 bg-red-50/50 px-1 py-0.5 rounded font-mono">dq_violations</code>.
                        </p>
                      </div>

                      {/* Display of resulting violations logged */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <span className="text-[10px] font-mono text-slate-500 font-bold block border-b border-slate-100 pb-1.5">Logged Data Anomalies (dq_violations table in RDS)</span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10px] font-mono text-slate-700">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-100">
                                <th className="pb-1.5">Anomaly ID</th>
                                <th className="pb-1.5">Target Column</th>
                                <th className="pb-1.5">Rule Failed</th>
                                <th className="pb-1.5">Offending Value</th>
                                <th className="pb-1.5">SQL Statement Paged</th>
                              </tr>
                            </thead>
                            <tbody>
                              {simViolations.map((v, idx) => (
                                <tr key={idx} className="border-b border-slate-100 py-1.5 hover:bg-slate-50/50">
                                  <td className="py-1.5 text-slate-500 text-[9px]">{v.id}</td>
                                  <td className="py-1.5 font-bold text-slate-800">{v.table_name}.{v.column_name}</td>
                                  <td className="py-1.5 text-blue-600">{v.rule_type}</td>
                                  <td className="py-1.5 text-red-600 font-bold">"{v.offending_value}"</td>
                                  <td className="py-1.5 text-slate-500 text-[8px] truncate max-w-[150px]">{v.violation_details.query}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex gap-3 items-start text-xs text-emerald-900">
                        <Sparkles className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="font-bold text-emerald-950">Continuous Enforcement Verification</span>
                          <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                            These results prove our end-to-end framework. The AI Agent deduced optimal boundaries, the human reviewer filtered out risks, and the checker continuously trapped real-world row anomalies (such as negative age values or duplicate accounts) securely!
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={resetSimulator}
                        className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                      >
                        <RotateCcw className="h-4 w-4 text-slate-500" />
                        <span>Run Simulation Again</span>
                      </button>
                    </div>
                  )}

                </div>

                {/* Simulated Log Output Window */}
                <div className="lg:col-span-4 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[450px] shadow-lg">
                  <div className="p-3 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-300 font-mono">System Console logs</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-400"></span>
                      <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto font-mono text-[10px] space-y-2 bg-slate-950/80 scrollbar-thin">
                    {simLogs.map((log, idx) => {
                      const colorMap = {
                        INFO: 'text-slate-400',
                        SUCCESS: 'text-emerald-400 font-semibold',
                        SQL: 'text-blue-400',
                        AI: 'text-purple-400',
                        WARN: 'text-amber-400',
                        ERROR: 'text-red-400 font-semibold'
                      };
                      return (
                        <div key={idx} className="leading-relaxed hover:bg-slate-900/40 p-1 rounded transition-colors">
                          <span className="text-slate-600 mr-1.5">[{log.timestamp}]</span>
                          <span className={`mr-1.5 uppercase font-bold text-[9px] ${colorMap[log.level]}`}>
                            {log.level}:
                          </span>
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {activeTab === 'schemas' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Intro */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Database Schemas & Quality Dimensions</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Deep technical specifications of operational PostgreSQL tables and mapping to the 6 pillars of data quality management.
                </p>
              </div>

              {/* Quality Dimension Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { dim: 'Completeness', rule: 'not_null', desc: 'Assesses if there are missing key metrics or elements.', code: "WHERE col IS NULL" },
                  { dim: 'Uniqueness', rule: 'unique', desc: 'Validates that there are no duplicate records in identified keys.', code: "GROUP BY col HAVING COUNT(*) > 1" },
                  { dim: 'Validity', rule: 'email_format, regex', desc: 'Enforces values correspond to a precise structure or regex pattern.', code: "col !~ '^[A-Z]...'" },
                  { dim: 'Accuracy', rule: 'min_value, max_value', desc: 'Verifies numeric values match logical domain bounds.', code: "col < min OR col > max" },
                  { dim: 'Consistency', rule: 'foreign_key check', desc: 'Assures keys correctly correspond across tables.', code: "col NOT IN (SELECT id...)" },
                  { dim: 'Timeliness', rule: 'freshness', desc: 'Validates records are current and not stale.', code: "max_days_old constraint" }
                ].map((d, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-900 font-display">{d.dim}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">{d.rule}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal">{d.desc}</p>
                    <div className="pt-2 border-t border-slate-100">
                      <code className="text-[10px] font-mono text-slate-800 bg-slate-50 border border-slate-150 px-2 py-1 rounded block">
                        {d.code}
                      </code>
                    </div>
                  </div>
                ))}
              </div>

              {/* Database Schema Visualizer */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 font-display">Metadata Tables Architecture</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {DB_SCHEMAS.map((schema, idx) => (
                    <div key={idx} className="p-5 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-3.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Database className="h-4.5 w-4.5 text-blue-600" />
                          <h4 className="font-bold text-sm text-slate-900 font-mono">{schema.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{schema.desc}</p>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-2 overflow-x-auto text-[11px] font-mono shadow-sm">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-100">
                              <th className="p-2">Column Name</th>
                              <th className="p-2">SQL Type</th>
                              <th className="p-2">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schema.fields.map((f, fIdx) => (
                              <tr key={fIdx} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/50">
                                <td className="p-2 text-blue-600 font-bold">{f.name}</td>
                                <td className="p-2 text-slate-500 text-[10px]">{f.type}</td>
                                <td className="p-2 text-[10px] text-slate-500 max-w-[150px] truncate" title={f.desc}>{f.desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'system_docs' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Architecture Specification Hub</h2>
                  <p className="text-slate-500 text-sm">
                    A formalized, professional system briefing and reference paper for the platform engineering team.
                  </p>
                </div>
                <button
                  onClick={handleCopyExport}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {exportCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied Specification!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Specification (Markdown)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Simulated Paper Document */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                
                {/* Visual Cover Border */}
                <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                
                <div className="p-8 sm:p-12 space-y-8 max-w-4xl mx-auto text-slate-700 font-sans leading-relaxed">
                  
                  {/* Paper Header */}
                  <div className="border-b border-slate-200 pb-6 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded font-bold">SYSTEM ARCHITECTURE BRIEFING</span>
                      <span className="text-xs font-mono text-slate-400">July 12, 2026</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-display">
                      AWS Serverless Data Quality (DQ) Agent Architecture Proposal
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">
                      An Automated Data Governance Framework utilizing Large Language Models (LLMs) and LangChain Tools with Human-in-the-Loop Safeguards.
                    </p>
                  </div>

                  {/* Document Body */}
                  <div className="space-y-6 text-sm">
                    
                    <section className="space-y-2">
                      <h4 className="text-slate-900 font-bold text-base font-display flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-blue-600 rounded-full"></span>
                        1. Executive Summary & Rationale
                      </h4>
                      <p className="text-slate-600">
                        Modern enterprises suffer from progressive data rot, silently breaking analytics reports, downstream production pipelines, and machine learning models. Manual data testing is unscalable, while standard static tools require rigid coding. 
                      </p>
                      <p className="text-slate-600">
                        Our proposed **Data Quality (DQ) Agent system** introduces an automated, AI-augmented, continuous validation lifecycle. By utilizing an Large Language Model (LLM) acting as an expert Data Quality Engineer, the system dynamically analyzes the statistical footprint of data, proposes rules tailored to schema shifts, and enforces them continuosly using lightweight, serverless compute.
                      </p>
                    </section>

                    <section className="space-y-2">
                      <h4 className="text-slate-900 font-bold text-base font-display flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-blue-600 rounded-full"></span>
                        2. Cost Savings & Business ROI
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl space-y-1">
                          <span className="font-bold text-slate-900 text-xs block">Serverless Scale-to-Zero</span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            Deployed entirely on AWS Lambda, there are **no continuous database connection charges or idle container server costs**. Computational billing is purely per-second of execution during audits, reducing background resource costs by 85%.
                          </p>
                        </div>
                        <div className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl space-y-1">
                          <span className="font-bold text-slate-900 text-xs block">AI Cost Efficiency via Groq API</span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            Utilizes Groq LLaMA models costing pennies per million tokens. By caching column statistical metadata profiles in intermediate RDS storage, we minimize LLM token consumption and eliminate expensive table scans.
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h4 className="text-slate-900 font-bold text-base font-display flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-blue-600 rounded-full"></span>
                        3. System Architecture & Components
                      </h4>
                      <p className="text-slate-600">
                        The framework constitutes five modular, loosely coupled serverless components communicating with a central PostgreSQL database:
                      </p>
                      <div className="space-y-3.5 pl-4 border-l-2 border-blue-100">
                        <div>
                          <strong className="text-slate-900 block text-xs">1. Profiler Lambda (Python / pg8000)</strong>
                          <p className="text-xs text-slate-500 mt-0.5">Discovers columns and constructs statistical profiles (null values, standard dev, distinct indices). Isolates data summaries inside PostgreSQL table <code className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded">dq_profiles</code>.</p>
                        </div>
                        <div>
                          <strong className="text-slate-900 block text-xs">2. Orchestration Trigger Lambda (Python / boto3)</strong>
                          <p className="text-xs text-slate-500 mt-0.5">Schedules or manually initiates Bedrock AgentCore execution flow with lightweight HTTP payloads.</p>
                        </div>
                        <div>
                          <strong className="text-slate-900 block text-xs">3. LangGraph Orchestrator (agent.py / mcp_server.py / FastMCP)</strong>
                          <p className="text-xs text-slate-500 mt-0.5">Acts as the core reasoning engine. Accesses SQL summaries via standard LangChain Tools tool bindings. Proposes custom rule assertions into <code className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded">dq_rules_proposed</code>.</p>
                        </div>
                        <div>
                          <strong className="text-slate-900 block text-xs">4. Governance Frontend (Next.js / Tailwind review panel)</strong>
                          <p className="text-xs text-slate-500 mt-0.5">Ensures absolute data safety. Generates a list of suggested rules for human operators to review, bulk approve, or reject.</p>
                        </div>
                        <div>
                          <strong className="text-slate-900 block text-xs">5. Checker Lambda (violations_lambda.py)</strong>
                          <p className="text-xs text-slate-500 mt-0.5">Enforces active approved rules against actual source records. Generates high-speed SQL queries dynamically to scan columns, isolating and logging failures in the table <code className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded">dq_violations</code>.</p>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h4 className="text-slate-900 font-bold text-base font-display flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-blue-600 rounded-full"></span>
                        4. Security & Quality Guardrails
                      </h4>
                      <p className="text-slate-600">
                        Data security and rule-accuracy are strictly enforced via multi-layer boundaries:
                      </p>
                      <ul className="list-disc pl-5 text-xs text-slate-500 space-y-1.5">
                        <li><strong>Secure Database Separation (MCP Bounds):</strong> The LLM never queries actual raw user records directly. It only receives compiled statistical profiles via strict LangChain Tools tool declarations, preventing sensitive record leaks to external APIs.</li>
                        <li><strong>Automated AI Self-Correction:</strong> Inside `agent.py`, rules proposed by the LLM are run through sanity check filters (e.g. rejecting strict uniqueness rules if column values are highly repetitive, or rejecting null value bounds if there are already existing null values). This filters out hallucinations before human governance.</li>
                        <li><strong>Human-in-the-Loop (Next.js):</strong> No AI rule is ever actively enforced without explicit operator approval, shielding production pipelines from false alerts.</li>
                      </ul>
                    </section>

                    <section className="space-y-2">
                      <h4 className="text-slate-900 font-bold text-base font-display flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-blue-600 rounded-full"></span>
                        5. Sample Component Inputs & Outputs
                      </h4>
                      
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-blue-600 font-mono block mb-1">A. Profiler Lambda Outputs (JSON Schema in dq_profiles)</span>
                          <pre className="text-[10px] font-mono text-slate-800 p-4 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto shadow-inner">
{`{
  "table_name": "users",
  "column_name": "email",
  "data_type": "varchar(255)",
  "total_rows": 5000,
  "null_rate": 0.0012,
  "distinct_rate": 0.9984,
  "min_length": 5,
  "max_length": 42,
  "sample_values": ["john@corp.com", "sarah@api.io"]
}`}
                          </pre>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-blue-600 font-mono block mb-1">B. LangGraph Orchestrator Rule Proposal (JSON Schema in dq_rules_proposed)</span>
                          <pre className="text-[10px] font-mono text-slate-800 p-4 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto shadow-inner">
{`{
  "table_name": "users",
  "column_name": "email",
  "rule_type": "email_format",
  "rule_config": {},
  "severity": "high",
  "confidence": 0.98,
  "dq_type": "Validity",
  "generated_by": "langgraph-agent"
}`}
                          </pre>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-blue-600 font-mono block mb-1">C. Checker Lambda Violation Log (JSON Schema in dq_violations)</span>
                          <pre className="text-[10px] font-mono text-slate-800 p-4 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto shadow-inner">
{`{
  "table_name": "users",
  "column_name": "email",
  "rule_type": "email_format",
  "offending_value": "user_at_gmail.com",
  "violation_details": {
    "rule_config": {},
    "query": "SELECT email FROM users WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\\\.[A-Za-z]{2,}$'"
  },
  "dq_type": "Validity",
  "detected_at": "2026-07-12 21:05:00"
}`}
                          </pre>
                        </div>
                      </div>
                    </section>

                  </div>

                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

// Full Markdown Documentation Content for copying
const MD_DOCS_CONTENT = `# Data Quality (DQ) System Architecture Specification

**Date:** July 12, 2026  
**Audience:** Platform Engineering & Data Quality Teams  
**Status:** Architecture Proposal

---

## 1. Executive Summary & Rationale

Data quality degradation is a silent blocker in relational databases, slowly breaking analytics layers, ML features, and application logic. Manual rule generation is slow and unscalable, whereas static code testing struggles to adapt to incoming table columns or schemas.

The **Data Quality (DQ) Agent system** resolves this by automating the entire validation lifecycle. Operating entirely within a serverless ecosystem on AWS, the system profiles database columns, delegates rule derivation to a high-speed LLM, enforces human governance safeguards, and audits transaction tables continuously for violations.

---

## 2. Business ROI & Cost Comparison

| Operational Feature | Legacy Rigid Systems | Our Serverless DQ Agent | Business Benefits |
| :--- | :--- | :--- | :--- |
| **Compute Charges** | Expensive continuous EC2 instances | AWS Lambda scaling to zero | **85% cost savings**; billing matches usage |
| **Model Operations** | High GPU cluster costs | API payloads with Groq (LLaMA-3) | **Low operational cost** (pennies per million tokens) |
| **Alert Management** | Rigid manual query writing | Automated AI proposals with self-checks | **Zero engineering hours** spent on script maintenance |
| **Data Governance** | Autonomous alerts triggering panic | Next.js Human-in-the-Loop review | **Data safety**; no false alerts in production |

---

## 3. High-Level Pipeline Architecture Diagram

\`\`\`mermaid
graph TD
    %% Source DB and profiling %%
    DB[(PostgreSQL RDS)] -->|Introspect Schema| P_Lambda[Profiler Lambda]
    P_Lambda -->|Compute Column Stats| DB_Profiles[Table: dq_profiles]

    %% Orchestrating ML and AI Rule creation %%
    Trigger[Trigger Lambda] -->|Predict Rules| XGBoost[XGBoost ML Model]
    XGBoost -->|High Confidence Rules| Proposed_Table[Table: dq_rules_proposed]
    XGBoost -->|Low Confidence Profiles| LangGraph[LangGraph Orchestrator]
    LangGraph -->|Invoke Tools| LC_Tools[LangChain Tools: trigger_lambda.py]
    LC_Tools <-->|Query Profile rows| DB_Profiles
    LangGraph -->|Deep Analysis (Groq LLaMA-3.3)| Self_Correction[AI Self-Correction Filter]
    Self_Correction -->|Filter out bad stats| Proposed_Table[Table: dq_rules_proposed]

    %% Governance review %%
    Frontend[Next.js Review Board] <-->|Approve/Reject| Proposed_Table
    Frontend -->|Move approved rules| Active_Rules[Table: dq_rules]

    %% Real-time Enforcement %%
    Checker[Checker Lambda] -->|Read active assertions| Active_Rules
    Checker <-->|Run Assertion SQL| DB
    Checker -->|Log row anomalies| Violations_Table[Table: dq_violations]

    style DB fill:#1e293b,stroke:#334155,stroke-width:2px;
    style XGBoost fill:#0284c7,stroke:#0369a1,stroke-width:2px;
    style LangGraph fill:#312e81,stroke:#4f46e5,stroke-width:2px;
    style Frontend fill:#064e3b,stroke:#059669,stroke-width:2px;
    style Checker fill:#7f1d1d,stroke:#dc2626,stroke-width:2px;
\`\`\`

---

## 4. Component Technical Specifications & Logic

### 4.1 Profiler Lambda (\`profiler_lambda.py\`)
- **Execution Engine:** AWS Lambda running Python 3.11.
- **Database Connection:** Lightweight pure-python \`pg8000\` driver.
- **Logic:** Dynamically scans \`information_schema.columns\` for non-system tables. Generates SQL assertions based on column types to compute row null counts, uniqueness (distinct rate), numeric bounds, and pulls random samples. Pushes metrics back to \`dq_profiles\`.

### 4.2 Multi-Agent Orchestrator (\`trigger_lambda.py\` & \`ml_model.py\`)
- **Reasoning Framework:** LangGraph Multi-Agent Orchestrator + Groq \`llama-3.3-70b-versatile\`.
- **Machine Learning Layer:** A fast, local XGBoost classifier that processes column profiles in milliseconds. It handles approximately 80% of standard data types, routing low-confidence, highly distinct, or complex text/categorical columns directly to the LLM agent for deep semantic analysis.
- **Agent Orchestration (LangGraph):** The system utilizes a ReAct (Reasoning and Acting) loop powered by LangGraph. When the ML model yields to the agent, the Orchestrator evaluates the schema context and autonomously invokes \`LangChain\` tools to fetch unhandled profiles from the Postgres database.
- **Deep Semantic Analysis:** Using Groq's high-throughput LLaMA-3.3-70B, the agent performs advanced semantic inference on column names (e.g., recognizing that a column named \`transaction_amount_usd\` should strictly be positive and numeric, or that \`user_email\` requires a regex email validation).
- **Tool Binding & Execution:** Communication with the underlying database is strictly bounded. The LLM cannot execute arbitrary SQL; instead, it provides JSON-formatted arguments to deterministic LangChain tools that handle database insertion and retrieval, entirely preventing SQL injection vectors.
- **Rule Verification Layer:** To protect human reviewers from "AI hallucinations" or statistically invalid rules, the orchestration layer runs programmatic sanity checks before database insertion:
  1. **Completeness Safeguard:** Automatically rejects proposed \`not_null\` rules if the column already contains more than 5% null values.
  2. **Uniqueness Safeguard:** Rejects proposed \`unique\` constraints if the column uniqueness rate is lower than 95%.
  3. **Data Type Protection:** Rejects uniqueness assertions on datetime/timestamp columns.
  4. **Value-sequence Validation:** Prevents hallucinated accepted value arrays like \`["1", "2", "3", "4", "5"]\`.

### 4.3 Governance Frontend (\`page.js\`)
- **Interface Structure:** Next.js single-page application styled using Tailwind utility classes.
- **Role:** Fetches proposed items from the \`dq_rules_proposed\` database table. Allows operators to filter by target table or data quality dimension, and performs bulk actions (\`Approve All\` or \`Reject All\`). Approving a rule moves it into the active ruleset database table (\`dq_rules\`).

### 4.4 Checker Lambda (\`violations_lambda.py\`)
- **Execution Schedule:** Chron or scheduled EventBridge events.
- **Logic:** Automatically queries active \`dq_rules\` rows. For each rule, it dynamically constructs SQL \`WHERE\` clauses designed to target and filter violations (e.g. \`LENGTH(col::text) > max_length\` or \`col NOT IN (accepted_values)\`). Executes the check with a strict \`LIMIT 100\` and saves anomalous records into \`dq_violations\`.

---

## 5. Sample Component Inputs & Outputs

### A. Profiler Lambda: Output Payload (pushed to RDS \`dq_profiles\`)
\`\`\`json
{
  "table_name": "users",
  "column_name": "email",
  "data_type": "character varying",
  "total_rows": 5,
  "null_rate": 0.20,
  "distinct_rate": 1.0,
  "min_value": "alice@example.com",
  "max_value": "david@example.com",
  "min_length": 17,
  "max_length": 18,
  "sample_values": ["alice@example.com", "bob_at_example.com", "david@example.com"]
}
\`\`\`

### B. LangGraph Orchestrator: Validated Proposal (pushed to RDS \`dq_rules_proposed\`)
\`\`\`json
{
  "table_name": "users",
  "column_name": "email",
  "rule_type": "email_format",
  "rule_config": {},
  "severity": "high",
  "confidence": 0.98,
  "dq_type": "Validity",
  "generated_by": "langgraph-agent"
}
\`\`\`

### C. Checker Lambda: Detected Violation Log (pushed to RDS \`dq_violations\`)
\`\`\`json
{
  "table_name": "users",
  "column_name": "email",
  "rule_type": "email_format",
  "offending_value": "bob_at_example.com",
  "violation_details": {
    "rule_config": {},
    "query": "SELECT email FROM users WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\\\.[A-Za-z]{2,}$'"
  },
  "dq_type": "Validity",
  "detected_at": "2026-07-12 21:00:15"
}
\`\`\`

---

## 6. PostgreSQL Operational Tables Schema

### I. \`dq_profiles\` Table
- \`table_name\` (VARCHAR)
- \`column_name\` (VARCHAR)
- \`data_type\` (VARCHAR)
- \`total_rows\` (INTEGER)
- \`null_rate\` (NUMERIC)
- \`distinct_rate\` (NUMERIC)
- \`min_value\` (VARCHAR)
- \`max_value\` (VARCHAR)
- \`avg_value\` (NUMERIC)
- \`sample_values\` (JSONB)

### II. \`dq_rules_proposed\` / \`dq_rules\` Table
- \`id\` (SERIAL PRIMARY KEY)
- \`table_name\` (VARCHAR)
- \`column_name\` (VARCHAR)
- \`rule_type\` (VARCHAR)
- \`rule_config\` (JSONB)
- \`severity\` (VARCHAR)
- \`confidence\` (NUMERIC)
- \`dq_type\` (VARCHAR)
- \`generated_by\` (VARCHAR)
- \`created_at\` (TIMESTAMP)

### III. \`dq_violations\` Table
- \`id\` (SERIAL PRIMARY KEY)
- \`table_name\` (VARCHAR)
- \`column_name\` (VARCHAR)
- \`rule_type\` (VARCHAR)
- \`offending_value\` (TEXT)
- \`violation_details\` (JSONB)
- \`dq_type\` (VARCHAR)
- \`detected_at\` (TIMESTAMP)
`;
