import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { generateTokens, verifyRefreshToken } from '../middlewares/auth.middleware';
import { sendSuccess, sendCreated, sendUnauthorized, sendBadRequest, sendNotFound } from '../utils/response';
import { User, AuthenticatedRequest, AuthPayload } from '../types';

export class AuthController {
  /**
   * User login
   */
  async login(req: Request, res: Response): Promise<void> {
    const { phone, password } = req.body;

    const result = await query<User>(
      'SELECT * FROM users WHERE phone = $1 AND deleted_at IS NULL',
      [phone]
    );

    const user = result.rows[0];

    if (!user) {
      sendUnauthorized(res, 'Invalid phone number or password');
      return;
    }

    if (!user.is_active) {
      sendUnauthorized(res, 'Account is deactivated');
      return;
    }

    if (!user.password_hash) {
      sendUnauthorized(res, 'Password not set for this account');
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      sendUnauthorized(res, 'Invalid phone number or password');
      return;
    }

    const payload: AuthPayload = {
      user_id: user.user_id,
      phone: user.phone,
      role: user.role,
      team_id: user.team_id,
    };

    const tokens = generateTokens(payload);

    logger.info('User logged in', { userId: user.user_id });

    sendSuccess(res, {
      user: {
        user_id: user.user_id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        team_id: user.team_id,
        preferred_language: user.preferred_language,
      },
      ...tokens,
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;

    try {
      const payload = verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const result = await query<User>(
        'SELECT * FROM users WHERE user_id = $1 AND is_active = true AND deleted_at IS NULL',
        [payload.user_id]
      );

      if (!result.rows[0]) {
        sendUnauthorized(res, 'User not found or deactivated');
        return;
      }

      const user = result.rows[0];
      const newPayload: AuthPayload = {
        user_id: user.user_id,
        phone: user.phone,
        role: user.role,
        team_id: user.team_id,
      };

      const tokens = generateTokens(newPayload);
      sendSuccess(res, tokens);
    } catch {
      sendUnauthorized(res, 'Invalid or expired refresh token');
    }
  }

  /**
   * Register new user (admin only)
   */
  async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { name, phone, email, password, role, team_id, preferred_language } = req.body;
    const currentUser = req.user;

    // Check if phone already exists
    const existing = await query(
      'SELECT 1 FROM users WHERE phone = $1',
      [phone]
    );

    if (existing.rows.length > 0) {
      sendBadRequest(res, 'Phone number already registered');
      return;
    }

    // Determine team_id based on who is creating the user
    let assignedTeamId = team_id;

    // If admin is creating a user, assign to admin's team automatically
    if (currentUser?.role === 'admin' && currentUser.team_id) {
      assignedTeamId = currentUser.team_id;
      // Admin can only create members
      if (role !== 'member') {
        sendBadRequest(res, 'Admin can only create member users');
        return;
      }
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await query<User>(
      `INSERT INTO users (name, phone, email, password_hash, role, team_id, preferred_language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, name, phone, email, role, team_id, preferred_language, is_active, created_at`,
      [name, phone, email || null, passwordHash, role, assignedTeamId || null, preferred_language || 'marathi']
    );

    logger.info('User registered', { userId: result.rows[0].user_id, teamId: assignedTeamId });

    sendCreated(res, result.rows[0], 'User registered successfully');
  }

  /**
   * Get current user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;

    const result = await query<User>(
      `SELECT user_id, name, phone, email, role, preferred_language, is_active, created_at
       FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (!result.rows[0]) {
      sendNotFound(res, 'User not found');
      return;
    }

    sendSuccess(res, result.rows[0]);
  }

  /**
   * Update current user profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    const { name, email, preferred_language } = req.body;

    const result = await query<User>(
      `UPDATE users
       SET name = COALESCE($2, name),
           email = COALESCE($3, email),
           preferred_language = COALESCE($4, preferred_language),
           updated_at = NOW()
       WHERE user_id = $1 AND deleted_at IS NULL
       RETURNING user_id, name, phone, email, role, preferred_language`,
      [userId, name, email, preferred_language]
    );

    if (!result.rows[0]) {
      sendNotFound(res, 'User not found');
      return;
    }

    sendSuccess(res, result.rows[0], 'Profile updated successfully');
  }

  /**
   * Change password
   */
  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    const { currentPassword, newPassword } = req.body;

    const result = await query<User>(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId]
    );

    if (!result.rows[0]) {
      sendNotFound(res, 'User not found');
      return;
    }

    if (result.rows[0].password_hash) {
      const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!isValid) {
        sendBadRequest(res, 'Current password is incorrect');
        return;
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE user_id = $1',
      [userId, newHash]
    );

    logger.info('Password changed', { userId });
    sendSuccess(res, null, 'Password changed successfully');
  }

