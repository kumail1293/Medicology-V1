// Frontend mirror of the backend role→permission matrix (utils/permissions.ts).
// Keep in sync with the server — the server is the source of truth for
// authorization; this only drives UI visibility (nav, buttons).

export type PermissionKey =
  | "users.view"
  | "users.manage"
  | "settings.manage"
  | "media.manage"
  | "import.run"
  | "questions.manage"
  | "taxonomy.manage"
  | "flashcards.manage"
  | "review.manage"
  | "announcements.manage"
  | "coming_soon.manage"
  | "payments.manage"
  | "entitlements.manage"
  | "flags.manage"
  | "errata.manage"
  | "overrides.manage"
  | "qbanks.manage"
  | "exam_settings.manage"
  | "email.manage"
  | "audit.view";

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ["*"],
  admin: ["*"],
  platform_admin: [
    "users.view", "users.manage", "settings.manage", "media.manage",
    "audit.view", "announcements.manage", "coming_soon.manage", "import.run",
    "taxonomy.manage", "flags.manage", "errata.manage", "payments.manage",
    "entitlements.manage", "overrides.manage", "qbanks.manage", "review.manage",
    "email.manage",
  ],
  content_admin: [
    "questions.manage", "taxonomy.manage", "flashcards.manage", "review.manage",
    "import.run", "media.manage", "announcements.manage",
  ],
  exam_admin: [
    "exam_settings.manage", "overrides.manage", "qbanks.manage",
    "review.manage", "questions.manage", "taxonomy.manage", "flashcards.manage",
  ],
  finance_admin: ["payments.manage", "entitlements.manage", "users.view", "audit.view"],
  marketing_admin: ["announcements.manage", "coming_soon.manage", "media.manage", "flags.manage", "email.manage"],
  support_admin: ["users.view", "flags.manage", "errata.manage", "audit.view"],
  editor: ["questions.manage", "flashcards.manage"],
  teacher: ["questions.manage", "flashcards.manage"],
  reviewer: ["review.manage", "questions.manage"],
  user: [],
};

export function roleHasPermission(role: string | undefined, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role ?? "user"] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

export const ADMIN_ROLES: string[] = [
  "admin", "superadmin", "platform_admin", "content_admin", "exam_admin",
  "finance_admin", "marketing_admin", "support_admin",
];

export const ASSIGNABLE_ROLES: string[] = [
  "user", "editor", "teacher", "reviewer",
  "content_admin", "exam_admin", "finance_admin", "marketing_admin", "support_admin",
  "platform_admin", "admin", "superadmin",
];

export const ROLE_LABELS: Record<string, string> = {
  user: "Student",
  editor: "Editor",
  teacher: "Teacher",
  reviewer: "Reviewer",
  content_admin: "Content Admin",
  exam_admin: "Exam Admin",
  finance_admin: "Finance Admin",
  marketing_admin: "Marketing Admin",
  support_admin: "Support Admin",
  platform_admin: "Platform Admin",
  admin: "Admin",
  superadmin: "Super Admin",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  user: "Standard student account.",
  editor: "Edits questions and flashcards.",
  teacher: "Edits questions and flashcards.",
  reviewer: "Approves content in the Review Queue.",
  content_admin: "Manages questions, taxonomy, flashcards, review queue and imports.",
  exam_admin: "Manages exam settings, scoped overrides, QBanks and reviews.",
  finance_admin: "Manages payments, orders and entitlements.",
  marketing_admin: "Manages announcements, coming-soon items and media.",
  support_admin: "Views users and resolves flags and errata.",
  platform_admin: "Full platform configuration: settings, users, media, payments.",
  admin: "Full platform administration (legacy).",
  superadmin: "Everything, including granting admin roles.",
};

export const ROLE_STYLES: Record<string, string> = {
  user: "bg-primary/10 text-primary",
  editor: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  teacher: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  reviewer: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  content_admin: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  exam_admin: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  finance_admin: "bg-green-500/10 text-green-600 dark:text-green-400",
  marketing_admin: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  support_admin: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  platform_admin: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  admin: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  superadmin: "bg-red-500/10 text-red-600 dark:text-red-400",
};
