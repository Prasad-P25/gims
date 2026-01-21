import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.status(statusCode).json(response);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  message?: string
): Response => {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    message,
    meta,
  };
  return res.status(200).json(response);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Resource created successfully'): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: Array<{ field: string; message: string }>
): Response => {
  const response: ApiResponse = {
    success: false,
    error: message,
    errors,
  };
  return res.status(statusCode).json(response);
};

export const sendBadRequest = (
  res: Response,
  message = 'Bad request',
  errors?: Array<{ field: string; message: string }>
): Response => {
  return sendError(res, message, 400, errors);
};

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response => {
  return sendError(res, message, 401);
};

export const sendForbidden = (res: Response, message = 'Forbidden'): Response => {
  return sendError(res, message, 403);
};

export const sendNotFound = (res: Response, message = 'Resource not found'): Response => {
  return sendError(res, message, 404);
};

export const sendConflict = (res: Response, message = 'Resource already exists'): Response => {
  return sendError(res, message, 409);
};

export const sendValidationError = (
  res: Response,
  errors: Array<{ field: string; message: string }>
): Response => {
  return sendError(res, 'Validation failed', 422, errors);
};

export const sendInternalError = (res: Response, message = 'Internal server error'): Response => {
  return sendError(res, message, 500);
};

// Pagination helper
export const calculatePagination = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
  };
};

export const getPaginationOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};
