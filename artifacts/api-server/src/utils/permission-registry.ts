// ============================================================================
// Permission registry — the single source of truth for every permission the
// platform knows about. Seeded into the `permissions` table and used by the
// Role Builder / permission matrix. Granular, namespaced, grouped.
//
// Backend enforcement uses the *effective* permission of the authenticated
// user (roles + account type + direct grants − explicit denials), resolved by
// utils/authorization.ts — never a hard-coded role check.
// ============================================================================

export interface PermissionDef {
  key: string;
  name: string;
  group: string;
  description?: string;
  sortOrder: number;
}

export const PERMISSION_GROUPS = [
  "Questions",
  "QBanks",
  "Exams",
  "Users",
  "Payments",
  "Settings",
  "Media",
  "Announcements",
  "Flashcards",
  "Audit",
  "System",
] as const;

export const PERMISSION_REGISTRY: PermissionDef[] = [
  // ── Questions ────────────────────────────────────────────────────────────
  { key: "questions.view", name: "View questions", group: "Questions", description: "Read questions and explanations", sortOrder: 1 },
  { key: "questions.create", name: "Create questions", group: "Questions", sortOrder: 2 },
  { key: "questions.edit", name: "Edit questions", group: "Questions", sortOrder: 3 },
  { key: "questions.delete", name: "Delete questions", group: "Questions", sortOrder: 4 },
  { key: "questions.review", name: "Review questions", group: "Questions", description: "Review pending questions", sortOrder: 5 },
  { key: "questions.publish", name: "Publish questions", group: "Questions", sortOrder: 6 },
  { key: "questions.archive", name: "Archive questions", group: "Questions", sortOrder: 7 },
  { key: "questions.import", name: "Import questions", group: "Questions", description: "Bulk import (Excel/CSV)", sortOrder: 8 },

  // ── QBanks ───────────────────────────────────────────────────────────────
  { key: "qbanks.view", name: "View QBanks", group: "QBanks", sortOrder: 1 },
  { key: "qbanks.create", name: "Create QBanks", group: "QBanks", sortOrder: 2 },
  { key: "qbanks.edit", name: "Edit QBanks", group: "QBanks", sortOrder: 3 },
  { key: "qbanks.delete", name: "Delete QBanks", group: "QBanks", sortOrder: 4 },
  { key: "qbanks.publish", name: "Publish QBanks", group: "QBanks", sortOrder: 5 },
  { key: "qbanks.pricing", name: "QBank pricing", group: "QBanks", sortOrder: 6 },
  { key: "qbanks.entitlements", name: "Manage entitlements", group: "QBanks", description: "Grant/revoke QBank access", sortOrder: 7 },

  // ── Exams ────────────────────────────────────────────────────────────────
  { key: "exams.view", name: "View exams", group: "Exams", sortOrder: 1 },
  { key: "exams.create", name: "Create exams", group: "Exams", sortOrder: 2 },
  { key: "exams.edit", name: "Edit exams", group: "Exams", sortOrder: 3 },
  { key: "exams.publish", name: "Publish exams", group: "Exams", sortOrder: 4 },
  { key: "exams.configure", name: "Configure exam rules", group: "Exams", description: "Duration, marking, pass %", sortOrder: 5 },
  { key: "exams.results", name: "View exam results", group: "Exams", sortOrder: 6 },

  // ── Users ────────────────────────────────────────────────────────────────
  { key: "users.view", name: "View users", group: "Users", sortOrder: 1 },
  { key: "users.create", name: "Create users", group: "Users", sortOrder: 2 },
  { key: "users.edit", name: "Edit users", group: "Users", sortOrder: 3 },
  { key: "users.suspend", name: "Suspend users", group: "Users", sortOrder: 4 },
  { key: "users.delete", name: "Delete users", group: "Users", sortOrder: 5 },
  { key: "users.manage_roles", name: "Manage roles", group: "Users", sortOrder: 6 },
  { key: "users.manage_types", name: "Manage account types", group: "Users", sortOrder: 7 },

  // ── Payments ─────────────────────────────────────────────────────────────
  { key: "payments.view", name: "View payments", group: "Payments", sortOrder: 1 },
  { key: "payments.refund", name: "Issue refunds", group: "Payments", sortOrder: 2 },
  { key: "payments.configure", name: "Configure payments", group: "Payments", sortOrder: 3 },

  // ── Settings ─────────────────────────────────────────────────────────────
  { key: "settings.view", name: "View settings", group: "Settings", sortOrder: 1 },
  { key: "settings.edit", name: "Edit settings", group: "Settings", sortOrder: 2 },
  { key: "settings.security", name: "Security settings", group: "Settings", sortOrder: 3 },
  { key: "settings.advanced", name: "Advanced settings", group: "Settings", description: "System-level config", sortOrder: 4 },

  // ── Media ────────────────────────────────────────────────────────────────
  { key: "media.view", name: "View media", group: "Media", sortOrder: 1 },
  { key: "media.upload", name: "Upload media", group: "Media", sortOrder: 2 },
  { key: "media.edit", name: "Edit media", group: "Media", sortOrder: 3 },
  { key: "media.delete", name: "Delete media", group: "Media", sortOrder: 4 },

  // ── Announcements ────────────────────────────────────────────────────────
  { key: "announcements.view", name: "View announcements", group: "Announcements", sortOrder: 1 },
  { key: "announcements.create", name: "Create announcements", group: "Announcements", sortOrder: 2 },
  { key: "announcements.edit", name: "Edit announcements", group: "Announcements", sortOrder: 3 },
  { key: "announcements.publish", name: "Publish announcements", group: "Announcements", sortOrder: 4 },
  { key: "announcements.broadcast", name: "Broadcast (email)", group: "Announcements", sortOrder: 5 },

  // ── Flashcards ───────────────────────────────────────────────────────────
  { key: "flashcards.view", name: "View flashcards", group: "Flashcards", sortOrder: 1 },
  { key: "flashcards.create", name: "Create flashcards", group: "Flashcards", sortOrder: 2 },
  { key: "flashcards.edit", name: "Edit flashcards", group: "Flashcards", sortOrder: 3 },
  { key: "flashcards.publish", name: "Publish flashcards", group: "Flashcards", sortOrder: 4 },

  // ── Audit ────────────────────────────────────────────────────────────────
  { key: "audit.view", name: "View audit logs", group: "Audit", sortOrder: 1 },

  // ── System ───────────────────────────────────────────────────────────────
  { key: "system.health", name: "System health", group: "System", sortOrder: 1 },
  { key: "system.backups", name: "Backups", group: "System", sortOrder: 2 },
  { key: "system.maintenance", name: "Maintenance mode", group: "System", sortOrder: 3 },
];

