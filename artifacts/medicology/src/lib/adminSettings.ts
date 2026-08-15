import { apiFetch } from "./api";

// Mirrors the server-side PlatformSettings shape (see api-server
// src/utils/settings-defaults.ts). The admin GET returns both the merged
// settings and the server defaults, so these are only used pre-load / fallback.
export interface GeneralSettings {
  siteName: string;
  tagline: string;
  supportEmail: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  homePage: "dashboard" | "store" | "practice";
}

export interface BrandingSettings {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: "sans" | "serif" | "mono";
  fontSizeScale: "sm" | "md" | "lg";
  borderRadius: number;
  contentMaxWidth: number;
}

export interface ContentSettings {
  defaultQuestionStatus: "draft" | "pending_review" | "published";
  defaultQbankStatus: "draft" | "published" | "archived";
  questionsPerPage: number;
  requireReviewBeforePublish: boolean;
}

export interface RegistrationSettings {
  openRegistration: boolean;
  defaultRole: "user" | "editor" | "teacher";
  requireEmailVerification: boolean;
  adminEmail: string;
}

export interface NotificationSettings {
  emailNewUser: boolean;
  emailNewQuestion: boolean;
  emailNewReview: boolean;
  emailNewPurchase: boolean;
  emailAnnouncements: boolean;
}

export interface SecuritySettings {
  requireMFA: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireComplexity: boolean;
  maxLoginAttempts: number;
  maintenanceMode: boolean;
}

export interface PaymentSettings {
  currency: string;
  provider: "dev" | "stripe" | "jazzcash" | "easypaisa";
  taxRatePercent: number;
  refundPolicyDays: number;
}

export interface StorageSettings {
  maxUploadSizeMB: number;
  allowedImageTypes: string[];
  storageBackend: "local" | "s3";
}

export interface IntegrationSettings {
  googleAnalyticsId: string;
  metaDescription: string;
  customHeadCode: string;
}

export interface SeoSettings {
  siteTitle: string;
  metaDescription: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: "summary" | "summary_large_image";
  robots: "index,follow" | "noindex,nofollow";
  canonicalUrl: string;
}

export interface FooterSettings {
  footerText: string;
  copyright: string;
  supportLink: string;
  privacyLink: string;
  termsLink: string;
  refundLink: string;
  socials: { platform: string; url: string }[];
}

export interface EmailSettings {
  provider: "log" | "smtp";
  fromName: string;
  fromEmail: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword?: string; // write-only — never returned by the API
  smtpPasswordSet: boolean;
  footerText: string;
  unsubscribeEnabled: boolean;
  trackingEnabled: boolean;
  retryPolicy: "none" | "once" | "thrice";
}

export type AnimationEffect =
  | 'none' | 'fade' | 'slide' | 'scale' | 'zoom' | 'bounce'
  | 'shimmer' | 'pulse' | 'marquee' | 'typewriter';

export interface AnimationsSettings {
  enabled: boolean;
  defaultEffect: AnimationEffect;
  durationMs: number;
  delayMs: number;
  repeat: 'none' | 'once' | 'infinite';
  trigger: 'on_load' | 'on_view' | 'always';
}

export interface FeatureFlagsSettings {
  flashcards: boolean;
  richContent: boolean;
  pastPapers: boolean;
  aiTutor: boolean;
  aiQuestionReview: boolean;
  spacedRepetition: boolean;
  studyBuddies: boolean;
  dailyChallenge: boolean;
  payments: boolean;
  waitlist: boolean;
  newExamEngine: boolean;
}

// QBank + exam behavior (plan items 10–11). Platform-wide defaults; any
// scope (QBank / taxonomy node) can override keys via the overrides API.
export interface ExamSettings {
  trialQuestions: number;
  attemptLimit: number;
  bookmarksEnabled: boolean;
  notesEnabled: boolean;
  reportingEnabled: boolean;
  questionCount: number;
  durationMinutes: number;
  markingScheme: "no_negative" | "standard";
  negativeMarking: number;
  passPercentage: number;
  navigation: "free" | "locked";
  questionPalette: boolean;
  reviewBehavior: "after_each" | "end_only";
  autoSubmit: boolean;
  pauseResume: boolean;
  resultVisibility: "immediate" | "end" | "admin_only";
  explanationBehavior: "after_answer" | "end" | "never";
  answerReveal: "after_answer" | "end";
}

// Bulk question import policy (Bulk Import admin page).
export interface BulkImportSettings {
  defaultImportStatus: "draft" | "pending_review" | "published";
  requireReviewBeforePublish: boolean;
  duplicateThreshold: number;
  autoCreateTaxonomy: boolean;
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  allowedQuestionTypes: string[];
  defaultDifficulty: "easy" | "medium" | "hard";
  notifyOnImport: boolean;
}

