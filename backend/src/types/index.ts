import { Request } from 'express';

// User types
export type UserRole = 'admin' | 'supervisor';
export type PreferredLanguage = 'marathi' | 'english' | 'hindi';

export interface User {
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  password_hash?: string;
  role: UserRole;
  preferred_language: PreferredLanguage;
  telegram_id?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface UserCreateInput {
  name: string;
  phone: string;
  email?: string;
  password?: string;
  role: UserRole;
  preferred_language?: PreferredLanguage;
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

export interface TaskRegistry {
  registry_id: string;
  category_id: number;
  registered_by: string;
  registered_by_name?: string;
  registration_date: Date;
  registration_time: string;
  task_data: Record<string, unknown>;
  input_mode: InputMode;
  input_source: InputSource;
  input_language?: string;
  original_input?: string;
  transcription?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface TaskCreateInput {
  category_id: number;
  task_data: Record<string, unknown>;
  input_mode: InputMode;
  input_source?: InputSource;
  input_language?: string;
  original_input?: string;
  transcription?: string;
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
  registered_by?: string;
  date_from?: Date;
  date_to?: Date;
  search?: string;
}

// Voice message types
export interface VoiceMessage {
  voice_id: string;
  registry_id: string;
  audio_file_path: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  detected_language?: string;
  transcription?: string;
  confidence_score?: number;
  created_at: Date;
}

// Reminder types
export type ReminderType = 'morning' | 'evening' | 'overdue' | 'custom';

export interface Reminder {
  reminder_id: string;
  user_id: string;
  registry_id?: string;
  reminder_type: ReminderType;
  scheduled_time: Date;
  message_template?: string;
  is_sent: boolean;
  sent_at?: Date;
  created_at: Date;
}

export interface ReminderCreateInput {
  user_id: string;
  registry_id?: string;
  reminder_type: ReminderType;
  scheduled_time: Date;
  message_template?: string;
}

// Audit log types
export type AuditAction = 'create' | 'update' | 'delete' | 'restore';

export interface AuditLog {
  log_id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  performed_by: string;
  performed_at: Date;
}

// WhatsApp types
export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'audio' | 'image' | 'document' | 'interactive';
  text?: { body: string };
  audio?: {
    id: string;
    mime_type: string;
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
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

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Auth types
export interface AuthPayload {
  user_id: string;
  phone: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

// Dashboard types
export interface DashboardStats {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  todayTasks: number;
  categoryBreakdown: Array<{
    category_id: number;
    name: string;
    count: number;
  }>;
  recentTasks: TaskRegistry[];
}

// Report types
export type ReportFormat = 'pdf' | 'excel';
export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportFilters {
  type: ReportType;
  format: ReportFormat;
  date_from: Date;
  date_to: Date;
  category_ids?: number[];
  include_summary?: boolean;
}
