import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Calendar, Loader2 } from 'lucide-react';
import { reportsService } from '../services/reports';
import { dashboardService } from '../services/dashboard';

export default function Reports() {
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    category_id: '',
    status: '',
  });
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: dashboardService.getCategories,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerateReport = async (format: 'pdf' | 'excel') => {
    // Ensure dates are set
    let startDate = filters.start_date;
    let endDate = filters.end_date;

    if (!startDate || !endDate) {
      // Default to current month if no dates selected
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = startDate || firstDay.toISOString().split('T')[0];
      endDate = endDate || lastDay.toISOString().split('T')[0];
    }

    setIsGenerating(format);
    try {
      const blob = await reportsService.generateReport({
        format,
        start_date: startDate,
        end_date: endDate,
        category_id: filters.category_id,
        status: filters.status,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task-report-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      const message = error.response?.data?.error || error.message || 'Failed to generate report. Please try again.';
      alert(message);
    } finally {
      setIsGenerating(null);
    }
  };

  // Set default dates (current month)
  const setThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFilters((prev) => ({
      ...prev,
      start_date: firstDay.toISOString().split('T')[0],
      end_date: lastDay.toISOString().split('T')[0],
    }));
  };

  const setThisWeek = () => {
    const now = new Date();
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - now.getDay());
    setFilters((prev) => ({
      ...prev,
      start_date: firstDay.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate task reports in PDF or Excel format
        </p>
      </div>

      {/* Report Configuration */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Report Filters
        </h2>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={setThisWeek} className="btn-secondary text-sm">
            This Week
          </button>
          <button onClick={setThisMonth} className="btn-secondary text-sm">
            This Month
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="label">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="label">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <select
              value={filters.category_id}
              onChange={(e) => handleFilterChange('category_id', e.target.value)}
              className="input"
            >
              <option value="">All Categories</option>
              {categories?.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.name_english}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

      </div>

      {/* Generate Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Report */}
        <div className="card">
          <div className="flex items-start">
            <div className="p-3 bg-red-100 rounded-lg">
              <FileText className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">PDF Report</h3>
              <p className="text-sm text-gray-500 mt-1">
                Generate a formatted PDF document with task summary and details.
                Ideal for printing and official records.
              </p>
              <button
                onClick={() => handleGenerateReport('pdf')}
                disabled={isGenerating !== null}
                className="btn-primary mt-4 inline-flex items-center"
              >
                {isGenerating === 'pdf' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Excel Report */}
        <div className="card">
          <div className="flex items-start">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Excel Report</h3>
              <p className="text-sm text-gray-500 mt-1">
                Generate an Excel spreadsheet with all task data.
                Ideal for data analysis and manipulation.
              </p>
              <button
                onClick={() => handleGenerateReport('excel')}
                disabled={isGenerating !== null}
                className="btn-primary mt-4 inline-flex items-center"
              >
                {isGenerating === 'excel' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Report Information
        </h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            Reports are generated based on the filters you select above. The generated
            files include:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            <li>• Task summary with counts by status and category</li>
            <li>• Complete list of tasks with all details</li>
            <li>• Registration dates and timestamps</li>
            <li>• Applicant information (if available)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
