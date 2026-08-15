import { Router } from 'express';
import { db } from '../db.js';
import { emailTemplatesTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { z } from 'zod';
import { EMAIL_VARIABLES, renderEmail, type EmailBlock } from '../utils/email-renderer.js';
import { sendEmail, getEmailLogs } from '../utils/mailer.js';
import { seedEmailTemplates } from '../utils/seed-email-templates.js';
import { recordAudit } from '../utils/audit.js';

export const emailRouter = Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, dashes').optional(),
  category: z.enum(['transactional', 'marketing', 'system']).default('transactional'),
  subject: z.string().min(1).max(200),
  preheader: z.string().max(300).optional().nullable(),
  senderName: z.string().max(120).optional().nullable(),
  senderEmail: z.string().email().max(200).optional().nullable(),
  bodyBlocks: z.array(z.any()).default([]),
  variables: z.array(z.string()).default([]),
  audience: z.string().max(200).optional().nullable(),
  language: z.string().max(10).default('en'),
});

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

// GET /api/admin/email/templates
emailRouter.get('/templates', authenticate, requireAdmin, requirePermission('email.manage'), async (req: any, res: any) => {
  try {
    const rows = await db.select().from(emailTemplatesTable);
    const templates = (rows as any[]).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/templates
emailRouter.post('/templates', authenticate, requireAdmin, requirePermission('email.manage'), validateBody(templateSchema), async (req: any, res: any) => {
  try {
    const body = req.validatedBody;
    const slug = body.slug || slugify(body.name);
    const dup = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.slug, slug));
    if (dup.length > 0) {
      res.status(409).json({ error: `A template with slug "${slug}" already exists` });
      return;
    }
    const inserted = await db.insert(emailTemplatesTable).values({
      ...body,
      slug,
      status: 'draft',
      version: 1,
      versions: [],
      createdById: req.user?.id ?? null,
      updatedById: req.user?.id ?? null,
    }).returning();
    const id = (inserted[0] as any)?.id;
    const row = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    await recordAudit({
      actor: actorOf(req), action: 'email_template.create', entityType: 'email_template',
      entityId: id, entityLabel: body.name, summary: `Created email template "${body.name}"`, ip: req.ip,
    });
    res.status(201).json({ template: row[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/email/templates/:id
emailRouter.get('/templates/:id', authenticate, requireAdmin, requirePermission('email.manage'), async (req: any, res: any) => {
  try {
    const rows = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, Number(req.params.id)));
    if (rows.length === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json({ template: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/email/templates/:id — save (bumps version when content changes)
emailRouter.patch('/templates/:id', authenticate, requireAdmin, requirePermission('email.manage'), validateBody(templateSchema.partial()), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    if (existing.length === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    const prev = existing[0] as any;
    const body = req.validatedBody;

    const contentChanged =
      (body.subject !== undefined && body.subject !== prev.subject) ||
      (body.bodyBlocks !== undefined && JSON.stringify(body.bodyBlocks) !== JSON.stringify(prev.bodyBlocks)) ||
      (body.preheader !== undefined && body.preheader !== prev.preheader);

    const versions = Array.isArray(prev.versions) ? prev.versions : [];
    const nextVersion = prev.version + 1;
    if (contentChanged) {
      versions.push({
        version: prev.version,
        subject: prev.subject,
        preheader: prev.preheader,
        bodyBlocks: prev.bodyBlocks,
        changedBy: prev.updatedById ?? null,
        changedAt: prev.updatedAt,
      });
    }

    await db.update(emailTemplatesTable)
      .set({
        ...body,
        slug: body.slug || prev.slug,
        version: contentChanged ? nextVersion : prev.version,
        versions,
        updatedById: req.user?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplatesTable.id, id));

    const row = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    await recordAudit({
      actor: actorOf(req), action: contentChanged ? 'email_template.update' : 'email_template.meta_update',
      entityType: 'email_template', entityId: id, entityLabel: prev.name,
      summary: `Updated email template "${prev.name}"${contentChanged ? ` (v${nextVersion})` : ''}`,
      ip: req.ip,
    });
    res.json({ template: row[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/templates/:id/publish
emailRouter.post('/templates/:id/publish', authenticate, requireAdmin, requirePermission('email.manage'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    if (existing.length === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    await db.update(emailTemplatesTable).set({ status: 'published', updatedById: req.user?.id ?? null, updatedAt: new Date() }).where(eq(emailTemplatesTable.id, id));
    await recordAudit({ actor: actorOf(req), action: 'email_template.publish', entityType: 'email_template', entityId: id, entityLabel: existing[0].name, summary: `Published email template "${existing[0].name}"`, ip: req.ip });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/templates/:id/archive
emailRouter.post('/templates/:id/archive', authenticate, requireAdmin, requirePermission('email.manage'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    if (existing.length === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    await db.update(emailTemplatesTable).set({ status: 'archived', updatedById: req.user?.id ?? null, updatedAt: new Date() }).where(eq(emailTemplatesTable.id, id));
    await recordAudit({ actor: actorOf(req), action: 'email_template.archive', entityType: 'email_template', entityId: id, entityLabel: existing[0].name, summary: `Archived email template "${existing[0].name}"`, ip: req.ip });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/templates/:id/restore — restore a previous version
emailRouter.post('/templates/:id/restore', authenticate, requireAdmin, requirePermission('email.manage'), validateBody(z.object({ version: z.number().int().min(1) })), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    if (existing.length === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    const prev = existing[0] as any;
    const versions = Array.isArray(prev.versions) ? prev.versions : [];
    const target = versions.find((v: any) => v.version === req.validatedBody.version);
    if (!target) { res.status(404).json({ error: `Version ${req.validatedBody.version} not found` }); return; }
    // Save the current state into history, then restore the target.
    versions.push({ version: prev.version, subject: prev.subject, preheader: prev.preheader, bodyBlocks: prev.bodyBlocks, changedBy: prev.updatedById ?? null, changedAt: prev.updatedAt });
    await db.update(emailTemplatesTable)
      .set({ subject: target.subject, preheader: target.preheader ?? null, bodyBlocks: target.bodyBlocks, version: prev.version + 1, versions, updatedById: req.user?.id ?? null, updatedAt: new Date() })
      .where(eq(emailTemplatesTable.id, id));
    const row = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    await recordAudit({ actor: actorOf(req), action: 'email_template.restore', entityType: 'email_template', entityId: id, entityLabel: prev.name, summary: `Restored email template "${prev.name}" to v${req.validatedBody.version}`, ip: req.ip });
    res.json({ template: row[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/templates/:id/preview — render with sample data
const previewData = {
  'user.firstName': 'Ayesha', 'user.lastName': 'Khan', 'user.name': 'Ayesha Khan', 'user.email': 'ayesha@example.com',
  'qbank.name': 'UHS MBBS Year 3 QBank', 'qbank.price': 'Rs. 1,500',
  'exam.name': 'UHS Final Professional', 'exam.date': 'March 2026',
  'result.score': '38', 'result.total': '50', 'result.percentage': '76', 'result.passed': 'true',
  'entitlement.expiryDate': 'August 15, 2027', 'entitlement.qbank': 'UHS MBBS Year 3 QBank',
  'platform.name': 'Medicology', 'platform.logo': '/images/logo-colored.png',
  'platform.supportEmail': 'support@medicology.com', 'platform.siteUrl': 'https://medicology.com',
  'order.id': 'ORD-1042', 'order.amount': 'Rs. 1,500',
  'unsubscribeUrl': 'https://medicology.com/unsubscribe?token=demo',
  'year': '2026', 'currentDate': 'August 15, 2026',
};

emailRouter.post('/templates/:id/preview', authenticate, requireAdmin, requirePermission('email.manage'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    if (existing.length === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    const t = existing[0] as any;
    const html = renderEmail({
      blocks: (t.bodyBlocks ?? []) as EmailBlock[],
      data: previewData,
      platformFooter: '© 2026 Medicology. All rights reserved.',
      unsubscribeUrl: 'https://medicology.com/unsubscribe?token=demo',
      brandName: t.senderName || 'Medicology',
      brandLogo: '/images/logo-colored.png',
    });
    res.json({ html, subject: t.subject, preheader: t.preheader ?? '' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/templates/:id/test — send a test email (explicit confirmation required client-side)
emailRouter.post('/templates/:id/test', authenticate, requireAdmin, requirePermission('email.manage'), validateBody(z.object({ to: z.string().email() })), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
    if (existing.length === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    const t = existing[0] as any;
    const result = await sendEmail({
      to: req.validatedBody.to,
      subject: `[Test] ${t.subject}`,
      blocks: (t.bodyBlocks ?? []) as EmailBlock[],
      templateId: id,
      requestedById: req.user?.id ?? null,
      data: previewData,
    });
    await recordAudit({
      actor: actorOf(req), action: 'email_template.test_send', entityType: 'email_template',
      entityId: id, entityLabel: t.name,
      summary: `Test email for "${t.name}" → ${req.validatedBody.to} (${result.status})`,
      ip: req.ip,
    });
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/templates/seed — restore the default library
// (idempotent: only missing slugs are inserted unless ?force=1).
emailRouter.post('/templates/seed', authenticate, requireAdmin, requirePermission('email.manage'), async (req: any, res: any) => {
  try {
    const force = String(req.query.force) === '1';
    const created = await seedEmailTemplates(force);
    const rows = await db.select().from(emailTemplatesTable);
    await recordAudit({
      actor: actorOf(req), action: 'email_template.seed', entityType: 'email_template',
      entityId: 0, entityLabel: 'library',
      summary: `Restored email template library (${created} added, ${rows.length} total)`, ip: req.ip,
    });
    res.json({ created, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Variables + logs
// ---------------------------------------------------------------------------

// GET /api/admin/email/variables
emailRouter.get('/variables', authenticate, requireAdmin, requirePermission('email.manage'), async (_req: any, res: any) => {
  res.json({ variables: EMAIL_VARIABLES, sampleData: previewData });
});

// GET /api/admin/email/logs
emailRouter.get('/logs', authenticate, requireAdmin, requirePermission('email.manage'), async (req: any, res: any) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const logs = await getEmailLogs(limit);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
