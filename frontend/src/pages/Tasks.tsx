import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { tasksService } from '../services/tasks';
import { teamStatsService } from '../services/teamStats';
import { dashboardService } from '../services/dashboard';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel, getSourceLabel, getSourceColor } from '../lib/utils';
import type { Task } from '../types';

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category_id: '',
    assigned_to: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignTo, setBulkAssignTo] = useState('');

  // Fetch tasks
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tasks', page, filters],
    queryFn: () => tasksService.getTasks({
      page,
      limit: 10,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      category_id: filters.category_id ? parseInt(filters.category_id) : undefined,
      assigned_to: filters.assigned_to || undefined,
      search: filters.search || undefined,
    } as any),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: dashboardService.getCategories,
  });

  // Fetch assignable users (for admins)
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: tasksService.getAssignableUsers,
    enabled: isAdmin,
  });

  // Quick status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      teamStatsService.quickStatusUpdate(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
    },
  });

  // Reassign mutation
  const reassignMutation = useMutation({
    mutationFn: ({ taskId, assignTo }: { taskId: string; assignTo: string }) =>
      teamStatsService.reassignTask(taskId, assignTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
    },
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: ({ taskIds, assignTo }: { taskIds: string[]; assignTo: string }) =>
      teamStatsService.bulkAssignTasks(taskIds, assignTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
      setSelectedTasks([]);
      setShowBulkAssignModal(false);
      setBulkAssignTo('');
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
    setSelectedTasks([]);
  };

  const clearFilters = () => {
    setFilters({ status: '', priority: '', category_id: '', assigned_to: '', search: '' });
    setPage(1);
    setSelectedTasks([]);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleAllTasks = () => {
    if (!data?.tasks) return;
    if (selectedTasks.length === data.tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(data.tasks.map(t => t.registry_id));
    }
  };

  const handleQuickStatusChange = (taskId: string, status: string) => {
    statusMutation.mutate({ taskId, status });
  };

  const handleBulkAssign = () => {
    if (!bulkAssignTo || selectedTasks.length === 0) return;
    bulkAssignMutation.mutate({ taskIds: selectedTasks, assignTo: bulkAssignTo });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Registry</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all registered tasks
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && selectedTasks.length > 0 && (
            <button
              onClick={() => setShowBulkAssignModal(true)}
              className="btn-secondary inline-flex items-center"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Assign ({selectedTasks.length})
            </button>
          )}
          <Link to="/tasks/new" className="btn-primary inline-flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Link>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'btn-secondary inline-flex items-center',
              showFilters && 'bg-gray-200'
            )}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="label">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="input"
              >
                <option value="">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="label">Category</label>
              <select
                value={filters.category_id}
                onChange={(e) => handleFilterChange('category_id', e.target.value)}
                className="input"
              >
                <option value="">All Categories</option>
                {categories?.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.name_english}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Member - Admin only */}
            {isAdmin && assignableUsers.length > 0 && (
              <div>
                <label className="label">Assigned To</label>
                <select
                  value={filters.assigned_to}
                  onChange={(e) => handleFilterChange('assigned_to', e.target.value)}
                  className="input"
                >
                  <option value="">All Members</option>
                  {assignableUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-4">
              <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700">
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tasks Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : data?.tasks && data.tasks.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {/* Checkbox column for admins */}
                    {isAdmin && (
                      <th className="px-3 py-3 text-left">
                        <button
                          onClick={toggleAllTasks}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {selectedTasks.length === data.tasks.length ? (
                            <CheckSquare className="h-5 w-5 text-primary-600" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                      Assigned To
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.tasks.map((task) => (
                    <TaskRow
                      key={task.registry_id}
                      task={task}
                      isAdmin={isAdmin}
                      isSelected={selectedTasks.includes(task.registry_id)}
                      onToggleSelect={() => toggleTaskSelection(task.registry_id)}
                      onStatusChange={handleQuickStatusChange}
                      assignableUsers={assignableUsers}
                      onReassign={(assignTo) => reassignMutation.mutate({ taskId: task.registry_id, assignTo })}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-500 text-center sm:text-left">
                <span className="hidden sm:inline">Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, data.total)} of </span>
                <span className="sm:hidden">{data.total} </span>
                {data.total} <span className="sm:hidden">tasks</span><span className="hidden sm:inline">results</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => { setPage(page - 1); setSelectedTasks([]); }}
                  disabled={page === 1}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-700 min-w-[80px] text-center">
                  {page} / {Math.ceil(data.total / 10)}
                </span>
                <button
                  onClick={() => { setPage(page + 1); setSelectedTasks([]); }}
                  disabled={page >= Math.ceil(data.total / 10)}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No tasks found</p>
            <Link to="/tasks/new" className="btn-primary mt-4 inline-flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Create your first task
            </Link>
          </div>
        )}
      </div>

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Assign {selectedTasks.length} Task(s)</h3>
            <div className="mb-4">
              <label className="label">Assign To</label>
              <select
                value={bulkAssignTo}
                onChange={(e) => setBulkAssignTo(e.target.value)}
                className="input"
              >
                <option value="">Select member...</option>
                {assignableUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowBulkAssignModal(false); setBulkAssignTo(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssignTo || bulkAssignMutation.isPending}
                className="btn-primary"
              >
                {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Row Component with quick actions
function TaskRow({
  task,
  isAdmin,
  isSelected,
  onToggleSelect,
  onStatusChange,
  assignableUsers,
  onReassign,
}: {
  task: Task;
  isAdmin: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onStatusChange: (taskId: string, status: string) => void;
  assignableUsers: Array<{ user_id: string; name: string }>;
  onReassign: (assignTo: string) => void;
}) {
  const [showReassign, setShowReassign] = useState(false);

  return (
    <tr className={cn('hover:bg-gray-50', isSelected && 'bg-blue-50')}>
      {/* Checkbox */}
      {isAdmin && (
        <td className="px-3 py-4">
          <button onClick={onToggleSelect} className="text-gray-500 hover:text-gray-700">
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-primary-600" />
            ) : (
              <Square className="h-5 w-5" />
            )}
          </button>
        </td>
      )}

      {/* Task Info */}
      <td className="px-4 py-4">
        <div className="text-sm font-medium text-gray-900">
          {(task.task_data as any)?.title || 'Untitled Task'}
        </div>
        <div className="text-sm text-gray-500 truncate max-w-xs">
          {String((task.task_data as any)?.description || task.transcription || '-')}
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-4 hidden md:table-cell">
        <span className="text-sm text-gray-600">
          {task.category_name_english || '-'}
        </span>
      </td>

      {/* Assigned To */}
      <td className="px-4 py-4 hidden xl:table-cell">
        {isAdmin ? (
          <div className="relative">
            <button
              onClick={() => setShowReassign(!showReassign)}
              className={cn(
                'text-sm px-2 py-1 rounded hover:bg-gray-100 flex items-center gap-1',
                task.assigned_to_name ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              {task.assigned_to_name || 'Unassigned'}
              <RefreshCw className="h-3 w-3" />
            </button>
            {showReassign && (
              <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[150px]">
                {assignableUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => { onReassign(u.user_id); setShowReassign(false); }}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm hover:bg-gray-100',
                      task.assigned_to === u.user_id && 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className={cn('text-sm', task.assigned_to_name ? 'text-gray-900' : 'text-gray-400')}>
            {task.assigned_to_name || 'Unassigned'}
          </span>
        )}
      </td>

      {/* Status - Quick change for admins */}
      <td className="px-4 py-4">
        {isAdmin ? (
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.registry_id, e.target.value)}
            className={cn(
              'text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer',
              getStatusColor(task.status)
            )}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        ) : (
          <span className={cn('badge', getStatusColor(task.status))}>
            {getStatusLabel(task.status)}
          </span>
        )}
      </td>

      {/* Priority */}
      <td className="px-4 py-4 hidden sm:table-cell">
        <span className={cn('badge', getPriorityColor(task.priority))}>
          {getPriorityLabel(task.priority)}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-4 hidden lg:table-cell">
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="h-4 w-4 mr-1" />
          {formatDate(task.registration_date)}
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-4 text-right">
        <Link
          to={`/tasks/${task.registry_id}`}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          View
        </Link>
      </td>
    </tr>
  );
}
