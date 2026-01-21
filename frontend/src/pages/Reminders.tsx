import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Clock, Trash2, CheckCircle } from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import api from '../services/api';

interface Reminder {
  reminder_id: string;
  registry_id: string;
  reminder_type: 'morning' | 'evening' | 'overdue' | 'custom';
  scheduled_time: string;
  message_template: string;
  is_sent: boolean;
  sent_at: string | null;
  task?: {
    task_data: any;
  };
}

export default function Reminders() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // Fetch reminders
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const response = await api.get<{ reminders: Reminder[] }>('/reminders');
      return response.data.reminders;
    },
  });

  // Delete reminder mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reminders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const getReminderTypeLabel = (type: string) => {
    switch (type) {
      case 'morning':
        return 'Morning';
      case 'evening':
        return 'Evening';
      case 'overdue':
        return 'Overdue';
      case 'custom':
        return 'Custom';
      default:
        return type;
    }
  };

  const getReminderTypeColor = (type: string) => {
    switch (type) {
      case 'morning':
        return 'bg-yellow-100 text-yellow-700';
      case 'evening':
        return 'bg-primary-100 text-primary-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      case 'custom':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage scheduled task reminders
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary inline-flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Schedule Reminder
        </button>
      </div>

      {/* Reminder Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Schedule New Reminder
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Reminders are sent via WhatsApp to supervisors. Configure reminder
            settings below.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Reminder Type</label>
              <select className="input">
                <option value="morning">Morning Summary (9:00 AM)</option>
                <option value="evening">Evening Summary (5:00 PM)</option>
                <option value="overdue">Overdue Alert</option>
                <option value="custom">Custom Time</option>
              </select>
            </div>
            <div>
              <label className="label">Schedule Time</label>
              <input type="datetime-local" className="input" />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Message Template</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Enter reminder message..."
              defaultValue="You have pending tasks that require attention."
            />
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button className="btn-primary">Schedule</button>
          </div>
        </div>
      )}

      {/* Reminder Settings */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Automatic Reminders
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">Morning Summary</p>
                <p className="text-sm text-gray-500">Daily at 9:00 AM</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Clock className="h-5 w-5 text-primary-600" />
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">Evening Summary</p>
                <p className="text-sm text-gray-500">Daily at 5:00 PM</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Bell className="h-5 w-5 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">Overdue Alerts</p>
                <p className="text-sm text-gray-500">Immediate notification</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Scheduled Reminders List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Scheduled Reminders
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : reminders && reminders.length > 0 ? (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.reminder_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center flex-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`badge ${getReminderTypeColor(reminder.reminder_type)}`}
                      >
                        {getReminderTypeLabel(reminder.reminder_type)}
                      </span>
                      {reminder.is_sent && (
                        <span className="badge bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sent
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Scheduled: {formatDateTime(reminder.scheduled_time)}
                    </p>
                    {reminder.message_template && (
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {reminder.message_template}
                      </p>
                    )}
                  </div>
                </div>
                {!reminder.is_sent && (
                  <button
                    onClick={() => deleteMutation.mutate(reminder.reminder_id)}
                    className="ml-4 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No scheduled reminders</p>
            <p className="text-sm text-gray-400">
              Automatic reminders are configured above
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
