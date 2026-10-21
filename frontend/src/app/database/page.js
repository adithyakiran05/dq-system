'use client';
import { useState, useEffect } from 'react';
import { middlewareApi } from '@/lib/middleware-client';

export default function DatabaseNavigator() {
  const [database, setDatabase] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTables, setExpandedTables] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTableForInsert, setSelectedTableForInsert] = useState(null);
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchDatabase();
  }, []);

  async function fetchDatabase() {
    setLoading(true);
    try {
      const res = await middlewareApi.getDatabaseProfiles();
      if (res.status === 'success') {
        setDatabase(res.data || {});
        setError(null);
      } else if (res.status === 'db_offline') {
        setError(res.message || "AWS RDS PostgreSQL is currently unreachable. Please check RDS Security Group port 5432.");
        setDatabase({});
      } else {
        setError(res.message);
      }
    } catch (err) {
      console.warn("Could not fetch database profiles:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleTable = (tableName) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  const openInsertModal = (tableName, e) => {
    e.stopPropagation();
    setSelectedTableForInsert(tableName);
    // Initialize form data based on columns
    const initialData = {};
    database[tableName]?.forEach(col => {
      initialData[col.column_name] = '';
    });
    setFormData(initialData);
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsModalOpen(true);
  };

  const handleInputChange = (colName, value) => {
    setFormData(prev => ({
      ...prev,
      [colName]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await middlewareApi.insertTestRecord(selectedTableForInsert, formData);
      if (res.status === 'success') {
        setSubmitSuccess(true);
        setTimeout(() => setIsModalOpen(false), 1500);
      } else {
        setSubmitError(res.message);
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTables = Object.keys(database).filter(tableName => 
    tableName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    database[tableName].some(col => col.column_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-t-2 border-purple-500 animate-spin mb-4"></div>
          <p className="text-gray-400">Scanning Database Schema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex flex-col items-center">
          <svg className="w-10 h-10 text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <h3 className="text-lg font-medium text-white mb-1">Failed to Load Schema</h3>
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col relative">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">Database Navigator</h1>
          <p className="text-gray-400 text-sm">Explore your mapped database schemas and insert new data.</p>
        </div>
        
        <div className="relative w-72">
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Search tables or columns..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder-gray-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-2 custom-scrollbar space-y-4">
        {filteredTables.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No tables found matching your search.</div>
        ) : (
          filteredTables.map(tableName => {
            const columns = database[tableName];
            const isExpanded = expandedTables[tableName];
            
            return (
              <div key={tableName} className="bg-neutral-900/30 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm transition-all duration-200 hover:border-neutral-700">
                <div 
                  onClick={() => toggleTable(tableName)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{tableName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{columns.length} Columns</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={(e) => openInsertModal(tableName, e)}
                      className="px-3 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-colors flex items-center border border-blue-500/20 mr-2"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                      Add Record
                    </button>
                    <div className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-neutral-800 bg-black/20 p-0">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-neutral-900/50 text-gray-400">
                        <tr>
                          <th className="px-6 py-3 font-medium">Column Name</th>
                          <th className="px-6 py-3 font-medium">Data Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 text-gray-300">
                        {columns.map((col, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3 font-mono text-xs text-blue-300">{col.column_name}</td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-1 rounded bg-neutral-800 text-xs text-gray-400 font-mono border border-neutral-700/50">
                                {col.data_type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Insert Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-full">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">Add Record</h2>
                <p className="text-sm text-gray-400 mt-1">Insert into <span className="font-mono text-blue-300 bg-blue-500/10 px-1 py-0.5 rounded">{selectedTableForInsert}</span></p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {submitSuccess ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-white font-medium text-lg">Record Added!</h3>
                  <p className="text-gray-400 text-sm mt-1">The data was successfully inserted into the database.</p>
                </div>
              ) : (
                <form id="insertForm" onSubmit={handleSubmit} className="space-y-4">
                  {submitError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center mb-4">
                      {submitError}
                    </div>
                  )}
                  {database[selectedTableForInsert]?.map((col, idx) => (
                    <div key={idx}>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        {col.column_name} <span className="text-xs text-gray-500 font-mono ml-2">({col.data_type})</span>
                      </label>
                      <input 
                        type={col.data_type.includes('int') || col.data_type.includes('numeric') ? 'number' : 'text'}
                        required
                        value={formData[col.column_name] || ''}
                        onChange={(e) => handleInputChange(col.column_name, e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        placeholder={`Enter ${col.column_name}...`}
                      />
                    </div>
                  ))}
                </form>
              )}
            </div>
            
            {!submitSuccess && (
              <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 flex justify-end space-x-3 rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="insertForm"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 flex items-center"
                >
                  {isSubmitting ? (
                    <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Inserting...</>
                  ) : 'Insert Record'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
