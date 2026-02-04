import { query } from '../config/database';
import { logger } from '../utils/logger';
import { Team, TeamCreateInput, TeamUpdateInput, User } from '../types';

export class TeamService {
  /**
   * Create a new team
   */
  async createTeam(input: TeamCreateInput): Promise<Team> {
    const sql = `
      INSERT INTO teams (name, description, admin_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [
      input.name,
      input.description || null,
      input.admin_id || null,
    ];

    const result = await query<Team>(sql, values);

    // If admin_id provided, update the user's team_id and role
    if (input.admin_id) {
      await query(
        `UPDATE users SET team_id = $1, role = 'admin' WHERE user_id = $2`,
        [result.rows[0].team_id, input.admin_id]
      );
    }

    logger.info('Team created', { teamId: result.rows[0].team_id });
    return result.rows[0];
  }

  /**
   * Get all teams with member count
   */
  async getAllTeams(): Promise<Team[]> {
    const sql = `
      SELECT
        t.*,
        u.name as admin_name,
        (SELECT COUNT(*) FROM users WHERE team_id = t.team_id AND deleted_at IS NULL) as member_count
      FROM teams t
      LEFT JOIN users u ON t.admin_id = u.user_id
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `;
    const result = await query<Team>(sql);
    return result.rows;
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId: string): Promise<Team | null> {
    const sql = `
      SELECT
        t.*,
        u.name as admin_name,
        (SELECT COUNT(*) FROM users WHERE team_id = t.team_id AND deleted_at IS NULL) as member_count
      FROM teams t
      LEFT JOIN users u ON t.admin_id = u.user_id
      WHERE t.team_id = $1 AND t.deleted_at IS NULL
    `;
    const result = await query<Team>(sql, [teamId]);
    return result.rows[0] || null;
  }

  /**
   * Update team
   */
  async updateTeam(teamId: string, input: TeamUpdateInput): Promise<Team | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (input.admin_id !== undefined) {
      updates.push(`admin_id = $${paramIndex++}`);
      values.push(input.admin_id);
    }

    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      return this.getTeamById(teamId);
    }

    updates.push('updated_at = NOW()');

    const sql = `
      UPDATE teams
      SET ${updates.join(', ')}
      WHERE team_id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;
    values.push(teamId);

    const result = await query<Team>(sql, values);
    if (result.rows[0]) {
      logger.info('Team updated', { teamId });
    }
    return result.rows[0] || null;
  }

  /**
   * Soft delete team
   */
  async deleteTeam(teamId: string): Promise<boolean> {
    // First, remove team_id from all users in this team
    await query(`UPDATE users SET team_id = NULL WHERE team_id = $1`, [teamId]);

    const sql = `
      UPDATE teams
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE team_id = $1 AND deleted_at IS NULL
      RETURNING team_id
    `;
    const result = await query(sql, [teamId]);
    if (result.rows[0]) {
      logger.info('Team deleted', { teamId });
      return true;
    }
    return false;
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<User[]> {
    const sql = `
      SELECT user_id, name, phone, email, role, preferred_language, telegram_id, is_active, created_at
      FROM users
      WHERE team_id = $1 AND deleted_at IS NULL
      ORDER BY role ASC, name ASC
    `;
    const result = await query<User>(sql, [teamId]);
    return result.rows;
  }

  /**
   * Add user to team
   */
  async addUserToTeam(teamId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<boolean> {
    const sql = `
      UPDATE users
      SET team_id = $1, role = $2, updated_at = NOW()
      WHERE user_id = $3 AND deleted_at IS NULL
      RETURNING user_id
    `;
    const result = await query(sql, [teamId, role, userId]);
    if (result.rows[0]) {
      logger.info('User added to team', { teamId, userId, role });
      return true;
    }
    return false;
  }

  /**
   * Remove user from team
   */
  async removeUserFromTeam(userId: string): Promise<boolean> {
    const sql = `
      UPDATE users
      SET team_id = NULL, updated_at = NOW()
      WHERE user_id = $1 AND deleted_at IS NULL
      RETURNING user_id
    `;
    const result = await query(sql, [userId]);
    if (result.rows[0]) {
      logger.info('User removed from team', { userId });
      return true;
    }
    return false;
  }

  /**
   * Get users without a team (for assignment)
   */
  async getUnassignedUsers(): Promise<User[]> {
    const sql = `
      SELECT user_id, name, phone, email, role, preferred_language, is_active, created_at
      FROM users
      WHERE team_id IS NULL AND role != 'super_admin' AND deleted_at IS NULL
      ORDER BY name ASC
    `;
    const result = await query<User>(sql);
    return result.rows;
  }

  /**
   * Check if user is admin of team
   */
  async isTeamAdmin(userId: string, teamId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM teams WHERE team_id = $1 AND admin_id = $2 AND deleted_at IS NULL
    `;
    const result = await query(sql, [teamId, userId]);
    return result.rows.length > 0;
  }

  /**
   * Get team by admin ID
   */
  async getTeamByAdminId(adminId: string): Promise<Team | null> {
    const sql = `
      SELECT t.*,
        (SELECT COUNT(*) FROM users WHERE team_id = t.team_id AND deleted_at IS NULL) as member_count
      FROM teams t
      WHERE t.admin_id = $1 AND t.deleted_at IS NULL
    `;
    const result = await query<Team>(sql, [adminId]);
    return result.rows[0] || null;
  }
}

export const teamService = new TeamService();
