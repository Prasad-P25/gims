import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import { reportFiltersSchema, projectReportFiltersSchema } from '../utils/validators';
import { asyncHandler } from '../middlewares/error.middleware';
import { reportController } from '../controllers/report.controller';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// POST /api/reports/generate - Generate a report
router.post(
  '/generate',
  validateBody(reportFiltersSchema),
  asyncHandler((req, res) => reportController.generateReport(req as AuthenticatedRequest, res))
);

// GET /api/reports/download/:reportId - Download generated report
router.get(
  '/download/:reportId',
  asyncHandler((req, res) => reportController.downloadReport(req as AuthenticatedRequest, res))
);

// GET /api/reports/daily - Generate daily report
router.get(
  '/daily',
  validateQuery(z.object({
    date: z.coerce.date().optional(),
    format: z.enum(['pdf', 'excel']).default('pdf'),
  })),
  asyncHandler((req, res) => reportController.generateDailyReport(req as AuthenticatedRequest, res))
);

// GET /api/reports/weekly - Generate weekly report
router.get(
  '/weekly',
  validateQuery(z.object({
    week_start: z.coerce.date().optional(),
    format: z.enum(['pdf', 'excel']).default('pdf'),
  })),
  asyncHandler((req, res) => reportController.generateWeeklyReport(req as AuthenticatedRequest, res))
);

// GET /api/reports/monthly - Generate monthly report
router.get(
  '/monthly',
  validateQuery(z.object({
    year: z.coerce.number().int().min(2020).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    format: z.enum(['pdf', 'excel']).default('pdf'),
  })),
  asyncHandler((req, res) => reportController.generateMonthlyReport(req as AuthenticatedRequest, res))
);

// GET /api/reports/project - Generate project-scoped PDF report
router.get(
  '/project',
  validateQuery(projectReportFiltersSchema),
  asyncHandler((req, res) => reportController.generateProjectReport(req as AuthenticatedRequest, res))
);

export default router;
