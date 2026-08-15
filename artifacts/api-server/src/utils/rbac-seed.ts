// ============================================================================
// RBAC seed — account types, roles, role→permission matrices, organizations
// and teams. Used by the mock DB so the admin panel is fully demonstrable
// without PostgreSQL. The same data is inserted into the real DB on first
// boot (idempotent) by seedRbac().
// ============================================================================

import { PERMISSION_REGISTRY } from "./permission-registry.js";

export interface SeedRole {
  name: string;
  slug: string;
  description: string;
  systemRole?: boolean;
  template?: boolean;
  permissions: string[];
}

export const SEED_ACCOUNT_TYPES = [
  { name: "Student", slug: "student", description: "Medical, dental & allied health student preparing for exams.", icon: "graduation-cap", color: "blue", status: "active", registrationAllowed: true, requiresApproval: false, invitationOnly: false, defaultRole: "student", canAccessAdmin: false, sortOrder: 1 },
  { name: "Teacher", slug: "teacher", description: "Faculty member who creates and edits educational content.", icon: "presentation", color: "green", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "teacher", canAccessAdmin: false, sortOrder: 2 },
  { name: "Content Author", slug: "content_author", description: "Writes questions, explanations and flashcards.", icon: "pen-tool", color: "purple", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "content_author", canAccessAdmin: false, sortOrder: 3 },
  { name: "Reviewer", slug: "reviewer", description: "Reviews and approves question content.", icon: "check-check", color: "orange", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "question_reviewer", canAccessAdmin: false, sortOrder: 4 },
  { name: "Institutional Admin", slug: "institutional_admin", description: "Manages content and users for an institution (university/exam body).", icon: "building-2", color: "teal", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "institutional_administrator", canAccessAdmin: true, sortOrder: 5 },
  { name: "Moderator", slug: "moderator", description: "Moderates flags, reports and community content.", icon: "shield", color: "indigo", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "support_agent", canAccessAdmin: true, sortOrder: 6 },
  { name: "Support Agent", slug: "support_agent", description: "Handles user support, flags and errata.", icon: "life-buoy", color: "cyan", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "support_agent", canAccessAdmin: true, sortOrder: 7 },
  { name: "Finance Manager", slug: "finance_manager", description: "Manages payments, refunds and entitlements.", icon: "banknote", color: "amber", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "finance_manager", canAccessAdmin: true, sortOrder: 8 },
  { name: "Staff", slug: "staff", description: "Platform staff with configurable access.", icon: "briefcase", color: "slate", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "support_agent", canAccessAdmin: true, sortOrder: 9 },
  { name: "Administrator", slug: "administrator", description: "Platform administrator.", icon: "settings", color: "red", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "administrator", canAccessAdmin: true, sortOrder: 10 },
  { name: "Superadmin", slug: "superadmin", description: "Full control over the entire platform.", icon: "crown", color: "yellow", registrationAllowed: false, requiresApproval: true, invitationOnly: true, defaultRole: "superadmin", canAccessAdmin: true, sortOrder: 11 },
] as const;

/** Permission keys granted to every admin-adjacent role (read-only baseline). */
const ADMIN_READ_BASELINE = [
  "questions.view", "qbanks.view", "exams.view", "users.view", "payments.view",
  "settings.view", "media.view", "announcements.view", "flashcards.view", "audit.view",
];

