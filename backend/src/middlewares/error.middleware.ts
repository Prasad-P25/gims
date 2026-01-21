import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { sendInternalError, sendValidationError, sendBadRequest } from '../utils/response';
import { isProduction } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  public errors: Array<{ field: string; message: string }>;

  constructor(errors: Array<{ field: string; message: string }>) {
    super('Validation failed', 422);
    this.errors = errors;
  }
}

const formatZodError = (error: ZodError): Array<{ field: string; message: string }> => {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    sendValidationError(res, formatZodError(err));
    return;
  }

  // Handle custom validation errors
  if (err instanceof ValidationError) {
    sendValidationError(res, err.errors);
    return;
  }

  // Handle custom app errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    sendBadRequest(res, 'Invalid JSON in request body');
    return;
  }

  // Handle unknown errors
  const message = isProduction ? 'Internal server error' : err.message;
  sendInternalError(res, message);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
