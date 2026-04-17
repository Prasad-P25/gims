import { query, getClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectTeamAssignment,
  ProjectDashboardStats,
  UserRole,
} from '../types';

interface AccessContext {
  user_id: string;
  role: UserRole;
  team_id?: string;
}

export class ProjectService {
  /**
   * Build a WHERE clause fragment that scopes projects by user access.
   * super_admin: sees all
   * admin / member: sees only projects their team is in
   * Returns both the SQL fragment and the parameter array, plus the next param index.
   */
  private accessFilter(
    ctx: AccessContext,
    startIdx = 1
  ): { sql: string; values: unknown[]; nextIdx: number } {
    if (ctx.role === 'super_admin') {
      return { sql: '', values: [], nextIdx: startIdx };
    }
    if (!ctx.team_id) {
      // admin/member without a team => sees nothing
      return { sql: ' AND FALSE', values: [], nextIdx: startIdx };
    }
    const sql = ` AND EXISTS (
      SELECT 1 FROM project_teams pt
      WHERE pt.project_id = p.project_id AND pt.team_id = $${startIdx}
    )`;
    return { sql, values: [ctx.team_id], nextIdx: startIdx + 1 };
  }

  /**
   * Create a project (optionally assigning teams).
   */
  async createProject(input: ProjectCreateInput, createdBy: string): Promise<Project> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const insertSql = `
        INSERT INTO projects (
          name_english, name_marathi, description, location, status,
          start_date, end_date, budget, project_manager_id,
          contact_person_name, contact_person_phone, contact_person_email,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const values = [
        input.name_english,
        input.name_marathi || null,
        input.description || null,
        input.location || null,
        input.status || 'active',
        input.start_date || null,
        input.end_date || null,
        input.budget ?? null,
        input.project_manager_id || null,
        input.contact_person_name || null,
        input.contact_person_phone || null,
        input.contact_person_email || null,
        createdBy,
      ];

      const result = await client.query<Project>(insertSql, values);
      const project = result.rows[0];

      // Assign teams if provided
      if (input.team_ids && input.team_ids.length > 0) {
        const assignSql = `
          INSERT INTO project_teams (project_id, team_id, assigned_by)
          SELECT $1, UNNEST($2::uuid[]), $3
          ON CONFLICT DO NOTHING
        `;
        await client.query(assignSql, [project.project_id, input.team_ids, createdBy]);
      }

      await client.query('COMMIT');
      logger.info('Project created', { projectId: project.project_id, createdBy });
      return project;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List projects visible to the user.
   */
  async listProjects(ctx: AccessContext, status?: string): Promise<Project[]> {
    const access = this.accessFilter(ctx, 1);
    const values: unknown[] = [...access.values];
    let paramIdx = access.nextIdx;

    let statusFilter = '';
    if (status) {
      statusFilter = ` AND p.status = $${paramIdx++}`;
      values.push(status);
    }

    const sql = `
      SELECT
        p.*,
        u.name AS project_manager_name,
        cu.name AS created_by_name,
        (SELECT COUNT(*) FROM project_teams pt WHERE pt.project_id = p.project_id) AS team_count,
        (SELECT COUNT(*) FROM task_registry tr WHERE tr.project_id = p.project_id AND tr.deleted_at IS NULL) AS task_count,
        (SELECT COUNT(*) FROM task_registry tr WHERE tr.project_id = p.project_id AND tr.status = 'completed' AND tr.deleted_at IS NULL) AS completed_task_count
      FROM projects p
      LEFT JOIN users u  ON p.project_manager_id = u.user_id
      LEFT JOIN users cu ON p.created_by        = cu.user_id
      WHERE p.deleted_at IS NULL
        ${access.sql}
        ${statusFilter}
      ORDER BY p.created_at DESC
    `;

    const result = await query<Project>(sql, values);
    return result.rows.map((p) => ({
      ...p,
      task_count: Number(p.task_count || 0),
      completed_task_count: Number(p.completed_task_count || 0),
      team_count: Number(p.team_count || 0),
      progress_percent:
        Number(p.task_count || 0) > 0
          ? Math.round((Number(p.completed_task_count || 0) / Number(p.task_count || 0)) * 100)
          : 0,
    }));
  }

  /**
   * Get a project by ID (respecting access).
   * Returns null if not found OR user has no access.
   */
  async getProjectById(projectId: string, ctx: AccessContext): Promise<Project | null> {
    const access = this.accessFilter(ctx, 2);
    const sql = `
      SELECT
        p.*,
        u.name AS project_manager_name,
        cu.name AS created_by_name,
        (SELECT COUNT(*) FROM project_teams pt WHERE pt.project_id = p.project_id) AS team_count,
        (SELECT COUNT(*) FROM task_registry tr WHERE tr.project_id = p.project_id AND tr.deleted_at IS NULL) AS task_count,
        (SELECT COUNT(*) FROM task_registry tr WHERE tr.project_id = p.project_id AND tr.status = 'completed' AND tr.deleted_at IS NULL) AS completed_task_count
      FROM projects p
      LEFT JOIN users u  ON p.project_manager_id = u.user_id
      LEFT JOIN users cu ON p.created_by        = cu.user_id
      WHERE p.project_id = $1 AND p.deleted_at IS NULL
        ${access.sql}
    `;
    const values = [projectId, ...access.values];
    const result = await query<Project>(sql, values);
    const p = result.rows[0];
    if (!p) return null;
    return {
      ...p,
      task_count: Number(p.task_count || 0),
      completed_task_count: Number(p.completed_task_count || 0),
      team_count: Number(p.team_count || 0),
      progress_percent:
        Number(p.task_count || 0) > 0
          ? Math.round((Number(p.completed_task_count || 0) / Number(p.task_count || 0)) * 100)
          : 0,
    };
  }

  /**
   * Update a project (fields only; team assignments use separate methods).
   */
  async updateProject(projectId: string, input: ProjectUpdateInput): Promise<Project | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Array<[keyof ProjectUpdateInput, string]> = [
      ['name_english', 'name_english'],
      ['name_marathi', 'name_marathi'],
      ['description', 'description'],
      ['location', 'location'],
      ['status', 'status'],
      ['start_date', 'start_date'],
      ['end_date', 'end_date'],
      ['budget', 'budget'],
      ['project_manager_id', 'project_manager_id'],
      ['contact_person_name', 'contact_person_name'],
      ['contact_person_phone', 'contact_person_phone'],
      ['contact_person_email', 'contact_person_email'],
    ];

    for (const [key, col] of fieldMap) {
      if (input[key] !== undefined) {
        updates.push(`${col} = $${idx++}`);
        values.push(input[key]);
      }
    }

    if (updates.length === 0) {
      const result = await query<Project>('SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL', [projectId]);
      return result.rows[0] || null;
    }

    const sql = `
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE project_id = $${idx} AND deleted_at IS NULL
      RETURNING *
    `;
    values.push(projectId);

    const result = await query<Project>(sql, values);
    if (result.rows[0]) {
      logger.info('Project updated', { projectId });
    }
    return result.rows[0] || null;
  }

  /**
   * Soft delete a project.
   */
  async deleteProject(projectId: string): Promise<boolean> {
    const sql = `
      UPDATE projects
      SET deleted_at = NOW()
      WHERE project_id = $1 AND deleted_at IS NULL
      RETURNING project_id
    `;
    const result = await query(sql, [projectId]);
    if (result.rows[0]) {
      logger.info('Project deleted', { projectId });
      return true;
    }
    return false;
  }

  /**
   * Assign one or more teams to a project.
   */
  async assignTeams(projectId: string, teamIds: string[], assignedBy: string): Promise<void> {
    if (teamIds.length === 0) return;
    const sql = `
      INSERT INTO project_teams (project_id, team_id, assigned_by)
      SELECT $1, UNNEST($2::uuid[]), $3
      ON CONFLICT DO NOTHING
    `;
    await query(sql, [projectId, teamIds, assignedBy]);
    logger.info('Teams assigned to project', { projectId, teamIds });
  }

  /**
   * Remove a team from a project.
   */
  async removeTeam(projectId: string, teamId: string): Promise<boolean> {
    const sql = `
      DELETE FROM project_teams
      WHERE project_id = $1 AND team_id = $2
      RETURNING project_id
    `;
    const result = await query(sql, [projectId, teamId]);
    return result.rows.length > 0;
  }

  /**
   * List teams assigned to a project.
   */
  async getProjectTeams(projectId: string): Promise<ProjectTeamAssignment[]> {
    const sql = `
      SELECT pt.project_id, pt.team_id, t.name AS team_name,
             pt.assigned_at, pt.assigned_by
      FROM project_teams pt
      JOIN teams t ON pt.team_id = t.team_id
      WHERE pt.project_id = $1 AND t.deleted_at IS NULL
      ORDER BY pt.assigned_at DESC
    `;
    const result = await query<ProjectTeamAssignment>(sql, [projectId]);
    return result.rows;
  }

  /**
   * List projects assigned to a given team.
   */
  async getProjectsForTeam(teamId: string): Promise<Project[]> {
    const sql = `
      SELECT p.*
      FROM projects p
      JOIN project_teams pt ON pt.project_id = p.project_id
      WHERE pt.team_id = $1 AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
    `;
    const result = await query<Project>(sql, [teamId]);
    return result.rows;
  }

  /**
   * Projects my team is in (for dropdowns).
   */
  async getMyProjects(teamId: string | undefined): Promise<Project[]> {
    if (!teamId) return [];
    return this.getProjectsForTeam(teamId);
  }

  /**
   * Dashboard stats for a single project.
   */
  async getDashboard(projectId: string, ctx: AccessContext): Promise<ProjectDashboardStats | null> {
    const project = await this.getProjectById(projectId, ctx);
    if (!project) return null;

    const teamsSql = `
      SELECT t.team_id, t.name,
             (SELECT COUNT(*) FROM users u WHERE u.team_id = t.team_id AND u.deleted_at IS NULL) AS member_count
      FROM project_teams pt
      JOIN teams t ON pt.team_id = t.team_id
      WHERE pt.project_id = $1 AND t.deleted_at IS NULL
      ORDER BY t.name
    `;
    const teamsResult = await query<{ team_id: string; name: string; member_count: string }>(teamsSql, [projectId]);

    const taskSql = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')   AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')   AS cancelled,
        COUNT(*)                                        AS total,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'in_progress')
            AND task_data->>'due_date' IS NOT NULL
            AND task_data->>'due_date' <> ''
            AND task_data->>'due_date' ~ '^\\d{4}-\\d{2}-\\d{2}'
            AND (task_data->>'due_date')::date < CURRENT_DATE
        ) AS overdue
      FROM task_registry
      WHERE project_id = $1 AND deleted_at IS NULL
    `;
    const taskResult = await query<{
      pending: string; in_progress: string; completed: string; cancelled: string; total: string; overdue: string;
    }>(taskSql, [projectId]);
    const t = taskResult.rows[0];

