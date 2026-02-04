import { useState } from 'react';
import { Download, Trash2, FileText, Image, File, Loader2, Eye, X } from 'lucide-react';
import type { Attachment } from '../types';
import { tasksService } from '../services/tasks';

interface AttachmentListProps {
  attachments: Attachment[];
  taskId: string;
  onDelete?: (attachmentId: string) => Promise<void>;
  readOnly?: boolean;
}

export default function AttachmentList({
  attachments,
  taskId,
  onDelete,
  readOnly = false
}: AttachmentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    if (fileType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const canPreview = (fileType: string): boolean => {
    return fileType.startsWith('image/') || fileType === 'application/pdf';
  };

  const handlePreview = async (attachment: Attachment) => {
    setPreviewLoading(true);
    setPreviewAttachment(attachment);

    try {
      const downloadUrl = tasksService.getAttachmentDownloadUrl(taskId, attachment.attachment_id);
      const accessToken = localStorage.getItem('accessToken');

      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load preview');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to load preview');
      setPreviewAttachment(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewAttachment(null);
    setPreviewUrl(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.attachment_id);
    try {
      const downloadUrl = tasksService.getAttachmentDownloadUrl(taskId, attachment.attachment_id);
      const accessToken = localStorage.getItem('accessToken');

      // Create a fetch request with auth header
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!onDelete) return;
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    setDeletingId(attachmentId);
    try {
      await onDelete(attachmentId);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  if (attachments.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <File className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No attachments yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.attachment_id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              {getFileIcon(attachment.file_type)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {attachment.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(attachment.file_size_bytes)} • {formatDate(attachment.created_at)}
                  {attachment.uploaded_by_name && ` • ${attachment.uploaded_by_name}`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1 ml-2">
              {/* Preview Button */}
              {canPreview(attachment.file_type) && (
                <button
                  type="button"
                  onClick={() => handlePreview(attachment)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}

              {/* Download Button */}
              <button
                type="button"
                onClick={() => handleDownload(attachment)}
                disabled={downloadingId === attachment.attachment_id}
                className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-50"
                title="Download"
              >
                {downloadingId === attachment.attachment_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>

              {/* Delete Button */}
              {!readOnly && onDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(attachment.attachment_id)}
                  disabled={deletingId === attachment.attachment_id}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === attachment.attachment_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={closePreview}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closePreview}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* File Name */}
            <div className="absolute -top-10 left-0 text-white text-sm truncate max-w-[80%]">
              {previewAttachment.file_name}
            </div>

            {/* Preview Content */}
            <div className="bg-white rounded-lg overflow-hidden">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : previewUrl ? (
                previewAttachment.file_type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={previewAttachment.file_name}
                    className="max-w-full max-h-[80vh] mx-auto"
                  />
                ) : previewAttachment.file_type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    title={previewAttachment.file_name}
                    className="w-full h-[80vh]"
                  />
                ) : null
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
