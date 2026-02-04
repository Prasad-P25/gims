import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Trash2, Edit2, UserPlus, UserMinus, Search } from 'lucide-react';
import { teamsService } from '../services/teams';
import api from '../services/api';
import { cn } from '../lib/utils';
import type { Team, User } from '../types';

export default function Teams() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    admin_id: '',
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Fetch teams
  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsService.getTeams,
  });

  // Fetch team members when a team is selected
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members', selectedTeam?.team_id],
    queryFn: () => teamsService.getTeamMembers(selectedTeam!.team_id),
    enabled: !!selectedTeam,
  });

  // Fetch unassigned users (for adding members and selecting admin)
  const { data: unassignedUsers } = useQuery({
    queryKey: ['unassigned-users'],
    queryFn: teamsService.getUnassignedUsers,
    enabled: showAddMember || showForm,
  });

  // Fetch all non-admin users for member selection in edit form
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-teams'],
    queryFn: async () => {
      const response = await api.get('/auth/users');
      return response.data.filter((u: User) => u.role !== 'super_admin');
    },
    enabled: showForm && !!editingTeam,
  });

  // Create team mutation
  const createMutation = useMutation({
    mutationFn: teamsService.createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to create team');
    },
  });

  // Update team mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teamsService.updateTeam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      resetForm();
    },
  });

  // Delete team mutation
  const deleteMutation = useMutation({
    mutationFn: teamsService.deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSelectedTeam(null);
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsService.addUserToTeam(teamId, userId, 'member'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.team_id] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-users'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowAddMember(false);
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsService.removeUserFromTeam(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.team_id] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-users'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', admin_id: '' });
    setSelectedMembers([]);
    setMemberSearch('');
    setShowForm(false);
    setEditingTeam(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeam) {
      setIsSaving(true);
      try {
        // Update team details
        await updateMutation.mutateAsync({ id: editingTeam.team_id, data: formData });

        // Get current members (excluding admin)
        const currentMembers = await teamsService.getTeamMembers(editingTeam.team_id);
        const currentMemberIds = currentMembers.filter(m => m.role !== 'admin').map(m => m.user_id);

        // Find members to add and remove
        const membersToAdd = selectedMembers.filter(id => !currentMemberIds.includes(id));
        const membersToRemove = currentMemberIds.filter(id => !selectedMembers.includes(id));

        // Add new members
        for (const userId of membersToAdd) {
          await teamsService.addUserToTeam(editingTeam.team_id, userId, 'member');
        }

        // Remove members
        for (const userId of membersToRemove) {
          await teamsService.removeUserFromTeam(editingTeam.team_id, userId);
        }

        queryClient.invalidateQueries({ queryKey: ['teams'] });
        queryClient.invalidateQueries({ queryKey: ['team-members'] });
        queryClient.invalidateQueries({ queryKey: ['unassigned-users'] });
        queryClient.invalidateQueries({ queryKey: ['all-users-for-teams'] });
        resetForm();
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to save team');
      } finally {
        setIsSaving(false);
      }
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = async (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      admin_id: team.admin_id || '',
    });
    // Load current team members
    try {
      const members = await teamsService.getTeamMembers(team.team_id);
      setSelectedMembers(members.filter(m => m.role !== 'admin').map(m => m.user_id));
    } catch {
      setSelectedMembers([]);
    }
    setShowForm(true);
  };

  const handleDelete = (teamId: string) => {
    if (window.confirm('Are you sure you want to delete this team? All members will be unassigned.')) {
      deleteMutation.mutate(teamId);
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (!selectedTeam) return;
    if (window.confirm('Remove this member from the team?')) {
      removeMemberMutation.mutate({ teamId: selectedTeam.team_id, userId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage teams
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary inline-flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </button>
      </div>

      {/* Team Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingTeam ? 'Edit Team' : 'Create New Team'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Team Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Enter team name"
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="label">Team Admin *</label>
              <select
                value={formData.admin_id}
                onChange={(e) => setFormData({ ...formData, admin_id: e.target.value })}
                className="input"
                required
              >
                <option value="">Select an admin</option>
                {unassignedUsers?.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.name} ({user.phone})
                  </option>
                ))}
                {editingTeam?.admin_id && (
                  <option value={editingTeam.admin_id}>
                    {editingTeam.admin_name} (Current Admin)
                  </option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select a user to be the team admin. Only unassigned users are shown.
              </p>
            </div>

            {/* Members Selection - Only show when editing */}
            {editingTeam && (
              <div>
                <label className="label">Team Members</label>
                {/* Search and Bulk Actions */}
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="input text-sm py-1.5 pl-8"
                    />
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const filteredUsers = allUsers
                          ?.filter((u: User) => u.user_id !== formData.admin_id)
                          .filter((u: User) =>
                            u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                            u.phone.includes(memberSearch)
                          )
                          .map((u: User) => u.user_id) || [];
                        setSelectedMembers([...new Set([...selectedMembers, ...filteredUsers])]);
                      }}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (memberSearch) {
                          // Only deselect filtered users
                          const filteredIds = allUsers
                            ?.filter((u: User) =>
                              u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                              u.phone.includes(memberSearch)
                            )
                            .map((u: User) => u.user_id) || [];
                          setSelectedMembers(selectedMembers.filter(id => !filteredIds.includes(id)));
                        } else {
                          setSelectedMembers([]);
                        }
                      }}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                </div>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
                  {allUsers && allUsers.length > 0 ? (
                    allUsers
                      .filter((user: User) => user.user_id !== formData.admin_id)
                      .filter((user: User) =>
                        user.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                        user.phone.includes(memberSearch)
                      )
                      .map((user: User) => {
                        const isInOtherTeam = user.team_id && user.team_id !== editingTeam.team_id;
                        const isSelected = selectedMembers.includes(user.user_id);
                        return (
                          <label
                            key={user.user_id}
                            className={cn(
                              'flex items-center p-2 rounded cursor-pointer',
                              isSelected ? 'bg-primary-100' : 'hover:bg-gray-100',
                              isInOtherTeam && !isSelected ? 'opacity-50' : ''
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMembers([...selectedMembers, user.user_id]);
                                } else {
                                  setSelectedMembers(selectedMembers.filter(id => id !== user.user_id));
                                }
                              }}
                              className="mr-3 h-4 w-4 text-primary-600 rounded"
                            />
                            <div className="flex-1">
                              <span className="font-medium">{user.name}</span>
                              <span className="text-gray-500 ml-2">({user.phone})</span>
                              {isInOtherTeam && (
                                <span className="text-xs ml-2 text-orange-600">
                                  (in {user.team_name || 'another team'})
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                  ) : (
                    <p className="text-gray-500 text-center py-2">No users available</p>
                  )}
                  {allUsers && memberSearch && allUsers
                    .filter((user: User) => user.user_id !== formData.admin_id)
                    .filter((user: User) =>
                      user.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      user.phone.includes(memberSearch)
                    ).length === 0 && (
                    <p className="text-gray-500 text-center py-2">No users match your search</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select users to add as team members. Users in other teams will be moved.
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || isSaving}
                className="btn-primary"
              >
                {createMutation.isPending || updateMutation.isPending || isSaving ? 'Saving...' : 'Save Team'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams List */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Teams</h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : teams && teams.length > 0 ? (
            <div className="space-y-3">
              {teams.map((team) => (
                <div
                  key={team.team_id}
                  onClick={() => setSelectedTeam(team)}
                  className={cn(
                    'p-4 rounded-lg border cursor-pointer transition-colors',
                    selectedTeam?.team_id === team.team_id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{team.name}</h3>
                      {team.description && (
                        <p className="text-sm text-gray-500 mt-1">{team.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {team.member_count || 0} members
                        </span>
                        {team.admin_name && (
                          <span>Admin: {team.admin_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(team);
                        }}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(team.team_id);
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No teams created yet</p>
          )}
        </div>

        {/* Team Members */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedTeam ? `${selectedTeam.name} Members` : 'Team Members'}
            </h2>
            {selectedTeam && (
              <button
                onClick={() => setShowAddMember(true)}
                className="btn-secondary text-sm inline-flex items-center"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add Member
              </button>
            )}
          </div>

          {!selectedTeam ? (
            <p className="text-center text-gray-500 py-8">Select a team to view members</p>
          ) : teamMembers && teamMembers.length > 0 ? (
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={cn(
                        'badge',
                        member.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                    {member.role !== 'admin' && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                        title="Remove from team"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No members in this team</p>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Member to {selectedTeam.name}</h3>

            {unassignedUsers && unassignedUsers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unassignedUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.phone}</p>
                    </div>
                    <button
                      onClick={() => addMemberMutation.mutate({
                        teamId: selectedTeam.team_id,
                        userId: user.user_id,
                      })}
                      disabled={addMemberMutation.isPending}
                      className="btn-primary text-sm"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No unassigned users available</p>
            )}

            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowAddMember(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
