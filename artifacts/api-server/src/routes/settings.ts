import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { appSettingsTable, settingsOverridesTable, SETTING_SCOPES, type SettingScope } from '@workspace/db';
import { and, eq } from '../utils/drizzle.js';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { updateSettingsSchema, UPDATE_SETTINGS_SHAPE, settingsOverrideUpsertSchema, examSettingsSchema } from './schemas.js';
import type { UpdateSettings } from './schemas.js';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  publicSettings,
} from '../utils/settings-defaults.js';
import { CONFIG_GROUPS, getConfigRegistry, getPublicConfigRegistry } from '../utils/config-registry.js';
import { recordAudit, getAuditLogs } from '../utils/audit.js';
import { invalidateFeatureFlagsCache } from '../utils/feature-flags.js';
import { invalidateMaintenanceCache } from '../middleware/maintenance.js';
import {
  SAFETY_KEYS,
  SCOPE_LABELS,
  loadOverridesForContext,
  platformGroup,
  resolveExamSettings,
  type OverrideContext,
} from '../utils/scoped-overrides.js';

export const settingsRouter = Router();

// ---------------------------------------------------------------------------
// Admin — full read/write of platform settings (WordPress options style).
// ---------------------------------------------------------------------------

async function loadStored(): Promise<Record<string, any>> {
  const rows = await db.select().from(appSettingsTable);
  const map: Record<string, any> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

// Short-TTL cache for the public config endpoint. The frontend fetches it on
// every page mount, so without a cache the DB + rate limiter get hammered.
// Public settings are whitelisted values only — safe to serve from cache.
let publicCache: { payload: any; at: number } | null = null;
const PUBLIC_CACHE_TTL_MS = 15_000;

export function invalidatePublicSettingsCache() {
  publicCache = null;
}

async function getPublicPayload() {
  const now = Date.now();
  if (publicCache && now - publicCache.at < PUBLIC_CACHE_TTL_MS) return publicCache.payload;
  const stored = await loadStored();
  const merged = mergeSettings(stored);
  const payload = {
    settings: publicSettings(merged),
    maintenance: { enabled: !!(merged as any).security?.maintenanceMode },
  };
  publicCache = { payload, at: now };
  return payload;
}

// GET /api/admin/settings — merged settings + defaults (for reset UI).
settingsRouter.get('/admin/settings', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const stored = await loadStored();
    const settings = mergeSettings(stored);
    res.json({ settings, defaults: DEFAULT_SETTINGS });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/settings — partial update of one or more groups.
settingsRouter.put('/admin/settings', authenticate, requireAdmin, requirePermission('settings.manage'), validateBody(updateSettingsSchema), async (req: any, res: any) => {
  try {
    const body = req.validatedBody as UpdateSettings;
    const stored = await loadStored();

    // --- SMTP password secret handling --------------------------------------
    // The password is never stored inside the settings group or returned by the
    // API. A non-empty smtpPassword in the payload is persisted under a secret
    // key; an empty/absent one leaves the existing secret untouched.
    const emailPatch = (body as any).email as Record<string, any> | undefined;
    if (emailPatch && typeof emailPatch === 'object') {
      const incomingPassword = emailPatch.smtpPassword;
      if (typeof incomingPassword === 'string' && incomingPassword.length > 0) {
        const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, '__secret_email_smtp_password'));
        if (existing.length > 0) {
          await db.update(appSettingsTable).set({ value: incomingPassword, updatedBy: req.user?.id ?? null, updatedAt: new Date() })
            .where(eq(appSettingsTable.key, '__secret_email_smtp_password'));
        } else {
          await db.insert(appSettingsTable).values({ key: '__secret_email_smtp_password', value: incomingPassword, updatedBy: req.user?.id ?? null });
        }
        emailPatch.smtpPasswordSet = true;
      }
      delete emailPatch.smtpPassword; // never persists inside the group
    }

    const merged = mergeSettings({ ...stored, ...(body as any) });

    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    const changed: string[] = [];
    const oldValues: Record<string, any> = {};
    for (const [group, groupValues] of Object.entries(body)) {
      if (!groupValues || typeof groupValues !== 'object') continue;
      // Store the full merged group so reads never have to re-merge per key.
      const fullGroup = (merged as any)[group];
      const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, group));
      // Snapshot the pre-change group for history/restore (mock DB mutates in
      // place, so capture before the write).
      const prev = (existing.length > 0 ? existing[0].value : DEFAULT_SETTINGS[group as keyof typeof DEFAULT_SETTINGS]) ?? {};
      oldValues[group] = JSON.parse(JSON.stringify(prev));
      if (existing.length > 0) {
        await db
          .update(appSettingsTable)
          .set({ value: fullGroup, updatedBy: req.user?.id ?? null, updatedAt: new Date() })
          .where(eq(appSettingsTable.key, group));
      } else {
        await db.insert(appSettingsTable).values({
          key: group,
          value: fullGroup,
          updatedBy: req.user?.id ?? null,
        });
      }
      changed.push(group);
    }

    // Feature flags + maintenance mode gate live routes — drop their caches.
    invalidateFeatureFlagsCache();
    invalidateMaintenanceCache();
    invalidatePublicSettingsCache();

    if (changed.length > 0) {
      await recordAudit({
        actor,
        action: 'settings.update',
        entityType: 'app_settings',
        entityId: 0,
        entityLabel: 'platform',
        summary: `Updated settings group(s): ${changed.join(', ')}`,
        oldValues,
        newValues: Object.fromEntries(changed.map((g) => [g, (merged as any)[g]])),
        ip: req.ip,
      });
    }

    res.json({ settings: merged });
  } catch (err: any) {
    console.error('Error in admin update settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/settings/export — versioned snapshot of the effective
// configuration. Secrets are stripped: the email group keeps only
// smtpPasswordSet, and secret keys are never included.
settingsRouter.get('/admin/settings/export', authenticate, requireAdmin, requirePermission('settings.manage'), async (_req: any, res: any) => {
  try {
    const stored = await loadStored();
    const merged = mergeSettings(stored) as any;
    // Strip secrets from the snapshot.
    const safe: any = JSON.parse(JSON.stringify(merged));
    if (safe.email) {
      safe.email = { ...safe.email, smtpPassword: undefined };
      delete safe.email.smtpPassword;
    }
    const snapshot = {
      version: 1,
      schema: 'medicology-settings',
      exportedAt: new Date().toISOString(),
      settings: safe,
    };
    res.setHeader('Content-Disposition', `attachment; filename="medicology-settings-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/settings/import — validate + preview a snapshot (dry run
// when ?dryRun=1), then apply. Audit-logged; secrets never imported.
settingsRouter.post('/admin/settings/import', authenticate, requireAdmin, requirePermission('settings.manage'), validateBody(z.object({ snapshot: z.unknown() })), async (req: any, res: any) => {
  try {
    const snap = (req.validatedBody as any).snapshot as any;
    if (!snap || typeof snap !== 'object' || !snap.settings || typeof snap.settings !== 'object') {
      return res.status(400).json({ error: 'Invalid snapshot: expected { version, schema, settings }' });
    }
    // Validate every group against its zod schema before touching storage.
    const { updateSettingsSchema } = await import('./schemas.js');
    const parsed = updateSettingsSchema.safeParse(snap.settings);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Snapshot validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const incoming = parsed.data as any;
    if (incoming.email?.smtpPassword) delete incoming.email.smtpPassword; // secrets never imported
    const stored = await loadStored();
    const merged = mergeSettings({ ...stored, ...incoming });

    // Diff for preview / audit.
    const diff: Record<string, { old: any; new: any }> = {};
    for (const [group, values] of Object.entries(incoming)) {
      if (!values || typeof values !== 'object') continue;
      const oldGroup = (stored[group] ?? (DEFAULT_SETTINGS as any)[group]) ?? {};
      const newGroup = (merged as any)[group];
      if (JSON.stringify(oldGroup) !== JSON.stringify(newGroup)) {
        diff[group] = { old: oldGroup, new: newGroup };
      }
    }

    const dryRun = String(req.query.dryRun) === '1';
    if (dryRun) {
      return res.json({ ok: true, dryRun: true, diff, groups: Object.keys(incoming) });
    }

    if (Object.keys(diff).length === 0) {
      return res.json({ ok: true, applied: 0, message: 'No changes — snapshot matches current settings.' });
    }

    // Apply changed groups.
    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    for (const [group, values] of Object.entries(incoming)) {
      if (!values || typeof values !== 'object') continue;
      if (!(diff as any)[group]) continue; // only changed groups
      const fullGroup = (merged as any)[group];
      const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, group));
      if (existing.length > 0) {
        await db.update(appSettingsTable).set({ value: fullGroup, updatedBy: req.user?.id ?? null, updatedAt: new Date() }).where(eq(appSettingsTable.key, group));
      } else {
        await db.insert(appSettingsTable).values({ key: group, value: fullGroup, updatedBy: req.user?.id ?? null });
      }
    }
    await recordAudit({
      actor, action: 'settings.import', entityType: 'app_settings', entityId: 0, entityLabel: 'platform',
      summary: `Imported settings snapshot (${Object.keys(diff).length} group(s))`,
      oldValues: Object.fromEntries(Object.entries(diff).map(([g, d]) => [g, d.old])),
      newValues: Object.fromEntries(Object.entries(diff).map(([g, d]) => [g, d.new])),
      ip: req.ip,
    });
    invalidateFeatureFlagsCache();
    invalidateMaintenanceCache();
    res.json({ ok: true, applied: Object.keys(diff).length, groups: Object.keys(diff) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/settings/email/test — send a test email through the full
// configured pipeline (SMTP or log provider) using the welcome template.
settingsRouter.post('/admin/settings/email/test', authenticate, requireAdmin, requirePermission('settings.manage'), validateBody(z.object({ to: z.string().email().optional() })), async (req: any, res: any) => {
  try {
    const { sendTransactional } = await import('../utils/transactional-email.js');
    const to = (req.validatedBody as any).to || 'test@medicology.local';
    const result = await sendTransactional({
      to,
      slug: 'welcome',
      data: {
        'user.firstName': 'Test',
        'user.name': 'Test User',
        'platform.name': 'Medicology',
        'platform.siteUrl': process.env.APP_BASE_URL || 'https://medicology.com',
        'platform.supportEmail': 'support@medicology.com',
        'currentDate': new Date().toLocaleDateString(),
      },
    });
    await recordAudit({
      actor: { id: req.user?.id, name: req.user?.name, email: req.user?.email },
      action: 'settings.email_test', entityType: 'email_settings', entityId: 0, entityLabel: 'email',
      summary: `Sent test email → ${to} (${result.status})`, ip: req.ip,
    });
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/settings/reset — restore a group (or everything) to defaults.
settingsRouter.post('/admin/settings/reset', authenticate, requireAdmin, requirePermission('settings.manage'), async (req: any, res: any) => {
  try {
    const { group } = req.body ?? {};
    const groups = group && typeof group === 'string'
      ? [group]
      : Object.keys(DEFAULT_SETTINGS);
    const stored = await loadStored();
    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };

    for (const g of groups) {
      if (!(g in DEFAULT_SETTINGS)) continue;
      await db.delete(appSettingsTable).where(eq(appSettingsTable.key, g));
      delete stored[g];
      // Resetting the email group also clears the stored SMTP secret.
      if (g === 'email') {
        await db.delete(appSettingsTable).where(eq(appSettingsTable.key, '__secret_email_smtp_password'));
      }
    }
    await recordAudit({
      actor,
      action: 'settings.reset',
      entityType: 'app_settings',
      entityId: 0,
      entityLabel: 'platform',
      summary: `Reset settings group(s): ${groups.join(', ')}`,
      oldValues: Object.fromEntries(groups.map((g) => [g, stored[g] ?? null])),
      newValues: { groups },
      ip: req.ip,
    });
    invalidateFeatureFlagsCache();
    invalidateMaintenanceCache();

    // mergeSettings fills defaults back in for the deleted groups.
    res.json({ settings: mergeSettings(stored) });
  } catch (err: any) {
    console.error('Error in admin reset settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Settings history & restore (reuses the audit trail — no duplicate system).
// ---------------------------------------------------------------------------

// GET /api/admin/settings/history — audit entries for settings changes.
settingsRouter.get('/admin/settings/history', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { logs, total } = await getAuditLogs({ entityType: 'app_settings', limit });
    res.json({ logs, total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/settings/restore — re-apply the pre-change snapshot from an
// audit entry (oldValues), so any saved configuration can be restored.
settingsRouter.post('/admin/settings/restore', authenticate, requireAdmin, requirePermission('settings.manage'), async (req: any, res: any) => {
  try {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'Audit log id is required' });
    const { logs } = await getAuditLogs({ entityType: 'app_settings', limit: 500 });
    const entry = logs.find((l: any) => Number(l.id) === Number(id));
    if (!entry) return res.status(404).json({ error: 'History entry not found' });
    const snapshot = entry.oldValues;
    if (!snapshot || typeof snapshot !== 'object' || Object.keys(snapshot).length === 0) {
      return res.status(400).json({ error: 'This history entry has no restorable snapshot' });
    }

    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    for (const [group, value] of Object.entries(snapshot)) {
      if (!(group in DEFAULT_SETTINGS)) continue;
      const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, group));
      if (existing.length > 0) {
        await db
          .update(appSettingsTable)
          .set({ value, updatedBy: req.user?.id ?? null, updatedAt: new Date() })
          .where(eq(appSettingsTable.key, group));
      } else {
        await db.insert(appSettingsTable).values({ key: group, value, updatedBy: req.user?.id ?? null });
      }
    }
    invalidateFeatureFlagsCache();
    invalidateMaintenanceCache();

    await recordAudit({
      actor,
      action: 'settings.restore',
      entityType: 'app_settings',
      entityId: 0,
      entityLabel: 'platform',
      summary: `Restored settings from history entry #${id}`,
      oldValues: snapshot,
      newValues: { restoredFrom: id },
      ip: req.ip,
    });

    const stored = await loadStored();
    res.json({ settings: mergeSettings(stored) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Scoped overrides (plan items 10–11) — QBank / taxonomy-scoped exam
// settings layered over the platform defaults with deterministic precedence.
// ---------------------------------------------------------------------------

// Per-key zod validators for the examSettings group (used to validate the
// JSONB value of an override before it is stored).
const EXAM_SETTINGS_KEY_SCHEMAS: Record<string, any> = (examSettingsSchema as any).shape;

function parseScopeId(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/admin/settings/overrides?scope=exam&scopeId=3 — list overrides
// currently set on one scope.
settingsRouter.get('/admin/settings/overrides', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const { scope, scopeId } = req.query;
    if (!SETTING_SCOPES.includes(scope)) {
      return res.status(400).json({ error: `scope must be one of: ${SETTING_SCOPES.join(', ')}` });
    }
    const id = parseScopeId(scopeId);
    if (!id) return res.status(400).json({ error: 'scopeId is required (positive integer)' });
    const rows = await db.select().from(settingsOverridesTable)
      .where(and(eq(settingsOverridesTable.scope, scope), eq(settingsOverridesTable.scopeId, id)));
    res.json({ overrides: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/settings/overrides — upsert one override. Validates the key
// is a real examSettings key and the value matches its schema; rejects safety
// keys; audits the change.
settingsRouter.put('/admin/settings/overrides', authenticate, requireAdmin, requirePermission('overrides.manage'), validateBody(settingsOverrideUpsertSchema), async (req: any, res: any) => {
  try {
    const { scope, scopeId, group, key, value } = req.validatedBody;
    if (SAFETY_KEYS.includes(`${group}.${key}`)) {
      return res.status(400).json({ error: `${group}.${key} is a system safety constraint and cannot be overridden` });
    }
    const keySchema = EXAM_SETTINGS_KEY_SCHEMAS[key];
    if (!keySchema) {
      return res.status(400).json({ error: `Unknown key "${key}" for group "${group}"` });
    }
    const parsed = keySchema.safeParse(value);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid override value',
        details: parsed.error.issues.map((i: any) => ({ field: i.path.join('.'), message: i.message })),
      });
    }

    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    const existing = await db.select().from(settingsOverridesTable)
      .where(and(
        eq(settingsOverridesTable.scope, scope),
        eq(settingsOverridesTable.scopeId, scopeId),
        eq(settingsOverridesTable.group, group),
        eq(settingsOverridesTable.key, key),
      ));
    let row;
    if (existing.length > 0) {
      row = existing[0];
      const prev = JSON.parse(JSON.stringify(row.value));
      await db.update(settingsOverridesTable)
        .set({ value: parsed.data, updatedAt: new Date() })
        .where(eq(settingsOverridesTable.id, row.id));
      await recordAudit({
        actor, action: 'settings_override.upsert', entityType: 'settings_override',
        entityId: row.id, entityLabel: `${SCOPE_LABELS[scope as SettingScope]} #${scopeId} · ${key}`,
        summary: `Updated override ${SCOPE_LABELS[scope as SettingScope]} #${scopeId} ${group}.${key}`,
        oldValues: { value: prev }, newValues: { value: parsed.data }, ip: req.ip,
      });
    } else {
      [row] = await db.insert(settingsOverridesTable).values({
        scope, scopeId, group, key, value: parsed.data, createdBy: req.user?.id ?? null,
      }).returning();
      await recordAudit({
        actor, action: 'settings_override.create', entityType: 'settings_override',
        entityId: row.id, entityLabel: `${SCOPE_LABELS[scope as SettingScope]} #${scopeId} · ${key}`,
        summary: `Added override ${SCOPE_LABELS[scope as SettingScope]} #${scopeId} ${group}.${key}`,
        newValues: { value: parsed.data }, ip: req.ip,
      });
    }
    res.json({ override: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/settings/overrides?scope=exam&scopeId=3&key=questionCount
settingsRouter.delete('/admin/settings/overrides', authenticate, requireAdmin, requirePermission('overrides.manage'), async (req: any, res: any) => {
  try {
    const { scope, scopeId, key, group } = req.query;
    if (!SETTING_SCOPES.includes(scope)) return res.status(400).json({ error: 'Invalid scope' });
    const id = parseScopeId(scopeId);
    if (!id) return res.status(400).json({ error: 'scopeId is required (positive integer)' });
    if (!key) return res.status(400).json({ error: 'key is required' });
    const g = group || 'examSettings';
    const existing = await db.select().from(settingsOverridesTable)
      .where(and(
        eq(settingsOverridesTable.scope, scope),
        eq(settingsOverridesTable.scopeId, id),
        eq(settingsOverridesTable.group, g),
        eq(settingsOverridesTable.key, key),
      ));
    if (existing.length === 0) return res.status(404).json({ error: 'Override not found' });
    await db.delete(settingsOverridesTable).where(eq(settingsOverridesTable.id, existing[0].id));
    await recordAudit({
      actor: { id: req.user?.id, name: req.user?.name, email: req.user?.email },
      action: 'settings_override.delete', entityType: 'settings_override',
      entityId: existing[0].id, entityLabel: `${SCOPE_LABELS[scope as SettingScope]} #${id} · ${key}`,
      summary: `Removed override ${SCOPE_LABELS[scope as SettingScope]} #${id} ${g}.${key}`,
      oldValues: { value: existing[0].value }, ip: req.ip,
    });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/settings/overrides/resolve?examId=1&qbankId=2&… — the
// resolved exam settings for a context + per-key provenance (admin preview).
settingsRouter.get('/admin/settings/overrides/resolve', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const ctx: OverrideContext = {};
    for (const scope of SETTING_SCOPES) {
      const id = parseScopeId(req.query[`${scope}Id`]);
      if (id) ctx[`${scope}Id` as keyof OverrideContext] = id;
    }
    const platform = await platformGroup('examSettings');
    const rows = await loadOverridesForContext(ctx);
    const resolved = resolveExamSettings(platform, rows);
    res.json({
      context: ctx,
      platform,
      settings: resolved.settings,
      sources: resolved.sources,
      applied: resolved.applied,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/exam?examId=1&qbankId=2&… — resolved exam behavior for a
// context, no auth (exam config is not secret). Used by the exam engine to
// pick up university/QBank-specific rules before a session starts.
settingsRouter.get('/settings/exam', async (req: any, res: any) => {
  try {
    const ctx: OverrideContext = {};
    for (const scope of SETTING_SCOPES) {
      const id = parseScopeId(req.query[`${scope}Id`]);
      if (id) ctx[`${scope}Id` as keyof OverrideContext] = id;
    }
    const platform = await platformGroup('examSettings');
    const rows = await loadOverridesForContext(ctx);
    const resolved = resolveExamSettings(platform, rows);
    res.json({ settings: resolved.settings, sources: resolved.sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/settings/:section — one group, admin only.
// ---------------------------------------------------------------------------
// Configuration registry (Phase 1) — the metadata contract the admin UI
// renders from. Admin-only; contains no secrets — only types, descriptions,
// defaults, scopes and the editableBy/audit policy. Registered BEFORE the
// /admin/settings/:section wildcard so it cannot be shadowed.
// ---------------------------------------------------------------------------
settingsRouter.get('/admin/settings/registry', authenticate, requireAdmin, requirePermission('settings.manage'), async (_req: any, res: any) => {
  try {
    res.json({
      groups: CONFIG_GROUPS,
      settings: getConfigRegistry(),
      publicSettings: getPublicConfigRegistry(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.get('/admin/settings/:section', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const { section } = req.params as { section: string };
    if (!(section in DEFAULT_SETTINGS)) {
      return res.status(404).json({ error: `Unknown settings section: ${section}` });
    }
    const stored = await loadStored();
    const merged = mergeSettings(stored);
    res.json({ section, settings: (merged as any)[section] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/settings/:section — validated partial update of one group.
settingsRouter.patch('/admin/settings/:section', authenticate, requireAdmin, requirePermission('settings.manage'), async (req: any, res: any) => {
  try {
    const { section } = req.params as { section: string };
    if (!(section in DEFAULT_SETTINGS)) {
      return res.status(404).json({ error: `Unknown settings section: ${section}` });
    }
    const groupSchema = (UPDATE_SETTINGS_SHAPE as any)[section];
    if (!groupSchema) {
      return res.status(400).json({ error: `Section ${section} is not updatable` });
    }
    const parsed = groupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues.map((i: any) => ({ field: i.path.join('.'), message: i.message })),
      });
    }

    const stored = await loadStored();
    const merged = mergeSettings({ ...stored, [section]: { ...(stored[section] ?? {}), ...parsed.data } });
    const fullGroup = (merged as any)[section];
    const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, section));
    const prev = (existing.length > 0 ? existing[0].value : DEFAULT_SETTINGS[section as keyof typeof DEFAULT_SETTINGS]) ?? {};
    if (existing.length > 0) {
      await db
        .update(appSettingsTable)
        .set({ value: fullGroup, updatedBy: req.user?.id ?? null, updatedAt: new Date() })
        .where(eq(appSettingsTable.key, section));
    } else {
      await db.insert(appSettingsTable).values({ key: section, value: fullGroup, updatedBy: req.user?.id ?? null });
    }
    invalidateFeatureFlagsCache();
    invalidateMaintenanceCache();

    await recordAudit({
      actor: { id: req.user?.id, name: req.user?.name, email: req.user?.email },
      action: 'settings.update',
      entityType: 'app_settings',
      entityId: 0,
      entityLabel: 'platform',
      summary: `Updated settings group: ${section}`,
      oldValues: { [section]: JSON.parse(JSON.stringify(prev)) },
      newValues: { [section]: fullGroup },
      ip: req.ip,
    });
    res.json({ settings: (merged as any)[section] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Public — whitelisted branding/general/feature-flag settings + maintenance
// status, no auth required. Used by the frontend to apply design tokens and
// gate features.
// ---------------------------------------------------------------------------

settingsRouter.get('/settings/public', async (_req: any, res: any) => {
  try {
    res.json(await getPublicPayload());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
