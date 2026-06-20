import api from './api';

export const reportsService = {
  async generateReport(params: {
    format: 'pdf' | 'excel';
    start_date?: string;
    end_date?: string;
    category_id?: string;
    status?: string;
  }): Promise<Blob> {
    // First, generate the report and get the download URL
    const generateResponse = await api.post('/reports/generate', {
      type: 'custom',
      format: params.format,
      date_from: params.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      date_to: params.end_date || new Date().toISOString(),
      category_ids: params.category_id ? [parseInt(params.category_id)] : undefined,
      status: params.status || undefined,
      include_summary: true,
    });

    // Then download the actual file
    const downloadUrl = generateResponse.data.downloadUrl;
    const downloadResponse = await api.get(downloadUrl, {
      responseType: 'blob',
    });

    return downloadResponse.data;
  },

  async generateDailyReport(date?: string, format: 'pdf' | 'excel' = 'pdf'): Promise<Blob> {
    const response = await api.get('/reports/daily', {
      params: { date, format },
    });

    const downloadUrl = response.data.downloadUrl;
    const downloadResponse = await api.get(downloadUrl, {
      responseType: 'blob',
    });

    return downloadResponse.data;
  },

  async generateWeeklyReport(weekStart?: string, format: 'pdf' | 'excel' = 'pdf'): Promise<Blob> {
    const response = await api.get('/reports/weekly', {
      params: { week_start: weekStart, format },
    });

    const downloadUrl = response.data.downloadUrl;
    const downloadResponse = await api.get(downloadUrl, {
      responseType: 'blob',
    });

    return downloadResponse.data;
  },

  async generateMonthlyReport(year: number, month: number, format: 'pdf' | 'excel' = 'pdf'): Promise<Blob> {
    const response = await api.get('/reports/monthly', {
      params: { year, month, format },
    });

    const downloadUrl = response.data.downloadUrl;
    const downloadResponse = await api.get(downloadUrl, {
      responseType: 'blob',
    });

    return downloadResponse.data;
  },

  async generateProjectReport(params: {
    project_id: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    category_id?: number;
    include_task_details?: boolean;
  }): Promise<{ blob: Blob; fileName: string }> {
    const response = await api.get('/reports/project', {
      params: {
        project_id: params.project_id,
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
        status: params.status || undefined,
        category_id: params.category_id || undefined,
        include_task_details: params.include_task_details ?? true,
      },
    });

    const { fileName, downloadUrl } = response.data;
    const downloadResponse = await api.get(downloadUrl, {
      responseType: 'blob',
    });

    return { blob: downloadResponse.data, fileName };
  },
};
