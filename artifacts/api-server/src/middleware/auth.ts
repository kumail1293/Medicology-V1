import jwt from 'jsonwebtoken';
import { Request } from 'express';

// JWT_SECRET is now validated in app.ts startup
const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    isAdmin: boolean;
    role: string;
  };
  body: any;
  params: any;
  query: any;
  headers: any;
}

export function generateToken(user: { id: number; email: string; isAdmin: boolean; role: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
}

export function authenticate(req: any, res: any, next: any): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.split(' ')[1];
  
  // In development, accept mock tokens (JWT format: header.payload.signature)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        // Check if it has the expected user properties
        if (payload.id && payload.email) {
          req.user = {
            id: payload.id,
            email: payload.email,
            isAdmin: payload.isAdmin || false,
            role: payload.role || 'user',
          };
          next();
          return;
        }
      }
    } catch {
      // Fall through to jwt.verify
    }
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
}

export function requireAdmin(req: any, res: any, next: any): void {
  if (!req.user?.isAdmin && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

// Content editors — admin, superadmin, editor and teacher roles — may create
// and edit educational content (questions, explanations, flashcards,
// announcements). System administration (users, payments, settings) stays
// behind requireAdmin.
const CONTENT_EDITOR_ROLES = ['admin', 'superadmin', 'editor', 'teacher'];
export function requireContentEditor(req: any, res: any, next: any): void {
  if (!req.user?.isAdmin && !CONTENT_EDITOR_ROLES.includes(req.user?.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
