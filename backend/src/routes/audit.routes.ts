import { Router, Response } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { AuthenticatedRequest } from '../types';
import { query } from '../config/database';
import { sendSuccess } from '../utils/response';

const router = Router();

interface AuditLog {
  log_id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  performed_by: string | null;
  performed_by_name?: string;
  performed_at: string;
  ip_address: string | null;
}

// GET /api/audit - Get audit logs (super_admin only)
router.get(
  '/',
  authenticate,
  authorize('super_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = 1, limit = 50, table_name, action, user_id, from_date, to_date } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (table_name) {
      conditions.push(`a.table_name = $${paramIndex++}`);
      values.push(table_name);
    }

    if (action) {
      conditions.push(`a.action = $${paramIndex++}`);
      values.push(action);
    }

    if (user_id) {
      conditions.push(`a.performed_by = $${paramIndex++}`);
      values.push(user_id);
    }

    if (from_date) {
      conditions.push(`a.performed_at >= $${paramIndex++}`);
      values.push(from_date);
    }

    if (to_date) {
      conditions.push(`a.performed_at <= $${paramIndex++}`);
      values.push(to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_log a ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total);

    // Get audit logs with user name
    const sql = `
      SELECT
        a.log_id,
        a.table_name,
        a.record_id,
        a.action,
        a.old_data,
        a.new_data,
        a.performed_by,
        u.name as performed_by_name,
        a.performed_at,
        a.ip_address
      FROM audit_log a
      LEFT JOIN users u ON a.performed_by = u.user_id
      ${whereClause}
      ORDER BY a.performed_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limitNum, offset);
    const result = await query<AuditLog>(sql, values);

    sendSuccess(res, {
      logs: result.rows,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

// GET /api/audit/stats - Get audit statistics
router.get(
  '/stats',
  authenticate,
  authorize('super_admin'),
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const statsResult = await query(`
      SELECT
        action,
        COUNT(*) as count
      FROM audit_log
      WHERE performed_at >= NOW() - INTERVAL '30 days'
      GROUP BY action
      ORDER BY count DESC
    `);

    const tableResult = await query(`
      SELECT
        table_name,
        COUNT(*) as count
      FROM audit_log
      WHERE performed_at >= NOW() - INTERVAL '30 days'
      GROUP BY table_name
      ORDER BY count DESC
    `);

    const recentActivityResult = await query(`
      SELECT
        DATE(performed_at) as date,
        COUNT(*) as count
      FROM audit_log
      WHERE performed_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(performed_at)
      ORDER BY date DESC
    `);

    sendSuccess(res, {
      byAction: statsResult.rows,
      byTable: tableResult.rows,
      recentActivity: recentActivityResult.rows,
    });
  })
);

export default router;
