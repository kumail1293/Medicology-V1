import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export interface ValidatedRequest extends Request {
  validatedBody?: unknown;
  validatedQuery?: unknown;
  validatedParams?: unknown;
}

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateBody(schema: ZodSchema) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body validation failed',
            details: formattedErrors,
          },
        });
      }
      return next(error);
    }
  };
}

/**
 * Middleware to validate query parameters against a Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameters validation failed',
            details: formattedErrors,
          },
        });
      }
      return next(error);
    }
  };
}

/**
 * Middleware to validate URL parameters against a Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.validatedParams = validated;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URL parameters validation failed',
            details: formattedErrors,
          },
        });
      }
      return next(error);
    }
  };
}

/**
 * Helper to wrap async route handlers and catch errors
 */
export function asyncHandler(
  fn: (req: ValidatedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
