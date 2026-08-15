export function rateLimit(maxRequests: number, windowMs: number) {
  const store: Record<string, { count: number; resetTime: number }> = {};

  // Prune expired entries on an interval so the in-memory store doesn't grow
  // unbounded. Interval is capped at 60s even when windowMs is larger.
  const cleanupInterval = Math.min(windowMs, 60000);
  setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(store)) {
      if (now > store[key].resetTime) delete store[key];
    }
  }, cleanupInterval);

  return (req: any, res: any, next: any) => {
    const key = `${req.ip || req.socket?.remoteAddress}:${req.path}`;
    const now = Date.now();

    if (!store[key]) {
      store[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    const entry = store[key];

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
      return next();
    }

    entry.count++;

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

    return next();
  };
}
