import { Request, Response, NextFunction } from 'express';

/**
 * Standard error response format
 */
export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

/**
 * Centralized error handler
 */
export class ApiError extends Error implements AppError {
  code: string;
  override message: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Express middleware to handle errors globally
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error for debugging
  console.error('[Error]', {
    code: err instanceof ApiError ? err.code : 'UNKNOWN_ERROR',
    message: err.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
  }

  // Generic error - don't expose internals
  const statusCode = (err as any).statusCode || 500;
  return res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    },
  });
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
