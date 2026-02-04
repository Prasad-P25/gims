import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, Search, Edit2 } from 'lucide-react';
import api from '../services/api';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface User {
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'member';
  team_id?: string;
  team_name?: string;
  preferred_language: string;
  is_active: boolean;
  created_at: string;
}

interface Team {
  team_id: string;
  name: string;
}

export default function Users() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'member',
    team_id: '',
    password: '',
    preferred_language: 'marathi',
  });

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get<User[]>('/auth/users');
      return response.data;
    },
  });

  // Fetch teams for dropdown
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await api.get<Team[]>('/teams');
      return response.data;
    },
    enabled: currentUser?.role === 'super_admin',
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/auth/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      resetForm();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Failed to create user';
      alert(message);
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: (data: { userId: string; updates: Partial<typeof formData> }) =>
      api.put(`/auth/users/${data.userId}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      resetForm();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Failed to update user';
      alert(message);
    },
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: (userId: string) =>
      api.patch(`/auth/users/${userId}/toggle-status`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      role: 'member',
      team_id: '',
      password: '',
      preferred_language: 'marathi',
    });
    setShowForm(false);
    setEditingUser(null);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      phone: user.phone,
      email: user.email || '',
      role: user.role,
      team_id: user.team_id || '',
      password: '',
      preferred_language: user.preferred_language || 'marathi',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      // Update existing user
      const updates: Partial<typeof formData> = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        preferred_language: formData.preferred_language,
      };
      // Only super_admin can change role and team
      if (currentUser?.role === 'super_admin') {
        updates.role = formData.role;
        updates.team_id = formData.team_id;
      }
      // Only include password if it's set
      if (formData.password) {
        updates.password = formData.password;
      }
      updateMutation.mutate({ userId: editingUser.user_id, updates });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredUsers = users?.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.phone.includes(search)
  );

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage system users and permissions
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="btn-primary inline-flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {/* User Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input"
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <label className="label">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="input"
                  placeholder="10-digit phone number"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="input"
                  placeholder="Email address (optional)"
                />
              </div>
              <div>
                <label className="label">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="input"
                  disabled={!isSuperAdmin && editingUser !== null}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                </select>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="label">Team</label>
                  <select
                    value={formData.team_id}
                    onChange={(e) =>
                      setFormData({ ...formData, team_id: e.target.value })
                    }
                    className="input"
                  >
                    <option value="">No Team</option>
                    {teams?.map((team) => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="input"
                  placeholder={editingUser ? 'Enter new password' : 'Enter password'}
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="label">Preferred Language</label>
                <select
                  value={formData.preferred_language}
                  onChange={(e) =>
                    setFormData({ ...formData, preferred_language: e.target.value })
                  }
                  className="input"
                >
                  <option value="marathi">Marathi</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                </select>
              </div>
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
                  : editingUser
                  ? 'Update User'
                  : 'Save User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Team
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {user.name}
                          </p>
                          {user.email && (
                            <p className="text-sm text-gray-500">{user.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {user.phone}
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span
                        className={cn(
                          'badge',
                          user.role === 'super_admin'
                            ? 'bg-red-100 text-red-700'
                            : user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-primary-100 text-primary-700'
                        )}
                      >
                        {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600">
                      {user.team_name || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          'badge',
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                          title="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleStatusMutation.mutate(user.user_id)}
                          className={cn(
                            'p-2 rounded-md',
                            user.is_active
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-green-500 hover:bg-green-50'
                          )}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {user.is_active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
