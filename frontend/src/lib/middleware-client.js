/**
 * Client for interacting with the Standalone Middleware Service.
 * Automatically handles baseUrl, tenant header forwarding, and standard JSON serialization.
 */

const MIDDLEWARE_URL = process.env.NEXT_PUBLIC_MIDDLEWARE_URL || 'http://localhost:8000';

async function fetchFromMiddleware(endpoint, options = {}) {
  const url = `${MIDDLEWARE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // If a tenant ID is stored in localStorage or cookies, attach it:
  if (typeof window !== 'undefined') {
    const tenantId = localStorage.getItem('tenant_id') || 'default';
    headers['X-Tenant-ID'] = tenantId;

    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.detail || `Middleware request failed with status ${response.status}`);
  }

  return data;
}

export const middlewareApi = {
  // Dashboard
  getMetrics: () => fetchFromMiddleware('/api/v1/dashboard/metrics'),
  getTables: () => fetchFromMiddleware('/api/v1/dashboard/tables'),

  // Rules
  getProposedRules: () => fetchFromMiddleware('/api/v1/rules'),
  approveRule: (rule_id) => fetchFromMiddleware('/api/v1/rules/approve', {
    method: 'POST',
    body: JSON.stringify({ rule_id })
  }),
  approveAllRules: (rule_ids) => fetchFromMiddleware('/api/v1/rules/approve-all', {
    method: 'POST',
    body: JSON.stringify({ rule_ids })
  }),
  rejectRule: (rule_id) => fetchFromMiddleware('/api/v1/rules/reject', {
    method: 'POST',
    body: JSON.stringify({ rule_id })
  }),
  rejectAllRules: (rule_ids) => fetchFromMiddleware('/api/v1/rules/reject-all', {
    method: 'POST',
    body: JSON.stringify({ rule_ids })
  }),
  updateRule: (rule_id, rule_config) => fetchFromMiddleware('/api/v1/rules/update', {
    method: 'POST',
    body: JSON.stringify({ rule_id, rule_config })
  }),
  getRulesSummary: () => fetchFromMiddleware('/api/v1/rules/summary'),
  getRulesHistory: () => fetchFromMiddleware('/api/v1/rules/history'),

  // Custom Configurations & Uploads
  getConfigs: () => fetchFromMiddleware('/api/v1/configs'),
  saveConfig: (config_text) => fetchFromMiddleware('/api/v1/configs', {
    method: 'POST',
    body: JSON.stringify({ config_text })
  }),
  deleteConfig: (config_id) => fetchFromMiddleware(`/api/v1/configs/${config_id}`, {
    method: 'DELETE'
  }),
  getPresignedUrl: (filename, contentType) => fetchFromMiddleware('/api/v1/configs/presigned-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType })
  }),

  // Database
  getDatabaseProfiles: () => fetchFromMiddleware('/api/v1/database/profiles'),
  insertTestRecord: (tableName, payload) => fetchFromMiddleware('/api/v1/database/insert', {
    method: 'POST',
    body: JSON.stringify({ tableName, payload })
  }),

  // Triggers
  triggerProfiler: () => fetchFromMiddleware('/api/v1/triggers/profiler', { method: 'POST' }),
  triggerChecker: () => fetchFromMiddleware('/api/v1/triggers/checker', { method: 'POST' }),
  triggerAgent: () => fetchFromMiddleware('/api/v1/triggers/agent', { method: 'POST' })
};
