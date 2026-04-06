import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory rate limiter
 * For production, use redis or express-rate-limit package
 */

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

/**
 * Rate limiting middleware
 * @param maxRequests Maximum requests allowed
 * @param windowMs Time window in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || req.socket.remoteAddress}:${req.path}`;
    const now = Date.now();

    if (!store[key]) {
      store[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    const entry = store[key];

    // Reset if window has expired
    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
      return next();
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
      });
    }

    next();
  };
}

/**
 * Clean up old entries periodically to prevent memory leak
 */
export function startRateLimitCleanup(intervalMs = 60000) {
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach(key => {
      if (now > store[key].resetTime) {
        delete store[key];
      }
    });
  }, intervalMs);
}

/**
 * Reset all rate limit entries (useful for testing)
 */
export function resetRateLimit() {
  Object.keys(store).forEach(key => delete store[key]);
}
