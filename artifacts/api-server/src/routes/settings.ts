import { Router } from 'express';
import { db } from '../db.js';
import { appSettingsTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { updateSettingsSchema, UPDATE_SETTINGS_SHAPE } from './schemas.js';
import type { UpdateSettings } from './schemas.js';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  publicSettings,
} from '../utils/settings-defaults.js';
import { recordAudit, getAuditLogs } from '../utils/audit.js';
import { invalidateFeatureFlagsCache } from '../utils/feature-flags.js';
import { invalidateMaintenanceCache } from '../middleware/maintenance.js';

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
settingsRouter.put('/admin/settings', authenticate, requireAdmin, validateBody(updateSettingsSchema), async (req: any, res: any) => {
  try {
    const body = req.validatedBody as UpdateSettings;
    const stored = await loadStored();
    const merged = mergeSettings({ ...stored, ...body });

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

// POST /api/admin/settings/reset — restore a group (or everything) to defaults.
settingsRouter.post('/admin/settings/reset', authenticate, requireAdmin, async (req: any, res: any) => {
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
settingsRouter.post('/admin/settings/restore', authenticate, requireAdmin, async (req: any, res: any) => {
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

// GET /api/admin/settings/:section — one group, admin only.
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
settingsRouter.patch('/admin/settings/:section', authenticate, requireAdmin, async (req: any, res: any) => {
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
    const stored = await loadStored();
    const merged = mergeSettings(stored);
    res.json({
      settings: publicSettings(merged),
      maintenance: { enabled: !!(merged as any).security?.maintenanceMode },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
