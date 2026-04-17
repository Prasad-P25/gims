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
  UserContext,
} from '../types';

export interface ProjectResolution {
  project_id: string | null;
  reason: 'explicit' | 'sticky' | 'single_team_project' | 'none' | 'ambiguous';
  /** Candidate project IDs when reason === 'ambiguous' (for Telegram/WhatsApp follow-up prompt). */
  candidates?: Array<{ project_id: string; name_english: string; name_marathi?: string | null }>;
}

export class TaskService {
  /**
   * Resolve the project_id for a new task using cascading rules:
   *   1. Explicit project_id in the request (validate team access)
   *   2. User's active_project_id (validate team access)
   *   3. If user's team is in exactly one project — use it
   *   4. Else null (with candidates list if 2+ projects — caller can prompt)
   *
   * Returns both the resolved project_id and the reason, so the caller (Telegram/WhatsApp)
   * can decide whether to send a follow-up "Which project?" prompt.
   */
  async resolveProjectForUser(
    userId: string,
    requestedProjectId?: string | null
  ): Promise<ProjectResolution> {
    // Load user + team info once
    const userResult = await query<{
      user_id: string;
      team_id: string | null;
      active_project_id: string | null;
      role: string;
    }>(
      `SELECT user_id, team_id, active_project_id, role
       FROM users
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) {
      return { project_id: null, reason: 'none' };
    }

    // Helper — is the user's team (if any) in this project?
    const teamInProject = async (projectId: string): Promise<boolean> => {
      if (user.role === 'super_admin') {
        // super_admin can pick any active project
        const r = await query(
          `SELECT 1 FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
          [projectId]
        );
        return r.rows.length > 0;
      }
      if (!user.team_id) return false;
      const r = await query(
        `SELECT 1 FROM project_teams pt
         JOIN projects p ON p.project_id = pt.project_id
         WHERE pt.project_id = $1 AND pt.team_id = $2 AND p.deleted_at IS NULL`,
        [projectId, user.team_id]
      );
      return r.rows.length > 0;
    };

    // 1. Explicit wins — but validate
    if (requestedProjectId) {
      if (await teamInProject(requestedProjectId)) {
        return { project_id: requestedProjectId, reason: 'explicit' };
      }
      logger.warn('Task creation: explicit project_id rejected (no access)', {
        userId,
        requestedProjectId,
      });
      // fall through to sticky / auto logic instead of failing hard
    }

    // 2. Sticky (active_project_id) — if user still has access
    if (user.active_project_id && (await teamInProject(user.active_project_id))) {
      return { project_id: user.active_project_id, reason: 'sticky' };
    }

    // 3. If user's team is in exactly one project — auto-assign
    if (user.team_id) {
      const r = await query<{ project_id: string; name_english: string; name_marathi: string | null }>(
        `SELECT p.project_id, p.name_english, p.name_marathi
         FROM project_teams pt
         JOIN projects p ON p.project_id = pt.project_id
         WHERE pt.team_id = $1 AND p.deleted_at IS NULL AND p.status != 'archived'
         ORDER BY p.name_english`,
        [user.team_id]
      );
      if (r.rows.length === 1) {
        return { project_id: r.rows[0].project_id, reason: 'single_team_project' };
      }
      if (r.rows.length >= 2) {
        // Ambiguous — caller can prompt
        return {
          project_id: null,
          reason: 'ambiguous',
          candidates: r.rows.map((row) => ({
            project_id: row.project_id,
            name_english: row.name_english,
            name_marathi: row.name_marathi,
          })),
        };
      }
    }

    return { project_id: null, reason: 'none' };
  }

  /**
   * Create a new task registry entry.
   * Resolves project_id via cascading rules (explicit → sticky → team-has-one → null).
   */
  async createTask(
    input: TaskCreateInput,
    userId: string
  ): Promise<TaskRegistry & { _projectResolution?: ProjectResolution }> {
    // Auto-assign to team admin if no assignee specified
    let assignedTo = input.assigned_to || null;
    if (!assignedTo) {
      const teamResult = await query(
        `SELECT t.admin_id FROM teams t
         JOIN users u ON u.team_id = t.team_id
         WHERE u.user_id = $1 AND u.deleted_at IS NULL AND t.deleted_at IS NULL`,
        [userId]
      );
      if (teamResult.rows[0]?.admin_id) {
        assignedTo = teamResult.rows[0].admin_id;
        logger.info('Auto-assigned task to team admin', { userId, adminId: assignedTo });
      }
    }

    // Cascading project resolution (explicit passed via input.project_id if provided)
    const resolution = await this.resolveProjectForUser(
      userId,
      input.project_id === null ? undefined : input.project_id
    );

    const sql = `
      INSERT INTO task_registry (
        category_id, registered_by, assigned_to, project_id, task_data, input_mode, input_source,
        input_language, original_input, transcription, priority, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      input.category_id,
      userId,
      assignedTo,
      resolution.project_id,
      JSON.stringify(input.task_data),
      input.input_mode,
      input.input_source || 'web',
      input.input_language || null,
      input.original_input || null,
      input.transcription || null,
      input.priority || 'medium',
      input.status || 'pending',
    ];

    const result = await query<TaskRegistry>(sql, values);
    const row = result.rows[0];
    logger.info('Task created', {
      registryId: row.registry_id,
      userId,
      assignedTo,
      projectId: resolution.project_id,
      projectResolution: resolution.reason,
    });
    return { ...row, _projectResolution: resolution };
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
        c.field_template,
        p.name_english as project_name
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      LEFT JOIN projects p ON tr.project_id = p.project_id
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
   * Role-based filtering:
   * - super_admin: sees all tasks
   * - admin: sees all tasks from their team
   * - member: sees only their own tasks
   */
  async getTasks(
    filters: TaskFilters,
    pagination: PaginationParams,
    userContext?: UserContext
  ): Promise<{ tasks: TaskRegistry[]; meta: PaginationMeta }> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ['tr.deleted_at IS NULL'];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (userContext) {
      if (userContext.role === 'member') {
        // Members see tasks they created OR tasks assigned to them
        conditions.push(`(tr.registered_by = $${paramIndex} OR tr.assigned_to = $${paramIndex})`);
        values.push(userContext.user_id);
        paramIndex++;
      } else if (userContext.role === 'admin' && userContext.team_id) {
        // Admins see all tasks from their team members (created by OR assigned to)
        conditions.push(`(
          tr.registered_by IN (SELECT user_id FROM users WHERE team_id = $${paramIndex} AND deleted_at IS NULL)
          OR tr.assigned_to IN (SELECT user_id FROM users WHERE team_id = $${paramIndex} AND deleted_at IS NULL)
        )`);
        values.push(userContext.team_id);
        paramIndex++;
      }
      // super_admin sees all tasks (no filter needed)
    }

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

    if (filters.assigned_to) {
      conditions.push(`tr.assigned_to = $${paramIndex++}`);
      values.push(filters.assigned_to);
    }

    if (filters.project_id) {
      conditions.push(`tr.project_id = $${paramIndex++}`);
      values.push(filters.project_id);
    }

    if (filters.team_id) {
      conditions.push(`tr.registered_by IN (
        SELECT user_id FROM users WHERE team_id = $${paramIndex++} AND deleted_at IS NULL
      )`);
      values.push(filters.team_id);
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
        u.name as registered_by_name,
        ua.name as assigned_to_name,
        p.name_english as project_name
      FROM task_registry tr
      JOIN categories c ON tr.category_id = c.category_id
      LEFT JOIN users u ON tr.registered_by = u.user_id
      LEFT JOIN users ua ON tr.assigned_to = ua.user_id
      LEFT JOIN projects p ON tr.project_id = p.project_id
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

    if (input.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(input.assigned_to);
    }

    if (input.project_id !== undefined) {
      updates.push(`project_id = $${paramIndex++}`);
      values.push(input.project_id);
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
    dateTo?: Date,
    userContext?: UserContext
  ): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    byCategory: Array<{ category_id: number; name: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
  }> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const trConditions: string[] = ['tr.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dateFrom && dateTo) {
      conditions.push(`registration_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      trConditions.push(`tr.registration_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(dateFrom, dateTo);
      paramIndex += 2;
    }

    // Role-based filtering
    if (userContext) {
      if (userContext.role === 'member') {
        conditions.push(`(registered_by = $${paramIndex} OR assigned_to = $${paramIndex})`);
        trConditions.push(`(tr.registered_by = $${paramIndex} OR tr.assigned_to = $${paramIndex})`);
        params.push(userContext.user_id);
        paramIndex++;
      } else if (userContext.role === 'admin' && userContext.team_id) {
        conditions.push(`(registered_by IN (SELECT user_id FROM users WHERE team_id = $${paramIndex} AND deleted_at IS NULL) OR assigned_to IN (SELECT user_id FROM users WHERE team_id = $${paramIndex} AND deleted_at IS NULL))`);
        trConditions.push(`(tr.registered_by IN (SELECT user_id FROM users WHERE team_id = $${paramIndex} AND deleted_at IS NULL) OR tr.assigned_to IN (SELECT user_id FROM users WHERE team_id = $${paramIndex} AND deleted_at IS NULL))`);
        params.push(userContext.team_id);
        paramIndex++;
      }
      // super_admin sees all
    }

    const whereClause = conditions.join(' AND ');
    const trWhereClause = trConditions.join(' AND ');

    // Overall stats
    const statsSql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM task_registry
      WHERE ${whereClause}
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
      WHERE ${trWhereClause}
      GROUP BY tr.category_id, c.name_english
      ORDER BY count DESC
    `;
    const categoryResult = await query(categorySql, params);

    // By priority
    const prioritySql = `
      SELECT priority, COUNT(*) as count
      FROM task_registry
      WHERE ${whereClause}
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

  /**
   * Get users that can be assigned tasks
   * - super_admin: can assign to admins only (they will delegate to members)
   * - admin: can assign to their team members only
   * - member: cannot assign (returns empty array)
   */
  async getAssignableUsers(userContext: UserContext): Promise<Array<{ user_id: string; name: string; role: string; team_name?: string }>> {
    if (userContext.role === 'member') {
      return [];
    }

    let sql: string;
    let params: unknown[] = [];

    if (userContext.role === 'super_admin') {
      // Super admin can assign to admins only (hierarchical delegation)
      sql = `
        SELECT u.user_id, u.name, u.role, t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.team_id
        WHERE u.role = 'admin'
          AND u.deleted_at IS NULL
          AND u.is_active = true
        ORDER BY t.name, u.name
      `;
    } else if (userContext.role === 'admin' && userContext.team_id) {
      // Admin can assign to their team members only
      sql = `
        SELECT user_id, name, role
        FROM users
        WHERE team_id = $1
          AND role = 'member'
          AND deleted_at IS NULL
          AND is_active = true
        ORDER BY name
      `;
      params = [userContext.team_id];
    } else {
      return [];
    }

    const result = await query<{ user_id: string; name: string; role: string; team_name?: string }>(sql, params);
    return result.rows;
  }
}

// Export singleton instance
export const taskService = new TaskService();
