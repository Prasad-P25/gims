import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Writable } from 'stream';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { taskService } from './task.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ReportFilters, TaskRegistry, Category } from '../types';

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

  constructor() {
    this.reportsDir = path.join(env.UPLOAD_DIR, 'reports');
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate a report based on filters
   */
  async generateReport(
    filters: ReportFilters,
    userId: string
  ): Promise<{ filePath: string; fileName: string }> {
    // Fetch report data
    const reportData = await this.fetchReportData(filters);

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
  private async fetchReportData(filters: ReportFilters): Promise<ReportData> {
    const { tasks } = await taskService.getTasks(
      {
        date_from: filters.date_from,
        date_to: filters.date_to,
        category_id: filters.category_ids?.[0], // TODO: Support multiple categories
      },
      { page: 1, limit: 10000 } // Get all matching tasks
    );

    const stats = await taskService.getTaskStats(filters.date_from, filters.date_to);

    return {
      tasks,
      stats,
      dateRange: { from: filters.date_from, to: filters.date_to },
      generatedAt: new Date(),
    };
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(
    data: ReportData,
    filters: ReportFilters
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `gims_report_${filters.type}_${Date.now()}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // Header
      doc.fontSize(20).text('GIMS Task Registry Report', { align: 'center' });
      doc.fontSize(12).text('Government Information Management System', { align: 'center' });
      doc.moveDown();

      // Report info
      doc.fontSize(10);
      doc.text(`Report Type: ${filters.type.toUpperCase()}`);
      doc.text(`Date Range: ${this.formatDate(data.dateRange.from)} to ${this.formatDate(data.dateRange.to)}`);
      doc.text(`Generated: ${this.formatDateTime(data.generatedAt)}`);
      doc.moveDown();

      // Summary section
      if (filters.include_summary) {
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Tasks: ${data.stats.total}`);
        doc.text(`Pending: ${data.stats.pending}`);
        doc.text(`In Progress: ${data.stats.inProgress}`);
        doc.text(`Completed: ${data.stats.completed}`);
        doc.text(`Cancelled: ${data.stats.cancelled}`);
        doc.moveDown();

        // Category breakdown
        doc.fontSize(12).text('By Category:', { underline: true });
        doc.fontSize(10);
        data.stats.byCategory.forEach((cat) => {
          doc.text(`  ${cat.name}: ${cat.count}`);
        });
        doc.moveDown();
      }

      // Tasks list
      doc.addPage();
      doc.fontSize(14).text('Task Details', { underline: true });
      doc.moveDown();

      data.tasks.forEach((task, index) => {
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(10);
        doc.text(`${index + 1}. Registry ID: ${task.registry_id.substring(0, 8)}`, { continued: false });
        doc.text(`   Date: ${this.formatDate(new Date(task.registration_date))}`);
        doc.text(`   Status: ${task.status} | Priority: ${task.priority}`);
        doc.text(`   Category: ${(task as unknown as { category_name_english?: string }).category_name_english || task.category_id}`);

        // Task data summary
        const taskDataStr = JSON.stringify(task.task_data, null, 2).substring(0, 200);
        doc.text(`   Details: ${taskDataStr}${taskDataStr.length >= 200 ? '...' : ''}`);
        doc.moveDown(0.5);
      });

      // Footer
      doc.fontSize(8).text(
        `Page ${doc.bufferedPageRange().count}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();

      writeStream.on('finish', () => {
        logger.info('PDF report generated', { fileName });
        resolve({ filePath, fileName });
      });

      writeStream.on('error', reject);
    });
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
