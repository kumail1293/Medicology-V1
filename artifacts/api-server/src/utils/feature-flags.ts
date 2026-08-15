// ============================================================================
// Feature flags — server-side enforcement for protected capabilities.
//
// Flags live in the app_settings table under the "featureFlags" group (see
// utils/settings-defaults.ts). The client may hide UI when a flag is off, but
// the ONLY security boundary is here: every protected route must be wrapped in
// requireFeature(...), never gated by the frontend alone.
// ============================================================================

import { db } from '../db.js';
import { appSettingsTable } from '@workspace/db';
import { mergeSettings } from './settings-defaults.js';

export type FeatureFlagKey =
  | 'flashcards'
  | 'richContent'
  | 'pastPapers'
  | 'aiTutor'
  | 'aiQuestionReview'
  | 'spacedRepetition'
  | 'studyBuddies'
  | 'dailyChallenge'
  | 'payments'
  | 'waitlist'
  | 'newExamEngine';

/** Uppercase wire names (plan convention: FLASHCARDS, PAYMENTS, …). */
export const FEATURE_FLAG_NAMES: Record<FeatureFlagKey, string> = {
  flashcards: 'FLASHCARDS',
  richContent: 'RICH_CONTENT',
  pastPapers: 'PAST_PAPERS',
  aiTutor: 'AI_TUTOR',
  aiQuestionReview: 'AI_QUESTION_REVIEW',
  spacedRepetition: 'SPACED_REPETITION',
  studyBuddies: 'STUDY_BUDDIES',
  dailyChallenge: 'DAILY_CHALLENGE',
  payments: 'PAYMENTS',
  waitlist: 'WAITLIST',
  newExamEngine: 'NEW_EXAM_ENGINE',
};

let cachedFlags: Record<FeatureFlagKey, boolean> | null = null;

/** Load the merged feature flags (defaults + stored overrides). */
export async function getFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  if (cachedFlags) return cachedFlags;
  const rows = await db.select().from(appSettingsTable);
  const stored: Record<string, any> = {};
  for (const row of rows) stored[row.key] = row.value;
  const merged = mergeSettings(stored) as any;
  cachedFlags = { ...merged.featureFlags } as Record<FeatureFlagKey, boolean>;
  return cachedFlags!;
}

/** Invalidate the cache after a settings write. */
export function invalidateFeatureFlagsCache(): void {
  cachedFlags = null;
}

/**
 * Express middleware — blocks the request (503) when the flag is disabled.
 * Reuses the merged settings service; cache invalidated by the settings route
 * after every successful write.
 */
export function requireFeature(flag: FeatureFlagKey) {
  return async (req: any, res: any, next: any) => {
    try {
      const flags = await getFeatureFlags();
      if (flags[flag] === false) {
        return res.status(503).json({
          error: 'FEATURE_DISABLED',
          message: `${FEATURE_FLAG_NAMES[flag]} is currently disabled on this platform.`,
        });
      }
      next();
    } catch (err: any) {
      // If settings can't be read, fail closed — don't serve a protected
      // capability whose flag state is unknown.
      console.error('Feature flag check failed:', err);
      return res.status(503).json({ error: 'FEATURE_UNAVAILABLE', message: 'Feature availability could not be determined.' });
    }
  };
}
