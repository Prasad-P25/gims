import { z } from 'zod';

// Common validators
export const uuidSchema = z.string().uuid('Invalid UUID format');

export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
  .transform((val) => val.replace(/\D/g, ''));

export const emailSchema = z.string().email('Invalid email format').optional().or(z.literal(''));

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Team validators
export const teamCreateSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  admin_id: uuidSchema.optional(),
});

export const teamUpdateSchema = teamCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// Project validators
const projectStatusEnum = z.enum(['active', 'on_hold', 'completed', 'archived']);

const optionalDate = z.coerce.date().optional().nullable();
const optionalStr = (max: number) =>
  z.string().max(max).optional().nullable().or(z.literal('')).transform((v) => (v === '' ? undefined : v));

export const projectCreateSchema = z.object({
  name_english: z.string().min(2, 'Project code must be at least 2 characters').max(200),
  name_marathi: z.string().min(1, 'Client name is required').max(200),
  po_number: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(300).optional(),
  status: projectStatusEnum.default('active'),
  start_date: optionalDate,
  end_date: optionalDate,
  budget: z.coerce.number().nonnegative().optional().nullable(),
  project_manager_id: uuidSchema.optional().or(z.literal('')).transform((v) => v || undefined),
  contact_person_name: z.string().max(200).optional(),
  contact_person_phone: z.string().max(20).optional(),
  contact_person_email: z.string().email('Invalid email').optional().or(z.literal('')).transform((v) => v || undefined),
  team_ids: z.array(uuidSchema).optional(),
}).refine(
  (data) => !data.start_date || !data.end_date || data.start_date <= data.end_date,
  { message: 'end_date must be after start_date', path: ['end_date'] }
);

export const projectUpdateSchema = z.object({
  name_english: z.string().min(2).max(200).optional(),
  name_marathi: z.string().min(1, 'Client name is required').max(200).optional(),
  po_number: optionalStr(100),
  description: optionalStr(5000),
  location: optionalStr(300),
  status: projectStatusEnum.optional(),
  start_date: optionalDate,
  end_date: optionalDate,
  budget: z.coerce.number().nonnegative().optional().nullable(),
  project_manager_id: uuidSchema.optional().nullable().or(z.literal('')).transform((v) => (v === '' ? null : v)),
  contact_person_name: optionalStr(200),
  contact_person_phone: optionalStr(20),
  contact_person_email: z.string().email().optional().nullable().or(z.literal('')).transform((v) => (v === '' ? null : v)),
});

export const projectTeamAssignSchema = z.object({
  team_ids: z.array(uuidSchema).min(1, 'Provide at least one team_id'),
});

// User validators
export const userCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: phoneSchema,
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  role: z.enum(['super_admin', 'admin', 'member']),
  team_id: uuidSchema.optional().or(z.literal('')).transform(val => val || undefined),
  preferred_language: z.enum(['marathi', 'english', 'hindi']).default('marathi'),
});

export const userUpdateSchema = userCreateSchema.partial();

// Auth validators
export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Task validators
export const taskCreateSchema = z.object({
  category_id: z.coerce.number().int().positive('Category is required'),
  task_data: z.record(z.unknown()).refine((data) => Object.keys(data).length > 0, {
    message: 'Task data cannot be empty',
  }),
  input_mode: z.enum(['voice', 'text']),
  input_language: z.string().optional(),
  original_input: z.string().optional(),
  transcription: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  assigned_to: uuidSchema.optional().or(z.literal('')).transform(val => val || undefined),
  project_id: uuidSchema.optional().nullable().or(z.literal('')).transform(val => {
    if (val === undefined) return undefined;
    return val || null;
  }),
});

export const taskUpdateSchema = z.object({
  category_id: z.coerce.number().int().positive().optional(),
  task_data: z.record(z.unknown()).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  assigned_to: uuidSchema.nullable().optional().or(z.literal('')).transform(val => {
    if (val === undefined) return undefined;
    return val || null;
  }),
  project_id: uuidSchema.nullable().optional().or(z.literal('')).transform(val => {
    if (val === undefined) return undefined;
    return val || null;
  }),
});

export const taskFiltersSchema = z.object({
  category_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  registered_by: uuidSchema.optional(),
  assigned_to: uuidSchema.optional(),
  project_id: uuidSchema.optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  search: z.string().optional(),
});

// Reminder validators
export const reminderCreateSchema = z.object({
  user_id: uuidSchema,
  registry_id: uuidSchema.optional(),
  reminder_type: z.enum(['morning', 'evening', 'overdue', 'custom']),
  scheduled_time: z.coerce.date(),
  message_template: z.string().optional(),
});

export const reminderUpdateSchema = reminderCreateSchema.partial();

// Report validators
export const reportFiltersSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  format: z.enum(['pdf', 'excel']),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
  category_ids: z.array(z.coerce.number().int().positive()).optional(),
  status: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional()
  ),
  include_summary: z.coerce.boolean().default(true),
});

export const projectReportFiltersSchema = z.object({
  project_id: uuidSchema,
  date_from: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.date().optional()
  ),
  date_to: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.date().optional()
  ),
  status: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional()
  ),
  category_id: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().positive().optional()
  ),
  include_task_details: z.preprocess(
    (v) => {
      if (v === '' || v == null) return true;
      if (v === 'false' || v === false) return false;
      return true;
    },
    z.boolean().default(true)
  ),
});

// Date validation helpers
export const dateRangeSchema = z
  .object({
    date_from: z.coerce.date(),
    date_to: z.coerce.date(),
  })
  .refine((data) => data.date_from <= data.date_to, {
    message: 'date_from must be before or equal to date_to',
    path: ['date_from'],
  });

// Category validators
export const categoryCreateSchema = z.object({
  name_english: z.string().min(1).max(100),
  name_marathi: z.string().min(1).max(100),
  description: z.string().optional(),
  field_template: z.record(z.unknown()).optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();
