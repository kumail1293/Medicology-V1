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
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const res = await fetch("/api/settings/public");
  if (!res.ok) throw new Error("Failed to load public settings");
  const data = await res.json();
  return data.settings as PublicSettings;
}