export interface PlatformSettings {
  general: GeneralSettings;
  branding: BrandingSettings;
  content: ContentSettings;
  registration: RegistrationSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  payments: PaymentSettings;
  storage: StorageSettings;
  integrations: IntegrationSettings;
  seo: SeoSettings;
  footer: FooterSettings;
  email: EmailSettings;
  animations: AnimationsSettings;
  featureFlags: FeatureFlagsSettings;
  examSettings: ExamSettings;
  bulkImport: BulkImportSettings;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  general: {
    siteName: "Medicology",
    tagline:
      "Master your medical knowledge. The premier QBank platform designed exclusively for Medical, Dental & Allied Health students.",
    supportEmail: "support@medicology.com",
    timezone: "Asia/Karachi",
    locale: "en",
    dateFormat: "MMM d, yyyy",
    homePage: "dashboard",
  },
  branding: {
    logoUrl: "/images/logo-colored.png",
    faviconUrl: "/favicon.ico",
    primaryColor: "#0d9488",
    accentColor: "#6366f1",
    fontFamily: "sans",
    fontSizeScale: "md",
    borderRadius: 12,
    contentMaxWidth: 1200,
  },
  content: {
    defaultQuestionStatus: "pending_review",
    defaultQbankStatus: "draft",
    questionsPerPage: 20,
    requireReviewBeforePublish: true,
  },
  registration: {
    openRegistration: true,
    defaultRole: "user",
    requireEmailVerification: false,
    adminEmail: "admin@medicology.com",
  },
  notifications: {
    emailNewUser: true,
    emailNewQuestion: true,
    emailNewReview: true,
    emailNewPurchase: true,
    emailAnnouncements: false,
  },
  security: {
    requireMFA: false,
    sessionTimeoutMinutes: 30,
    passwordMinLength: 8,
    passwordRequireComplexity: false,
    maxLoginAttempts: 5,
    maintenanceMode: false,
  },
  payments: {
    currency: "USD",
    provider: "dev",
    taxRatePercent: 0,
    refundPolicyDays: 7,
  },
  storage: {
    maxUploadSizeMB: 10,
    allowedImageTypes: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    storageBackend: "local",
  },
  integrations: {
    googleAnalyticsId: "",
    metaDescription: "",
    customHeadCode: "",
  },
  email: {
    provider: "log",
    fromName: "Medicology",
    fromEmail: "no-reply@medicology.com",
    replyTo: "support@medicology.com",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPasswordSet: false,
    footerText: "© 2026 Medicology. All rights reserved.",
    unsubscribeEnabled: true,
    trackingEnabled: false,
    retryPolicy: "once",
  },
  seo: {
    siteTitle: "Medicology — Medical Exam Preparation",
    metaDescription: "Master your medical knowledge with Medicology. The premier QBank platform designed exclusively for Medical, Dental & Allied Health students.",
    keywords: ["medical", "qbank", "usmle", "mbbs", "mcqs", "exam prep"],
    ogTitle: "Medicology — Medical Exam Preparation",
    ogDescription: "The premier QBank platform for Medical, Dental & Allied Health students.",
    ogImage: "/images/og-cover.png",
    twitterCard: "summary_large_image",
    robots: "index,follow",
    canonicalUrl: "https://medicology.com/",
  },
  footer: {
    footerText: "Medicology — Master your medical knowledge.",
    copyright: "© 2026 Medicology. All rights reserved.",
    supportLink: "/support",
    privacyLink: "/privacy",
    termsLink: "/terms",
    refundLink: "/refunds",
    socials: [
      { platform: "instagram", url: "https://instagram.com/medicology" },
      { platform: "facebook", url: "https://facebook.com/medicology" },
      { platform: "x", url: "https://x.com/medicology" },
    ],
  },
  featureFlags: {
    flashcards: true,
    richContent: true,
    pastPapers: true,
    aiTutor: true,
    aiQuestionReview: true,
    spacedRepetition: true,
    studyBuddies: true,
    dailyChallenge: true,
    payments: true,
    waitlist: true,
    newExamEngine: true,
  },
  animations: {
    enabled: true,
    defaultEffect: "fade",
    durationMs: 400,
    delayMs: 0,
    repeat: "once",
    trigger: "on_load",
  },
  examSettings: {
    trialQuestions: 10,
    attemptLimit: 0,
    bookmarksEnabled: true,
    notesEnabled: true,
    reportingEnabled: true,
    questionCount: 20,
    durationMinutes: 60,
    markingScheme: "no_negative",
    negativeMarking: 0,
    passPercentage: 50,
    navigation: "free",
    questionPalette: true,
    reviewBehavior: "end_only",
    autoSubmit: true,
    pauseResume: true,
    resultVisibility: "immediate",
    explanationBehavior: "after_answer",
    answerReveal: "after_answer",
  },
  bulkImport: {
    defaultImportStatus: "pending_review",
    requireReviewBeforePublish: true,
    duplicateThreshold: 0.85,
    autoCreateTaxonomy: true,
    maxFileSizeMB: 20,
    allowedFileTypes: ["xlsx", "xls", "csv", "tsv"],
    allowedQuestionTypes: ["sba", "best_of_five", "true_false", "assertion_reason", "emq", "image_based", "clinical_vignette", "case_based"],
    defaultDifficulty: "medium",
    notifyOnImport: true,
  },
};

