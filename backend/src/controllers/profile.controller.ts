import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';
import { projectService } from '../services/project.service';
import crypto from 'crypto';

export class ProfileController {
  /**
   * Get current user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;

    const result = await query(
      `SELECT user_id, name, email, phone, role, telegram_id, telegram_username, created_at
       FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (!result.rows[0]) {
      sendError(res, 'User not found', 404);
      return;
    }

    const user = result.rows[0];
    sendSuccess(res, {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      telegram_linked: !!user.telegram_id,
      telegram_username: user.telegram_username || null,
      created_at: user.created_at,
    });
  }

  /**
   * Update profile (name, phone, email)
   */
  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const { name, phone, email } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (phone) {
      // Check if phone is already used by another user
      const phoneCheck = await query(
        'SELECT user_id FROM users WHERE phone = $1 AND user_id != $2 AND deleted_at IS NULL',
        [phone, userId]
      );
      if (phoneCheck.rows.length > 0) {
        sendError(res, 'Phone number already in use', 400);
        return;
      }
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }

    if (email) {
      // Check if email is already used by another user
      const emailCheck = await query(
        'SELECT user_id FROM users WHERE email = $1 AND user_id != $2 AND deleted_at IS NULL',
        [email, userId]
      );
      if (emailCheck.rows.length > 0) {
        sendError(res, 'Email already in use', 400);
        return;
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }

    if (updates.length === 0) {
      sendError(res, 'No fields to update', 400);
      return;
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex} AND deleted_at IS NULL
       RETURNING user_id, name, email, phone, role`,
      values
    );

    if (!result.rows[0]) {
      sendError(res, 'Failed to update profile', 500);
      return;
    }

    logger.info('Profile updated', { userId });
    sendSuccess(res, { message: 'Profile updated successfully', user: result.rows[0] });
  }

  /**
   * Change password
   */
  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      sendError(res, 'Current password and new password are required', 400);
      return;
    }

    if (new_password.length < 6) {
      sendError(res, 'New password must be at least 6 characters', 400);
      return;
    }

    // Get current password hash
    const userResult = await query(
      'SELECT password_hash FROM users WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (!userResult.rows[0]) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isValid) {
      sendError(res, 'Current password is incorrect', 401);
      return;
    }

    // Hash new password
    const newHash = await bcrypt.hash(new_password, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [newHash, userId]
    );

    logger.info('Password changed', { userId });
    sendSuccess(res, { message: 'Password changed successfully' });
  }

  /**
   * Generate Telegram link code
   */
  async generateTelegramLinkCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const phone = req.user!.phone;

    if (!phone) {
      sendError(res, 'Phone number is required to link Telegram', 400);
      return;
    }

    // Generate a unique code
    const linkCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Store the code temporarily (expires in 10 minutes)
    // We'll use a simple approach: store in user record or a separate table
    // For simplicity, we'll return the phone number which user uses with /link command

    logger.info('Telegram link code generated', { userId });
    sendSuccess(res, {
      message: 'To link your Telegram account, send the following command to the bot',
      command: `/link ${phone}`,
      instructions: [
        '1. Open Telegram and find the GIMS bot',
        '2. Send the command shown above',
        '3. Your account will be linked automatically',
      ],
    });
  }

  /**
   * Get the user's active (sticky) project.
   */
  async getActiveProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;

    const result = await query<{
      active_project_id: string | null;
      project_id: string | null;
      name_english: string | null;
      name_marathi: string | null;
      status: string | null;
    }>(
      `SELECT u.active_project_id, p.project_id, p.name_english, p.name_marathi, p.status
       FROM users u
       LEFT JOIN projects p ON u.active_project_id = p.project_id AND p.deleted_at IS NULL
       WHERE u.user_id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );

    if (!result.rows[0]) {
      sendError(res, 'User not found', 404);
      return;
    }

    const row = result.rows[0];

    // If the project is gone (soft-deleted / FK set null), clear the sticky reference
    if (row.active_project_id && !row.project_id) {
      await query(`UPDATE users SET active_project_id = NULL WHERE user_id = $1`, [userId]);
      sendSuccess(res, { active_project: null });
      return;
    }

    if (!row.project_id) {
      sendSuccess(res, { active_project: null });
      return;
    }

    sendSuccess(res, {
      active_project: {
        project_id: row.project_id,
        name_english: row.name_english,
        name_marathi: row.name_marathi,
        status: row.status,
      },
    });
  }

  /**
   * Set the user's active (sticky) project.
   * Body: { project_id: string | null }
   * Validation: if project_id is provided, the user's team must be assigned to that project
   *             (super_admin can set any project).
   */
  async setActiveProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    const { project_id } = req.body as { project_id: string | null };

    if (project_id === null || project_id === undefined || project_id === '') {
      // Clear active project
      await query(`UPDATE users SET active_project_id = NULL, updated_at = NOW() WHERE user_id = $1`, [user.user_id]);
      logger.info('Active project cleared', { userId: user.user_id });
      sendSuccess(res, { active_project: null, message: 'Active project cleared' });
      return;
    }

    // Validate UUID format
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(project_id)) {
      sendError(res, 'Invalid project_id', 400);
      return;
    }

    // Check project exists and user has access
    if (user.role !== 'super_admin') {
      if (!user.team_id) {
        sendError(res, 'You do not belong to a team, cannot select a project', 400);
        return;
      }
      const isTeamInProject = await projectService.isTeamInProject(project_id, user.team_id);
      if (!isTeamInProject) {
        sendError(res, 'Your team is not assigned to this project', 403);
        return;
      }
    } else {
      // super_admin: just ensure the project exists and is not deleted
      const exists = await query(
        `SELECT 1 FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
        [project_id]
      );
      if (exists.rows.length === 0) {
        sendError(res, 'Project not found', 404);
        return;
      }
    }

    await query(
      `UPDATE users SET active_project_id = $1, updated_at = NOW() WHERE user_id = $2`,
      [project_id, user.user_id]
    );

    const projectRow = await query<{
      project_id: string;
      name_english: string;
      name_marathi: string | null;
      status: string;
    }>(
      `SELECT project_id, name_english, name_marathi, status FROM projects WHERE project_id = $1`,
      [project_id]
    );

    logger.info('Active project set', { userId: user.user_id, projectId: project_id });
    sendSuccess(res, {
      active_project: projectRow.rows[0] || null,
      message: 'Active project updated',
    });
  }

  /**
   * Unlink Telegram account
   */
  async unlinkTelegram(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;

    const result = await query(
      `UPDATE users SET telegram_id = NULL, telegram_username = NULL, updated_at = NOW()
       WHERE user_id = $1 AND deleted_at IS NULL
       RETURNING user_id`,
      [userId]
    );

    if (!result.rows[0]) {
      sendError(res, 'Failed to unlink Telegram', 500);
      return;
    }

    logger.info('Telegram unlinked', { userId });
    sendSuccess(res, { message: 'Telegram account unlinked successfully' });
  }
}

export const profileController = new ProfileController();