export const SEED_ROLES: SeedRole[] = [
  { name: "Superadmin", slug: "superadmin", description: "Full control over every platform capability.", systemRole: true, permissions: ["*"] },
  { name: "Student", slug: "student", description: "Default student account — no admin permissions.", systemRole: true, permissions: [] },
  { name: "Teacher", slug: "teacher", description: "Creates and edits questions, flashcards and announcements.", systemRole: true, permissions: ["questions.view", "questions.create", "questions.edit", "flashcards.view", "flashcards.create", "flashcards.edit", "announcements.view", "announcements.create", "announcements.edit", "media.view", "media.upload"] },
  { name: "Content Author", slug: "content_author", description: "Writes question content and flashcards.", template: true, permissions: ["questions.view", "questions.create", "questions.edit", "flashcards.view", "flashcards.create", "flashcards.edit", "media.view", "media.upload"] },
  { name: "Question Reviewer", slug: "question_reviewer", description: "Reviews, approves and publishes questions.", template: true, permissions: ["questions.view", "questions.create", "questions.edit", "questions.review", "questions.publish", "questions.archive", "media.view"] },
  { name: "QBank Manager", slug: "qbank_manager", description: "Creates and manages QBanks and their questions.", template: true, permissions: ["qbanks.view", "qbanks.create", "qbanks.edit", "qbanks.publish", "questions.view", "questions.create", "questions.edit", "questions.import", "questions.review", "questions.publish", "media.view", "media.upload"] },
  { name: "Exam Manager", slug: "exam_manager", description: "Configures exams and exam rules.", template: true, permissions: ["exams.view", "exams.create", "exams.edit", "exams.publish", "exams.configure", "exams.results", "qbanks.view"] },
  { name: "Flashcard Manager", slug: "flashcard_manager", description: "Creates and publishes flashcard decks.", template: true, permissions: ["flashcards.view", "flashcards.create", "flashcards.edit", "flashcards.publish", "media.view", "media.upload"] },
  { name: "Announcement Manager", slug: "announcement_manager", description: "Creates, publishes and broadcasts announcements.", template: true, permissions: ["announcements.view", "announcements.create", "announcements.edit", "announcements.publish", "announcements.broadcast", "media.view", "media.upload"] },
  { name: "Finance Manager", slug: "finance_manager", description: "Manages payments, refunds and entitlements.", template: true, permissions: ["payments.view", "payments.refund", "payments.configure", "qbanks.entitlements", "qbanks.pricing", "users.view", "audit.view"] },
  { name: "Support Agent", slug: "support_agent", description: "User support, flags and errata.", template: true, permissions: ["users.view", "users.edit", "announcements.view", "announcements.create", "settings.view", "audit.view"] },
  { name: "Institutional Administrator", slug: "institutional_administrator", description: "Manages content and users scoped to their institution.", template: true, permissions: [...ADMIN_READ_BASELINE, "questions.create", "questions.edit", "questions.review", "questions.publish", "users.view", "users.edit", "media.upload", "media.edit"] },
  { name: "Administrator", slug: "administrator", description: "Platform administrator — most capabilities except security/advanced.", template: true, permissions: [...ADMIN_READ_BASELINE, "questions.create", "questions.edit", "questions.review", "questions.publish", "questions.archive", "questions.import", "qbanks.create", "qbanks.edit", "qbanks.publish", "qbanks.entitlements", "exams.create", "exams.edit", "exams.publish", "exams.configure", "users.create", "users.edit", "users.suspend", "users.manage_roles", "payments.view", "payments.refund", "settings.edit", "media.upload", "media.edit", "media.delete", "announcements.create", "announcements.edit", "announcements.publish", "announcements.broadcast", "flashcards.create", "flashcards.edit", "flashcards.publish"] },
];

export const SEED_ORGANIZATIONS = [
  { name: "University of Health Sciences", slug: "uhs", description: "UHS Lahore — MBBS/BDS examinations.", organizationType: "university" },
  { name: "Khyber Medical University", slug: "kmu", description: "KMU Peshawar — medical & allied health programs.", organizationType: "university" },
  { name: "College of Physicians & Surgeons Pakistan", slug: "cpsp", description: "FCPS examinations.", organizationType: "exam_authority" },
  { name: "Pakistan Medical Commission", slug: "pmdc", description: "NRE/NEB national registration exams.", organizationType: "exam_authority" },
] as const;

export const SEED_TEAMS = [
  { name: "UHS Content Team", slug: "uhs-content", organizationSlug: "uhs", description: "Writes and reviews UHS question content." },
  { name: "FCPS Question Reviewers", slug: "fcps-reviewers", organizationSlug: "cpsp", description: "Reviews FCPS Part 1 & 2 content." },
] as const;

export function allPermissionKeys(): string[] {
  return PERMISSION_REGISTRY.map((p) => p.key);
}
