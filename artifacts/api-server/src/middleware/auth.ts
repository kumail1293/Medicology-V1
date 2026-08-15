import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { ADMIN_ROLES, requirePermission } from '../utils/permissions.js';

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

import { randomUUID } from 'node:crypto';

export function generateToken(user: { id: number; email: string; isAdmin: boolean; role: string }) {
  // Unique jti: jsonwebtoken's iat is second-granularity, so two logins in the
  // same second would otherwise produce byte-identical tokens (breaking the
  // per-session revocation registry).
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d', jwtid: randomUUID() });
}

/** Resolve a bearer token to a user, or null when absent/invalid. */
function resolveUserFromToken(token: string | undefined): any {
  if (!token) return null;
  // In development, accept mock tokens (JWT format: header.payload.signature)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        // Check if it has the expected user properties
        if (payload.id && payload.email) {
          return {
            id: payload.id,
            email: payload.email,
            isAdmin: payload.isAdmin || false,
            role: payload.role || 'user',
          };
        }
      }
    } catch {
      // Fall through to jwt.verify
    }
  }
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export async function authenticate(req: any, res: any, next: any): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.split(' ')[1];
  const user = resolveUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  // Revoked sessions are rejected (Account → Security → revoke device).
  const { sessionIsValid } = await import('../utils/sessions.js');
  const valid = await sessionIsValid(token);
  if (!valid) {
    res.status(401).json({ error: 'Session revoked — please sign in again' });
    return;
  }
  req.user = user;
  next();
}

/**
 * Optional auth: attaches the user when a valid bearer token is present, but
 * never rejects — for public endpoints that behave differently for logged-in
 * visitors (e.g. Coming Soon Notify Me).
 */
export function softAuthenticate(req: any, _res: any, next: any): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const user = resolveUserFromToken(header.split(' ')[1]);
    if (user) req.user = user;
  }
  next();
}

export function requireAdmin(req: any, res: any, next: any): void {
  if (!req.user?.isAdmin && !ADMIN_ROLES.includes(req.user?.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export { requirePermission };
export { roleHasPermission, ROLE_PERMISSIONS, ROLE_LABELS, ADMIN_ROLES, ASSIGNABLE_ROLES } from '../utils/permissions.js';

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
