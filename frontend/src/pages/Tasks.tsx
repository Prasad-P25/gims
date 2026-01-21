import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { tasksService } from '../services/tasks';
import { dashboardService } from '../services/dashboard';
import { cn, formatDate, getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from '../lib/utils';

export default function Tasks() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category_id: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', page, filters],
    queryFn: () => tasksService.getTasks({
      page,
      limit: 10,
      ...filters,
    }),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: dashboardService.getCategories,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: '', priority: '', category_id: '', search: '' });
    setPage(1);
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
        <Link to="/tasks/new" className="btn-primary inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Link>
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
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div className="sm:col-span-3">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Category
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
                    <tr key={task.registry_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {task.task_data?.title || task.task_data?.subject || 'Untitled Task'}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {task.task_data?.description || task.transcription || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="text-sm text-gray-600">
                          {task.category?.name_english || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('badge', getStatusColor(task.status))}>
                          {getStatusLabel(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <span className={cn('badge', getPriorityColor(task.priority))}>
                          {getPriorityLabel(task.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(task.registration_date)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          to={`/tasks/${task.registry_id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, data.total)} of {data.total} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} of {Math.ceil(data.total / 10)}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
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
    </div>
  );
}
