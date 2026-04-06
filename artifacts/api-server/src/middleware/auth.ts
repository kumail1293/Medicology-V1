import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// JWT_SECRET is now validated in app.ts startup
const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    isAdmin: boolean;
    role: string;
  };
}

export function generateToken(user: { id: number; email: string; isAdmin: boolean; role: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}