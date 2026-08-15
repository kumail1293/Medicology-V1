// ============================================================================
// CONFIGURATION REGISTRY (Phase 1 — platform configuration engine).
//
// A single metadata source of truth for every platform setting. Each entry
// declares: group, key, type, label, description, defaultValue, scopes,
// public, editableBy, requiresAudit, deprecated, dependencies, options and
// validation (delegating to the zod group schemas in routes/schemas.ts).
//
// The admin UI can render forms from this registry, and every write is
// validated through it — no arbitrary unsafe configuration values.
//
// DEFAULTS + VALIDATION remain authoritative in settings-defaults.ts and
// routes/schemas.ts; this registry describes them and adds the metadata the
// plan requires (type/description/scopes/public/editableBy/audit).
// ============================================================================

import { DEFAULT_SETTINGS, PUBLIC_SETTINGS_GROUPS, PlatformSettings } from './settings-defaults.js';
import {
  generalSettingsSchema,
  brandingSettingsSchema,
  contentSettingsSchema,
  registrationSettingsSchema,
  notificationSettingsSchema,
  securitySettingsSchema,
  paymentSettingsSchema,
  storageSettingsSchema,
  integrationSettingsSchema,
  seoSettingsSchema,
  footerSettingsSchema,
  emailSettingsSchema,
  animationsSettingsSchema,
  featureFlagsSettingsSchema,
  bulkImportSettingsSchema,
  examSettingsSchema,
} from '../routes/schemas.js';
import { SETTING_SCOPES } from '@workspace/db';

export type SettingValueType =
  | 'string' | 'integer' | 'decimal' | 'boolean' | 'enum' | 'json'
  | 'color' | 'url' | 'duration' | 'percentage' | 'richText' | 'image'
  | 'file' | 'array' | 'object';

export interface SettingEntry {
  group: string;
  key: string;
  path: string; // "group.key"
  label: string;
  description: string;
  type: SettingValueType;
  defaultValue: unknown;
  options?: { value: string; label: string }[];
  scopes: string[];
  public: boolean;
  editableBy: string[];
  requiresAudit: boolean;
  deprecated: boolean;
  dependencies: string[];
  min?: number;
  max?: number;
}

export interface SettingGroupMeta {
  group: string;
  label: string;
  description: string;
  public: boolean;
  editableBy: string[];
  requiresAudit: boolean;
}

// ---------------------------------------------------------------------------
// Group metadata.
// ---------------------------------------------------------------------------

export const CONFIG_GROUPS: SettingGroupMeta[] = [
  { group: 'general', label: 'General', description: 'Site identity, contact and locale.', public: true, editableBy: ['settings.manage'], requiresAudit: false },
  { group: 'branding', label: 'Branding', description: 'Visual identity — logos, colors, typography, radius.', public: true, editableBy: ['settings.manage'], requiresAudit: false },
  { group: 'content', label: 'Content', description: 'Default content statuses and pagination.', public: false, editableBy: ['settings.manage'], requiresAudit: true },
  { group: 'registration', label: 'Registration', description: 'Open/closed registration, verification and defaults.', public: false, editableBy: ['settings.manage'], requiresAudit: true },
  { group: 'notifications', label: 'Notifications', description: 'Which events trigger email notifications.', public: false, editableBy: ['settings.manage'], requiresAudit: true },
  { group: 'security', label: 'Security', description: 'MFA, sessions, passwords, login attempts, maintenance.', public: false, editableBy: ['settings.manage'], requiresAudit: true },
  { group: 'payments', label: 'Payments', description: 'Currency, provider, tax and refund policy.', public: false, editableBy: ['settings.manage', 'payments.manage'], requiresAudit: true },
  { group: 'storage', label: 'Storage', description: 'Upload limits and storage backend.', public: false, editableBy: ['settings.manage', 'media.manage'], requiresAudit: true },
  { group: 'integrations', label: 'Integrations', description: 'Analytics, SEO meta and custom head code.', public: false, editableBy: ['settings.manage'], requiresAudit: true },
  { group: 'seo', label: 'SEO', description: 'Site title, meta, Open Graph, Twitter cards and robots.', public: true, editableBy: ['settings.manage'], requiresAudit: false },
  { group: 'footer', label: 'Footer & Social', description: 'Footer text, legal links and social platform links.', public: true, editableBy: ['settings.manage'], requiresAudit: false },
  { group: 'email', label: 'Email', description: 'Sender identity, SMTP delivery and email policy (secrets never exposed).', public: false, editableBy: ['settings.manage', 'email.manage'], requiresAudit: true },
  { group: 'animations', label: 'Animations', description: 'Platform animation behavior (always respects prefers-reduced-motion).', public: true, editableBy: ['settings.manage'], requiresAudit: false },
  { group: 'featureFlags', label: 'Feature Flags', description: 'Which platform features are enabled.', public: true, editableBy: ['settings.manage'], requiresAudit: true },
  { group: 'bulkImport', label: 'Bulk Import', description: 'Import policy — status, review gate, limits, allowed types.', public: false, editableBy: ['settings.manage', 'import.run'], requiresAudit: true },
  { group: 'examSettings', label: 'Exam & QBank Defaults', description: 'Platform-wide QBank and exam behavior defaults.', public: false, editableBy: ['settings.manage', 'exam_settings.manage'], requiresAudit: true },
];

