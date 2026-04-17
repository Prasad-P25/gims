import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  FolderKanban,
  MapPin,
  Calendar,
  CheckCircle2,
  Phone,
  Mail,
  User as UserIcon,
  Users as UsersIcon,
  AlertTriangle,
  FileDown,
  Loader2,
} from 'lucide-react';
import { projectsService } from '../services/projects';
import { tasksService } from '../services/tasks';
import { reportsService } from '../services/reports';
import { cn, formatDate, getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from '../lib/utils';
import type { ProjectStatus, Task } from '../types';

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-200 text-gray-600',
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'green' | 'yellow' | 'blue' | 'red';
}) {
  const toneClass = {
    default: 'bg-gray-50 text-gray-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
  }[tone];
  return (
    <div className={cn('rounded-lg p-4 border', toneClass)}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!id) return;
    setIsDownloading(true);
    try {
      const { blob, fileName } = await reportsService.generateProjectReport({
        project_id: id,
        include_task_details: true,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to generate project report';
      alert(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['project-dashboard', id],
    queryFn: () => projectsService.dashboard(id!),
    enabled: Boolean(id),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { project_id: id, limit: 25 }],
    queryFn: () => tasksService.getTasks({ project_id: id, limit: 25 } as any),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto card text-center py-10">
        <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
        <p className="text-gray-700">Project not found or you don't have access.</p>
        <Link to="/projects" className="btn-secondary mt-4 inline-flex items-center">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Link>
      </div>
    );
  }

  const { project, teams, total_tasks, pending_tasks, in_progress_tasks, completed_tasks, cancelled_tasks, overdue_tasks, progress_percent, per_team_breakdown } = data;
  const tasks: Task[] = tasksData?.tasks ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link to="/projects" className="p-2 rounded-md hover:bg-gray-100 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <FolderKanban className="h-6 w-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">{project.name_english}</h1>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[project.status])}>
                {STATUS_LABELS[project.status]}
              </span>
            </div>
            {project.name_marathi && (
              <p className="text-sm text-gray-600 mt-1">{project.name_marathi}</p>
            )}
            {project.description && (
              <p className="text-sm text-gray-500 mt-2 max-w-2xl">{project.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={isDownloading}
          className="btn-primary inline-flex items-center whitespace-nowrap"
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Download Report
            </>
          )}
        </button>
      </div>

      {/* Overview card */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Progress</span>
            <span className="text-gray-500">{progress_percent}% ({completed_tasks} / {total_tasks} tasks)</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${progress_percent}%` }}
            />
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {project.location && (
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4 text-gray-400" /> {project.location}
            </div>
          )}
          {project.start_date && (
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="h-4 w-4 text-gray-400" /> Starts {formatDate(project.start_date)}
            </div>
          )}
          {project.end_date && (
            <div className="flex items-center gap-2 text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-gray-400" /> Ends {formatDate(project.end_date)}
            </div>
          )}
          {project.project_manager_name && (
            <div className="flex items-center gap-2 text-gray-700">
              <UserIcon className="h-4 w-4 text-gray-400" /> PM: {project.project_manager_name}
            </div>
          )}
          {project.contact_person_name && (
            <div className="flex items-center gap-2 text-gray-700">
              <UserIcon className="h-4 w-4 text-gray-400" /> Contact: {project.contact_person_name}
            </div>
          )}
          {project.contact_person_phone && (
            <div className="flex items-center gap-2 text-gray-700">
              <Phone className="h-4 w-4 text-gray-400" /> {project.contact_person_phone}
            </div>
          )}
          {project.contact_person_email && (
            <div className="flex items-center gap-2 text-gray-700">
              <Mail className="h-4 w-4 text-gray-400" /> {project.contact_person_email}
            </div>
          )}
          {project.budget != null && (
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-gray-400">₹</span>
              Budget: {Number(project.budget).toLocaleString('en-IN')}
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={total_tasks} />
        <StatCard label="Pending" value={pending_tasks} tone="yellow" />
        <StatCard label="In Progress" value={in_progress_tasks} tone="blue" />
        <StatCard label="Completed" value={completed_tasks} tone="green" />
        <StatCard label="Cancelled" value={cancelled_tasks} />
        <StatCard label="Overdue" value={overdue_tasks} tone="red" />
      </div>

      {/* Teams + Per-team breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-gray-500" /> Teams ({teams.length})
          </h2>
          {teams.length === 0 ? (
            <p className="text-sm text-gray-500">No teams assigned yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {teams.map((t) => (
                <li key={t.team_id} className="py-2 flex items-center justify-between">
                  <span className="text-gray-900">{t.name}</span>
                  <span className="text-xs text-gray-500">{t.member_count} members</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Per-team breakdown</h2>
          {per_team_breakdown.length === 0 ? (
            <p className="text-sm text-gray-500">No tasks yet.</p>
          ) : (
            <div className="space-y-3">
              {per_team_breakdown.map((b) => {
                const pct = b.task_count > 0 ? Math.round((b.completed_count / b.task_count) * 100) : 0;
                return (
                  <div key={b.team_id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{b.team_name}</span>
                      <span className="text-gray-500">
                        {b.completed_count} / {b.task_count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent tasks for this project */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent tasks</h2>
          <Link to={`/tasks`} className="text-sm text-primary-600 hover:text-primary-700">
            View all tasks →
          </Link>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks in this project yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Priority</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {tasks.map((task) => (
                  <tr key={task.registry_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link to={`/tasks/${task.registry_id}`} className="text-sm font-medium text-gray-900 hover:text-primary-700">
                        {(task.task_data as any)?.title || 'Untitled Task'}
                      </Link>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-600">
                      {task.category_name_english || '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('badge', getStatusColor(task.status))}>
                        {getStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <span className={cn('badge', getPriorityColor(task.priority))}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-sm text-gray-500">
                      {formatDate(task.registration_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
