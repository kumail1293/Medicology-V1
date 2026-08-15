import { Router } from 'express';
import { db } from '../db.js';
import { announcementsTable, announcementTemplatesTable } from '@workspace/db';
import { eq, desc } from '../utils/drizzle.js';
import { authenticate, requireAdmin, requirePermission, AuthRequest } from '../middleware/auth.js';
import { queueTransactional } from '../utils/transactional-email.js';
import { usersTable } from '@workspace/db';
import { recordAudit } from '../utils/audit.js';

export const announcementsRouter = Router();

const VALID_TYPES = ['popup', 'banner', 'ticker', 'modal', 'toast', 'exam_alert', 'promotion'];
const VALID_THEMES = ['info', 'success', 'warning', 'error', 'primary'];
const VALID_PRIORITIES = ['low', 'normal', 'high'];
const VALID_FREQUENCIES = ['once', 'daily', 'every_visit'];
const VALID_CATEGORIES = ['exam_alert', 'qbank_launch', 'promotion', 'system_notice', 'maintenance', 'feature', 'custom'];

const PRIORITY_WEIGHT: Record<string, number> = { high: 3, normal: 2, low: 1 };

// Normalize an incoming announcement body to a partial row.
// Only defined fields are included so partial updates don't clobber columns.
function toRow(body: any) {
  const row: any = {};
  if (body.type !== undefined) row.type = body.type;
  if (body.title !== undefined) row.title = String(body.title);
  if (body.content !== undefined) row.content = String(body.content);
  if (body.buttonText !== undefined) row.buttonText = body.buttonText;
  if (body.buttonUrl !== undefined) row.buttonUrl = body.buttonUrl;
  if (body.targetRoles !== undefined) row.targetRoles = body.targetRoles;
  if (body.isActive !== undefined) row.isActive = Boolean(body.isActive);
  if (body.priority !== undefined) row.priority = body.priority;
  if (body.theme !== undefined) row.theme = body.theme;
  if (body.dismissible !== undefined) row.dismissible = Boolean(body.dismissible);
  if (body.frequency !== undefined) row.frequency = body.frequency;
  if (body.targetRoute !== undefined) row.targetRoute = body.targetRoute || null;
  if (body.startsAt !== undefined) row.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.expiresAt !== undefined) row.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  return row;
}

function validateEnums(body: any): string | null {
  if (body.type !== undefined && !VALID_TYPES.includes(body.type)) {
    return `type must be one of: ${VALID_TYPES.join(', ')}`;
  }
  if (body.theme !== undefined && !VALID_THEMES.includes(body.theme)) {
    return `theme must be one of: ${VALID_THEMES.join(', ')}`;
  }
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.frequency !== undefined && !VALID_FREQUENCIES.includes(body.frequency)) {
    return `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`;
  }
  return null;
}

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });

