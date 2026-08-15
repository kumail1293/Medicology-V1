import { createHash } from 'node:crypto';
import { db } from '../db.js';
import { userSessionsTable, securityEventsTable } from '@workspace/db';
import { eq, and } from './drizzle.js';

// ============================================================================
// Session registry — active logins per user, keyed by a SHA-256 hash of the
// JWT (raw tokens are never persisted). Revoked sessions are rejected by the
// auth middleware. Login/security events land in security_events.
// ============================================================================

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(opts: {
  userId: number;
  token: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<number> {
  const hash = tokenHash(opts.token);
  const inserted = await db.insert(userSessionsTable).values({
    userId: opts.userId,
    tokenHash: hash,
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
  });
  const id = Array.isArray(inserted) ? (inserted[0] as any)?.id : (inserted as any)?.id;
  // Record a security event for the login (login history).
  try {
    await db.insert(securityEventsTable).values({
      sessionId: String(id),
      userId: opts.userId,
      type: 'login',
      userAgent: opts.userAgent ?? null,
      metadata: { ip: opts.ip ?? null },
    });
  } catch {
    // Security event logging is best-effort.
  }
  return id;
}

export async function listSessions(userId: number) {
  const rows = await db.select().from(userSessionsTable).where(eq(userSessionsTable.userId, userId));
  return (rows as any[])
    .sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)))
    .map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeen: s.lastSeen,
      revoked: s.revoked,
      current: false,
    }));
}

export async function revokeSession(userId: number, sessionId: number): Promise<boolean> {
  const rows = await db.select().from(userSessionsTable).where(and(
    eq(userSessionsTable.id, sessionId),
    eq(userSessionsTable.userId, userId),
  ));
  if (rows.length === 0) return false;
  await db.update(userSessionsTable).set({ revoked: true }).where(eq(userSessionsTable.id, sessionId));
  return true;
}

export async function revokeAllSessions(userId: number, exceptHash?: string): Promise<number> {
  const rows = await db.select().from(userSessionsTable).where(eq(userSessionsTable.userId, userId));
  let count = 0;
  for (const row of rows) {
    if (exceptHash && row.tokenHash === exceptHash) continue;
    await db.update(userSessionsTable).set({ revoked: true }).where(eq(userSessionsTable.id, row.id));
    count++;
  }
  return count;
}

/**
 * Returns false when the token belongs to a revoked session. Tokens without a
 * session record (e.g. re-issued via profile update before sessions existed)
 * are allowed — revocation only ever kills sessions we know about.
 */
export async function sessionIsValid(token: string): Promise<boolean> {
  const hash = tokenHash(token);
  const rows = await db.select().from(userSessionsTable).where(eq(userSessionsTable.tokenHash, hash));
  if (rows.length === 0) return true; // legacy / not tracked
  return !(rows[0] as any).revoked;
}

export async function loginHistory(userId: number, limit = 30) {
  const rows = await db.select().from(securityEventsTable).where(eq(securityEventsTable.userId, userId));
  return (rows as any[])
    .filter((e) => e.type === 'login')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      type: e.type,
      userAgent: e.userAgent,
      ip: (e.metadata as any)?.ip ?? null,
      createdAt: e.createdAt,
    }));
}
