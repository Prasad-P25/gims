import { query, transaction } from '../config/database';
import { logger } from '../utils/logger';
import {
  TaskRegistry,
  TaskCreateInput,
  TaskUpdateInput,
  TaskFilters,
  PaginationParams,
  PaginationMeta,
  Category,
  VoiceMessage,
} from '../types';

export class TaskService {
  /**
   * Create a new task registry entry
   */
  async createTask(
    input: TaskCreateInput,
    userId: string
  ): Promise<TaskRegistry> {
    const sql = `
      INSERT INTO task_registry (
        category_id, registered_by, task_data, input_mode,
        input_language, original_input, transcription, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      input.category_id,
      userId,
      JSON.stringify(input.task_data),
      input.input_mode,
      input.input_language || null,
      input.original_input || null,
      input.transcription || null,
      input.priority || 'medium',
    ];

    const result = await query<TaskRegistry>(sql, values);
    logger.info('Task created', { registryId: result.rows[0].registry_id, userId });
    return result.rows[0];
  }

  /**
   * Get task by ID
   */
  async getTaskById(registryId: string): Promise<TaskRegistry | null> {
    const sql = `
      SELECT * FROM task_registry
      WHERE registry_id = $1 AND deleted_at IS NULL
    `;
    const result = await query<TaskRegistry>(sql, [registryId]);
    return result.rows[0] || null;
  }

  /**
   * Get task with category details
   */
  async getTaskWithCategory(registryId: string): Promise<(TaskRegistry & { category: Category }) | null> {
    const sql = `
      SELECT
        tr.*,
        c.name_english as category_name_english,
        c.name_marathi as category_name_marathi,
        c.field_template
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      WHERE tr.registry_id = $1 AND tr.deleted_at IS NULL
    `;
    const result = await query(sql, [registryId]);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      ...row,
      category: {
        category_id: row.category_id,
        name_english: row.category_name_english,
        name_marathi: row.category_name_marathi,
        field_template: row.field_template,
      } as Category,
    } as TaskRegistry & { category: Category };
  }

  /**
   * Get tasks with filters and pagination
   */
  async getTasks(
    filters: TaskFilters,
    pagination: PaginationParams
  ): Promise<{ tasks: TaskRegistry[]; meta: PaginationMeta }> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ['tr.deleted_at IS NULL'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.category_id) {
      conditions.push(`tr.category_id = $${paramIndex++}`);
      values.push(filters.category_id);
    }

    if (filters.status) {
      conditions.push(`tr.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.priority) {
      conditions.push(`tr.priority = $${paramIndex++}`);
      values.push(filters.priority);
    }

    if (filters.registered_by) {
      conditions.push(`tr.registered_by = $${paramIndex++}`);
      values.push(filters.registered_by);
    }

    if (filters.date_from) {
      conditions.push(`tr.registration_date >= $${paramIndex++}`);
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push(`tr.registration_date <= $${paramIndex++}`);
      values.push(filters.date_to);
    }

