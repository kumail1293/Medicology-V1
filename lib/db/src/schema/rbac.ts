import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

// ============================================================================
// Administration 2.0 — unified access & configuration.
//
// Layered authorization model (account type ≠ role ≠ permission ≠ scope):
//
//   user_types      — what KIND of account (Student, Teacher, Reviewer, …)
//   permissions     — namespaced capability registry (questions.publish, …)
//   roles           — named bundles of permissions (QBank Manager, …)
//   role_permissions— role → permission assignments
//   user_roles      — users can hold MULTIPLE roles
//   user_permissions— direct allow/deny overrides per user
//   organizations   — institutions / publishers / content teams
//   teams           — sub-groups inside an organization
//   team_members    — user membership in a team (with a role + scope)
//   user_scopes     — per-user access scopes against the taxonomy
//   role_scopes     — per-role access scopes (e.g. "UHS → MBBS → Pathology")
//
// Effective permissions are computed server-side by utils/authorization.ts
// with deterministic precedence. Frontend hiding is NOT security.
// ============================================================================

export const USER_TYPE_STATUSES = ["active", "inactive"] as const;
export type UserTypeStatus = (typeof USER_TYPE_STATUSES)[number];

export const userTypesTable = pgTable("user_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  status: text("status").$type<UserTypeStatus>().notNull().default("active"),
  registrationAllowed: boolean("registration_allowed").notNull().default(true),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  invitationOnly: boolean("invitation_only").notNull().default(false),
  defaultRole: text("default_role"), // slug of the default role
  canAccessAdmin: boolean("can_access_admin").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const permissionsTable = pgTable("permissions", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g. "questions.publish"
  name: text("name").notNull(), // human label
  group: text("group").notNull(), // e.g. "Questions"
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ROLE_STATUSES = ["active", "inactive", "archived"] as const;
export type RoleStatus = (typeof ROLE_STATUSES)[number];

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status").$type<RoleStatus>().notNull().default("active"),
  // System roles (Superadmin, Student, …) are protected from deletion.
  systemRole: boolean("system_role").notNull().default(false),
  // Template roles can be cloned into new custom roles.
  template: boolean("template").notNull().default(false),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [t.roleId, t.permissionKey]
);

export const userRolesTable = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [t.userId, t.roleId]
);

// Direct per-user permission grants. `allowed` true = grant, false = explicit
// denial (a denial wins over role grants — no escalation via membership).
export const userPermissionsTable = pgTable(
  "user_permissions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
    allowed: boolean("allowed").notNull().default(true),
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [t.userId, t.permissionKey]
);

export const ORGANIZATION_TYPES = [
  "university",
  "exam_authority",
  "institution",
  "content_team",
  "publisher",
  "partner",
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_STATUSES = ["active", "inactive", "suspended"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  description: text("description"),
  organizationType: text("organization_type").$type<OrganizationType>().notNull().default("institution"),
  status: text("status").$type<OrganizationStatus>().notNull().default("active"),
  parentOrganizationId: integer("parent_organization_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamMembersTable = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teamsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: integer("role_id").references(() => rolesTable.id),
    scope: jsonb("scope").$type<Record<string, any>>().default({}),
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [t.teamId, t.userId]
);

// ── Access scopes ───────────────────────────────────────────────────────────
// Scope type mirrors the taxonomy chain + global/qbank:
//   global | country | exam | program | year | subject | system | topic | qbank
export const SCOPE_TYPES = [
  "global",
  "country",
  "exam",
  "program",
  "year",
  "subject",
  "system",
  "topic",
  "qbank",
] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const userScopesTable = pgTable(
  "user_scopes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").$type<ScopeType>().notNull(),
    // scopeId is null for "global"; otherwise references the taxonomy node / qbank id.
    scopeId: integer("scope_id"),
    label: text("label"), // human-readable, e.g. "UHS / MBBS / Pathology"
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [t.userId, t.scopeType, t.scopeId]
);

export const roleScopesTable = pgTable(
  "role_scopes",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").$type<ScopeType>().notNull(),
    scopeId: integer("scope_id"),
    label: text("label"),
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [t.roleId, t.scopeType, t.scopeId]
);

// ── Zod schemas ─────────────────────────────────────────────────────────────

export const insertUserTypeSchema = createInsertSchema(userTypesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserType = z.infer<typeof insertUserTypeSchema>;
export type UserType = typeof userTypesTable.$inferSelect;

export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true, createdAt: true });
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissionsTable.$inferSelect;

export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;

export const insertRolePermissionSchema = createInsertSchema(rolePermissionsTable).omit({ id: true, createdAt: true });
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;

export const insertUserRoleSchema = createInsertSchema(userRolesTable).omit({ id: true, createdAt: true });
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRoleRow = typeof userRolesTable.$inferSelect;

export const insertUserPermissionSchema = createInsertSchema(userPermissionsTable).omit({ id: true, createdAt: true });
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof userPermissionsTable.$inferSelect;

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;

export const insertTeamMemberSchema = createInsertSchema(teamMembersTable).omit({ id: true, createdAt: true });
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembersTable.$inferSelect;

export const insertUserScopeSchema = createInsertSchema(userScopesTable).omit({ id: true, createdAt: true });
export type InsertUserScope = z.infer<typeof insertUserScopeSchema>;
export type UserScope = typeof userScopesTable.$inferSelect;

export const insertRoleScopeSchema = createInsertSchema(roleScopesTable).omit({ id: true, createdAt: true });
export type InsertRoleScope = z.infer<typeof insertRoleScopeSchema>;
export type RoleScope = typeof roleScopesTable.$inferSelect;