    const perTeamSql = `
      SELECT t.team_id, t.name AS team_name,
             COUNT(tr.registry_id) AS task_count,
             COUNT(tr.registry_id) FILTER (WHERE tr.status = 'completed') AS completed_count
      FROM project_teams pt
      JOIN teams t ON pt.team_id = t.team_id
      LEFT JOIN users u ON u.team_id = t.team_id AND u.deleted_at IS NULL
      LEFT JOIN task_registry tr
        ON tr.project_id = pt.project_id
       AND (tr.assigned_to = u.user_id OR tr.registered_by = u.user_id)
       AND tr.deleted_at IS NULL
      WHERE pt.project_id = $1 AND t.deleted_at IS NULL
      GROUP BY t.team_id, t.name
      ORDER BY t.name
    `;
    const perTeamResult = await query<{ team_id: string; team_name: string; task_count: string; completed_count: string }>(
      perTeamSql,
      [projectId]
    );

    const total = Number(t.total || 0);
    const completed = Number(t.completed || 0);

    return {
      project,
      teams: teamsResult.rows.map((r) => ({
        team_id: r.team_id,
        name: r.name,
        member_count: Number(r.member_count || 0),
      })),
      total_tasks: total,
      pending_tasks: Number(t.pending || 0),
      in_progress_tasks: Number(t.in_progress || 0),
      completed_tasks: completed,
      cancelled_tasks: Number(t.cancelled || 0),
      overdue_tasks: Number(t.overdue || 0),
      progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      per_team_breakdown: perTeamResult.rows.map((r) => ({
        team_id: r.team_id,
        team_name: r.team_name,
        task_count: Number(r.task_count || 0),
        completed_count: Number(r.completed_count || 0),
      })),
    };
  }

  /**
   * Check whether a given team is assigned to a given project.
   * Used by task creation to validate project selection.
   */
  async isTeamInProject(projectId: string, teamId: string): Promise<boolean> {
    const sql = `SELECT 1 FROM project_teams WHERE project_id = $1 AND team_id = $2`;
    const result = await query(sql, [projectId, teamId]);
    return result.rows.length > 0;
  }
}

export const projectService = new ProjectService();
