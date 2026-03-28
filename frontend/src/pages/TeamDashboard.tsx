import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { teamStatsService } from '../services/teamStats';
import type { MemberStats } from '../services/teamStats';
import { cn } from '../lib/utils';

export default function TeamDashboard() {
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['team-dashboard'],
    queryFn: teamStatsService.getTeamDashboard,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Unable to load team dashboard</p>
        <p className="text-sm text-gray-400 mt-1">Make sure you are an admin with a team assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dashboard.team_name} • {dashboard.total_members} members
          </p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['team-dashboard'] })}
          className="btn-secondary inline-flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Team Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Total Tasks"
          value={dashboard.total_tasks}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={dashboard.pending_tasks}
          color="yellow"
        />
        <StatCard
          icon={RefreshCw}
          label="In Progress"
          value={dashboard.in_progress_tasks}
          color="purple"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed"
          value={dashboard.completed_tasks}
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={dashboard.overdue_tasks}
          color="red"
        />
        <StatCard
          icon={TrendingUp}
          label="Completion Rate"
          value={`${dashboard.completion_rate}%`}
          color="teal"
        />
      </div>

      {/* Team Members Performance */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Workload & Performance
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    Pending
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                    In Progress
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    Completed
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    Overdue
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">This Week</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workload</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboard.members.map((member) => (
                <MemberRow key={member.user_id} member={member} maxTasks={Math.max(...dashboard.members.map(m => m.total_tasks), 1)} />
              ))}
            </tbody>
          </table>
        </div>

        {dashboard.members.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No team members found
          </div>
        )}
      </div>

      {/* Workload Legend */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Workload Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-16 h-3 bg-green-200 rounded"></div>
            <span className="text-gray-600">Low (0-30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-3 bg-yellow-200 rounded"></div>
            <span className="text-gray-600">Medium (30-70%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-3 bg-red-200 rounded"></div>
            <span className="text-gray-600">High (70-100%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: 'blue' | 'yellow' | 'purple' | 'green' | 'red' | 'teal';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    teal: 'bg-teal-50 text-teal-600',
  };

  return (
    <div className="card p-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-2', colorClasses[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// Member Row Component
function MemberRow({ member, maxTasks }: { member: MemberStats; maxTasks: number }) {
  const workloadPercent = maxTasks > 0 ? Math.round((member.pending_tasks + member.in_progress_tasks) / maxTasks * 100) : 0;

  const getWorkloadColor = (percent: number) => {
    if (percent <= 30) return 'bg-green-400';
    if (percent <= 70) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-green flex items-center justify-center">
            <span className="text-white font-semibold text-xs">
              {member.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-medium text-gray-900">{member.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center font-semibold text-gray-900">{member.total_tasks}</td>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
          member.pending_tasks > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'
        )}>
          {member.pending_tasks}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
          member.in_progress_tasks > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'
        )}>
          {member.in_progress_tasks}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
          member.completed_tasks > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        )}>
          {member.completed_tasks}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
          member.overdue_tasks > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'
        )}>
          {member.overdue_tasks}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium text-gray-600">
          {member.completed_this_week}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'text-sm font-semibold',
          member.completion_rate >= 70 ? 'text-green-600' : member.completion_rate >= 40 ? 'text-yellow-600' : 'text-red-600'
        )}>
          {member.completion_rate}%
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="w-24">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getWorkloadColor(workloadPercent))}
              style={{ width: `${Math.min(workloadPercent, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 mt-1 block">{workloadPercent}%</span>
        </div>
      </td>
    </tr>
  );
}