export const PERMISSION_KEYS = PERMISSION_REGISTRY.map((p) => p.key);

// Legacy permission keys from the previous static system, mapped onto the new
// granular registry. Used to keep old requirePermission('…') gates working.
export const LEGACY_PERMISSION_MAP: Record<string, string[]> = {
  "users.view": ["users.view"],
  "users.manage": ["users.view", "users.create", "users.edit", "users.suspend", "users.delete"],
  "settings.manage": ["settings.view", "settings.edit"],
  "media.manage": ["media.view", "media.upload", "media.edit", "media.delete"],
  "import.run": ["questions.import"],
  "questions.manage": ["questions.view", "questions.create", "questions.edit", "questions.review", "questions.publish", "questions.archive"],
  "taxonomy.manage": ["exams.view", "exams.create", "exams.edit", "exams.configure"],
  "flashcards.manage": ["flashcards.view", "flashcards.create", "flashcards.edit", "flashcards.publish"],
  "review.manage": ["questions.review", "questions.publish"],
  "announcements.manage": ["announcements.view", "announcements.create", "announcements.edit", "announcements.publish"],
  "coming_soon.manage": ["announcements.view", "announcements.create"],
  "payments.manage": ["payments.view", "payments.refund", "payments.configure"],
  "entitlements.manage": ["qbanks.entitlements", "qbanks.pricing"],
  "flags.manage": ["settings.edit"],
  "errata.manage": ["questions.edit"],
  "overrides.manage": ["settings.edit", "exams.configure"],
  "qbanks.manage": ["qbanks.view", "qbanks.create", "qbanks.edit", "qbanks.publish"],
  "exam_settings.manage": ["exams.configure", "exams.view"],
  "email.manage": ["settings.edit", "announcements.broadcast"],
  "audit.view": ["audit.view"],
};

/** Resolve a legacy permission key into the granular keys it implies. */
export function expandLegacyPermission(legacyKey: string): string[] {
  return LEGACY_PERMISSION_MAP[legacyKey] ?? [legacyKey];
}
