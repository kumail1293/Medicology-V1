// ============================================================================
// Administration 2.0 — RBAC routes.
//
// Superadmin-owned: account types, roles, permissions, organizations.
// users.manage_roles: user↔role / user↔scope / user↔permission assignment.
//
// Every mutation is audited and gated by requireCan (effective permission),
// never a frontend role check.
// ============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import {
  userTypesTable,
  permissionsTable,
  rolesTable,
  rolePermissionsTable,
  userRolesTable,
  userPermissionsTable,
  organizationsTable,
  teamsTable,
  teamMembersTable,
  userScopesTable,
  roleScopesTable,
  usersTable,
  type ScopeType,
} from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { requireCan, resolveUserAccess, clearAuthorizationCache } from '../utils/authorization.js';
import { PERMISSION_REGISTRY } from '../utils/permission-registry.js';
import { recordAudit } from '../utils/audit.js';

export const rbacRouter = Router();

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });
const SCOPE_TYPES: ScopeType[] = ['global', 'country', 'exam', 'program', 'year', 'subject', 'system', 'topic', 'qbank'];

// ---------------------------------------------------------------------------
// Permissions (registry — read-only list)
// ---------------------------------------------------------------------------

rbacRouter.get('/permissions', authenticate, requireAdmin, async (_req: any, res: any) => {
  try {
    const rows = await db.select().from(permissionsTable);
    res.json({ permissions: rows.length > 0 ? rows : PERMISSION_REGISTRY, groups: [...new Set(PERMISSION_REGISTRY.map((p) => p.group))] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Account types
// ---------------------------------------------------------------------------

const userTypeSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9_]+$/, 'lowercase letters, numbers, underscores'),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  registrationAllowed: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  invitationOnly: z.boolean().optional(),
  defaultRole: z.string().optional().nullable(),
  canAccessAdmin: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

rbacRouter.get('/user-types', authenticate, requireAdmin, async (_req: any, res: any) => {
  try {
    const types = await db.select().from(userTypesTable);
    const counts = await db.select().from(usersTable);
    res.json({
      userTypes: types.map((t: any) => ({
        ...t,
        userCount: counts.filter((u: any) => u.userType === t.slug).length,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rbacRouter.post('/user-types', authenticate, requireCan('users.manage_types'), async (req: any, res: any) => {
  try {
    const body = userTypeSchema.parse(req.body);
    const existing = await db.select().from(userTypesTable).where(eq(userTypesTable.slug, body.slug));
    if (existing.length > 0) return res.status(409).json({ error: 'Slug already exists' });
    const [row] = await db.insert(userTypesTable).values({ ...body, metadata: {} }).returning();
    await recordAudit({ actor: actorOf(req), action: 'user_type.create', entityType: 'user_type', entityId: row.id, entityLabel: row.name, newValues: row, ip: req.ip });
    res.status(201).json({ userType: row });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

rbacRouter.put('/user-types/:id', authenticate, requireCan('users.manage_types'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const body = userTypeSchema.partial().parse(req.body);
    const [existing] = await db.select().from(userTypesTable).where(eq(userTypesTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const [row] = await db.update(userTypesTable).set({ ...body, updatedAt: new Date() }).where(eq(userTypesTable.id, id)).returning();
    await recordAudit({ actor: actorOf(req), action: 'user_type.update', entityType: 'user_type', entityId: id, entityLabel: row.name, oldValues: existing, newValues: row, ip: req.ip });
    clearAuthorizationCache();
    res.json({ userType: row });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const roleSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9_]+$/, 'lowercase letters, numbers, underscores'),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  permissions: z.array(z.string()).optional(),
});

rbacRouter.get('/roles', authenticate, requireAdmin, async (_req: any, res: any) => {
  try {
    const [roles, rolePerms, userRoles] = await Promise.all([
      db.select().from(rolesTable),
      db.select().from(rolePermissionsTable),
      db.select().from(userRolesTable),
    ]);
    const permsByRole = new Map<number, string[]>();
    for (const rp of rolePerms) {
      const rid = Number(rp.roleId);
      if (!permsByRole.has(rid)) permsByRole.set(rid, []);
      permsByRole.get(rid)!.push(String(rp.permissionKey));
    }
    const usersByRole = new Map<number, number>();
    for (const ur of userRoles) {
      const rid = Number(ur.roleId);
      usersByRole.set(rid, (usersByRole.get(rid) ?? 0) + 1);
    }
    res.json({
      roles: roles.map((r: any) => ({
        ...r,
        permissions: permsByRole.get(Number(r.id)) ?? [],
        userCount: usersByRole.get(Number(r.id)) ?? 0,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rbacRouter.post('/roles', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const body = roleSchema.parse(req.body);
    const existing = await db.select().from(rolesTable).where(eq(rolesTable.slug, body.slug));
    if (existing.length > 0) return res.status(409).json({ error: 'Slug already exists' });
    const [row] = await db.insert(rolesTable).values({
      name: body.name, slug: body.slug, description: body.description ?? null,
      status: body.status ?? 'active', systemRole: false, template: false, createdBy: req.user?.id ?? null,
    }).returning();
    for (const key of body.permissions ?? []) {
      await db.insert(rolePermissionsTable).values({ roleId: row.id, permissionKey: key, grantedBy: req.user?.id ?? null });
    }
    await recordAudit({ actor: actorOf(req), action: 'role.create', entityType: 'role', entityId: row.id, entityLabel: row.name, newValues: { ...row, permissions: body.permissions }, ip: req.ip });
    clearAuthorizationCache();
    res.status(201).json({ role: { ...row, permissions: body.permissions ?? [] } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

rbacRouter.put('/roles/:id', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const body = roleSchema.partial().parse(req.body);
    const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.systemRole && body.status === 'archived') {
      return res.status(400).json({ error: 'System roles cannot be archived' });
    }
    const [row] = await db.update(rolesTable).set({
      name: body.name ?? existing.name,
      slug: body.slug ?? existing.slug,
      description: body.description !== undefined ? body.description : existing.description,
      status: body.status ?? existing.status,
      updatedAt: new Date(),
    }).where(eq(rolesTable.id, id)).returning();
    if (body.permissions) {
      await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
      for (const key of body.permissions) {
        await db.insert(rolePermissionsTable).values({ roleId: id, permissionKey: key, grantedBy: req.user?.id ?? null });
      }
    }
    await recordAudit({ actor: actorOf(req), action: 'role.update', entityType: 'role', entityId: id, entityLabel: row.name, oldValues: existing, newValues: { ...row, permissions: body.permissions }, ip: req.ip });
    clearAuthorizationCache();
    res.json({ role: { ...row, permissions: body.permissions ?? undefined } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Duplicate a role (clone permissions into a new role)
rbacRouter.post('/roles/:id/duplicate', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const [src] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
    if (!src) return res.status(404).json({ error: 'Not found' });
    const perms = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
    const newSlug = `${src.slug}_copy`;
    const [row] = await db.insert(rolesTable).values({
      name: `${src.name} (Copy)`, slug: newSlug, description: src.description,
      status: 'active', systemRole: false, template: false, createdBy: req.user?.id ?? null,
    }).returning();
    for (const p of perms) {
      await db.insert(rolePermissionsTable).values({ roleId: row.id, permissionKey: p.permissionKey, grantedBy: req.user?.id ?? null });
    }
    await recordAudit({ actor: actorOf(req), action: 'role.duplicate', entityType: 'role', entityId: row.id, entityLabel: row.name, newValues: { fromRole: src.slug }, ip: req.ip });
    clearAuthorizationCache();
    res.status(201).json({ role: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// User access assignment (roles, direct permissions, scopes)
// ---------------------------------------------------------------------------

rbacRouter.get('/users/:id/access', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    const access = await resolveUserAccess({ id: userId });
    const [userRoles, directPerms, scopes] = await Promise.all([
      db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId)),
      db.select().from(userPermissionsTable).where(eq(userPermissionsTable.userId, userId)),
      db.select().from(userScopesTable).where(eq(userScopesTable.userId, userId)),
    ]);
    const [roles, rolePerms] = await Promise.all([
      db.select().from(rolesTable),
      db.select().from(rolePermissionsTable),
    ]);
    const assignedRoleIds = new Set(userRoles.map((ur: any) => Number(ur.roleId)));
    const rolePermissionsMap = new Map<number, string[]>();
    for (const rp of rolePerms) {
      const rid = Number(rp.roleId);
      if (!rolePermissionsMap.has(rid)) rolePermissionsMap.set(rid, []);
      rolePermissionsMap.get(rid)!.push(String(rp.permissionKey));
    }
    res.json({
      effective: access,
      roles: roles.map((r: any) => ({ ...r, permissions: rolePermissionsMap.get(Number(r.id)) ?? [], assigned: assignedRoleIds.has(Number(r.id)) })),
      directPermissions: directPerms,
      scopes,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /users/:id/roles — replace the user's role set
rbacRouter.put('/users/:id/roles', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    const { roleIds } = z.object({ roleIds: z.array(z.number()) }).parse(req.body);
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
    for (const roleId of roleIds) {
      await db.insert(userRolesTable).values({ userId, roleId, grantedBy: req.user?.id ?? null });
    }
    await recordAudit({ actor: actorOf(req), action: 'user.roles.update', entityType: 'user', entityId: userId, newValues: { roleIds }, ip: req.ip });
    clearAuthorizationCache();
    res.json({ success: true, roleIds });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /users/:id/permissions — replace direct permission grants/denials
rbacRouter.put('/users/:id/permissions', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    const { permissions } = z.object({ permissions: z.array(z.object({ permissionKey: z.string(), allowed: z.boolean() })) }).parse(req.body);
    await db.delete(userPermissionsTable).where(eq(userPermissionsTable.userId, userId));
    for (const p of permissions) {
      await db.insert(userPermissionsTable).values({ userId, permissionKey: p.permissionKey, allowed: p.allowed, grantedBy: req.user?.id ?? null });
    }
    await recordAudit({ actor: actorOf(req), action: 'user.permissions.update', entityType: 'user', entityId: userId, newValues: { permissions }, ip: req.ip });
    clearAuthorizationCache();
    res.json({ success: true, permissions });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /users/:id/scopes — replace the user's access scopes
rbacRouter.put('/users/:id/scopes', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    const { scopes } = z.object({
      scopes: z.array(z.object({ scopeType: z.string().refine((v) => (SCOPE_TYPES as string[]).includes(v)), scopeId: z.number().nullable().optional(), label: z.string().optional() })),
    }).parse(req.body);
    await db.delete(userScopesTable).where(eq(userScopesTable.userId, userId));
    for (const s of scopes) {
      await db.insert(userScopesTable).values({ userId, scopeType: s.scopeType, scopeId: s.scopeId ?? null, label: s.label ?? null, grantedBy: req.user?.id ?? null });
    }
    await recordAudit({ actor: actorOf(req), action: 'user.scopes.update', entityType: 'user', entityId: userId, newValues: { scopes }, ip: req.ip });
    clearAuthorizationCache();
    res.json({ success: true, scopes });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /users/:id/account-type — set the user's account type
rbacRouter.put('/users/:id/account-type', authenticate, requireCan('users.manage_types'), async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    const { userType } = z.object({ userType: z.string().min(1) }).parse(req.body);
    const type = await db.select().from(userTypesTable).where(eq(userTypesTable.slug, userType));
    if (type.length === 0) return res.status(400).json({ error: 'Unknown account type' });
    await db.update(usersTable).set({ userType }).where(eq(usersTable.id, userId));
    await recordAudit({ actor: actorOf(req), action: 'user.account_type.update', entityType: 'user', entityId: userId, newValues: { userType }, ip: req.ip });
    clearAuthorizationCache();
    res.json({ success: true, userType });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Organizations / teams
// ---------------------------------------------------------------------------

const orgSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9_-]+$/, 'lowercase letters, numbers, dashes'),
  logo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  organizationType: z.enum(['university', 'exam_authority', 'institution', 'content_team', 'publisher', 'partner']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  parentOrganizationId: z.number().nullable().optional(),
});

rbacRouter.get('/organizations', authenticate, requireAdmin, async (_req: any, res: any) => {
  try {
    const [orgs, teams, members] = await Promise.all([
      db.select().from(organizationsTable),
      db.select().from(teamsTable),
      db.select().from(teamMembersTable),
    ]);
    const teamsByOrg = new Map<number, any[]>();
    for (const t of teams) {
      const oid = Number(t.organizationId);
      if (!teamsByOrg.has(oid)) teamsByOrg.set(oid, []);
      teamsByOrg.get(oid)!.push({ ...t, memberCount: members.filter((m: any) => Number(m.teamId) === Number(t.id)).length });
    }
    res.json({
      organizations: orgs.map((o: any) => ({ ...o, teams: teamsByOrg.get(Number(o.id)) ?? [] })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rbacRouter.post('/organizations', authenticate, requireCan('users.manage_types'), async (req: any, res: any) => {
  try {
    const body = orgSchema.parse(req.body);
    const existing = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, body.slug));
    if (existing.length > 0) return res.status(409).json({ error: 'Slug already exists' });
    const [row] = await db.insert(organizationsTable).values({ ...body, metadata: {} }).returning();
    await recordAudit({ actor: actorOf(req), action: 'organization.create', entityType: 'organization', entityId: row.id, entityLabel: row.name, newValues: row, ip: req.ip });
    res.status(201).json({ organization: row });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Team membership
rbacRouter.post('/teams/:id/members', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const teamId = Number(req.params.id);
    const { userId, roleId, scope } = z.object({
      userId: z.number(), roleId: z.number().nullable().optional(), scope: z.record(z.any()).optional(),
    }).parse(req.body);
    const [row] = await db.insert(teamMembersTable).values({ teamId, userId, roleId: roleId ?? null, scope: scope ?? {}, grantedBy: req.user?.id ?? null }).returning();
    await recordAudit({ actor: actorOf(req), action: 'team.member.add', entityType: 'team', entityId: teamId, newValues: { userId, roleId }, ip: req.ip });
    res.status(201).json({ member: row });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Role scopes
// ---------------------------------------------------------------------------

rbacRouter.put('/roles/:id/scopes', authenticate, requireCan('users.manage_roles'), async (req: any, res: any) => {
  try {
    const roleId = Number(req.params.id);
    const { scopes } = z.object({
      scopes: z.array(z.object({ scopeType: z.string().refine((v) => (SCOPE_TYPES as string[]).includes(v)), scopeId: z.number().nullable().optional(), label: z.string().optional() })),
    }).parse(req.body);
    await db.delete(roleScopesTable).where(eq(roleScopesTable.roleId, roleId));
    for (const s of scopes) {
      await db.insert(roleScopesTable).values({ roleId, scopeType: s.scopeType, scopeId: s.scopeId ?? null, label: s.label ?? null, grantedBy: req.user?.id ?? null });
    }
    await recordAudit({ actor: actorOf(req), action: 'role.scopes.update', entityType: 'role', entityId: roleId, newValues: { scopes }, ip: req.ip });
    clearAuthorizationCache();
    res.json({ success: true, scopes });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Scope selector data — taxonomy options for the scope picker
rbacRouter.get('/scopes/options', authenticate, requireAdmin, async (_req: any, res: any) => {
  try {
    const { countriesTable, examsTable, programsTable, academicYearsTable, subjectsTable, systemsTable, topicsTable, qbanksTable } = await import('@workspace/db');
    const [countries, exams, programs, years, subjects, systems, topics, qbanks] = await Promise.all([
      db.select().from(countriesTable), db.select().from(examsTable), db.select().from(programsTable),
      db.select().from(academicYearsTable), db.select().from(subjectsTable), db.select().from(systemsTable),
      db.select().from(topicsTable), db.select().from(qbanksTable),
    ]);
    res.json({
      countries: countries.map((c: any) => ({ id: c.id, label: c.name })),
      exams: exams.map((e: any) => ({ id: e.id, label: e.name })),
      programs: programs.map((p: any) => ({ id: p.id, label: p.name })),
      years: years.map((y: any) => ({ id: y.id, label: y.name })),
      subjects: subjects.map((s: any) => ({ id: s.id, label: s.name })),
      systems: systems.map((s: any) => ({ id: s.id, label: s.name })),
      topics: topics.map((t: any) => ({ id: t.id, label: t.name })),
      qbanks: qbanks.map((q: any) => ({ id: q.id, label: q.name })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
