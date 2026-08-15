// ============================================================================
// Scoped settings overrides (admin settings plan items 10–11).
//
// Platform defaults live in app_settings (see settings-defaults.ts). Scopes —
// a QBank product or a taxonomy node — can override individual keys. The
// winner is fully deterministic:
//
//   system safety constraints (SAFETY_KEYS, never overridable)
//       ↓
//   QBank override
//       ↓
//   topic → system → subject → year → program → exam → country
//       ↓
//   platform default
//
// `resolveExamSettings` returns both the merged values and a per-key
// provenance map ("platform" | scope name) so the admin UI can show exactly
// where every value came from, and tests can assert the precedence order.
// ============================================================================

import { db } from '../db.js';
import {
  settingsOverridesTable,
  appSettingsTable,
  SETTING_SCOPES,
  type SettingScope,
  type SettingsOverride,
} from '@workspace/db';
import { and, eq, or } from './drizzle.js';
import { DEFAULT_SETTINGS, mergeSettings, type ExamSettings } from './settings-defaults.js';

// Most specific → least specific. Resolution applies least → most so the
// most specific scope always wins (qbank beats every taxonomy node).
export const SCOPE_PRECEDENCE: SettingScope[] = [...SETTING_SCOPES];

export const SCOPE_LABELS: Record<SettingScope, string> = {
  qbank: 'QBank',
  topic: 'Topic',
  system: 'System',
  subject: 'Subject',
  year: 'Academic year',
  program: 'Program',
  exam: 'Exam / university',
  country: 'Country',
};

// System safety constraints — these keys can never be overridden at any
// scope (and are rejected on write). Format: "<group>.<key>".
export const SAFETY_KEYS: string[] = [
  'security.maintenanceMode',
  'security.requireMFA',
  'payments.provider',
];

export interface OverrideContext {
  qbankId?: number;
  topicId?: number;
  systemId?: number;
  subjectId?: number;
  yearId?: number;
  programId?: number;
  examId?: number;
  countryId?: number;
}

export interface ResolvedExamSettings {
  settings: ExamSettings;
  sources: Record<string, 'platform' | SettingScope>;
  applied: { key: string; scope: SettingScope; scopeId: number; value: unknown }[];
}

/** Load every override row matching the context's scopes (any of them). */
export async function loadOverridesForContext(ctx: OverrideContext): Promise<SettingsOverride[]> {
  const conds = SCOPE_PRECEDENCE
    .filter((s) => ctx[`${s}Id` as keyof OverrideContext] != null)
    .map((scope) =>
      and(
        eq(settingsOverridesTable.scope, scope),
        eq(settingsOverridesTable.scopeId, Number(ctx[`${scope}Id` as keyof OverrideContext])),
      ),
    );
  if (conds.length === 0) return [];
  return db.select().from(settingsOverridesTable).where(conds.length === 1 ? conds[0] : or(...conds));
}

/**
 * Resolve exam settings for a context. `platform` is the merged platform
 * defaults (from app_settings); overrides are layered on top in precedence
 * order (least specific first, so more specific scopes win).
 */
export function resolveExamSettings(
  platform: ExamSettings,
  rows: SettingsOverride[],
): ResolvedExamSettings {
  // Safety: drop any override targeting a safety key (defense in depth).
  const safe = rows.filter((r) => !SAFETY_KEYS.includes(`${r.group}.${r.key}`));

  // Apply least → most specific; later writes win.
  const order = [...SCOPE_PRECEDENCE].reverse(); // country … qbank
  const appliedValues: Record<string, unknown> = {};
  const sources: Record<string, 'platform' | SettingScope> = {};
  const applied: ResolvedExamSettings['applied'] = [];

  for (const scope of order) {
    for (const row of safe.filter((r) => r.scope === scope)) {
      if (!(row.key in platform)) continue; // unknown key — ignore defensively
      appliedValues[row.key] = row.value;
      sources[row.key] = scope;
      applied.push({ key: row.key, scope, scopeId: row.scopeId, value: row.value });
    }
  }

  return {
    settings: { ...platform, ...appliedValues } as ExamSettings,
    sources,
    applied,
  };
}

/** Load one group's platform defaults (app_settings merged over DEFAULT_SETTINGS). */
export async function platformGroup<K extends keyof typeof DEFAULT_SETTINGS>(
  group: K,
): Promise<(typeof DEFAULT_SETTINGS)[K]> {
  const rows = await db.select().from(appSettingsTable);
  const stored: Record<string, any> = {};
  for (const row of rows) stored[row.key] = row.value;
  return (mergeSettings(stored) as any)[group];
}

/**
 * Resolve exam settings for a QBank product: its own overrides plus the
 * taxonomy chain it is scoped to (country → exam → program → year).
 * Used by session creation so QBank sessions pick up product rules.
 */
export async function resolveExamSettingsForQbank(qbank: {
  id: number;
  countryId?: number | null;
  examId?: number | null;
  programId?: number | null;
  academicYearId?: number | null;
}): Promise<ResolvedExamSettings> {
  const ctx: OverrideContext = {
    qbankId: qbank.id,
    countryId: qbank.countryId ?? undefined,
    examId: qbank.examId ?? undefined,
    programId: qbank.programId ?? undefined,
    yearId: qbank.academicYearId ?? undefined,
  };
  const platform = await platformGroup('examSettings');
  const rows = await loadOverridesForContext(ctx);
  return resolveExamSettings(platform, rows);
}
