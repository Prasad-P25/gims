// User types
export type UserRole = 'admin' | 'supervisor';

export interface User {
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  preferred_language: 'marathi' | 'english' | 'hindi';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Category types
export interface Category {
  category_id: number;
  name_english: string;
  name_marathi: string;
  description?: string;
  field_template?: Record<string, FieldTemplate>;
  display_order: number;
  is_active: boolean;
}

export interface FieldTemplate {
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  label_english: string;
  label_marathi: string;
  required: boolean;
  options?: string[];
}

// Task types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'high' | 'medium' | 'low';
export type InputMode = 'voice' | 'text';
export type InputSource = 'web' | 'telegram' | 'whatsapp';

export interface Task {
  registry_id: string;
  category_id: number;
  registered_by: string;
  registration_date: string;
  registration_time: string;
  task_data: Record<string, unknown>;
  input_mode: InputMode;
  input_source: InputSource;
  input_language?: string;
  original_input?: string;
  transcription?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_name_english?: string;
  category_name_marathi?: string;
  registered_by_name?: string;
}

export interface TaskCreateInput {
  category_id: number;
  task_data: Record<string, unknown>;
  input_mode: InputMode;
  input_language?: string;
  priority?: TaskPriority;
}

export interface TaskUpdateInput {
  category_id?: number;
  task_data?: Record<string, unknown>;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface TaskFilters {
  category_id?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// Dashboard types
export interface DashboardStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  todayTasks: number;
  byCategory: Array<{ category_id: number; name: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  tasks: T[];
  meta: PaginationMeta;
}

// Report types
export type ReportFormat = 'pdf' | 'excel';
export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportFilters {
  type: ReportType;
  format: ReportFormat;
  date_from: string;
  date_to: string;
  category_ids?: number[];
  include_summary?: boolean;
}

export interface ReportResponse {
  fileName: string;
  downloadUrl: string;
}
