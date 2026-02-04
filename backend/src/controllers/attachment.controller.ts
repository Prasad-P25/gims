import { Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { attachmentService } from '../services/attachment.service';
import { taskService } from '../services/task.service';
import { sendSuccess, sendCreated, sendNoContent, sendNotFound, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export class AttachmentController {
  /**
   * Upload files to a task
   */
  async uploadAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: registryId } = req.params;
      const userId = req.user!.user_id;
      const files = req.files as Express.Multer.File[];

      // Check if task exists
      const task = await taskService.getTaskById(registryId);
      if (!task) {
        sendNotFound(res, 'Task not found');
        return;
      }

      // Validate file count
      if (!files || files.length === 0) {
        sendError(res, 'No files provided', 400);
        return;
      }

      const countValidation = attachmentService.validateFileCount(files.length);
      if (!countValidation.valid) {
        sendError(res, countValidation.error!, 400);
        return;
      }

      // Validate each file
      for (const file of files) {
        const validation = attachmentService.validateFile(file);
        if (!validation.valid) {
          sendError(res, validation.error!, 400);
          return;
        }
      }

      // Save files and create records
      const attachments = [];
      for (const file of files) {
        const { storedName, filePath } = await attachmentService.saveFile(file, registryId);

        const attachment = await attachmentService.createAttachment(
          {
            registry_id: registryId,
            file_name: file.originalname,
            stored_name: storedName,
            file_path: filePath,
            file_type: file.mimetype,
            file_size_bytes: file.size,
            upload_source: 'web',
          },
          userId
        );
        attachments.push(attachment);
      }

      sendCreated(res, attachments, `${attachments.length} file(s) uploaded successfully`);
    } catch (error: any) {
      console.error('Upload error:', error);
      sendError(res, error.message || 'Failed to upload files', 500);
    }
  }

  /**
   * List attachments for a task
   */
  async getAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id: registryId } = req.params;

    // Check if task exists
    const task = await taskService.getTaskById(registryId);
    if (!task) {
      sendNotFound(res, 'Task not found');
      return;
    }

    const attachments = await attachmentService.getAttachmentsByTask(registryId);
    sendSuccess(res, attachments);
  }

  /**
   * Download an attachment
   */
  async downloadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id: registryId, aid: attachmentId } = req.params;

    // Get attachment
    const attachment = await attachmentService.getAttachmentById(attachmentId);

    if (!attachment) {
      sendNotFound(res, 'Attachment not found');
      return;
    }

    // Verify attachment belongs to the task
    if (attachment.registry_id !== registryId) {
      sendNotFound(res, 'Attachment not found');
      return;
    }

    // Check if file exists on disk
    const exists = await attachmentService.fileExists(attachment.file_path);
    if (!exists) {
      sendError(res, 'File not found on server', 404);
      return;
    }

    // Get full path and send file
    const fullPath = attachmentService.getFullFilePath(attachment.file_path);

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
    res.setHeader('Content-Type', attachment.file_type);

    // Read and send file
    try {
      const fileBuffer = await fs.readFile(fullPath);
      res.send(fileBuffer);
    } catch (error) {
      console.error('Download error:', error);
      sendError(res, 'Failed to read file', 500);
    }
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id: registryId, aid: attachmentId } = req.params;
    const userId = req.user!.user_id;

    // Get attachment
    const attachment = await attachmentService.getAttachmentById(attachmentId);

    if (!attachment) {
      sendNotFound(res, 'Attachment not found');
      return;
    }

    // Verify attachment belongs to the task
    if (attachment.registry_id !== registryId) {
      sendNotFound(res, 'Attachment not found');
      return;
    }

    // Soft delete the attachment record
    const deleted = await attachmentService.deleteAttachment(attachmentId, userId);

    if (!deleted) {
      sendNotFound(res, 'Attachment not found');
      return;
    }

    sendNoContent(res);
  }
}

export const attachmentController = new AttachmentController();
