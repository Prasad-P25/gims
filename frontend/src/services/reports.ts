import api from './api';

export const reportsService = {
  async generateReport(params: {
    format: 'pdf' | 'excel';
    start_date?: string;
    end_date?: string;
    category_id?: string;
    status?: string;
  }): Promise<Blob> {
    const response = await api.post('/reports/generate', params, {
      responseType: 'blob',
    });
    return response.data;
  },
};
