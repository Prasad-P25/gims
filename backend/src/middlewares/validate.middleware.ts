import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendValidationError } from '../utils/response';

type RequestLocation = 'body' | 'query' | 'params';

interface ValidateOptions {
  location?: RequestLocation;
  stripUnknown?: boolean;
}

export const validate = <T>(
  schema: ZodSchema<T>,
  options: ValidateOptions = {}
) => {
  const { location = 'body', stripUnknown = true } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[location];
      const result = schema.parse(data);

      // Replace request data with validated/transformed data
      if (stripUnknown) {
        req[location] = result as typeof req[typeof location];
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        sendValidationError(res, errors);
        return;
      }
      next(error);
    }
  };
};

export const validateBody = <T>(schema: ZodSchema<T>) => {
  return validate(schema, { location: 'body' });
};

export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return validate(schema, { location: 'query' });
};

export const validateParams = <T>(schema: ZodSchema<T>) => {
  return validate(schema, { location: 'params' });
};

// Combined validation for multiple locations
export const validateRequest = <
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
>(schemas: {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string }> = [];

    if (schemas.body) {
      try {
        req.body = schemas.body.parse(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((err) => ({
              field: `body.${err.path.join('.')}`,
              message: err.message,
            }))
          );
        }
      }
    }

    if (schemas.query) {
      try {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((err) => ({
              field: `query.${err.path.join('.')}`,
              message: err.message,
            }))
          );
        }
      }
    }

    if (schemas.params) {
      try {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((err) => ({
              field: `params.${err.path.join('.')}`,
              message: err.message,
            }))
          );
        }
      }
    }

    if (errors.length > 0) {
      sendValidationError(res, errors);
      return;
    }

    next();
  };
};
