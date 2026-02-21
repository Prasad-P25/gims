import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, Bell, Globe, Database, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboard';

export default function Settings() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('general');
  const [generalSettings, setGeneralSettings] = useState({
    system_name: 'GIMS - Task Registry',
    default_language: 'marathi',
    timezone: 'Asia/Kolkata',
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: dashboardService.getCategories,
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'categories', label: 'Categories', icon: Database },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure system settings and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="card p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-3" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                General Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="label">System Name</label>
                  <input
                    type="text"
                    value={generalSettings.system_name}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        system_name: e.target.value,
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Default Language</label>
                  <select
                    value={generalSettings.default_language}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        default_language: e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="marathi">Marathi</option>
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                  </select>
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <select
                    value={generalSettings.timezone}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        timezone: e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="Asia/Kolkata">
                      Asia/Kolkata (IST, UTC+5:30)
                    </option>
                  </select>
                </div>
                <div className="pt-4">
                  <button className="btn-primary inline-flex items-center">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Reminder Schedule
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Automated reminders are sent via Telegram at the following times
              </p>
              <div className="space-y-4">
                {/* Overdue Alert */}
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-xl">⚠️</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Overdue Alert</p>
                      <p className="text-sm text-gray-500">
                        Alert for tasks pending from previous days
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">09:00 AM</p>
                    <p className="text-xs text-gray-500">IST</p>
                  </div>
                </div>

                {/* Morning Update */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xl">🌅</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Morning Update</p>
                      <p className="text-sm text-gray-500">
                        Pending tasks and today's focus for all users
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">10:00 AM</p>
                    <p className="text-xs text-gray-500">IST</p>
                  </div>
                </div>

                {/* Evening Update */}
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <span className="text-xl">🌆</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Evening Update</p>
                      <p className="text-sm text-gray-500">
                        Today's progress and pending highlights for all users
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-orange-600">06:00 PM</p>
                    <p className="text-xs text-gray-500">IST</p>
                  </div>
                </div>

                {/* Daily Report */}
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-xl">📊</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Daily Report</p>
                      <p className="text-sm text-gray-500">
                        Full day summary for managers and admins only
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-purple-600">07:00 PM</p>
                    <p className="text-xs text-gray-500">IST</p>
                  </div>
                </div>

                {/* Info Note */}
                <div className="p-4 bg-gray-100 rounded-lg mt-6">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> Reminders are sent via Telegram to all users who have linked their account. Super admin can test reminders using <code>/testreminder</code> on Telegram.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Categories */}
          {activeTab === 'categories' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Task Categories
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                System categories for task classification (read-only)
              </p>
              <div className="space-y-3">
                {categories?.map((cat) => (
                  <div
                    key={cat.category_id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {cat.name_english}
                      </p>
                      <p className="text-sm text-gray-500">{cat.name_marathi}</p>
                    </div>
                    <span className="badge bg-primary-100 text-primary-700">
                      #{cat.category_id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Security Settings
              </h2>
              <div className="space-y-6">
                {/* Current User */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Logged in as</p>
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">
                        {user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{user?.name}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {user?.role}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Change Password */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    Change Password
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Current Password</label>
                      <input
                        type="password"
                        className="input"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <input
                        type="password"
                        className="input"
                        placeholder="Enter new password"
                      />
                    </div>
                    <div>
                      <label className="label">Confirm New Password</label>
                      <input
                        type="password"
                        className="input"
                        placeholder="Confirm new password"
                      />
                    </div>
                    <button className="btn-primary">Update Password</button>
                  </div>
                </div>

                {/* Session Info */}
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <strong>Security Note:</strong> Always log out when using
                    shared computers. Your session will expire after 7 days of
                    inactivity.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
