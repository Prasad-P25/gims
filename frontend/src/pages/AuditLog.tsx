import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '../services/api';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface AuditLogEntry {
  log_id: string;
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_at: string;
  ip_address: string | null;
}

interface AuditStats {
  byAction: Array<{ action: string; count: string }>;
  byTable: Array<{ table_name: string; count: string }>;
  recentActivity: Array<{ date: string; count: string }>;
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Fetch audit logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });
      if (filters.table_name) params.append('table_name', filters.table_name);
      if (filters.action) params.append('action', filters.action);

      const response = await api.get(`/audit?${params}`);
      return response.data as {
        logs: AuditLogEntry[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      };
    },
  });

  // Fetch audit stats
  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const response = await api.get('/audit/stats');
      return response.data as AuditStats;
    },
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-700';
      case 'update':
        return 'bg-blue-100 text-blue-700';
      case 'delete':
        return 'bg-red-100 text-red-700';
      case 'restore':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTableDisplayName = (tableName: string) => {
    const names: Record<string, string> = {
      task_registry: 'Tasks',
      users: 'Users',
      teams: 'Teams',
      categories: 'Categories',
      reminders: 'Reminders',
    };
    return names[tableName] || tableName;
  };

  const formatChanges = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) => {
    if (!oldData && newData) {
      return <span className="text-green-600">Created new record</span>;
    }
    if (oldData && !newData) {
      return <span className="text-red-600">Deleted record</span>;
    }
    if (oldData && newData) {
      const changes: string[] = [];
      for (const key of Object.keys(newData)) {
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          changes.push(key);
        }
      }
      if (changes.length === 0) return <span className="text-gray-500">No changes</span>;
      return (
        <span className="text-blue-600">
          Changed: {changes.slice(0, 3).join(', ')}
          {changes.length > 3 && ` +${changes.length - 3} more`}
        </span>
      );
    }
    return <span className="text-gray-500">Unknown</span>;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track all changes and actions in the system
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn-secondary inline-flex items-center"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.byAction.slice(0, 4).map((stat) => (
            <div key={stat.action} className="card p-4">
              <div className="flex items-center justify-between">
                <span className={cn('badge', getActionColor(stat.action))}>
                  {stat.action}
                </span>
                <span className="text-2xl font-bold text-gray-900">{stat.count}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Table</label>
              <select
                value={filters.table_name}
                onChange={(e) => {
                  setFilters({ ...filters, table_name: e.target.value });
                  setPage(1);
                }}
                className="input"
              >
                <option value="">All Tables</option>
                <option value="task_registry">Tasks</option>
                <option value="users">Users</option>
                <option value="teams">Teams</option>
                <option value="categories">Categories</option>
              </select>
            </div>
            <div>
              <label className="label">Action</label>
              <select
                value={filters.action}
                onChange={(e) => {
                  setFilters({ ...filters, action: e.target.value });
                  setPage(1);
                }}
                className="input"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="restore">Restore</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ table_name: '', action: '' });
                  setPage(1);
                }}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : logsData && logsData.logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Changes
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logsData.logs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {format(new Date(log.performed_at), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <History className="h-4 w-4 text-gray-500" />
                          </div>
                          <span className="ml-2 text-sm text-gray-900">
                            {log.performed_by_name || 'System'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('badge', getActionColor(log.action))}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getTableDisplayName(log.table_name)}
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        {formatChanges(log.old_data, log.new_data)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * 25) + 1} to {Math.min(page * 25, logsData.meta.total)} of {logsData.meta.total}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {logsData.meta.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(logsData.meta.totalPages, page + 1))}
                  disabled={page === logsData.meta.totalPages}
                  className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Audit Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Action</label>
                  <p className={cn('badge inline-block mt-1', getActionColor(selectedLog.action))}>
                    {selectedLog.action}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Table</label>
                  <p className="font-medium">{getTableDisplayName(selectedLog.table_name)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Performed By</label>
                  <p className="font-medium">{selectedLog.performed_by_name || 'System'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Time</label>
                  <p className="font-medium">
                    {format(new Date(selectedLog.performed_at), 'MMM d, yyyy HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Record ID</label>
                  <p className="font-mono text-xs">{selectedLog.record_id}</p>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <label className="text-xs text-gray-500">IP Address</label>
                    <p className="font-mono text-xs">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>

              {selectedLog.old_data && (
                <div>
                  <label className="text-xs text-gray-500">Previous Data</label>
                  <pre className="mt-1 p-3 bg-red-50 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <label className="text-xs text-gray-500">New Data</label>
                  <pre className="mt-1 p-3 bg-green-50 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