/** Group zod schema used for validation (also consulted for enum options). */
const GROUP_SCHEMAS: Record<string, any> = {
  general: generalSettingsSchema,
  branding: brandingSettingsSchema,
  content: contentSettingsSchema,
  registration: registrationSettingsSchema,
  notifications: notificationSettingsSchema,
  security: securitySettingsSchema,
  payments: paymentSettingsSchema,
  storage: storageSettingsSchema,
  integrations: integrationSettingsSchema,
  seo: seoSettingsSchema,
  footer: footerSettingsSchema,
  email: emailSettingsSchema,
  animations: animationsSettingsSchema,
  featureFlags: featureFlagsSettingsSchema,
  bulkImport: bulkImportSettingsSchema,
  examSettings: examSettingsSchema,
};

// ---------------------------------------------------------------------------
// Hand-authored descriptions + type hints per key (concise; extend freely).
// ---------------------------------------------------------------------------

const KEY_HINTS: Record<string, { label: string; description: string; type?: SettingValueType }> = {
  'general.siteName': { label: 'Site name', description: 'Public platform name shown in headers and emails.' },
  'general.tagline': { label: 'Tagline', description: 'Short marketing line under the brand name.' },
  'general.supportEmail': { label: 'Support email', description: 'Public contact address (not a secret).', type: 'string' },
  'general.timezone': { label: 'Timezone', description: 'Default timezone for dates and schedules.' },
  'general.locale': { label: 'Locale', description: 'Default language/locale code.' },
  'general.dateFormat': { label: 'Date format', description: 'Display format for dates.' },
  'general.homePage': { label: 'Home page', description: 'Default landing route after login.', type: 'enum' },
  'branding.logoUrl': { label: 'Logo URL', description: 'Primary logo (media URL or path).', type: 'image' },
  'branding.faviconUrl': { label: 'Favicon URL', description: 'Browser tab icon.', type: 'image' },
  'branding.primaryColor': { label: 'Primary color', description: 'Main brand color.', type: 'color' },
  'branding.accentColor': { label: 'Accent color', description: 'Secondary highlight color.', type: 'color' },
  'branding.fontFamily': { label: 'Font family', description: 'UI font stack.', type: 'enum' },
  'branding.fontSizeScale': { label: 'Font size scale', description: 'Relative text sizing.', type: 'enum' },
  'branding.borderRadius': { label: 'Border radius', description: 'Base radius in pixels.', type: 'integer' },
  'branding.contentMaxWidth': { label: 'Content max width', description: 'Max content width in pixels.', type: 'integer' },
  'registration.openRegistration': { label: 'Open registration', description: 'Allow new accounts to self-register.', type: 'boolean' },
  'registration.defaultRole': { label: 'Default role', description: 'Role assigned to new accounts.', type: 'enum' },
  'registration.requireEmailVerification': { label: 'Require email verification', description: 'Force email verification before login.', type: 'boolean' },
  'security.requireMFA': { label: 'Require MFA', description: 'Require multi-factor authentication for all users.', type: 'boolean' },
  'security.maintenanceMode': { label: 'Maintenance mode', description: 'Put the platform into maintenance (safety key — never overridable).', type: 'boolean' },
  'security.passwordMinLength': { label: 'Password min length', description: 'Minimum password length.', type: 'integer' },
  'security.maxLoginAttempts': { label: 'Max login attempts', description: 'Lockout threshold per account.', type: 'integer' },
  'security.sessionTimeoutMinutes': { label: 'Session timeout', description: 'Idle session timeout in minutes.', type: 'duration' },
  'seo.siteTitle': { label: 'Site title', description: 'Browser tab + search title.' },
  'seo.metaDescription': { label: 'Meta description', description: 'Search result snippet.' },
  'seo.ogImage': { label: 'OG image', description: 'Social share image.', type: 'image' },
  'seo.twitterCard': { label: 'Twitter card', description: 'X/Twitter card type.', type: 'enum' },
  'seo.robots': { label: 'Robots', description: 'Search engine crawling directive.', type: 'enum' },
  'footer.footerText': { label: 'Footer text', description: 'Short line shown in the site footer.' },
  'footer.copyright': { label: 'Copyright', description: 'Copyright line.' },
  'footer.socials': { label: 'Social links', description: 'Only configured platforms render.', type: 'array' },
  'payments.currency': { label: 'Currency', description: 'Default order currency (ISO 4217).', type: 'string' },
  'payments.provider': { label: 'Payment provider', description: 'Default provider adapter (safety key — never overridable).', type: 'enum' },
  'payments.taxRatePercent': { label: 'Tax rate', description: 'Applied tax rate.', type: 'percentage' },
  'payments.refundPolicyDays': { label: 'Refund window', description: 'Days after purchase a refund is allowed.', type: 'duration' },
  'storage.maxUploadSizeMB': { label: 'Max upload size', description: 'Maximum media upload size in MB.', type: 'integer' },
  'storage.storageBackend': { label: 'Storage backend', description: 'Where uploads are stored.', type: 'enum' },
  'animations.defaultEffect': { label: 'Default effect', description: 'Default page-transition animation.', type: 'enum' },
  'animations.durationMs': { label: 'Duration', description: 'Animation duration in milliseconds.', type: 'duration' },
  'animations.repeat': { label: 'Repeat', description: 'How many times the animation plays.', type: 'enum' },
  'examSettings.questionCount': { label: 'Question count', description: 'Default questions per exam session.', type: 'integer' },
  'examSettings.durationMinutes': { label: 'Duration', description: 'Default exam duration in minutes.', type: 'duration' },
  'examSettings.markingScheme': { label: 'Marking scheme', description: 'How answers are marked.', type: 'enum' },
  'examSettings.negativeMarking': { label: 'Negative marking', description: 'Points deducted per wrong answer.', type: 'decimal' },
  'examSettings.passPercentage': { label: 'Pass percentage', description: 'Score needed to pass.', type: 'percentage' },
  'examSettings.navigation': { label: 'Navigation', description: 'How users move between questions.', type: 'enum' },
  'examSettings.autoSubmit': { label: 'Auto-submit', description: 'Submit automatically when time expires.', type: 'boolean' },
  'examSettings.pauseResume': { label: 'Pause / resume', description: 'Allow pausing and resuming sessions.', type: 'boolean' },
  'examSettings.resultVisibility': { label: 'Result visibility', description: 'When results are revealed.', type: 'enum' },
  'examSettings.explanationBehavior': { label: 'Explanations', description: 'When explanations are shown.', type: 'enum' },
  'examSettings.answerReveal': { label: 'Answer reveal', description: 'When the correct answer is revealed.', type: 'enum' },
  'examSettings.trialQuestions': { label: 'Trial questions', description: 'Free trial question count per QBank.', type: 'integer' },
  'examSettings.attemptLimit': { label: 'Attempt limit', description: '0 = unlimited.', type: 'integer' },
  'examSettings.bookmarksEnabled': { label: 'Bookmarks', description: 'Allow bookmarking during exams.', type: 'boolean' },
  'examSettings.notesEnabled': { label: 'Notes', description: 'Allow notes during exams.', type: 'boolean' },
  'examSettings.reportingEnabled': { label: 'Reporting', description: 'Allow flagging questions during exams.', type: 'boolean' },
  'examSettings.questionPalette': { label: 'Question palette', description: 'Show the question navigator palette.', type: 'boolean' },
  'examSettings.reviewBehavior': { label: 'Review behavior', description: 'When the review screen is available.', type: 'enum' },
  'bulkImport.defaultImportStatus': { label: 'Default import status', description: 'Status applied to imported questions.', type: 'enum' },
  'bulkImport.requireReviewBeforePublish': { label: 'Require review before publish', description: 'Downgrade published imports to pending review.', type: 'boolean' },
  'bulkImport.duplicateThreshold': { label: 'Duplicate threshold', description: 'Similarity at which a row is flagged as a duplicate.', type: 'decimal' },
  'bulkImport.autoCreateTaxonomy': { label: 'Auto-create taxonomy', description: 'Create missing subject/topic rows on import.', type: 'boolean' },
  'bulkImport.maxFileSizeMB': { label: 'Max upload size', description: 'Import file size limit in MB.', type: 'integer' },
  'bulkImport.allowedFileTypes': { label: 'Allowed file types', description: 'Extensions accepted for import.', type: 'array' },
  'bulkImport.allowedQuestionTypes': { label: 'Allowed question types', description: 'Question types permitted in imports.', type: 'array' },
  'bulkImport.defaultDifficulty': { label: 'Default difficulty', description: 'Difficulty applied when a row has none.', type: 'enum' },
  'bulkImport.notifyOnImport': { label: 'Audit-log imports', description: 'Record every import in the audit trail.', type: 'boolean' },
};

