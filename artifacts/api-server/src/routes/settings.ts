import { Router } from 'express';
import { db } from '../db.js';
import { appSettingsTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { updateSettingsSchema } from './schemas.js';
import type { UpdateSettings } from './schemas.js';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  publicSettings,
} from '../utils/settings-defaults.js';
import { recordAudit } from '../utils/audit.js';

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
    for (const [group, groupValues] of Object.entries(body)) {
      if (!groupValues || typeof groupValues !== 'object') continue;
      // Store the full merged group so reads never have to re-merge per key.
      const fullGroup = (merged as any)[group];
      const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, group));
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

    if (changed.length > 0) {
      await recordAudit({
        actor,
        action: 'settings.update',
        entityType: 'app_settings',
        entityId: 0,
        entityLabel: 'platform',
        summary: `Updated settings group(s): ${changed.join(', ')}`,
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
      newValues: { groups },
      ip: req.ip,
    });

    // mergeSettings fills defaults back in for the deleted groups.
    res.json({ settings: mergeSettings(stored) });
  } catch (err: any) {
    console.error('Error in admin reset settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Public — whitelisted branding/general settings, no auth required. Used by
// the frontend to apply site name + design tokens.
// ---------------------------------------------------------------------------

settingsRouter.get('/settings/public', async (_req: any, res: any) => {
  try {
    const stored = await loadStored();
    const merged = mergeSettings(stored);
    res.json({ settings: publicSettings(merged) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
