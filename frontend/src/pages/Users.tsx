import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, Search } from 'lucide-react';
import api from '../services/api';
import { cn } from '../lib/utils';

interface User {
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: 'admin' | 'supervisor';
  preferred_language: string;
  is_active: boolean;
  created_at: string;
}

export default function Users() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'supervisor',
    password: '',
    preferred_language: 'marathi',
  });

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get<{ users: User[] }>('/auth/users');
      return response.data.users;
    },
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/auth/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetForm();
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
      role: 'supervisor',
      password: '',
      preferred_language: 'marathi',
    });
    setShowForm(false);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const filteredUsers = users?.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.phone.includes(search)
  );

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
          onClick={() => setShowForm(!showForm)}
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
                >
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="input"
                  placeholder="Enter password"
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
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? 'Saving...' : 'Save User'}
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
                    Language
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
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-primary-100 text-primary-700'
                        )}
                      >
                        {user.role === 'admin' ? 'Admin' : 'Supervisor'}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600 capitalize">
                      {user.preferred_language}
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
