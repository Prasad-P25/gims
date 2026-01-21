import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Bell, Globe, Database, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboard';

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('general');
  const [generalSettings, setGeneralSettings] = useState({
    system_name: 'GIMS - Task Registry',
    default_language: 'marathi',
    timezone: 'Asia/Kolkata',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    morning_reminder: true,
    morning_time: '09:00',
    evening_reminder: true,
    evening_time: '17:00',
    overdue_alerts: true,
    whatsapp_notifications: true,
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
                Notification Settings
              </h2>
              <div className="space-y-6">
                {/* WhatsApp Notifications */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      WhatsApp Notifications
                    </p>
                    <p className="text-sm text-gray-500">
                      Enable WhatsApp message notifications
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.whatsapp_notifications}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          whatsapp_notifications: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                {/* Morning Reminder */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-gray-900">Morning Summary</p>
                      <p className="text-sm text-gray-500">
                        Daily pending task summary
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.morning_reminder}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            morning_reminder: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  {notificationSettings.morning_reminder && (
                    <div>
                      <label className="label">Time</label>
                      <input
                        type="time"
                        value={notificationSettings.morning_time}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            morning_time: e.target.value,
                          })
                        }
                        className="input w-32"
                      />
                    </div>
                  )}
                </div>

                {/* Evening Reminder */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-gray-900">Evening Summary</p>
                      <p className="text-sm text-gray-500">
                        End of day status report
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.evening_reminder}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            evening_reminder: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  {notificationSettings.evening_reminder && (
                    <div>
                      <label className="label">Time</label>
                      <input
                        type="time"
                        value={notificationSettings.evening_time}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            evening_time: e.target.value,
                          })
                        }
                        className="input w-32"
                      />
                    </div>
                  )}
                </div>

                {/* Overdue Alerts */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Overdue Alerts</p>
                    <p className="text-sm text-gray-500">
                      Immediate alerts for overdue tasks
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.overdue_alerts}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          overdue_alerts: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
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
