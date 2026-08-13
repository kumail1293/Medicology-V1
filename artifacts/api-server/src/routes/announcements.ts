import { Router } from 'express';
import { db } from '../db.js';
import { announcementsTable } from '@workspace/db';
import { eq, desc } from '../utils/drizzle.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const announcementsRouter = Router();

const VALID_TYPES = ['popup', 'banner', 'ticker'];

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
  if (body.expiresAt !== undefined) row.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  return row;
}

// Get active announcements for the current user
announcementsRouter.get('/active', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const active = await db.select().from(announcementsTable)
      .where(eq(announcementsTable.isActive, true))
      .orderBy(desc(announcementsTable.createdAt));

    const now = Date.now();
    const role = req.user!.role || 'user';
    const announcements = active.filter((a: any) => {
      if (a.expiresAt && new Date(a.expiresAt).getTime() < now) return false;
      const roles = a.targetRoles
        ? String(a.targetRoles).split(',').map((r: string) => r.trim()).filter(Boolean)
        : [];
      if (roles.length === 0 || roles.includes('all')) return true;
      return roles.includes(role);
    });

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

// Admin: create announcement
announcementsRouter.post('/', authenticate, requireAdmin, async (req, res: any) => {
  try {
    const body = toRow(req.body);
    if (!body.title || !body.content) {
      return res.status(400).json({ error: 'title and content are required' });
    }
    if (body.type !== undefined && !VALID_TYPES.includes(body.type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const [announcement] = await db.insert(announcementsTable).values({
      type: body.type || 'banner',
      title: body.title,
      content: body.content,
      buttonText: body.buttonText ?? null,
      buttonUrl: body.buttonUrl ?? null,
      targetRoles: body.targetRoles ?? 'all',
      isActive: body.isActive ?? false,
      expiresAt: body.expiresAt ?? null,
    }).returning();

    return res.status(201).json({ ...announcement });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Admin: update announcement
announcementsRouter.put('/:id', authenticate, requireAdmin, async (req, res: any) => {
  try {
    const body = toRow(req.body);
    if (body.type !== undefined && !VALID_TYPES.includes(body.type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const [announcement] = await db.update(announcementsTable)
      .set(body)
      .where(eq(announcementsTable.id, Number(req.params.id)))
      .returning();

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ ...announcement });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Admin: delete announcement
announcementsRouter.delete('/:id', authenticate, requireAdmin, async (req, res: any) => {
  try {
    await db.delete(announcementsTable).where(eq(announcementsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
