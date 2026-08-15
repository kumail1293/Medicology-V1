// ============================================================================
// Maintenance mode — enforced server-side, never by the client alone.
//
// When security.maintenanceMode is enabled, non-exempt API routes return 503.
// Exempt routes keep the platform reachable and safe:
//   - /api/health          — uptime probes keep working
//   - /api/auth/*          — admins (and users) must be able to log in
//   - /api/settings/*      — the frontend needs branding + maintenance status
//   - /api/admin/*         — admin bypass (admins keep working)
//
// The middleware is mounted at /api, so req.path arrives already stripped of
// the /api prefix (e.g. /auth/login, /admin/settings).
// ============================================================================

import { db } from '../db.js';
import { appSettingsTable } from '@workspace/db';
import { mergeSettings } from '../utils/settings-defaults.js';

let cachedMaintenance: { enabled: boolean } | null = null;

export async function isMaintenanceMode(): Promise<boolean> {
  if (cachedMaintenance) return cachedMaintenance.enabled;
  const rows = await db.select().from(appSettingsTable);
  const stored: Record<string, any> = {};
  for (const row of rows) stored[row.key] = row.value;
  const merged = mergeSettings(stored) as any;
  cachedMaintenance = { enabled: !!merged.security?.maintenanceMode };
  return cachedMaintenance.enabled;
}

export function invalidateMaintenanceCache(): void {
  cachedMaintenance = null;
}

const EXEMPT_PREFIXES = ['/health', '/auth/', '/settings/', '/admin/'];

export function maintenanceMode() {
  return async (req: any, res: any, next: any) => {
    try {
      if (!(await isMaintenanceMode())) {
        next();
        return;
      }
      const path = req.path ?? '';
      if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) {
        next();
        return;
      }
      res.status(503).json({
        error: 'MAINTENANCE_MODE',
        message: 'The platform is temporarily under maintenance. Please check back shortly.',
      });
    } catch (err: any) {
      // Fail closed: if we can't read the setting, don't serve the platform.
      console.error('Maintenance mode check failed:', err);
      res.status(503).json({ error: 'MAINTENANCE_MODE', message: 'Service temporarily unavailable.' });
    }
  };
}
