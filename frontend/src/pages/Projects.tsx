import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  FolderKanban,
  Users as UsersIcon,
  MapPin,
  Calendar,
  CheckCircle2,
  Phone,
  Mail,
  Hash,
  LayoutDashboard,
} from 'lucide-react';
import { projectsService } from '../services/projects';
import { teamsService } from '../services/teams';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import type {
  Project,
  ProjectCreateInput,
  ProjectStatus,
  Team,
} from '../types';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-200 text-gray-600',
};

const emptyForm: ProjectCreateInput = {
  name_english: '',
  name_marathi: '',
  po_number: '',
  description: '',
  location: '',
  status: 'active',
  start_date: '',
  end_date: '',
  budget: undefined,
  project_manager_id: '',
  contact_person_name: '',
  contact_person_phone: '',
  contact_person_email: '',
  team_ids: [],
};

export default function Projects() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'super_admin' || user?.role === 'admin';
  const canDelete = user?.role === 'super_admin';

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [form, setForm] = useState<ProjectCreateInput>(emptyForm);

  // Fetch projects (list)
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn: () => projectsService.list(statusFilter || undefined),
  });

  // Fetch teams for assignment dropdown
  const { data: teams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: teamsService.getTeams,
    enabled: showForm,
  });

  // Fetch assigned teams for the project being edited
  const { data: assignedTeams } = useQuery({
    queryKey: ['project-teams', editing?.project_id],
    queryFn: () => projectsService.getTeams(editing!.project_id),
    enabled: !!editing,
  });

  const createMutation = useMutation({
    mutationFn: projectsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      resetForm();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Failed to create project');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectCreateInput }) =>
      projectsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      resetForm();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Failed to update project');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectsService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const assignTeamsMutation = useMutation({
    mutationFn: ({ id, teamIds }: { id: string; teamIds: string[] }) =>
      projectsService.assignTeams(id, teamIds),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-teams', vars.id] });
    },
  });

  const removeTeamMutation = useMutation({
    mutationFn: ({ id, teamId }: { id: string; teamId: string }) =>
      projectsService.removeTeam(id, teamId),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-teams', vars.id] });
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditing(null);
  };

  const handleEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name_english: p.name_english,
      name_marathi: p.name_marathi || '',
      po_number: p.po_number || '',
      description: p.description || '',
      location: p.location || '',
      status: p.status,
      start_date: p.start_date ? p.start_date.slice(0, 10) : '',
      end_date: p.end_date ? p.end_date.slice(0, 10) : '',
      budget: p.budget ? Number(p.budget) : undefined,
      project_manager_id: p.project_manager_id || '',
      contact_person_name: p.contact_person_name || '',
      contact_person_phone: p.contact_person_phone || '',
      contact_person_email: p.contact_person_email || '',
      team_ids: [],
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Normalize empty strings -> null/undefined, skip team_ids on update (handled separately)
    const payload: any = { ...form };
    if (payload.start_date === '') payload.start_date = null;
    if (payload.end_date === '') payload.end_date = null;
    if (payload.budget === '' || payload.budget === undefined || Number.isNaN(payload.budget)) {
      payload.budget = null;
    } else {
      payload.budget = Number(payload.budget);
    }
    if (!payload.project_manager_id) delete payload.project_manager_id;
    ['po_number', 'description', 'location', 'contact_person_name', 'contact_person_phone', 'contact_person_email']
      .forEach((k) => {
        if (payload[k] === '') payload[k] = editing ? null : undefined;
      });

    if (editing) {
      // Don't send team_ids on update (use separate assign endpoint)
      delete payload.team_ids;
      updateMutation.mutate({ id: editing.project_id, data: payload });
    } else {
      if (!payload.team_ids || payload.team_ids.length === 0) delete payload.team_ids;
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (p: Project) => {
    if (window.confirm(`Delete project "${p.name_english}"? This cannot be undone.`)) {
      deleteMutation.mutate(p.project_id);
    }
  };

  const toggleTeamAssignment = (teamId: string, isAssigned: boolean) => {
    if (!editing) return;
    if (isAssigned) {
      if (window.confirm('Remove this team from the project?')) {
        removeTeamMutation.mutate({ id: editing.project_id, teamId });
      }
    } else {
      assignTeamsMutation.mutate({ id: editing.project_id, teamIds: [teamId] });
    }
  };

  const assignedTeamIds = useMemo(
    () => new Set((assignedTeams || []).map((t) => t.team_id)),
    [assignedTeams]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage projects and assign teams to them
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | '')}
            className="input text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn-primary inline-flex items-center whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Project' : 'Create New Project'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Project Code *</label>
                <input
                  type="text"
                  value={form.name_english}
                  onChange={(e) => setForm({ ...form, name_english: e.target.value })}
                  className="input"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="label">Client Name *</label>
                <input
                  type="text"
                  value={form.name_marathi || ''}
                  onChange={(e) => setForm({ ...form, name_marathi: e.target.value })}
                  className="input"
                  required
                  minLength={1}
                />
              </div>
              <div>
                <label className="label">PO Number</label>
                <input
                  type="text"
                  value={form.po_number || ''}
                  onChange={(e) => setForm({ ...form, po_number: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  value={form.location || ''}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  value={form.status || 'active'}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as ProjectStatus })
                  }
                  className="input"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={(form.start_date as string) || ''}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={(form.end_date as string) || ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Budget (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.budget ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      budget: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="input"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Contact Person</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    value={form.contact_person_name || ''}
                    onChange={(e) => setForm({ ...form, contact_person_name: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    value={form.contact_person_phone || ''}
                    onChange={(e) => setForm({ ...form, contact_person_phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={form.contact_person_email || ''}
                    onChange={(e) => setForm({ ...form, contact_person_email: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Teams section - create: multi-select; edit: manage list */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Teams</p>

              {!editing ? (
                <div>
                  <label className="label">Assign teams to this project</label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1 bg-gray-50">
                    {teams && teams.length > 0 ? (
                      teams.map((t) => {
                        const checked = (form.team_ids || []).includes(t.team_id);
                        return (
                          <label
                            key={t.team_id}
                            className="flex items-center p-2 rounded cursor-pointer hover:bg-white"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(form.team_ids || []);
                                if (e.target.checked) next.add(t.team_id);
                                else next.delete(t.team_id);
                                setForm({ ...form, team_ids: Array.from(next) });
                              }}
                              className="mr-3 h-4 w-4 text-primary-600 rounded"
                            />
                            <div className="flex-1">
                              <span className="font-medium">{t.name}</span>
                              {t.admin_name && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (admin: {t.admin_name})
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-2">No teams available</p>
                    )}
                  </div>
                  {user?.role === 'admin' && user?.team_id && (
                    <p className="text-xs text-orange-600 mt-1">
                      Note: as an admin, you must include your own team.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="label">Teams on this project</label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1 bg-gray-50">
                    {teams && teams.length > 0 ? (
                      teams.map((t) => {
                        const isAssigned = assignedTeamIds.has(t.team_id);
                        return (
                          <label
                            key={t.team_id}
                            className={cn(
                              'flex items-center p-2 rounded cursor-pointer hover:bg-white',
                              isAssigned && 'bg-primary-50'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleTeamAssignment(t.team_id, isAssigned)}
                              className="mr-3 h-4 w-4 text-primary-600 rounded"
                            />
                            <div className="flex-1">
                              <span className="font-medium">{t.name}</span>
                              {t.admin_name && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (admin: {t.admin_name})
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-2">No teams available</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editing
                  ? 'Save Changes'
                  : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects list */}
      {isLoading ? (
        <div className="card flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <FolderKanban className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500">No projects yet</p>
          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn-primary mt-4"
            >
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.project_id} className="card flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{p.name_english}</h3>
                  {p.name_marathi && (
                    <p className="text-sm text-gray-500 truncate">{p.name_marathi}</p>
                  )}
                </div>
                <span className={cn('badge text-xs ml-2', STATUS_COLORS[p.status])}>
                  {STATUS_LABELS[p.status]}
                </span>
              </div>

              {p.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{p.description}</p>
              )}

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>
                    {p.completed_task_count || 0}/{p.task_count || 0} tasks ·{' '}
                    {p.progress_percent || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${p.progress_percent || 0}%` }}
                  />
                </div>
              </div>

              {/* Meta info */}
              <div className="space-y-1 text-xs text-gray-600 mb-3">
                {p.po_number && (
                  <div className="flex items-center">
                    <Hash className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                    PO: {p.po_number}
                  </div>
                )}
                {p.location && (
                  <div className="flex items-center">
                    <MapPin className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                    {p.location}
                  </div>
                )}
                {(p.start_date || p.end_date) && (
                  <div className="flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                    {p.start_date ? new Date(p.start_date).toLocaleDateString() : '—'}
                    {' → '}
                    {p.end_date ? new Date(p.end_date).toLocaleDateString() : '—'}
                  </div>
                )}
                <div className="flex items-center">
                  <UsersIcon className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  {p.team_count || 0} team{(p.team_count || 0) !== 1 ? 's' : ''}
                </div>
                {p.contact_person_name && (
                  <div className="flex items-center">
                    <Phone className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                    {p.contact_person_name}
                    {p.contact_person_phone && ` · ${p.contact_person_phone}`}
                  </div>
                )}
                {p.contact_person_email && (
                  <div className="flex items-center">
                    <Mail className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                    {p.contact_person_email}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-auto flex items-center justify-between pt-3 border-t">
                <Link
                  to={`/projects/${p.project_id}`}
                  className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <LayoutDashboard className="h-4 w-4 mr-1" />
                  Dashboard
                </Link>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {p.status === 'completed' && (
                <div className="mt-2 flex items-center text-xs text-blue-600">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Project marked as completed
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
