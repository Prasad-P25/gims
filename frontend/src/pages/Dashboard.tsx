import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Folder,
  FolderKanban,
  Mic,
  MessageSquare,
  Users,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
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
import { projectsService } from '../services/projects';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from '../lib/utils';
import type { Project, ProjectStatus } from '../types';

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

  // Fetch projects overview for super_admin
  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ['dashboard', 'projects-overview'],
    queryFn: () => projectsService.list(),
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

      {/* Projects Overview for Super Admin */}
      {user?.role === 'super_admin' && allProjects && (
        <ProjectsOverviewCard projects={allProjects} />
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

const PROJECT_STATUS_TONE: Record<ProjectStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  on_hold: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  archived: 'bg-gray-50 text-gray-600 border-gray-200',
};

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

function ProjectsOverviewCard({ projects }: { projects: Project[] }) {
  const byStatus: Record<ProjectStatus, number> = {
    active: 0,
    on_hold: 0,
    completed: 0,
    archived: 0,
  };
  let totalTasks = 0;
  let totalCompleted = 0;

  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    totalTasks += Number(p.task_count || 0);
    totalCompleted += Number(p.completed_task_count || 0);
  }

  const overallProgress = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const topProjects = [...projects]
    .sort((a, b) => Number(b.task_count || 0) - Number(a.task_count || 0))
    .slice(0, 5);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <FolderKanban className="h-5 w-5 mr-2 text-indigo-600" />
          Projects Overview
        </h2>
        <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700">
          Manage projects →
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">No projects yet.</p>
      ) : (
        <>
          {/* Status counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {(Object.keys(byStatus) as ProjectStatus[]).map((s) => (
              <div key={s} className={cn('rounded-lg p-3 border', PROJECT_STATUS_TONE[s])}>
                <div className="text-2xl font-bold">{byStatus[s]}</div>
                <div className="text-xs uppercase tracking-wide mt-1">{PROJECT_STATUS_LABEL[s]}</div>
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Overall task progress</span>
              <span className="text-gray-500">{overallProgress}% ({totalCompleted} / {totalTasks} tasks)</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Top projects by task volume */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Top projects by task volume</h3>
            {topProjects.filter((p) => Number(p.task_count || 0) > 0).length === 0 ? (
              <p className="text-xs text-gray-500">No tasks attached to any project yet.</p>
            ) : (
              <ul className="space-y-2">
                {topProjects.map((p) => {
                  const count = Number(p.task_count || 0);
                  const completed = Number(p.completed_task_count || 0);
                  const pct = count > 0 ? Math.round((completed / count) * 100) : 0;
                  return (
                    <li key={p.project_id}>
                      <Link
                        to={`/projects/${p.project_id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-gray-50 rounded px-2 -mx-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{p.name_english}</span>
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', PROJECT_STATUS_TONE[p.status])}>
                              {PROJECT_STATUS_LABEL[p.status]}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 max-w-xs bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{completed}/{count}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