    if (filters.search) {
      conditions.push(`(
        tr.task_data::text ILIKE $${paramIndex} OR
        tr.transcription ILIKE $${paramIndex} OR
        tr.original_input ILIKE $${paramIndex}
      )`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sort column
    const allowedSortColumns = ['created_at', 'registration_date', 'status', 'priority'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM task_registry tr
      WHERE ${whereClause}
    `;
    const countResult = await query<{ total: string }>(countSql, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const dataSql = `
      SELECT
        tr.*,
        c.name_english as category_name_english,
        c.name_marathi as category_name_marathi,
        u.name as registered_by_name
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      JOIN users u ON tr.registered_by = u.user_id
      WHERE ${whereClause}
      ORDER BY tr.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    values.push(limit, offset);

    const dataResult = await query<TaskRegistry>(dataSql, values);

    return {
      tasks: dataResult.rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update task
   */
  async updateTask(
    registryId: string,
    input: TaskUpdateInput,
    userId: string
  ): Promise<TaskRegistry | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(input.category_id);
    }

    if (input.task_data !== undefined) {
      updates.push(`task_data = $${paramIndex++}`);
      values.push(JSON.stringify(input.task_data));
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }

    if (updates.length === 0) {
      return this.getTaskById(registryId);
    }

    updates.push('updated_at = NOW()');

    const sql = `
      UPDATE task_registry
      SET ${updates.join(', ')}
      WHERE registry_id = $${paramIndex++} AND deleted_at IS NULL
      RETURNING *
    `;
    values.push(registryId);

    const result = await query<TaskRegistry>(sql, values);
    if (result.rows[0]) {
      logger.info('Task updated', { registryId, userId });
    }
    return result.rows[0] || null;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    registryId: string,
    status: TaskRegistry['status'],
    userId: string
  ): Promise<TaskRegistry | null> {
    return this.updateTask(registryId, { status }, userId);
  }

  /**
   * Soft delete task
   */
  async deleteTask(registryId: string, userId: string): Promise<boolean> {
    const sql = `
      UPDATE task_registry
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE registry_id = $1 AND deleted_at IS NULL
      RETURNING registry_id
    `;
    const result = await query(sql, [registryId]);
    if (result.rows[0]) {
      logger.info('Task deleted', { registryId, userId });
      return true;
    }
    return false;
  }

  /**
   * Get tasks by category
   */
  async getTasksByCategory(
    categoryId: number,
    pagination: PaginationParams
  ): Promise<{ tasks: TaskRegistry[]; meta: PaginationMeta }> {
    return this.getTasks({ category_id: categoryId }, pagination);
  }

  /**
   * Get today's tasks
   */
  async getTodaysTasks(userId?: string): Promise<TaskRegistry[]> {
    const sql = `
      SELECT tr.*, c.name_english, c.name_marathi
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      WHERE tr.registration_date = CURRENT_DATE
        AND tr.deleted_at IS NULL
        ${userId ? 'AND tr.registered_by = $1' : ''}
      ORDER BY tr.created_at DESC
    `;
    const result = await query<TaskRegistry>(sql, userId ? [userId] : []);
    return result.rows;
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(userId?: string): Promise<TaskRegistry[]> {
    const sql = `
      SELECT tr.*, c.name_english, c.name_marathi
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      WHERE tr.status = 'pending'
        AND tr.deleted_at IS NULL
        ${userId ? 'AND tr.registered_by = $1' : ''}
      ORDER BY
        CASE tr.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        tr.created_at ASC
    `;
    const result = await query<TaskRegistry>(sql, userId ? [userId] : []);
    return result.rows;
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: string, limit: number = 10): Promise<TaskRegistry[]> {
    const sql = `
      SELECT tr.*, c.name_english, c.name_marathi
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      WHERE tr.status = $1
        AND tr.deleted_at IS NULL
      ORDER BY
        CASE tr.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        tr.created_at DESC
      LIMIT $2
    `;
    const result = await query<TaskRegistry>(sql, [status, limit]);
    return result.rows;
  }

  /**
   * Get today's tasks
   */
  async getTodayTasks(): Promise<TaskRegistry[]> {
    const sql = `
      SELECT tr.*, c.name_english, c.name_marathi
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      WHERE DATE(tr.created_at) = CURRENT_DATE
        AND tr.deleted_at IS NULL
      ORDER BY
        CASE tr.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        tr.created_at DESC
    `;
    const result = await query<TaskRegistry>(sql);
    return result.rows;
  }

  /**
   * Get all tasks summary (for bot status command)
   */
  async getAllTasksSummary(): Promise<{
    pending: TaskRegistry[];
    inProgress: TaskRegistry[];
    completed: TaskRegistry[];
    todayCount: number;
  }> {
    const [pending, inProgress, completed, todayTasks] = await Promise.all([
      this.getTasksByStatus('pending', 5),
      this.getTasksByStatus('in_progress', 5),
      this.getTasksByStatus('completed', 5),
      this.getTodayTasks(),
    ]);

    return {
      pending,
      inProgress,
      completed,
      todayCount: todayTasks.length,
    };
  }

  /**
   * Get task statistics
   */
  async getTaskStats(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    byCategory: Array<{ category_id: number; name: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
  }> {
    const dateCondition = dateFrom && dateTo
      ? 'AND registration_date BETWEEN $1 AND $2'
      : '';
    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];

    // Overall stats
    const statsSql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM task_registry
      WHERE deleted_at IS NULL ${dateCondition}
    `;
    const statsResult = await query(statsSql, params);
    const stats = statsResult.rows[0];

    // By category
    const categorySql = `
      SELECT
        tr.category_id,
        c.name_english as name,
        COUNT(*) as count
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      WHERE tr.deleted_at IS NULL ${dateCondition}
      GROUP BY tr.category_id, c.name_english
      ORDER BY count DESC
    `;
    const categoryResult = await query(categorySql, params);

    // By priority
    const prioritySql = `
      SELECT priority, COUNT(*) as count
      FROM task_registry
      WHERE deleted_at IS NULL ${dateCondition}
      GROUP BY priority
    `;
    const priorityResult = await query(prioritySql, params);

    return {
      total: parseInt(stats.total, 10),
      pending: parseInt(stats.pending, 10),
      inProgress: parseInt(stats.in_progress, 10),
      completed: parseInt(stats.completed, 10),
      cancelled: parseInt(stats.cancelled, 10),
      byCategory: categoryResult.rows.map((r) => ({
        category_id: r.category_id,
        name: r.name,
        count: parseInt(r.count, 10),
      })),
      byPriority: priorityResult.rows.map((r) => ({
        priority: r.priority,
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Save voice message metadata
   */
  async saveVoiceMessage(
    registryId: string,
    data: {
      audioFilePath: string;
      durationSeconds?: number;
      fileSizeBytes?: number;
      detectedLanguage?: string;
      transcription?: string;
      confidenceScore?: number;
    }
  ): Promise<VoiceMessage> {
    const sql = `
      INSERT INTO voice_messages (
        registry_id, audio_file_path, duration_seconds,
        file_size_bytes, detected_language, transcription,
        confidence_score, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const result = await query<VoiceMessage>(sql, [
      registryId,
      data.audioFilePath,
      data.durationSeconds || null,
      data.fileSizeBytes || null,
      data.detectedLanguage || null,
      data.transcription || null,
      data.confidenceScore || null,
    ]);

    return result.rows[0];
  }

  /**
   * Get all categories
   */
  async getCategories(activeOnly = true): Promise<Category[]> {
    const sql = `
      SELECT * FROM categories
      ${activeOnly ? 'WHERE is_active = true' : ''}
      ORDER BY display_order ASC
    `;
    const result = await query<Category>(sql);
    return result.rows;
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId: number): Promise<Category | null> {
    const sql = 'SELECT * FROM categories WHERE category_id = $1';
    const result = await query<Category>(sql, [categoryId]);
    return result.rows[0] || null;
  }
}

// Export singleton instance
export const taskService = new TaskService();
