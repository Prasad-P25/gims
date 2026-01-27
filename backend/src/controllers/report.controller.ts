import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { reportService } from '../services/report.service';
import { sendSuccess, sendNotFound, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest, ReportFilters } from '../types';

export class ReportController {
  /**
   * Generate a report
   */
  async generateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filters: ReportFilters = {
      type: req.body.type,
      format: req.body.format,
      date_from: new Date(req.body.date_from),
      date_to: new Date(req.body.date_to),
      category_ids: req.body.category_ids,
      include_summary: req.body.include_summary ?? true,
    };

    const userId = req.user!.user_id;
    const { filePath, fileName } = await reportService.generateReport(filters, userId);

    sendSuccess(res, {
      fileName,
      downloadUrl: `/reports/download/${encodeURIComponent(fileName)}`,
    }, 'Report generated successfully');
  }

  /**
   * Download a generated report
   */
  async downloadReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { reportId } = req.params;

    // Sanitize filename to prevent directory traversal
    const sanitizedFileName = path.basename(reportId);
    const filePath = path.join(process.cwd(), 'uploads', 'reports', sanitizedFileName);

    if (!fs.existsSync(filePath)) {
      sendNotFound(res, 'Report not found');
      return;
    }

    // Determine content type
    const ext = path.extname(sanitizedFileName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dateParam = req.query.date as string;
    const format = (req.query.format as 'pdf' | 'excel') || 'pdf';

    const date = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const filters: ReportFilters = {
      type: 'daily',
      format,
      date_from: startOfDay,
      date_to: endOfDay,
      include_summary: true,
    };

    const userId = req.user!.user_id;
    const { filePath, fileName } = await reportService.generateReport(filters, userId);

    sendSuccess(res, {
      fileName,
      downloadUrl: `/reports/download/${encodeURIComponent(fileName)}`,
    });
  }

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const weekStartParam = req.query.week_start as string;
    const format = (req.query.format as 'pdf' | 'excel') || 'pdf';

    const weekStart = weekStartParam ? new Date(weekStartParam) : new Date();
    // Set to start of week (Monday)
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const filters: ReportFilters = {
      type: 'weekly',
      format,
      date_from: weekStart,
      date_to: weekEnd,
      include_summary: true,
    };

    const userId = req.user!.user_id;
    const { filePath, fileName } = await reportService.generateReport(filters, userId);

    sendSuccess(res, {
      fileName,
      downloadUrl: `/reports/download/${encodeURIComponent(fileName)}`,
    });
  }

  /**
   * Generate monthly report
   */
  async generateMonthlyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const format = (req.query.format as 'pdf' | 'excel') || 'pdf';

    if (!year || !month || month < 1 || month > 12) {
      sendBadRequest(res, 'Invalid year or month');
      return;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const filters: ReportFilters = {
      type: 'monthly',
      format,
      date_from: startDate,
      date_to: endDate,
      include_summary: true,
    };

    const userId = req.user!.user_id;
    const { filePath, fileName } = await reportService.generateReport(filters, userId);

    sendSuccess(res, {
      fileName,
      downloadUrl: `/reports/download/${encodeURIComponent(fileName)}`,
    });
  }
}

export const reportController = new ReportController();
