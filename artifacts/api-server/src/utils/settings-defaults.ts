// ============================================================================
// Platform settings — WordPress-style grouped configuration stored in the
// app_settings table (JSONB values keyed by group name). DEFAULT_SETTINGS is
// the server-side source of truth; the admin UI renders it for resets and
// the public endpoint exposes only whitelisted branding/general keys.
// ============================================================================

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
  primaryColor: string; // hex
  accentColor: string; // hex
  fontFamily: "sans" | "serif" | "mono";
  fontSizeScale: "sm" | "md" | "lg";
  borderRadius: number; // px
  contentMaxWidth: number; // px
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

// Feature flags — every protected capability must be enforced server-side
// (see utils/feature-flags.ts requireFeature), never by the client alone.
export interface FeatureFlagsSettings {
  flashcards: boolean; // FLASHCARDS
  richContent: boolean; // RICH_CONTENT
  pastPapers: boolean; // PAST_PAPERS
  aiTutor: boolean; // AI_TUTOR
  aiQuestionReview: boolean; // AI_QUESTION_REVIEW
  spacedRepetition: boolean; // SPACED_REPETITION
  studyBuddies: boolean; // STUDY_BUDDIES
  dailyChallenge: boolean; // DAILY_CHALLENGE
  payments: boolean; // PAYMENTS
  waitlist: boolean; // WAITLIST
  newExamEngine: boolean; // NEW_EXAM_ENGINE
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
  featureFlags: FeatureFlagsSettings;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  general: {
    siteName: "Medicology",
    tagline: "Master your medical knowledge. The premier QBank platform designed exclusively for Medical, Dental & Allied Health students.",
    supportEmail: "support@medicology.com",
    timezone: "Asia/Karachi",
    locale: "en",
    dateFormat: "MMM d, yyyy",
    homePage: "dashboard",
  },
  branding: {
    logoUrl: "/images/logo-colored.png",
    faviconUrl: "/favicon.ico",
    primaryColor: "#0d9488", // teal-600 — matches the default --primary hue
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
};

// Groups that the public (unauthenticated) API may expose — branding, general
// info, feature flags and the maintenance status. Never include credentials,
// emails, payment config or security toggles.
export const PUBLIC_SETTINGS_GROUPS: (keyof PlatformSettings)[] = [
  "general",
  "featureFlags",
  "branding",
];

type StoredGroups = Partial<{ [K in keyof PlatformSettings]: Partial<PlatformSettings[K]> }>;

/** Deep-merge stored values over defaults (stored wins per key). */
export function mergeSettings(stored: StoredGroups): PlatformSettings {
  const out: any = {};
  for (const [group, defaults] of Object.entries(DEFAULT_SETTINGS)) {
    out[group] = { ...(defaults as any), ...((stored as any)[group] ?? {}) };
  }
  return out as PlatformSettings;
}

/** Whitelisted public subset for /api/settings/public. */
export function publicSettings(s: PlatformSettings): Partial<PlatformSettings> {
  const out: any = {};
  for (const group of PUBLIC_SETTINGS_GROUPS) {
    out[group] = (s as any)[group];
  }
  return out as Partial<PlatformSettings>;
}
