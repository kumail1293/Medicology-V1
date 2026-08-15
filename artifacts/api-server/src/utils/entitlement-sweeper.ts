import { db } from '../db.js';
import { entitlementsTable, usersTable, qbanksTable } from '@workspace/db';
import { eq } from './drizzle.js';
import { sendTransactional } from './transactional-email.js';

// ============================================================================
// Entitlement expiry notifications.
//
// A background sweeper (runs at boot + every 6h) finds grants whose expiry is
// 7 days away (or already past) and emails the owner once per grant, using the
// entitlement_expiring / entitlement_expired templates. Bookkeeping flags on
// the entitlement row make the notifications idempotent — re-running the
// sweeper never sends a duplicate.
// ============================================================================

const EXPIRY_WINDOW_DAYS = 7;
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

export async function sweepEntitlementExpiry(): Promise<{ expiring: number; expired: number }> {
  const now = new Date();
  const result = { expiring: 0, expired: 0 };

  // Load everything and filter in JS — works identically on the mock DB
  // (which has no date operators) and Postgres.
  const grants = await db.select().from(entitlementsTable);
  const users = await db.select().from(usersTable);
  const qbanks = await db.select().from(qbanksTable);
  const userById = new Map(users.map((u: any) => [u.id, u]));
  const qbankById = new Map(qbanks.map((q: any) => [q.id, q]));

  for (const g of grants as any[]) {
    if (g.status !== 'active' || !g.expiresAt) continue;
    const expiry = new Date(g.expiresAt);
    const msLeft = expiry.getTime() - now.getTime();

    // Expired — send once.
    if (msLeft < 0 && !g.expiredNotifiedAt) {
      const user = userById.get(g.userId) as any;
      const qbank = qbankById.get(g.qbankId) as any;
      if (!user || !qbank) continue;
      await sendTransactional({
        to: user.email,
        slug: 'entitlement_expired',
        userId: user.id,
        templateId: g.id,
        data: {
          'user.firstName': user.name?.split(' ')[0] ?? 'there',
          'qbank.name': qbank.name,
          'platform.name': 'Medicology',
        },
      });
      try {
        await db.update(entitlementsTable).set({ expiredNotifiedAt: new Date() }).where(eq(entitlementsTable.id, g.id));
        result.expired++;
      } catch { /* best-effort */ }
      continue;
    }

    // Expiring within the window — send once.
    if (msLeft >= 0 && msLeft <= EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000 && !g.expiringNotifiedAt) {
      const user = userById.get(g.userId) as any;
      const qbank = qbankById.get(g.qbankId) as any;
      if (!user || !qbank) continue;
      await sendTransactional({
        to: user.email,
        slug: 'entitlement_expiring',
        userId: user.id,
        templateId: g.id,
        data: {
          'user.firstName': user.name?.split(' ')[0] ?? 'there',
          'qbank.name': qbank.name,
          'entitlement.expiryDate': expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          'platform.name': 'Medicology',
        },
      });
      try {
        await db.update(entitlementsTable).set({ expiringNotifiedAt: new Date() }).where(eq(entitlementsTable.id, g.id));
        result.expiring++;
      } catch { /* best-effort */ }
    }
  }

  if (result.expiring + result.expired > 0) {
    console.log(`📧 Entitlement sweep: ${result.expiring} expiring + ${result.expired} expired notices sent`);
  }
  return result;
}

let started = false;

/** Starts the sweeper (boot + every 6h). Safe to call multiple times. */
export function startEntitlementSweeper(): void {
  if (started) return;
  started = true;
  void sweepEntitlementExpiry();
  setInterval(() => void sweepEntitlementExpiry(), SWEEP_INTERVAL_MS);
}
