// Team types
export interface Team {
  team_id: string;
  name: string;
  description?: string;
  admin_id?: string;
  admin_name?: string;
  is_active: boolean;
  member_count?: number;
  created_at: string;
}

// Project types
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export interface Project {
  project_id: string;
  name_english: string;
  name_marathi?: string;
  description?: string;
  location?: string;
  status: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | string | null;
  project_manager_id?: string | null;
  project_manager_name?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
  contact_person_email?: string | null;
  created_by: string;
  created_by_name?: string;
  team_count?: number;
  task_count?: number;
  completed_task_count?: number;
  progress_percent?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  name_english: string;
  name_marathi?: string;
  description?: string;
  location?: string;
  status?: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  project_manager_id?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  team_ids?: string[];
}

export interface ProjectUpdateInput {
  name_english?: string;
  name_marathi?: string | null;
  description?: string | null;
  location?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  project_manager_id?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
  contact_person_email?: string | null;
}

export interface ProjectTeamAssignment {
  project_id: string;
  team_id: string;
  team_name?: string;
  assigned_at: string;
  assigned_by?: string;
}

export interface ProjectDashboardStats {
  project: Project;
  teams: Array<{ team_id: string; name: string; member_count: number }>;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  cancelled_tasks: number;
  overdue_tasks: number;
  progress_percent: number;
  per_team_breakdown: Array<{
    team_id: string;
    team_name: string;
    task_count: number;
    completed_count: number;
  }>;
}

// User types
export type UserRole = 'super_admin' | 'admin' | 'member';

export interface User {
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  team_id?: string;
  team_name?: string;
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
  assigned_to?: string;
  project_id?: string | null;
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
  assigned_to_name?: string;
  project_name?: string | null;
}

export interface AssignableUser {
  user_id: string;
  name: string;
  role: string;
  team_name?: string;
}

export interface TaskCreateInput {
  category_id: number;
  task_data: Record<string, unknown>;
  input_mode: InputMode;
  input_language?: string;
  priority?: TaskPriority;
  assigned_to?: string;
  project_id?: string | null;
}

export interface TaskUpdateInput {
  category_id?: number;
  task_data?: Record<string, unknown>;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  project_id?: string | null;
}

export interface TaskFilters {
  category_id?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string;
  project_id?: string;
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

// Attachment types
export interface Attachment {
  attachment_id: string;
  registry_id: string;
  file_name: string;
  stored_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  uploaded_by_name?: string;
  upload_source: 'web' | 'telegram' | 'whatsapp';
  created_at: string;
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
