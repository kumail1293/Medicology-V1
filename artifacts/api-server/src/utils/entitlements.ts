import { db } from '../db.js';
import { entitlementsTable, qbanksTable } from '@workspace/db';
import { eq, and } from './drizzle.js';
import { recordAudit } from './audit.js';

// Statuses that count as granting access (revoked/expired do not).
const ACCESS_GRANTING_STATUSES = ['active', 'beta', 'complimentary', 'scholarship', 'institutional'];

const isGranting = (row: any, now: number) =>
  ACCESS_GRANTING_STATUSES.includes(row.status) &&
  (!row.expiresAt || new Date(row.expiresAt).getTime() > now);

export async function getEntitlementsForUser(userId: number) {
  return db
    .select()
    .from(entitlementsTable)
    .where(eq(entitlementsTable.userId, userId));
}

/** True when the user has a non-expired, non-revoked entitlement for the QBank. */
export async function hasActiveEntitlement(userId: number, qbankId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(entitlementsTable)
    .where(
      and(
        eq(entitlementsTable.userId, userId),
        eq(entitlementsTable.qbankId, qbankId)
      )
    );
  const now = Date.now();
  return rows.some((row) => isGranting(row, now));
}

export interface GrantEntitlementParams {
  userId: number;
  qbankId: number;
  source: 'payment' | 'complimentary' | 'scholarship' | 'beta' | 'institutional' | 'coupon';
  durationDays?: number;
  orderRef?: string;
  grantedBy?: number;
  metadata?: Record<string, any>;
}

/**
 * Grant (or renew) a QBank entitlement. Idempotent: while an active entitlement
 * already exists the existing row is kept instead of duplicating access; a
 * payment grant anchors on its order reference.
 */
export async function grantEntitlement(params: GrantEntitlementParams) {
  const now = Date.now();
  const existing = await db
    .select()
    .from(entitlementsTable)
    .where(
      and(
        eq(entitlementsTable.userId, params.userId),
        eq(entitlementsTable.qbankId, params.qbankId)
      )
    );

  const active = existing.find((row) => isGranting(row, now));
  if (active) {
    return { entitlement: active, created: false };
  }

  const startAt = new Date();
  let expiresAt: Date | null = null;
  if (params.durationDays) {
    expiresAt = new Date(startAt.getTime() + params.durationDays * 24 * 60 * 60 * 1000);
  }

  const status =
    params.source === 'complimentary' || params.source === 'scholarship'
      ? params.source
      : params.source === 'beta'
        ? 'beta'
        : 'active';

  const [entitlement] = await db
    .insert(entitlementsTable)
    .values({
      userId: params.userId,
      qbankId: params.qbankId,
      source: params.source,
      status,
      startAt,
      expiresAt,
      orderRef: params.orderRef ?? null,
      grantedBy: params.grantedBy ?? null,
      metadata: params.metadata ?? null,
    })
    .returning();

  const [qbank] = await db
    .select({ slug: qbanksTable.slug, name: qbanksTable.name })
    .from(qbanksTable)
    .where(eq(qbanksTable.id, params.qbankId));
  await recordAudit({
    actor: params.grantedBy ? { id: params.grantedBy } : undefined,
    action: 'entitlement.grant',
    entityType: 'entitlement',
    entityId: entitlement.id,
    entityLabel: qbank?.slug ?? `qbank#${params.qbankId}`,
    summary: `Granted ${params.source} access to ${qbank?.name ?? qbank?.slug ?? params.qbankId}`,
    newValues: { userId: params.userId, qbankId: params.qbankId, source: params.source, expiresAt },
  });

  return { entitlement, created: true };
}

export async function revokeEntitlement(entitlementId: number, byUserId?: number) {
  const [entitlement] = await db
    .update(entitlementsTable)
    .set({ status: 'revoked' })
    .where(eq(entitlementsTable.id, entitlementId))
    .returning();
  if (entitlement) {
    await recordAudit({
      actor: byUserId ? { id: byUserId } : undefined,
      action: 'entitlement.revoke',
      entityType: 'entitlement',
      entityId: entitlement.id,
      entityLabel: `qbank#${entitlement.qbankId}`,
      summary: `Revoked entitlement for user ${entitlement.userId}`,
      oldValues: { status: entitlement.status },
      newValues: { status: 'revoked' },
    });
  }
  return entitlement;
}

export async function findQbankBySlug(slug: string) {
  const [qbank] = await db.select().from(qbanksTable).where(eq(qbanksTable.slug, slug));
  return qbank;
}