export type SettingsGroup = keyof PlatformSettings;

export async function fetchAdminSettings(): Promise<{
  settings: PlatformSettings;
  defaults: PlatformSettings;
}> {
  const res = await apiFetch("/api/admin/settings");
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

export async function saveAdminSettings(
  patch: Partial<{ [K in SettingsGroup]: Partial<PlatformSettings[K]> }>,
): Promise<PlatformSettings> {
  const res = await apiFetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to save settings");
  return data.settings;
}

// ---------------------------------------------------------------------------
// Scoped overrides (plan items 10–11).
// ---------------------------------------------------------------------------

export const SETTING_SCOPES = ["qbank", "topic", "system", "subject", "year", "program", "exam", "country"] as const;
export type SettingScope = (typeof SETTING_SCOPES)[number];

export const SCOPE_LABELS: Record<SettingScope, string> = {
  qbank: "QBank",
  topic: "Topic",
  system: "System",
  subject: "Subject",
  year: "Academic year",
  program: "Program",
  exam: "Exam / university",
  country: "Country",
};

export interface SettingsOverride {
  id: number;
  scope: SettingScope;
  scopeId: number;
  group: string;
  key: string;
  value: unknown;
  createdAt?: string;
  updatedAt?: string;
}

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

export interface ResolvedResult {
  context: OverrideContext;
  platform: ExamSettings;
  settings: ExamSettings;
  sources: Record<string, string>;
  applied: { key: string; scope: SettingScope; scopeId: number; value: unknown }[];
}

export async function listOverrides(scope: SettingScope, scopeId: number): Promise<SettingsOverride[]> {
  const res = await apiFetch(`/api/admin/settings/overrides?scope=${scope}&scopeId=${scopeId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to load overrides");
  return data.overrides ?? [];
}

export async function upsertOverride(opts: {
  scope: SettingScope; scopeId: number; group: string; key: string; value: unknown;
}): Promise<SettingsOverride> {
  const res = await apiFetch("/api/admin/settings/overrides", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to save override");
  return data.override;
}

export async function deleteOverride(opts: {
  scope: SettingScope; scopeId: number; group: string; key: string;
}): Promise<void> {
  const q = new URLSearchParams({ scope: opts.scope, scopeId: String(opts.scopeId), group: opts.group, key: opts.key });
  const res = await apiFetch(`/api/admin/settings/overrides?${q}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to delete override");
}

export async function resolveOverrides(ctx: OverrideContext): Promise<ResolvedResult> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(ctx)) if (v != null) q.set(k, String(v));
  const res = await apiFetch(`/api/admin/settings/overrides/resolve?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to resolve overrides");
  return data;
}

export async function resetSettingsGroup(group?: SettingsGroup): Promise<PlatformSettings> {
  const res = await apiFetch("/api/admin/settings/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(group ? { group } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to reset settings");
  return data.settings;
}

export interface PublicSettings {
  general: GeneralSettings;
  branding: BrandingSettings;
  animations: AnimationsSettings;
  featureFlags: FeatureFlagsSettings;
  seo?: SeoSettings;
  footer?: FooterSettings;
}

export async function fetchPublicSettings(): Promise<{
  settings: PublicSettings;
  maintenance: { enabled: boolean };
}> {
  const res = await fetch("/api/settings/public");
  if (!res.ok) throw new Error("Failed to load public settings");
  const data = await res.json();
  return {
    settings: data.settings as PublicSettings,
    maintenance: data.maintenance ?? { enabled: false },
  };
}

export interface SettingsHistoryEntry {
  id: number;
  action: string;
  summary: string;
  actorName: string | null;
  actorEmail: string | null;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  createdAt: string;
}

export async function fetchSettingsHistory(limit = 50): Promise<{ logs: SettingsHistoryEntry[]; total: number }> {
  const res = await apiFetch(`/api/admin/settings/history?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load settings history");
  return res.json();
}

export async function restoreSettings(id: number): Promise<PlatformSettings> {
  const res = await apiFetch("/api/admin/settings/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to restore settings");
  return data.settings;
}