  /**
   * Logout (placeholder - actual logout is client-side token deletion)
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    // In a production system, you might want to:
    // - Add the token to a blacklist in Redis
    // - Invalidate refresh tokens in database

    logger.info('User logged out', { userId: req.user?.user_id });
    sendSuccess(res, null, 'Logged out successfully');
  }

  /**
   * Get all users
   * - super_admin: all users
   * - admin: only their team members
   */
  async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const currentUser = req.user;

    let sql: string;
    let params: unknown[] = [];

    if (currentUser?.role === 'super_admin') {
      // Super admin sees all users
      sql = `
        SELECT u.user_id, u.name, u.phone, u.email, u.role, u.team_id,
               u.preferred_language, u.is_active, u.created_at,
               t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.team_id
        WHERE u.deleted_at IS NULL
        ORDER BY u.created_at DESC
      `;
    } else if (currentUser?.role === 'admin' && currentUser.team_id) {
      // Admin sees only their team members
      sql = `
        SELECT u.user_id, u.name, u.phone, u.email, u.role, u.team_id,
               u.preferred_language, u.is_active, u.created_at,
               t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.team_id
        WHERE u.team_id = $1 AND u.deleted_at IS NULL
        ORDER BY u.created_at DESC
      `;
      params = [currentUser.team_id];
    } else {
      sendSuccess(res, []);
      return;
    }

    const result = await query<User>(sql, params);
    sendSuccess(res, result.rows);
  }

  /**
   * Toggle user active status (admin only)
   */
  async toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.params;

    const result = await query<User>(
      `UPDATE users
       SET is_active = NOT is_active, updated_at = NOW()
       WHERE user_id = $1 AND deleted_at IS NULL
       RETURNING user_id, name, phone, email, role, preferred_language, is_active`,
      [userId]
    );

    if (!result.rows[0]) {
      sendNotFound(res, 'User not found');
      return;
    }

    logger.info('User status toggled', { userId, isActive: result.rows[0].is_active });
    sendSuccess(res, result.rows[0], `User ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`);
  }

  /**
   * Update user details (admin/super_admin only)
   */
  async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.params;
    const { name, phone, email, role, team_id, preferred_language, password } = req.body;
    const currentUser = req.user;

    // Check if user exists
    const existing = await query<User>(
      'SELECT * FROM users WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (!existing.rows[0]) {
      sendNotFound(res, 'User not found');
      return;
    }

    const targetUser = existing.rows[0];

    // Admins can only edit members in their own team
    if (currentUser?.role === 'admin') {
      if (targetUser.team_id !== currentUser.team_id) {
        sendBadRequest(res, 'You can only edit users in your own team');
        return;
      }
      if (role && role !== 'member') {
        sendBadRequest(res, 'Admins can only assign member role');
        return;
      }
    }

    // Check phone uniqueness if changed
    if (phone && phone !== targetUser.phone) {
      const phoneExists = await query(
        'SELECT 1 FROM users WHERE phone = $1 AND user_id != $2',
        [phone, userId]
      );
      if (phoneExists.rows.length > 0) {
        sendBadRequest(res, 'Phone number already in use');
        return;
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email || null);
    }
    if (role !== undefined && currentUser?.role === 'super_admin') {
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }
    if (team_id !== undefined && currentUser?.role === 'super_admin') {
      updates.push(`team_id = $${paramIndex++}`);
      values.push(team_id || null);
    }
    if (preferred_language !== undefined) {
      updates.push(`preferred_language = $${paramIndex++}`);
      values.push(preferred_language);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      sendBadRequest(res, 'No fields to update');
      return;
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    const sql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex} AND deleted_at IS NULL
      RETURNING user_id, name, phone, email, role, team_id, preferred_language, is_active, created_at
    `;

    const result = await query<User>(sql, values);

    logger.info('User updated', { userId, updatedBy: currentUser?.user_id });
    sendSuccess(res, result.rows[0], 'User updated successfully');
  }
}

export const authController = new AuthController();
