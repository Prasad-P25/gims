import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Folder,
  Mic,
  MessageSquare,
  Users,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { dashboardService } from '../services/dashboard';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from '../lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  change?: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={cn('p-3 rounded-full', color)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  pending: '#f59e0b',
  in_progress: '#8b5cf6',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

const CHART_COLORS = ['#0284c7', '#0891b2', '#059669', '#84cc16', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardService.getStats,
  });

  const { data: categoryStats, isLoading: categoryLoading } = useQuery({
    queryKey: ['dashboard', 'categories'],
    queryFn: dashboardService.getCategoryStats,
  });

  const { data: recentTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['dashboard', 'recent'],
    queryFn: () => dashboardService.getRecentTasks(5),
  });

  const { data: trends } = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: async () => {
      const response = await api.get('/dashboard/trends?period=week');
      return response.data;
    },
  });

  // Fetch team stats for super_admin
  const { data: teamStats } = useQuery({
    queryKey: ['dashboard', 'team-stats'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    },
    enabled: user?.role === 'super_admin',
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Prepare data for status pie chart
  const statusData = [
    { name: 'Pending', value: stats?.pending || 0, color: STATUS_COLORS.pending },
    { name: 'In Progress', value: (stats as any)?.inProgress || (stats as any)?.in_progress || 0, color: STATUS_COLORS.in_progress },
    { name: 'Completed', value: stats?.completed || 0, color: STATUS_COLORS.completed },
    { name: 'Cancelled', value: (stats as any)?.cancelled || 0, color: STATUS_COLORS.cancelled },
  ].filter(d => d.value > 0);

  // Prepare data for category bar chart
  const categoryChartData = (categoryStats || [])
    .filter(cat => cat.task_count > 0)
    .slice(0, 6)
    .map(cat => ({
      name: cat.name_english.length > 15 ? cat.name_english.slice(0, 15) + '...' : cat.name_english,
      tasks: cat.task_count,
    }));

  // Prepare trend data
  const trendData = (trends?.data || []).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tasks: parseInt(d.count) || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of task registry statistics
          {user?.role === 'admin' && ' (Your Team)'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tasks"
          value={stats?.total || 0}
          icon={<ClipboardList className="h-6 w-6 text-primary-600" />}
          color="bg-primary-100"
        />
        <StatCard
          title="Pending"
          value={stats?.pending || 0}
          icon={<Clock className="h-6 w-6 text-yellow-600" />}
          color="bg-yellow-100"
        />
        <StatCard
          title="In Progress"
          value={(stats as any)?.inProgress || (stats as any)?.in_progress || 0}
          icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
          color="bg-purple-100"
        />
        <StatCard
          title="Completed"
          value={stats?.completed || 0}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
      </div>

      {/* Team Stats for Super Admin */}
      {user?.role === 'super_admin' && teamStats && teamStats.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-primary-600" />
            Team Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamStats.map((team: any) => (
              <div key={team.team_id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900">{team.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Admin: {team.admin_name || 'Not assigned'}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary-600">{team.member_count || 0}</span>
                  <span className="text-xs text-gray-500">members</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Task Status Distribution
          </h2>
          {statusData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* All Categories List */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            All Categories
          </h2>
          {categoryLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : categoryStats && categoryStats.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {categoryStats.map((cat) => {
                const hasNoTasks = cat.task_count === 0;
                return (
                  <div
                    key={cat.category_id}
                    className={cn(
                      "flex items-center justify-between transition-opacity",
                      hasNoTasks && "opacity-40"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        hasNoTasks ? "text-gray-400" : "text-gray-900"
                      )}>
                        {cat.name_english}
                      </p>
                      <p className={cn(
                        "text-xs truncate",
                        hasNoTasks ? "text-gray-300" : "text-gray-500"
                      )}>
                        {cat.name_marathi}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center">
                      <div className={cn(
                        "w-24 rounded-full h-2 mr-3",
                        hasNoTasks ? "bg-gray-100" : "bg-gray-200"
                      )}>
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              (cat.task_count / (stats?.total || 1)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className={cn(
                        "text-sm font-semibold w-8 text-right",
                        hasNoTasks ? "text-gray-300" : "text-gray-700"
                      )}>
                        {cat.task_count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No category data available</p>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      {trendData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Task Registration Trend (Last 7 Days)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="tasks"
                  stroke="#0284c7"
                  fillOpacity={1}
                  fill="url(#colorTasks)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Tasks - Full Width */}
      <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Tasks
          </h2>
          {tasksLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : recentTasks && recentTasks.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentTasks.map((task) => (
                <div
                  key={task.registry_id}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border-l-4 border-primary-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {(task.task_data as any)?.title || (task.task_data as any)?.subject || String((task.task_data as any)?.description || '').slice(0, 50) || 'Untitled Task'}
                      </p>

                      {/* Category */}
                      <div className="flex items-center mt-1.5 space-x-1.5">
                        <Folder className="h-3.5 w-3.5 text-primary-500" />
                        <span className="text-xs font-medium text-primary-600">
                          {(task as any).category_name_english || 'General'}
                        </span>
                      </div>

                      {/* Description snippet */}
                      {(task.task_data as any)?.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {String((task.task_data as any).description)}
                        </p>
                      )}

                      {/* Meta info */}
                      <div className="flex items-center mt-2 space-x-3 text-xs text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(task.registration_date)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {task.input_mode === 'voice' ? (
                            <Mic className="h-3 w-3 text-orange-400" />
                          ) : (
                            <MessageSquare className="h-3 w-3 text-blue-400" />
                          )}
                          <span className="capitalize">{task.input_mode || 'text'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-3 flex flex-col items-end space-y-1.5">
                      <span className={cn('badge', getStatusColor(task.status))}>
                        {getStatusLabel(task.status)}
                      </span>
                      <span className={cn('badge', getPriorityColor(task.priority))}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No tasks registered yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Tasks will appear here as they are added
              </p>
            </div>
          )}
      </div>

      {/* Today's Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Today's Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <p className="text-3xl font-bold text-primary-600">
              {(stats as any)?.today || 0}
            </p>
            <p className="text-sm text-primary-700 mt-1">Registered Today</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">
              {(stats as any)?.completed_today || 0}
            </p>
            <p className="text-sm text-green-700 mt-1">Completed Today</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">
              {(stats as any)?.overdue || 0}
            </p>
            <p className="text-sm text-red-700 mt-1">Overdue Tasks</p>
          </div>
        </div>
      </div>
    </div>
  );
}
