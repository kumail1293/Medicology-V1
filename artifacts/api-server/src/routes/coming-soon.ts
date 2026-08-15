import { Router } from 'express';
import { db } from '../db.js';
import { comingSoonTable, comingSoonInterestsTable } from '@workspace/db';
import { eq, and, desc, count } from '../utils/drizzle.js';
import { softAuthenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../utils/audit.js';

export const comingSoonRouter = Router();
export const comingSoonAdminRouter = Router();

const VALID_CATEGORIES = ['exam', 'qbank', 'feature', 'program', 'resource'];
const VALID_STATUSES = ['planned', 'in_progress', 'launching'];

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });

function toRow(body: any) {
  const row: any = {};
  if (body.name !== undefined) row.name = String(body.name).trim();
  if (body.description !== undefined) row.description = body.description ? String(body.description) : null;
  if (body.category !== undefined) row.category = body.category;
  if (body.icon !== undefined) row.icon = body.icon ? String(body.icon) : null;
  if (body.imageUrl !== undefined) row.imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  if (body.expectedRelease !== undefined) row.expectedRelease = body.expectedRelease ? new Date(body.expectedRelease) : null;
  if (body.status !== undefined) row.status = body.status;
  if (body.notifyMe !== undefined) row.notifyMe = Boolean(body.notifyMe);
  if (body.audience !== undefined) row.audience = body.audience ? String(body.audience) : null;
  if (body.ctaLabel !== undefined) row.ctaLabel = body.ctaLabel ? String(body.ctaLabel) : 'Notify Me';
  if (body.ctaUrl !== undefined) row.ctaUrl = body.ctaUrl ? String(body.ctaUrl) : null;
  if (body.sortOrder !== undefined) row.sortOrder = Number(body.sortOrder) || 0;
  if (body.active !== undefined) row.active = Boolean(body.active);
  return row;
}

function validateEnums(body: any): string | null {
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    return `category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  return null;
}

/** Attach interest (Notify Me) counts to entries. */
async function withInterestCounts(entries: any[]) {
  const counts = await db
    .select({ comingSoonId: comingSoonInterestsTable.comingSoonId, count: count() })
    .from(comingSoonInterestsTable)
    .groupBy(comingSoonInterestsTable.comingSoonId);
  const map: Record<number, number> = {};
  for (const c of counts) map[Number(c.comingSoonId)] = Number(c.count);
  return entries.map((e) => ({ ...e, interestCount: map[Number(e.id)] ?? 0 }));
}

// ---------------------------------------------------------------------------
// Public: active entries (sorted by sortOrder then name) with interest counts.
// ---------------------------------------------------------------------------
comingSoonRouter.get('/', async (_req: any, res: any) => {
  try {
    const entries = await db
      .select()
      .from(comingSoonTable)
      .where(eq(comingSoonTable.active, true))
      .orderBy(comingSoonTable.sortOrder, comingSoonTable.name);
    res.json(await withInterestCounts(entries));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public: register "Notify Me" interest. Authenticated users are keyed by
// their account; anonymous visitors supply an email.
comingSoonRouter.post('/:id/notify', softAuthenticate, async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const [entry] = await db.select().from(comingSoonTable).where(eq(comingSoonTable.id, id));
    if (!entry) return res.status(404).json({ error: 'Coming Soon item not found' });
    if (!entry.notifyMe) return res.status(400).json({ error: 'Notify Me is not available for this item' });

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const userId = req.user?.id ?? null;

    // Deduplicate: one interest per (entry, user), or per (entry, email) for
    // anonymous visitors.
    const existing = await db
      .select()
      .from(comingSoonInterestsTable)
      .where(
        and(
          eq(comingSoonInterestsTable.comingSoonId, id),
          userId ? eq(comingSoonInterestsTable.userId, userId) : eq(comingSoonInterestsTable.email, email || '__anonymous__')
        )
      );
    if (existing.length > 0) {
      return res.status(200).json({ message: 'You are already on the Notify Me list', alreadyRegistered: true });
    }
    if (!userId && !email) {
      return res.status(400).json({ error: 'An email is required to be notified' });
    }

    await db.insert(comingSoonInterestsTable).values({ comingSoonId: id, userId, email: userId ? null : email });
    res.status(201).json({ message: 'You will be notified when this goes live', registered: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Admin: full catalogue management (requireAdmin — content/coming-soon roles
// are enforced at the route mount in app.ts via role permissions).
// ---------------------------------------------------------------------------
comingSoonAdminRouter.get('/', requireAdmin, requirePermission('coming_soon.manage'), async (_req: any, res: any) => {
  try {
    const entries = await db
      .select()
      .from(comingSoonTable)
      .orderBy(comingSoonTable.sortOrder, desc(comingSoonTable.createdAt));
    res.json(await withInterestCounts(entries));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

comingSoonAdminRouter.post('/', requireAdmin, requirePermission('coming_soon.manage'), async (req: any, res: any) => {
  try {
    const enumErr = validateEnums(req.body);
    if (enumErr) return res.status(400).json({ error: enumErr });
    if (!String(req.body?.name ?? '').trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const row = { ...toRow(req.body), createdById: req.user?.id ?? null, updatedAt: new Date() };
    const [entry] = await db.insert(comingSoonTable).values(row).returning();
    await recordAudit({
      actor: actorOf(req),
      action: 'coming_soon.create',
      entityType: 'coming_soon',
      entityId: entry.id,
      entityLabel: entry.name,
      summary: `Created Coming Soon item "${entry.name}" (${entry.category})`,
      newValues: entry,
      ip: req.ip,
    });
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

comingSoonAdminRouter.put('/:id', requireAdmin, requirePermission('coming_soon.manage'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const enumErr = validateEnums(req.body);
    if (enumErr) return res.status(400).json({ error: enumErr });
    const [existing] = await db.select().from(comingSoonTable).where(eq(comingSoonTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Coming Soon item not found' });

    const row = { ...toRow(req.body), updatedAt: new Date() };
    const [updated] = await db.update(comingSoonTable).set(row).where(eq(comingSoonTable.id, id)).returning();
    await recordAudit({
      actor: actorOf(req),
      action: 'coming_soon.update',
      entityType: 'coming_soon',
      entityId: id,
      entityLabel: updated.name,
      summary: `Updated Coming Soon item "${updated.name}"`,
      oldValues: existing,
      newValues: updated,
      ip: req.ip,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

comingSoonAdminRouter.delete('/:id', requireAdmin, requirePermission('coming_soon.manage'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(comingSoonTable).where(eq(comingSoonTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Coming Soon item not found' });
    await db.delete(comingSoonTable).where(eq(comingSoonTable.id, id));
    await recordAudit({
      actor: actorOf(req),
      action: 'coming_soon.delete',
      entityType: 'coming_soon',
      entityId: id,
      entityLabel: existing.name,
      summary: `Deleted Coming Soon item "${existing.name}"`,
      oldValues: existing,
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
