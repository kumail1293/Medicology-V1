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
  inviteOnly: boolean;
  allowedDomains: string[];
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

// Animation controls (plan item 15). These are presentation preferences for
// users who do NOT request reduced motion — prefers-reduced-motion is always
// respected client-side and wins over any of these values.
export type AnimationEffect =
  | 'none' | 'fade' | 'slide' | 'scale' | 'zoom' | 'bounce'
  | 'shimmer' | 'pulse' | 'marquee' | 'typewriter';

export interface AnimationsSettings {
  enabled: boolean; // master switch — off disables all CSS-driven animations
  defaultEffect: AnimationEffect;
  durationMs: number; // 0–3000
  delayMs: number; // 0–2000
  repeat: 'none' | 'once' | 'infinite';
  trigger: 'on_load' | 'on_view' | 'always';
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

// Bulk question import policy (Bulk Import admin page). Controls the default
// status imported questions receive, duplicate-detection strictness, which
// question types are accepted, and file upload limits.
export interface BulkImportSettings {
  defaultImportStatus: 'draft' | 'pending_review' | 'published';
  requireReviewBeforePublish: boolean;
  duplicateThreshold: number; // 0.5–0.95 (higher = stricter duplicate detection)
  autoCreateTaxonomy: boolean;
  maxFileSizeMB: number;
  allowedFileTypes: string[]; // xlsx, xls, csv, tsv
  allowedQuestionTypes: string[]; // subset of QUESTION_TYPES
  defaultDifficulty: 'easy' | 'medium' | 'hard';
  notifyOnImport: boolean;
}

// QBank + exam behavior (plan items 10–11). These are the *platform-wide
// defaults*; universities/exams and individual QBanks can override them via
// the scoped-overrides system (see utils/scoped-overrides.ts). Resolution is
// deterministic: safety constraints > QBank > topic > system > subject >
// year > program > exam > country > platform default.
export interface ExamSettings {
  // QBank defaults (item 10).
  trialQuestions: number; // free questions before the paywall (0 = full trial)
  attemptLimit: number; // 0 = unlimited attempts
  bookmarksEnabled: boolean;
  notesEnabled: boolean;
  reportingEnabled: boolean;
  // Exam session behavior (item 11).
  questionCount: number; // default questions per session
  durationMinutes: number; // 0 = untimed
  markingScheme: 'no_negative' | 'standard';
  negativeMarking: number; // fraction deducted per wrong answer (0 = none)
  passPercentage: number; // 0–100
  navigation: 'free' | 'locked'; // free = jump anywhere; locked = sequential
  questionPalette: boolean; // show the question-number palette
  reviewBehavior: 'after_each' | 'end_only';
  autoSubmit: boolean; // submit when the timer expires
  pauseResume: boolean;
  resultVisibility: 'immediate' | 'end' | 'admin_only';
  explanationBehavior: 'after_answer' | 'end' | 'never';
  answerReveal: 'after_answer' | 'end';
}

export interface SeoSettings {
  siteTitle: string;
  metaDescription: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: 'summary' | 'summary_large_image';
  robots: 'index,follow' | 'noindex,nofollow';
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
  // smtpPassword is stored server-side only and NEVER returned by the API.
  // smtpPasswordSet tracks whether a password has been configured.
  smtpPasswordSet: boolean;
  footerText: string;
  unsubscribeEnabled: boolean;
  trackingEnabled: boolean;
  retryPolicy: "none" | "once" | "thrice";
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
    tagline: "Master your medical knowledge. The premier QBank platform designed exclusively for Medical, Dental & Allied Health students.",
    supportEmail: "support@medicology.net",
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
    inviteOnly: false,
    allowedDomains: [],
    adminEmail: "admin@medicology.net",
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
    provider: "log", // "log" prints to console in dev; "smtp" sends for real
    fromName: "Medicology",
    fromEmail: "no-reply@medicology.net",
    replyTo: "support@medicology.net",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPasswordSet: false, // derived from stored secret; never the secret itself
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
    twitterCard: 'summary_large_image',
    robots: 'index,follow',
    canonicalUrl: "https://medicology.net/",
  },
  footer: {
    footerText: "Medicology — Master your medical knowledge.",
    copyright: "© 2026 Medicology. All rights reserved.",
    supportLink: "/support",
    privacyLink: "/privacy",
    termsLink: "/terms",
    refundLink: "/refunds",
    socials: [
      { platform: "instagram", url: "https://instagram.com/medicologyworld" },
      { platform: "facebook", url: "https://facebook.com/medicologyworld" },
      { platform: "x", url: "https://x.com/medicologyworld" },
      { platform: "tiktok", url: "https://tiktok.com/@medicologyworld" },
      { platform: "youtube", url: "https://youtube.com/@medicologyworld" },
      { platform: "linkedin", url: "https://linkedin.com/company/medicologyworld" },
      { platform: "whatsapp", url: "https://wa.me/medicologyworld" },
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
    defaultEffect: 'fade',
    durationMs: 400,
    delayMs: 0,
    repeat: 'once',
    trigger: 'on_load',
  },
  bulkImport: {
    defaultImportStatus: 'pending_review',
    requireReviewBeforePublish: true,
    duplicateThreshold: 0.85,
    autoCreateTaxonomy: true,
    maxFileSizeMB: 20,
    allowedFileTypes: ['xlsx', 'xls', 'csv', 'tsv'],
    allowedQuestionTypes: ['sba', 'best_of_five', 'true_false', 'assertion_reason', 'emq', 'image_based', 'clinical_vignette', 'case_based'],
    defaultDifficulty: 'medium',
    notifyOnImport: true,
  },
  examSettings: {
    trialQuestions: 10,
    attemptLimit: 0,
    bookmarksEnabled: true,
    notesEnabled: true,
    reportingEnabled: true,
    questionCount: 20,
    durationMinutes: 60,
    markingScheme: 'no_negative',
    negativeMarking: 0,
    passPercentage: 50,
    navigation: 'free',
    questionPalette: true,
    reviewBehavior: 'end_only',
    autoSubmit: true,
    pauseResume: true,
    resultVisibility: 'immediate',
    explanationBehavior: 'after_answer',
    answerReveal: 'after_answer',
  },
};

// Groups that the public (unauthenticated) API may expose — branding, general
// info, feature flags, animation prefs and the maintenance status. Never
// include credentials, emails, payment config or security toggles.
export const PUBLIC_SETTINGS_GROUPS: (keyof PlatformSettings)[] = [
  "general",
  "featureFlags",
  "animations",
  "branding",
  "seo",
  "footer",
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