// ---------------------------------------------------------------------------
// Active announcements for the current user — filtered by schedule (startsAt /
// expiresAt), role targeting, and sorted by priority then recency.
// ---------------------------------------------------------------------------
announcementsRouter.get('/active', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const active = await db.select().from(announcementsTable)
      .where(eq(announcementsTable.isActive, true));

    const now = Date.now();
    const role = req.user!.role || 'user';
    const announcements = active
      .filter((a: any) => {
        if (a.startsAt && new Date(a.startsAt).getTime() > now) return false;
        if (a.expiresAt && new Date(a.expiresAt).getTime() < now) return false;
        const roles = a.targetRoles
          ? String(a.targetRoles).split(',').map((r: string) => r.trim()).filter(Boolean)
          : [];
        if (roles.length === 0 || roles.includes('all')) return true;
        return roles.includes(role);
      })
      .sort((a: any, b: any) =>
        (PRIORITY_WEIGHT[b.priority] ?? 2) - (PRIORITY_WEIGHT[a.priority] ?? 2)
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    res.json({ announcements });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Admin: get all announcements
announcementsRouter.get('/admin', authenticate, requireAdmin, async (req, res: any) => {
  try {
    const announcements = await db.select().from(announcementsTable)
      .orderBy(desc(announcementsTable.createdAt));
    res.json({ announcements });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------------------------
// Reusable templates (admin settings plan item 14) — admin-authored skeletons
// that prefill the announcement builder.
// ---------------------------------------------------------------------------

announcementsRouter.get('/templates', authenticate, requireAdmin, async (_req, res: any) => {
  try {
    const templates = await db.select().from(announcementTemplatesTable)
      .orderBy(desc(announcementTemplatesTable.updatedAt));
    res.json({ templates });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

announcementsRouter.post('/templates', authenticate, requireAdmin, requirePermission('announcements.manage'), async (req, res: any) => {
  try {
    const body = req.body ?? {};
    if (!body.name || !body.title || !body.content) {
      return res.status(400).json({ error: 'name, title and content are required' });
    }
    const invalid = validateEnums(body);
    if (invalid) return res.status(400).json({ error: invalid });
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const [template] = await db.insert(announcementTemplatesTable).values({
      name: body.name,
      category: body.category ?? 'custom',
      type: body.type ?? 'banner',
      title: body.title,
      content: body.content,
      buttonText: body.buttonText ?? null,
      buttonUrl: body.buttonUrl ?? null,
      theme: body.theme ?? 'info',
      priority: body.priority ?? 'normal',
      targetRoles: body.targetRoles ?? 'all',
    }).returning();

    await recordAudit({
      actor: actorOf(req),
      action: 'announcement_template.create',
      entityType: 'announcement_template',
      entityId: template.id,
      entityLabel: template.name,
      summary: `Created announcement template: ${template.name}`,
      newValues: template,
      ip: req.ip,
    });
    return res.status(201).json({ ...template });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

announcementsRouter.put('/templates/:id', authenticate, requireAdmin, requirePermission('announcements.manage'), async (req, res: any) => {
  try {
    const body = req.body ?? {};
    const invalid = validateEnums(body);
    if (invalid) return res.status(400).json({ error: invalid });

    const row: any = {};
    if (body.name !== undefined) row.name = body.name;
    if (body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(body.category)) {
        return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
      }
      row.category = body.category;
    }
    if (body.type !== undefined) row.type = body.type;
    if (body.title !== undefined) row.title = body.title;
    if (body.content !== undefined) row.content = body.content;
    if (body.buttonText !== undefined) row.buttonText = body.buttonText;
    if (body.buttonUrl !== undefined) row.buttonUrl = body.buttonUrl;
    if (body.theme !== undefined) row.theme = body.theme;
    if (body.priority !== undefined) row.priority = body.priority;
    if (body.targetRoles !== undefined) row.targetRoles = body.targetRoles;
    row.updatedAt = new Date();

    const [template] = await db.update(announcementTemplatesTable)
      .set(row)
      .where(eq(announcementTemplatesTable.id, Number(req.params.id)))
      .returning();
    if (!template) return res.status(404).json({ error: 'Template not found' });

    await recordAudit({
      actor: actorOf(req),
      action: 'announcement_template.update',
      entityType: 'announcement_template',
      entityId: template.id,
      entityLabel: template.name,
      summary: `Updated announcement template: ${template.name}`,
      newValues: template,
      ip: req.ip,
    });
    res.json({ ...template });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

announcementsRouter.delete('/templates/:id', authenticate, requireAdmin, requirePermission('announcements.manage'), async (req, res: any) => {
  try {
    const [existing] = await db.select().from(announcementTemplatesTable).where(eq(announcementTemplatesTable.id, Number(req.params.id)));
    await db.delete(announcementTemplatesTable).where(eq(announcementTemplatesTable.id, Number(req.params.id)));
    if (existing) {
      await recordAudit({
        actor: actorOf(req),
        action: 'announcement_template.delete',
        entityType: 'announcement_template',
        entityId: existing.id,
        entityLabel: existing.name,
        summary: `Deleted announcement template: ${existing.name}`,
        oldValues: existing,
        ip: req.ip,
      });
    }
    res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Admin: create announcement
announcementsRouter.post('/', authenticate, requireAdmin, requirePermission('announcements.manage'), async (req, res: any) => {
  try {
    const body = toRow(req.body);
    if (!body.title || !body.content) {
      return res.status(400).json({ error: 'title and content are required' });
    }
    const invalid = validateEnums(body);
    if (invalid) return res.status(400).json({ error: invalid });

    const [announcement] = await db.insert(announcementsTable).values({
      type: body.type || 'banner',
      title: body.title,
      content: body.content,
      buttonText: body.buttonText ?? null,
      buttonUrl: body.buttonUrl ?? null,
      targetRoles: body.targetRoles ?? 'all',
      isActive: body.isActive ?? false,
      startsAt: body.startsAt ?? null,
      expiresAt: body.expiresAt ?? null,
      priority: body.priority ?? 'normal',
      theme: body.theme ?? 'info',
      dismissible: body.dismissible ?? true,
      frequency: body.frequency ?? 'every_visit',
      targetRoute: body.targetRoute ?? null,
    }).returning();

    await recordAudit({
      actor: actorOf(req),
      action: 'announcement.create',
      entityType: 'announcement',
      entityId: announcement.id,
      entityLabel: announcement.title,
      summary: `Created ${announcement.type} announcement: ${announcement.title}`,
      newValues: announcement,
      ip: req.ip,
    });

    return res.status(201).json({ ...announcement });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Admin: update announcement
announcementsRouter.put('/:id', authenticate, requireAdmin, requirePermission('announcements.manage'), async (req, res: any) => {
  try {
    const body = toRow(req.body);
    const invalid = validateEnums(body);
    if (invalid) return res.status(400).json({ error: invalid });

    const [existing] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: 'Announcement not found' });

    body.updatedAt = new Date();
    const [announcement] = await db.update(announcementsTable)
      .set(body)
      .where(eq(announcementsTable.id, Number(req.params.id)))
      .returning();

    await recordAudit({
      actor: actorOf(req),
      action: 'announcement.update',
      entityType: 'announcement',
      entityId: announcement.id,
      entityLabel: announcement.title,
      summary: `Updated announcement: ${announcement.title}`,
      oldValues: existing,
      newValues: announcement,
      ip: req.ip,
    });
    res.json({ ...announcement });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Admin: email an announcement to its audience using the `announcement`
// email template. Bounded to the first 500 matching users; best-effort sends.
announcementsRouter.post('/:id/email', authenticate, requireAdmin, requirePermission('announcements.manage'), async (req, res: any) => {
  try {
    const [announcement] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, Number(req.params.id)));
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    const all = await db.select().from(usersTable);
    const roles = announcement.targetRoles === 'all' ? null : String(announcement.targetRoles).split(',').map((r) => r.trim());
    const recipients = (all as any[])
      .filter((u) => !u.deletedAt && (roles === null || roles.includes(u.role)))
      .slice(0, 500);

    const baseUrl = process.env.APP_BASE_URL || 'https://medicology.com';
    for (const user of recipients) {
      queueTransactional({
        to: user.email,
        slug: 'announcement',
        userId: user.id,
        data: {
          'user.firstName': String(user.name).split(' ')[0],
          'announcement.title': announcement.title,
          'announcement.subtitle': announcement.buttonText ?? 'New update from Medicology',
          'announcement.body': String(announcement.content).replace(/<[^>]+>/g, ' ').slice(0, 600),
          'announcement.ctaLabel': announcement.buttonText ?? 'Learn more',
          'announcement.ctaUrl': announcement.buttonUrl ?? baseUrl,
          'platform.name': 'Medicology',
          'platform.siteUrl': baseUrl,
        },
      });
    }

    await recordAudit({
      actor: actorOf(req),
      action: 'announcement.email',
      entityType: 'announcement',
      entityId: announcement.id,
      entityLabel: announcement.title,
      summary: `Emailed announcement "${announcement.title}" to ${recipients.length} recipient(s)`,
      newValues: { recipients: recipients.length },
      ip: req.ip,
    });

    res.json({ success: true, recipients: recipients.length });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Admin: delete announcement
announcementsRouter.delete('/:id', authenticate, requireAdmin, requirePermission('announcements.manage'), async (req, res: any) => {
  try {
    const [existing] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, Number(req.params.id)));
    await db.delete(announcementsTable).where(eq(announcementsTable.id, Number(req.params.id)));
    if (existing) {
      await recordAudit({
        actor: actorOf(req),
        action: 'announcement.delete',
        entityType: 'announcement',
        entityId: existing.id,
        entityLabel: existing.title,
        summary: `Deleted announcement: ${existing.title}`,
        oldValues: existing,
        ip: req.ip,
      });
    }
    res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
