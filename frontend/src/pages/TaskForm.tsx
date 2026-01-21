import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { tasksService } from '../services/tasks';
import { dashboardService } from '../services/dashboard';

export default function TaskForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    category_id: '',
    status: 'pending',
    priority: 'medium',
    task_data: {
      title: '',
      description: '',
      applicant_name: '',
      applicant_phone: '',
      due_date: '',
    },
  });

  const [error, setError] = useState('');

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: dashboardService.getCategories,
  });

  // Fetch existing task if editing
  const { data: existingTask, isLoading: taskLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksService.getTask(id!),
    enabled: isEditing,
  });

  // Update form when existing task loads
  useEffect(() => {
    if (existingTask) {
      setFormData({
        category_id: existingTask.category_id?.toString() || '',
        status: existingTask.status,
        priority: existingTask.priority,
        task_data: {
          title: existingTask.task_data?.title || '',
          description: existingTask.task_data?.description || '',
          applicant_name: existingTask.task_data?.applicant_name || '',
          applicant_phone: existingTask.task_data?.applicant_phone || '',
          due_date: existingTask.task_data?.due_date || '',
        },
      });
    }
  }, [existingTask]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: tasksService.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/tasks');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create task');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => tasksService.updateTask(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/tasks');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update task');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      category_id: parseInt(formData.category_id),
      status: formData.status,
      priority: formData.priority,
      task_data: formData.task_data,
      input_mode: 'text',
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (field: string, value: string) => {
    if (field.startsWith('task_data.')) {
      const dataField = field.replace('task_data.', '');
      setFormData((prev) => ({
        ...prev,
        task_data: { ...prev.task_data, [dataField]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditing && taskLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Task' : 'New Task'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEditing ? 'Update task details' : 'Register a new task'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Category */}
        <div>
          <label className="label">Category *</label>
          <select
            value={formData.category_id}
            onChange={(e) => handleChange('category_id', e.target.value)}
            className="input"
            required
          >
            <option value="">Select a category</option>
            {categories?.map((cat) => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.name_english} - {cat.name_marathi}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="label">Title *</label>
          <input
            type="text"
            value={formData.task_data.title}
            onChange={(e) => handleChange('task_data.title', e.target.value)}
            className="input"
            placeholder="Enter task title"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <textarea
            value={formData.task_data.description}
            onChange={(e) => handleChange('task_data.description', e.target.value)}
            className="input"
            rows={4}
            placeholder="Enter task description"
          />
        </div>

        {/* Status and Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="input"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="label">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="input"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Applicant Info */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Applicant Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Applicant Name</label>
              <input
                type="text"
                value={formData.task_data.applicant_name}
                onChange={(e) => handleChange('task_data.applicant_name', e.target.value)}
                className="input"
                placeholder="Enter applicant name"
              />
            </div>

            <div>
              <label className="label">Applicant Phone</label>
              <input
                type="tel"
                value={formData.task_data.applicant_phone}
                onChange={(e) => handleChange('task_data.applicant_phone', e.target.value)}
                className="input"
                placeholder="10-digit phone number"
                pattern="[0-9]{10}"
                maxLength={10}
              />
            </div>
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="label">Due Date</label>
          <input
            type="date"
            value={formData.task_data.due_date}
            onChange={(e) => handleChange('task_data.due_date', e.target.value)}
            className="input"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary inline-flex items-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Task' : 'Create Task'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
