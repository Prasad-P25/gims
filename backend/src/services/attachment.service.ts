import { query } from '../config/database';
import { logger } from '../utils/logger';
import { Attachment, AttachmentCreateInput } from '../types';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Allowed file types
const ALLOWED_EXTENSIONS = [
  '.jpeg', '.jpg', '.png', '.gif', '.webp',  // Images
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'  // Documents
];

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_UPLOAD = 5;
const UPLOADS_BASE_DIR = path.join(process.cwd(), 'uploads', 'attachments');

export class AttachmentService {
  /**
   * Validate file type and size
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: `File type ${ext} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return { valid: false, error: `MIME type ${file.mimetype} is not allowed` };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
    }

    return { valid: true };
  }

  /**
   * Validate number of files
   */
  validateFileCount(count: number): { valid: boolean; error?: string } {
    if (count > MAX_FILES_PER_UPLOAD) {
      return { valid: false, error: `Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload` };
    }
    return { valid: true };
  }

  /**
   * Ensure upload directory exists
   */
  async ensureUploadDir(taskId: string): Promise<string> {
    const taskDir = path.join(UPLOADS_BASE_DIR, taskId);
    await fs.mkdir(taskDir, { recursive: true });
    return taskDir;
  }

  /**
   * Save file to disk
   */
  async saveFile(
    file: Express.Multer.File,
    taskId: string
  ): Promise<{ storedName: string; filePath: string }> {
    const taskDir = await this.ensureUploadDir(taskId);
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${uuidv4()}${ext}`;
    const filePath = path.join(taskDir, storedName);

    await fs.writeFile(filePath, file.buffer);

    // Return relative path from uploads directory
    const relativePath = path.join('attachments', taskId, storedName);
    return { storedName, filePath: relativePath };
  }

  /**
   * Create attachment record
   */
  async createAttachment(
    input: AttachmentCreateInput,
    userId: string
  ): Promise<Attachment> {
    const sql = `
      INSERT INTO attachments (
        registry_id, file_name, stored_name, file_path,
        file_type, file_size_bytes, uploaded_by, upload_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      input.registry_id,
      input.file_name,
      input.stored_name,
      input.file_path,
      input.file_type,
      input.file_size_bytes,
      userId,
      input.upload_source || 'web',
    ];

    const result = await query<Attachment>(sql, values);
    logger.info('Attachment created', {
      attachmentId: result.rows[0].attachment_id,
      registryId: input.registry_id,
      userId
    });
    return result.rows[0];
  }

  /**
   * Get attachments for a task
   */
  async getAttachmentsByTask(registryId: string): Promise<Attachment[]> {
    const sql = `
      SELECT a.*, u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.user_id
      WHERE a.registry_id = $1 AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC
    `;
    const result = await query<Attachment>(sql, [registryId]);
    return result.rows;
  }

  /**
   * Get single attachment by ID
   */
  async getAttachmentById(attachmentId: string): Promise<Attachment | null> {
    const sql = `
      SELECT a.*, u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.user_id
      WHERE a.attachment_id = $1 AND a.deleted_at IS NULL
    `;
    const result = await query<Attachment>(sql, [attachmentId]);
    return result.rows[0] || null;
  }

  /**
   * Soft delete attachment
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<boolean> {
    const sql = `
      UPDATE attachments
      SET deleted_at = NOW()
      WHERE attachment_id = $1 AND deleted_at IS NULL
      RETURNING attachment_id
    `;
    const result = await query(sql, [attachmentId]);
    if (result.rows[0]) {
      logger.info('Attachment deleted', { attachmentId, userId });
      return true;
    }
    return false;
  }

  /**
   * Get full file path on disk
   */
  getFullFilePath(relativePath: string): string {
    return path.join(process.cwd(), 'uploads', relativePath);
  }

  /**
   * Check if file exists on disk
   */
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.getFullFilePath(relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file from disk (used when cleaning up)
   */
  async deleteFileFromDisk(relativePath: string): Promise<void> {
    try {
      const fullPath = this.getFullFilePath(relativePath);
      await fs.unlink(fullPath);
      logger.info('File deleted from disk', { path: relativePath });
    } catch (error) {
      logger.warn('Failed to delete file from disk', { path: relativePath, error });
    }
  }
}

// Export singleton instance
export const attachmentService = new AttachmentService();