// ---------------------------------------------------------------------------
// Type + enum inference from default values and the zod schemas.
// ---------------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const URL_RE = /^(https?:)?\/\//;

function inferType(path: string, value: unknown): SettingValueType {
  const hint = KEY_HINTS[path]?.type;
  if (hint) return hint;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'decimal';
  }
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'object';
  if (typeof value === 'string') {
    if (HEX_RE.test(value)) return 'color';
    if (URL_RE.test(value)) return 'url';
  }
  return 'string';
}

/** Pull enum options out of a zod group schema for a given key. */
function enumOptions(schema: any, key: string): { value: string; label: string }[] | undefined {
  try {
    const field = schema?.shape?.[key];
    if (!field) return undefined;
    // z.enum -> ZodEnum (v4: _def.values or values)
    const values = field._def?.values ?? field._def?.options ?? field.values;
    if (Array.isArray(values) && values.length > 0 && typeof values[0] === 'string') {
      return values.map((v: string) => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));
    }
    // z.array(z.enum(...)) — options for array-of-enum fields.
    if (Array.isArray(field._def?.type?._def?.values)) {
      return field._def.type._def.values.map((v: string) => ({ value: v, label: v }));
    }
  } catch {
    /* not an enum — fine */
  }
  return undefined;
}

/** min/max bounds from the zod field (number fields). */
function bounds(schema: any, key: string): { min?: number; max?: number } {
  try {
    const field = schema?.shape?.[key];
    if (!field) return {};
    const checks = field._def?.checks ?? [];
    const out: { min?: number; max?: number } = {};
    for (const c of checks) {
      if (c.kind === 'min' && typeof c.value === 'number') out.min = c.value;
      if (c.kind === 'max' && typeof c.value === 'number') out.max = c.value;
    }
    return out;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Registry assembly.
// ---------------------------------------------------------------------------

export function buildConfigRegistry(): SettingEntry[] {
  const entries: SettingEntry[] = [];
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, Record<string, unknown>>;
  for (const group of CONFIG_GROUPS) {
    const schema = GROUP_SCHEMAS[group.group];
    const groupDefaults = defaults[group.group] ?? {};
    for (const [key, value] of Object.entries(groupDefaults)) {
      const path = `${group.group}.${key}`;
      const hint = KEY_HINTS[path];
      entries.push({
        group: group.group,
        key,
        path,
        label: hint?.label ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        description: hint?.description ?? '',
        type: inferType(path, value),
        defaultValue: value,
        options: enumOptions(schema, key),
        scopes: [...SETTING_SCOPES],
        public: group.public,
        editableBy: group.editableBy,
        requiresAudit: group.requiresAudit,
        deprecated: false,
        dependencies: [],
        ...bounds(schema, key),
      });
    }
  }
  return entries;
}

const REGISTRY_CACHE = buildConfigRegistry();

export function getConfigRegistry(): SettingEntry[] {
  return REGISTRY_CACHE;
}

export function getPublicConfigRegistry(): SettingEntry[] {
  return REGISTRY_CACHE.filter((e) => e.public);
}

export function findSetting(group: string, key: string): SettingEntry | undefined {
  return REGISTRY_CACHE.find((e) => e.group === group && e.key === key);
}

/**
 * Validate a single setting value against its registry metadata + zod field.
 * Returns an error string, or null when the value is valid.
 */
export function validateSetting(group: string, key: string, value: unknown): string | null {
  const schema = GROUP_SCHEMAS[group];
  if (!schema) return `Unknown settings group "${group}"`;
  const field = schema.shape?.[key];
  if (!field) return `Unknown setting "${group}.${key}"`;
  const result = field.safeParse(value);
  if (!result.success) {
    const issue = result.error?.issues?.[0];
    return issue ? `${group}.${key}: ${issue.message}` : `Invalid value for ${group}.${key}`;
  }
  return null;
}

/** Validate a whole partial group payload; returns a map of key → error. */
export function validateGroupPayload(group: string, payload: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    const err = validateSetting(group, key, value);
    if (err) errors[key] = err;
  }
  return errors;
}

/** Cross-check: every default key has a registry entry (registry completeness). */
export function registryCoversDefaults(): { missing: string[] } {
  const covered = new Set(REGISTRY_CACHE.map((e) => e.path));
  const missing: string[] = [];
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, Record<string, unknown>>;
  for (const [group, vals] of Object.entries(defaults)) {
    for (const key of Object.keys(vals)) {
      if (!covered.has(`${group}.${key}`)) missing.push(`${group}.${key}`);
    }
  }
  return { missing };
}

export { PUBLIC_SETTINGS_GROUPS };
export type { PlatformSettings };
