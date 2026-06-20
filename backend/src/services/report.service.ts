import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Writable } from 'stream';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { taskService } from './task.service';
import { projectService } from './project.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ReportFilters, TaskRegistry, Category, UserContext, ProjectDashboardStats, TaskStatus } from '../types';

export interface ProjectReportFilters {
  project_id: string;
  date_from?: Date;
  date_to?: Date;
  status?: TaskStatus;
  category_id?: number;
  include_task_details?: boolean;
}

interface ReportData {
  tasks: TaskRegistry[];
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    byCategory: Array<{ category_id: number; name: string; count: number }>;
  };
  dateRange: { from: Date; to: Date };
  generatedAt: Date;
}

export class ReportService {
  private reportsDir: string;
  private devanagariFont: string;

  constructor() {
    // Use absolute path for reports directory
    this.reportsDir = path.resolve(process.cwd(), env.UPLOAD_DIR, 'reports');
    // Path to Devanagari font for Marathi text
    this.devanagariFont = path.resolve(process.cwd(), 'assets', 'fonts', 'NotoSansDevanagari-Regular.ttf');

    // Ensure reports directory exists
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
        logger.info('Reports directory created', { path: this.reportsDir });
      }
    } catch (error) {
      logger.error('Failed to create reports directory', { path: this.reportsDir, error });
    }
  }

  /**
   * Check if text contains Devanagari characters
   */
  private containsDevanagari(text: string): boolean {
    // Devanagari Unicode range: 0900-097F
    return /[\u0900-\u097F]/.test(text);
  }

  /**
   * Generate a report based on filters
   */
  async generateReport(
    filters: ReportFilters,
    userId: string,
    userContext?: UserContext
  ): Promise<{ filePath: string; fileName: string }> {
    // Fetch report data (role-filtered)
    const reportData = await this.fetchReportData(filters, userContext);

    // Generate report based on format
    if (filters.format === 'pdf') {
      return this.generatePDFReport(reportData, filters);
    } else {
      return this.generateExcelReport(reportData, filters);
    }
  }

  /**
   * Fetch data for the report
   */
  private async fetchReportData(filters: ReportFilters, userContext?: UserContext): Promise<ReportData> {
    // Strict filtering: report exactly the tasks whose registration_date falls
    // within the selected window, optionally narrowed by status/category.
    const { tasks: allTasks } = await taskService.getTasks(
      {
        date_from: filters.date_from,
        date_to: filters.date_to,
        category_id: filters.category_ids?.[0],
        status: filters.status,
      },
      { page: 1, limit: 10000 },
      userContext
    );

    // Stats reflect everything in the report
    const stats = this.calculateStats(allTasks);

    return {
      tasks: allTasks,
      stats,
      dateRange: { from: filters.date_from, to: filters.date_to },
      generatedAt: new Date(),
    };
  }

  /**
   * Calculate stats from a task list (used when include_open_tasks merges multiple queries)
   */
  private calculateStats(tasks: TaskRegistry[]): ReportData['stats'] {
    const byCategory = new Map<number, { category_id: number; name: string; count: number }>();

    for (const task of tasks) {
      const catName = (task as any).category_name_english || `Category ${task.category_id}`;
      const existing = byCategory.get(task.category_id);
      if (existing) {
        existing.count++;
      } else {
        byCategory.set(task.category_id, { category_id: task.category_id, name: catName, count: 1 });
      }
    }

    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      cancelled: tasks.filter((t) => t.status === 'cancelled').length,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.count - a.count),
    };
  }

  // Color constants for the report
  private colors = {
    primary: '#1e40af',      // Blue
    primaryLight: '#3b82f6',
    secondary: '#6b7280',    // Gray
    success: '#16a34a',      // Green
    warning: '#f59e0b',      // Orange/Yellow
    danger: '#dc2626',       // Red
    info: '#0891b2',         // Cyan
    pending: '#f59e0b',
    inProgress: '#3b82f6',
    completed: '#16a34a',
    cancelled: '#dc2626',
    highPriority: '#dc2626',
    mediumPriority: '#f59e0b',
    lowPriority: '#16a34a',
  };

  /**
   * Generate PDF report with enhanced graphics
   */
  private async generatePDFReport(
    data: ReportData,
    filters: ReportFilters
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `gims_report_${filters.type}_${Date.now()}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
      const writeStream = fs.createWriteStream(filePath);
      const pageHeight = doc.page.height;
      const pageWidth = doc.page.width;
      let currentPage = 1;
      const generatedTime = this.formatDateTime(data.generatedAt);

      // Register Devanagari font for Marathi text
      let hasDevanagariFont = false;
      try {
        if (fs.existsSync(this.devanagariFont)) {
          doc.registerFont('Devanagari', this.devanagariFont);
          hasDevanagariFont = true;
          logger.debug('Devanagari font registered successfully');
        }
      } catch (err) {
        logger.warn('Failed to register Devanagari font', { error: err });
      }

      // Helper to draw text with appropriate font (handles mixed Latin + Devanagari)
      const drawText = (text: string, x: number, y: number, options?: any) => {
        if (!hasDevanagariFont || !this.containsDevanagari(text)) {
          doc.font('Helvetica');
          doc.text(text, x, y, options);
          return;
        }

        // Split text into segments of Devanagari vs Latin
        const segments = text.match(/[\u0900-\u097F\u0980-\u09FF]+|[^\u0900-\u097F\u0980-\u09FF]+/g) || [text];
        let currentX = x;
        const lineBreak = false;

        segments.forEach((segment, idx) => {
          if (this.containsDevanagari(segment)) {
            doc.font('Devanagari');
          } else {
            doc.font('Helvetica');
          }
          const segWidth = doc.widthOfString(segment);
          if (idx === 0) {
            doc.text(segment, currentX, y, { ...options, lineBreak, continued: idx < segments.length - 1 });
          } else {
            doc.text(segment, { lineBreak, continued: idx < segments.length - 1 });
          }
          currentX += segWidth;
        });

        doc.font('Helvetica'); // Reset to default
      };

      // Simple footer drawing function - draws at bottom of current page
      const drawFooter = (pageNum: number) => {
        doc.save();
        doc.font('Helvetica');
        doc.moveTo(40, pageHeight - 45).lineTo(pageWidth - 40, pageHeight - 45).stroke('#e5e7eb');
        doc.fontSize(8).fillColor('#6b7280');
        const footerText = `Page ${pageNum} | GIMS Report | ${generatedTime}`;
        const textWidth = doc.widthOfString(footerText);
        doc.text(footerText, (pageWidth - textWidth) / 2, pageHeight - 35, { lineBreak: false });
        doc.restore();
      };

      doc.pipe(writeStream);

      // ===== PAGE 1: COVER & SUMMARY =====

      // Header Banner
      doc.rect(0, 0, doc.page.width, 120).fill(this.colors.primary);

      // Title
      doc.fontSize(28).fillColor('#ffffff');
      doc.text('GIMS Task Registry', 40, 35, { align: 'center', width: doc.page.width - 80 });
      doc.fontSize(14).fillColor('#93c5fd');
      doc.text('Government Information Management System', 40, 70, { align: 'center', width: doc.page.width - 80 });

      // Report type badge
      doc.roundedRect(doc.page.width / 2 - 60, 95, 120, 22, 3).fill('#ffffff');
      doc.fontSize(10).fillColor(this.colors.primary);
      doc.text(filters.type.toUpperCase() + ' REPORT', doc.page.width / 2 - 60, 100, { align: 'center', width: 120 });

      // Report Info Box
      doc.roundedRect(40, 140, doc.page.width - 80, 60, 5).fill('#f3f4f6');
      doc.fontSize(10).fillColor('#374151');
      doc.text(`Date Range: ${this.formatDate(data.dateRange.from)} to ${this.formatDate(data.dateRange.to)}`, 55, 155);
      doc.text(`Generated: ${this.formatDateTime(data.generatedAt)}`, 55, 175);
      doc.text(`Total Records: ${data.tasks.length}`, 350, 155);

      // ===== SUMMARY CARDS (5 cards) =====
      if (filters.include_summary) {
        const cardY = 220;
        const cardWidth = (doc.page.width - 80) / 5;
        const cardHeight = 70;
        const cardGap = 8;

        // Total Tasks Card
        this.drawStatCard(doc, 40, cardY, cardWidth - cardGap, cardHeight,
          'Total', data.stats.total.toString(), this.colors.primary);

        // Pending Card
        this.drawStatCard(doc, 40 + cardWidth, cardY, cardWidth - cardGap, cardHeight,
          'Pending', data.stats.pending.toString(), this.colors.pending);

        // In Progress Card
        this.drawStatCard(doc, 40 + cardWidth * 2, cardY, cardWidth - cardGap, cardHeight,
          'In Progress', data.stats.inProgress.toString(), this.colors.inProgress);

        // Completed Card
        this.drawStatCard(doc, 40 + cardWidth * 3, cardY, cardWidth - cardGap, cardHeight,
          'Completed', data.stats.completed.toString(), this.colors.completed);

        // Cancelled Card
        this.drawStatCard(doc, 40 + cardWidth * 4, cardY, cardWidth - cardGap, cardHeight,
          'Cancelled', data.stats.cancelled.toString(), this.colors.cancelled);

        // ===== STATUS DISTRIBUTION BAR =====
        const barY = cardY + cardHeight + 30;
        doc.fontSize(12).fillColor('#1f2937').text('Status Distribution', 40, barY);

        const barStartY = barY + 20;
        const barWidth = doc.page.width - 80;
        const barHeight = 25;
        const total = data.stats.total || 1;

        // Background
        doc.roundedRect(40, barStartY, barWidth, barHeight, 4).fill('#e5e7eb');

        // Draw segments
        let currentX = 40;
        if (data.stats.completed > 0) {
          const width = (data.stats.completed / total) * barWidth;
          doc.rect(currentX, barStartY, width, barHeight).fill(this.colors.completed);
          currentX += width;
        }
        if (data.stats.inProgress > 0) {
          const width = (data.stats.inProgress / total) * barWidth;
          doc.rect(currentX, barStartY, width, barHeight).fill(this.colors.inProgress);
          currentX += width;
        }
        if (data.stats.pending > 0) {
          const width = (data.stats.pending / total) * barWidth;
          doc.rect(currentX, barStartY, width, barHeight).fill(this.colors.pending);
          currentX += width;
        }
        if (data.stats.cancelled > 0) {
          const width = (data.stats.cancelled / total) * barWidth;
          doc.rect(currentX, barStartY, width, barHeight).fill(this.colors.cancelled);
        }

        // Legend
        const legendY = barStartY + barHeight + 15;
        this.drawLegendItem(doc, 40, legendY, this.colors.completed, 'Completed');
        this.drawLegendItem(doc, 140, legendY, this.colors.inProgress, 'In Progress');
        this.drawLegendItem(doc, 250, legendY, this.colors.pending, 'Pending');
        this.drawLegendItem(doc, 340, legendY, this.colors.cancelled, 'Cancelled');

        // ===== CATEGORY BREAKDOWN =====
        const catY = legendY + 40;
        doc.fontSize(12).fillColor('#1f2937').text('Tasks by Category', 40, catY);

        let catItemY = catY + 25;
        const maxCatWidth = 300;
        const maxCount = Math.max(...data.stats.byCategory.map(c => c.count), 1);

        data.stats.byCategory.forEach((cat, idx) => {
          if (catItemY > 700) return; // Stop if near bottom

          const barW = (cat.count / maxCount) * maxCatWidth;

          // Category name (use drawText for Marathi support)
          doc.fontSize(9).fillColor('#4b5563');
          drawText(cat.name, 40, catItemY, { width: 180, lineBreak: false });

          // Bar
          doc.roundedRect(230, catItemY, maxCatWidth, 14, 2).fill('#e5e7eb');
          if (barW > 0) {
            doc.roundedRect(230, catItemY, Math.max(barW, 4), 14, 2).fill(this.colors.primaryLight);
          }

          // Count
          doc.fontSize(9).fillColor('#1f2937').text(cat.count.toString(), 540, catItemY);

          catItemY += 22;
        });
      }

      // Footer for page 1
      drawFooter(currentPage);

      // ===== PAGE 2+: TASK DETAILS =====
      if (data.tasks.length > 0) {
        currentPage++;
        doc.addPage();

        // Task Details Header
        doc.rect(0, 0, pageWidth, 50).fill(this.colors.primary);
        doc.fontSize(18).fillColor('#ffffff');
        doc.text('Task Details', 40, 18, { align: 'center', width: pageWidth - 80 });

        let yPos = 70;
        const taskCardHeight = 85;
        const maxYBeforeNewPage = pageHeight - 60; // Leave room for footer

        data.tasks.forEach((task, index) => {
          // Check if we need a new page (leave room for footer)
          if (yPos + taskCardHeight > maxYBeforeNewPage) {
            drawFooter(currentPage);
            currentPage++;
            doc.addPage();
            doc.rect(0, 0, pageWidth, 50).fill(this.colors.primary);
            doc.fontSize(18).fillColor('#ffffff');
            doc.text('Task Details (continued)', 40, 18, { align: 'center', width: pageWidth - 80 });
            yPos = 70;
          }

          // Task Card
          doc.roundedRect(40, yPos, pageWidth - 80, taskCardHeight, 5)
            .fillAndStroke('#fafafa', '#e5e7eb');

          // Task number badge
          doc.roundedRect(50, yPos + 10, 30, 20, 3).fill(this.colors.primary);
          doc.fontSize(10).fillColor('#ffffff');
          doc.text(`${index + 1}`, 50, yPos + 14, { width: 30, align: 'center' });

          // Registry ID
          doc.fontSize(11).fillColor('#1f2937');
          doc.text(`ID: ${task.registry_id.substring(0, 8)}`, 90, yPos + 12);

          // Date
          doc.fontSize(9).fillColor('#6b7280');
          doc.text(this.formatDate(new Date(task.registration_date)), 400, yPos + 12);

          // Status badge
          const statusColor = this.getStatusColor(task.status);
          doc.roundedRect(90, yPos + 32, 70, 18, 3).fill(statusColor);
          doc.fontSize(8).fillColor('#ffffff');
          doc.text(task.status.toUpperCase(), 90, yPos + 36, { width: 70, align: 'center' });

          // Priority badge
          const priorityColor = this.getPriorityColor(task.priority);
          doc.roundedRect(170, yPos + 32, 60, 18, 3).fill(priorityColor);
          doc.fontSize(8).fillColor('#ffffff');
          doc.text(task.priority.toUpperCase(), 170, yPos + 36, { width: 60, align: 'center' });

          // Category
          doc.fontSize(9).fillColor('#4b5563');
          const categoryName = (task as unknown as { category_name_english?: string; category_name_marathi?: string }).category_name_marathi
            || (task as unknown as { category_name_english?: string }).category_name_english
            || `Category ${task.category_id}`;
          drawText(`Category: ${categoryName}`, 250, yPos + 35, { lineBreak: false });

          // Task details (simplified) - use drawText for Marathi support
          const taskData = task.task_data as Record<string, unknown>;
          const title = taskData?.title || taskData?.issue_description || taskData?.description || '';
          const displayTitle = String(title).substring(0, 80);

          doc.fontSize(9).fillColor('#374151');
          drawText(displayTitle + (String(title).length > 80 ? '...' : ''), 90, yPos + 58, {
            width: pageWidth - 150,
            ellipsis: true,
          });

          yPos += taskCardHeight + 8;
        });

        // Footer for last page
        drawFooter(currentPage);
      }

      doc.end();

      writeStream.on('finish', () => {
        logger.info('PDF report generated', { fileName });
        resolve({ filePath, fileName });
      });

      writeStream.on('error', reject);
    });
  }

  /**
   * Draw a stat card
   */
  private drawStatCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    color: string
  ): void {
    // Card background
    doc.roundedRect(x, y, width, height, 5).fill('#ffffff');
    doc.roundedRect(x, y, width, height, 5).stroke('#e5e7eb');

    // Top accent line
    doc.rect(x, y, width, 4).fill(color);

    // Value
    doc.fontSize(24).fillColor(color);
    doc.text(value, x, y + 20, { width, align: 'center' });

    // Label
    doc.fontSize(9).fillColor('#6b7280');
    doc.text(label, x, y + 50, { width, align: 'center' });
  }

  /**
   * Draw a legend item
   */
  private drawLegendItem(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    color: string,
    label: string
  ): void {
    doc.roundedRect(x, y, 12, 12, 2).fill(color);
    doc.fontSize(9).fillColor('#4b5563');
    doc.text(label, x + 18, y + 1);
  }

  /**
   * Get color for status
   */
  private getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      pending: this.colors.pending,
      in_progress: this.colors.inProgress,
      completed: this.colors.completed,
      cancelled: this.colors.cancelled,
    };
    return statusColors[status] || this.colors.secondary;
  }

  /**
   * Get color for priority
   */
  private getPriorityColor(priority: string): string {
    const priorityColors: Record<string, string> = {
      high: this.colors.highPriority,
      medium: this.colors.mediumPriority,
      low: this.colors.lowPriority,
    };
    return priorityColors[priority] || this.colors.secondary;
  }

  /**
   * Generate Excel report
   */
  private async generateExcelReport(
    data: ReportData,
    filters: ReportFilters
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `gims_report_${filters.type}_${Date.now()}.xlsx`;
    const filePath = path.join(this.reportsDir, fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GIMS';
    workbook.created = new Date();

    // Summary sheet
    if (filters.include_summary) {
      const summarySheet = workbook.addWorksheet('Summary');

      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 15 },
      ];

      summarySheet.addRows([
        { metric: 'Report Type', value: filters.type.toUpperCase() },
        { metric: 'Date From', value: this.formatDate(data.dateRange.from) },
        { metric: 'Date To', value: this.formatDate(data.dateRange.to) },
        { metric: 'Generated At', value: this.formatDateTime(data.generatedAt) },
        { metric: '', value: '' },
        { metric: 'Total Tasks', value: data.stats.total },
        { metric: 'Pending', value: data.stats.pending },
        { metric: 'In Progress', value: data.stats.inProgress },
        { metric: 'Completed', value: data.stats.completed },
        { metric: 'Cancelled', value: data.stats.cancelled },
      ]);

      // Style header row
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }

    // Category breakdown sheet
    const categorySheet = workbook.addWorksheet('By Category');
    categorySheet.columns = [
      { header: 'Category', key: 'name', width: 40 },
      { header: 'Task Count', key: 'count', width: 15 },
    ];

    data.stats.byCategory.forEach((cat) => {
      categorySheet.addRow({ name: cat.name, count: cat.count });
    });

    categorySheet.getRow(1).font = { bold: true };
    categorySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    categorySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Tasks sheet
    const tasksSheet = workbook.addWorksheet('Tasks');
    tasksSheet.columns = [
      { header: 'Registry ID', key: 'registry_id', width: 15 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Input Mode', key: 'input_mode', width: 10 },
      { header: 'Details', key: 'details', width: 50 },
    ];

    data.tasks.forEach((task) => {
      tasksSheet.addRow({
        registry_id: task.registry_id.substring(0, 8),
        date: this.formatDate(new Date(task.registration_date)),
        category: (task as unknown as { category_name_english?: string }).category_name_english || `Category ${task.category_id}`,
        status: task.status,
        priority: task.priority,
        input_mode: task.input_mode,
        details: JSON.stringify(task.task_data).substring(0, 200),
      });
    });

    tasksSheet.getRow(1).font = { bold: true };
    tasksSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    tasksSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Auto-filter
    tasksSheet.autoFilter = {
      from: 'A1',
      to: `G${data.tasks.length + 1}`,
    };

    await workbook.xlsx.writeFile(filePath);
    logger.info('Excel report generated', { fileName });

    return { filePath, fileName };
  }

  /**
   * Generate daily summary report
   */
  async generateDailySummary(date: Date = new Date()): Promise<ReportData> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.fetchReportData({
      type: 'daily',
      format: 'pdf',
      date_from: startOfDay,
      date_to: endOfDay,
      include_summary: true,
    });
  }

  /**
   * Generate a project-scoped PDF report.
   * Returns null if the user has no access to the project.
   */
  async generateProjectReport(
    filters: ProjectReportFilters,
    userContext: UserContext
  ): Promise<{ filePath: string; fileName: string } | null> {
    // 1. Get project dashboard data (applies access filter)
    const dashboard = await projectService.getDashboard(filters.project_id, {
      user_id: userContext.user_id,
      role: userContext.role,
      team_id: userContext.team_id,
    });
    if (!dashboard) return null;

    // 2. Fetch tasks for this project with filters
    const { tasks } = await taskService.getTasks(
      {
        project_id: filters.project_id,
        date_from: filters.date_from,
        date_to: filters.date_to,
        status: filters.status,
        category_id: filters.category_id,
      },
      { page: 1, limit: 10000 },
      userContext
    );

    const includeTasks = filters.include_task_details !== false;
    return this.generateProjectPDF(dashboard, tasks, filters, includeTasks);
  }

  /**
   * PDF generation for a single project.
   * Pages: 1) overview + stats + status bar, 2) team breakdown, 3+) task cards.
   */
  private async generateProjectPDF(
    dashboard: ProjectDashboardStats,
    tasks: TaskRegistry[],
    filters: ProjectReportFilters,
    includeTasks: boolean
  ): Promise<{ filePath: string; fileName: string }> {
    const project = dashboard.project;
    const safeName = project.name_english.replace(/[^a-zA-Z0-9]+/g, '_').substring(0, 40);
    const fileName = `gims_project_${safeName}_${Date.now()}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);
    const generatedAt = new Date();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
      const writeStream = fs.createWriteStream(filePath);
      const pageHeight = doc.page.height;
      const pageWidth = doc.page.width;
      let currentPage = 1;
      const generatedTime = this.formatDateTime(generatedAt);

      // Register Devanagari font
      let hasDevanagariFont = false;
      try {
        if (fs.existsSync(this.devanagariFont)) {
          doc.registerFont('Devanagari', this.devanagariFont);
          hasDevanagariFont = true;
        }
      } catch (err) {
        logger.warn('Failed to register Devanagari font', { error: err });
      }

      const drawText = (text: string, x: number, y: number, options?: any) => {
        if (!hasDevanagariFont || !this.containsDevanagari(text)) {
          doc.font('Helvetica');
          doc.text(text, x, y, options);
          return;
        }
        const segments = text.match(/[\u0900-\u097F\u0980-\u09FF]+|[^\u0900-\u097F\u0980-\u09FF]+/g) || [text];
        let currentX = x;
        segments.forEach((segment, idx) => {
          doc.font(this.containsDevanagari(segment) ? 'Devanagari' : 'Helvetica');
          const segWidth = doc.widthOfString(segment);
          if (idx === 0) {
            doc.text(segment, currentX, y, { ...options, lineBreak: false, continued: idx < segments.length - 1 });
          } else {
            doc.text(segment, { lineBreak: false, continued: idx < segments.length - 1 });
          }
          currentX += segWidth;
        });
        doc.font('Helvetica');
      };

      const drawFooter = (pageNum: number) => {
        doc.save();
        doc.font('Helvetica');
        doc.moveTo(40, pageHeight - 45).lineTo(pageWidth - 40, pageHeight - 45).stroke('#e5e7eb');
        doc.fontSize(8).fillColor('#6b7280');
        const footerText = `Page ${pageNum} | GIMS Project Report | ${generatedTime}`;
        const textWidth = doc.widthOfString(footerText);
        doc.text(footerText, (pageWidth - textWidth) / 2, pageHeight - 35, { lineBreak: false });
        doc.restore();
      };

      doc.pipe(writeStream);

      // ===== PAGE 1: PROJECT OVERVIEW =====

      // Header banner
      doc.rect(0, 0, pageWidth, 120).fill(this.colors.primary);
      doc.fontSize(24).fillColor('#ffffff');
      doc.text('Project Report', 40, 30, { align: 'center', width: pageWidth - 80 });

      // Project name in header (Marathi-aware)
      doc.fontSize(14).fillColor('#dbeafe');
      drawText(project.name_english, 40, 65, { align: 'center', width: pageWidth - 80 });
      if (project.name_marathi) {
        doc.fontSize(11).fillColor('#bfdbfe');
        drawText(project.name_marathi, 40, 88, { align: 'center', width: pageWidth - 80 });
      }

      // Status badge
      const statusColor = this.getProjectStatusColor(project.status);
      doc.roundedRect(pageWidth / 2 - 45, 100, 90, 16, 3).fill(statusColor);
      doc.fontSize(9).fillColor('#ffffff');
      doc.text(project.status.replace('_', ' ').toUpperCase(), pageWidth / 2 - 45, 103, { align: 'center', width: 90 });

      // Project info box
      const infoY = 140;
      const infoH = 110;
      doc.roundedRect(40, infoY, pageWidth - 80, infoH, 5).fill('#f3f4f6');
      doc.fontSize(10).fillColor('#374151');

      const startDate = project.start_date ? this.formatDate(new Date(project.start_date)) : '—';
      const endDate = project.end_date ? this.formatDate(new Date(project.end_date)) : '—';
      const budget = project.budget ? `₹ ${Number(project.budget).toLocaleString('en-IN')}` : '—';

      doc.text(`Dates:`, 55, infoY + 15);
      doc.fillColor('#111827').text(`${startDate}  →  ${endDate}`, 115, infoY + 15);
      doc.fillColor('#374151').text(`Location:`, 55, infoY + 33);
      doc.fillColor('#111827');
      drawText(project.location || '—', 115, infoY + 33, { width: 250, lineBreak: false });
      doc.fillColor('#374151').text(`Budget:`, 55, infoY + 51);
      doc.fillColor('#111827').text(budget, 115, infoY + 51);

      // Contact (right column)
      doc.fillColor('#374151').text(`Contact:`, 320, infoY + 15);
      doc.fillColor('#111827').text(project.contact_person_name || '—', 370, infoY + 15);
      if (project.contact_person_phone) {
        doc.fillColor('#374151').text(`Phone:`, 320, infoY + 33);
        doc.fillColor('#111827').text(project.contact_person_phone, 370, infoY + 33);
      }
      if (project.contact_person_email) {
        doc.fillColor('#374151').text(`Email:`, 320, infoY + 51);
        doc.fillColor('#111827').text(project.contact_person_email, 370, infoY + 51);
      }
      doc.fillColor('#374151').text(`Generated:`, 55, infoY + 80);
      doc.fillColor('#111827').text(generatedTime, 115, infoY + 80);

      // Filters applied
      const filterParts: string[] = [];
      if (filters.date_from) filterParts.push(`From: ${this.formatDate(new Date(filters.date_from))}`);
      if (filters.date_to) filterParts.push(`To: ${this.formatDate(new Date(filters.date_to))}`);
      if (filters.status) filterParts.push(`Status: ${filters.status}`);
      if (filters.category_id) filterParts.push(`Category: ${filters.category_id}`);
      if (filterParts.length > 0) {
        doc.fillColor('#374151').text(`Filters:`, 320, infoY + 80);
        doc.fillColor('#111827').fontSize(9).text(filterParts.join(' • '), 370, infoY + 80, { width: 200 });
      }

      // ===== STAT CARDS (6 cards) =====
      const cardY = infoY + infoH + 25;
      const cardWidth = (pageWidth - 80) / 6;
      const cardHeight = 65;
      const cardGap = 6;

      this.drawStatCard(doc, 40, cardY, cardWidth - cardGap, cardHeight, 'Total', String(dashboard.total_tasks), this.colors.primary);
      this.drawStatCard(doc, 40 + cardWidth, cardY, cardWidth - cardGap, cardHeight, 'Pending', String(dashboard.pending_tasks), this.colors.pending);
      this.drawStatCard(doc, 40 + cardWidth * 2, cardY, cardWidth - cardGap, cardHeight, 'In Progress', String(dashboard.in_progress_tasks), this.colors.inProgress);
      this.drawStatCard(doc, 40 + cardWidth * 3, cardY, cardWidth - cardGap, cardHeight, 'Completed', String(dashboard.completed_tasks), this.colors.completed);
      this.drawStatCard(doc, 40 + cardWidth * 4, cardY, cardWidth - cardGap, cardHeight, 'Cancelled', String(dashboard.cancelled_tasks), this.colors.cancelled);
      this.drawStatCard(doc, 40 + cardWidth * 5, cardY, cardWidth - cardGap, cardHeight, 'Overdue', String(dashboard.overdue_tasks), this.colors.danger);

      // ===== PROGRESS BAR =====
      const progY = cardY + cardHeight + 25;
      doc.fontSize(12).fillColor('#1f2937').text('Overall Progress', 40, progY);
      doc.fontSize(10).fillColor('#6b7280').text(
        `${dashboard.completed_tasks} / ${dashboard.total_tasks} tasks  ·  ${dashboard.progress_percent}%`,
        40, progY + 16
      );

      const progBarY = progY + 35;
      const progBarW = pageWidth - 80;
      const progBarH = 18;
      doc.roundedRect(40, progBarY, progBarW, progBarH, 3).fill('#e5e7eb');
      if (dashboard.progress_percent > 0) {
        const fillW = Math.max(4, (dashboard.progress_percent / 100) * progBarW);
        doc.roundedRect(40, progBarY, fillW, progBarH, 3).fill(this.colors.completed);
      }

      // ===== STATUS DISTRIBUTION BAR =====
      const distY = progBarY + progBarH + 30;
      doc.fontSize(12).fillColor('#1f2937').text('Status Distribution', 40, distY);

      const distBarY = distY + 20;
      const distBarH = 22;
      const total = dashboard.total_tasks || 1;
      doc.roundedRect(40, distBarY, progBarW, distBarH, 3).fill('#e5e7eb');

      let currentX = 40;
      const segments: Array<[number, string]> = [
        [dashboard.completed_tasks, this.colors.completed],
        [dashboard.in_progress_tasks, this.colors.inProgress],
        [dashboard.pending_tasks, this.colors.pending],
        [dashboard.cancelled_tasks, this.colors.cancelled],
      ];
      segments.forEach(([count, color]) => {
        if (count > 0) {
          const w = (count / total) * progBarW;
          doc.rect(currentX, distBarY, w, distBarH).fill(color);
          currentX += w;
        }
      });

      const legendY = distBarY + distBarH + 15;
      this.drawLegendItem(doc, 40, legendY, this.colors.completed, `Completed (${dashboard.completed_tasks})`);
      this.drawLegendItem(doc, 170, legendY, this.colors.inProgress, `In Progress (${dashboard.in_progress_tasks})`);
      this.drawLegendItem(doc, 300, legendY, this.colors.pending, `Pending (${dashboard.pending_tasks})`);
      this.drawLegendItem(doc, 420, legendY, this.colors.cancelled, `Cancelled (${dashboard.cancelled_tasks})`);

      drawFooter(currentPage);

      // ===== PAGE 2: TEAM BREAKDOWN =====
      if (dashboard.per_team_breakdown.length > 0) {
        currentPage++;
        doc.addPage();
        doc.rect(0, 0, pageWidth, 50).fill(this.colors.primary);
        doc.fontSize(18).fillColor('#ffffff');
        doc.text('Team Breakdown', 40, 18, { align: 'center', width: pageWidth - 80 });

        // Teams summary cards (one per team)
        let teamY = 70;
        const teamCardH = 70;

        dashboard.per_team_breakdown.forEach((team) => {
          if (teamY + teamCardH > pageHeight - 60) {
            drawFooter(currentPage);
            currentPage++;
            doc.addPage();
            doc.rect(0, 0, pageWidth, 50).fill(this.colors.primary);
            doc.fontSize(18).fillColor('#ffffff');
            doc.text('Team Breakdown (continued)', 40, 18, { align: 'center', width: pageWidth - 80 });
            teamY = 70;
          }

          const memberInfo = dashboard.teams.find((t) => t.team_id === team.team_id);
          const memberCount = memberInfo?.member_count || 0;
          const teamProgress = team.task_count > 0
            ? Math.round((team.completed_count / team.task_count) * 100)
            : 0;

          // Card
          doc.roundedRect(40, teamY, pageWidth - 80, teamCardH, 5).fillAndStroke('#fafafa', '#e5e7eb');

          // Team name + member count
          doc.fontSize(12).fillColor('#111827');
          drawText(team.team_name, 55, teamY + 10, { lineBreak: false });
          doc.fontSize(9).fillColor('#6b7280');
          doc.text(`${memberCount} member${memberCount !== 1 ? 's' : ''}`, 55, teamY + 28);

          // Task counts (right side)
          doc.fontSize(10).fillColor('#374151');
          doc.text(`Total: ${team.task_count}`, pageWidth - 230, teamY + 10);
          doc.fillColor(this.colors.completed).text(`Completed: ${team.completed_count}`, pageWidth - 230, teamY + 28);
          doc.fillColor('#6b7280').fontSize(9).text(`${teamProgress}% complete`, pageWidth - 100, teamY + 10);

          // Progress bar
          const tbarY = teamY + 48;
          const tbarW = pageWidth - 110;
          doc.roundedRect(55, tbarY, tbarW, 12, 2).fill('#e5e7eb');
          if (teamProgress > 0) {
            const w = Math.max(4, (teamProgress / 100) * tbarW);
            doc.roundedRect(55, tbarY, w, 12, 2).fill(this.colors.completed);
          }

          teamY += teamCardH + 10;
        });

        drawFooter(currentPage);
      }

      // ===== PAGE 3+: TASK DETAILS =====
      if (includeTasks && tasks.length > 0) {
        currentPage++;
        doc.addPage();
        doc.rect(0, 0, pageWidth, 50).fill(this.colors.primary);
        doc.fontSize(18).fillColor('#ffffff');
        doc.text(`Tasks (${tasks.length})`, 40, 18, { align: 'center', width: pageWidth - 80 });

        let yPos = 70;
        const taskCardHeight = 85;
        const maxYBeforeNewPage = pageHeight - 60;

        tasks.forEach((task, index) => {
          if (yPos + taskCardHeight > maxYBeforeNewPage) {
            drawFooter(currentPage);
            currentPage++;
            doc.addPage();
            doc.rect(0, 0, pageWidth, 50).fill(this.colors.primary);
            doc.fontSize(18).fillColor('#ffffff');
            doc.text('Tasks (continued)', 40, 18, { align: 'center', width: pageWidth - 80 });
            yPos = 70;
          }

          doc.roundedRect(40, yPos, pageWidth - 80, taskCardHeight, 5).fillAndStroke('#fafafa', '#e5e7eb');

          // Number badge
          doc.roundedRect(50, yPos + 10, 30, 20, 3).fill(this.colors.primary);
          doc.fontSize(10).fillColor('#ffffff');
          doc.text(`${index + 1}`, 50, yPos + 14, { width: 30, align: 'center' });

          // ID + date
          doc.fontSize(11).fillColor('#1f2937');
          doc.text(`ID: ${task.registry_id.substring(0, 8)}`, 90, yPos + 12);
          doc.fontSize(9).fillColor('#6b7280');
          doc.text(this.formatDate(new Date(task.registration_date)), 400, yPos + 12);

          // Status + priority badges
          const statusC = this.getStatusColor(task.status);
          doc.roundedRect(90, yPos + 32, 70, 18, 3).fill(statusC);
          doc.fontSize(8).fillColor('#ffffff');
          doc.text(task.status.toUpperCase(), 90, yPos + 36, { width: 70, align: 'center' });

          const priorityC = this.getPriorityColor(task.priority);
          doc.roundedRect(170, yPos + 32, 60, 18, 3).fill(priorityC);
          doc.fontSize(8).fillColor('#ffffff');
          doc.text(task.priority.toUpperCase(), 170, yPos + 36, { width: 60, align: 'center' });

          // Category
          doc.fontSize(9).fillColor('#4b5563');
          const categoryName = (task as any).category_name_marathi
            || (task as any).category_name_english
            || `Category ${task.category_id}`;
          drawText(`Category: ${categoryName}`, 250, yPos + 35, { lineBreak: false });

          // Title
          const taskData = task.task_data as Record<string, unknown>;
          const title = taskData?.title || taskData?.issue_description || taskData?.description || '';
          const displayTitle = String(title).substring(0, 80);
          doc.fontSize(9).fillColor('#374151');
          drawText(displayTitle + (String(title).length > 80 ? '...' : ''), 90, yPos + 58, {
            width: pageWidth - 150,
            ellipsis: true,
          });

          yPos += taskCardHeight + 8;
        });

        drawFooter(currentPage);
      } else if (includeTasks && tasks.length === 0) {
        currentPage++;
        doc.addPage();
        doc.rect(0, 0, pageWidth, 50).fill(this.colors.primary);
        doc.fontSize(18).fillColor('#ffffff');
        doc.text('Tasks', 40, 18, { align: 'center', width: pageWidth - 80 });

        doc.fontSize(12).fillColor('#6b7280');
        doc.text('No tasks found for the selected filters.', 40, 90, { align: 'center', width: pageWidth - 80 });

        drawFooter(currentPage);
      }

      doc.end();

      writeStream.on('finish', () => {
        logger.info('Project PDF report generated', { fileName, projectId: project.project_id });
        resolve({ filePath, fileName });
      });
      writeStream.on('error', reject);
    });
  }

  /**
   * Get color for project status.
   */
  private getProjectStatusColor(status: string): string {
    const colors: Record<string, string> = {
      active: this.colors.completed,
      on_hold: this.colors.pending,
      completed: this.colors.inProgress,
      archived: this.colors.secondary,
    };
    return colors[status] || this.colors.secondary;
  }

  /**
   * Delete old reports (cleanup)
   */
  async cleanupOldReports(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;
    const files = fs.readdirSync(this.reportsDir);

    for (const file of files) {
      const filePath = path.join(this.reportsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    logger.info('Old reports cleaned up', { deletedCount });
    return deletedCount;
  }

  /**
   * Format date as DD/MM/YYYY
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Format datetime
   */
  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

// Export singleton instance
export const reportService = new ReportService();
