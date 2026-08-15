// ============================================================================
// Effective authorization engine (Administration 2.0).
//
// Effective permissions are computed from, in precedence order:
//
//   1. Explicit DENIALS (user_permissions where allowed = false)  ← strongest
//   2. Direct GRANTS (user_permissions where allowed = true)
//   3. Role permissions (user_roles → role_permissions)
//   4. Account-type default role permissions (user_types.defaultRole)
//   5. Superadmin / legacy full-admin bypass (role in admin/superadmin)
//
// A denial always wins — a user cannot gain a permission merely by joining a
// broader organization or being granted a role. This prevents escalation.
//
// The '*'-wildcard role (superadmin) grants every registered permission.
//
// Legacy compatibility: users with the old string roles (admin, superadmin,
// platform_admin, …) are resolved through their role slug as well, and the
// static ROLE_PERMISSIONS map is used only as a fallback for legacy roles that
// have no DB role row (kept so requireAdmin/requirePermission keep working).
// ============================================================================

import { db } from '../db.js';
import {
  rolesTable,
  rolePermissionsTable,
  userRolesTable,
  userPermissionsTable,
  userTypesTable,
  userScopesTable,
  roleScopesTable,
  type ScopeType,
} from '@workspace/db';
import { eq } from './drizzle.js';
import { PERMISSION_REGISTRY, LEGACY_PERMISSION_MAP } from './permission-registry.js';

export interface EffectivePermission {
  key: string;
  allowed: boolean;
  source: 'direct' | 'role' | 'account_type' | 'legacy' | 'denied';
  viaRole?: string; // role slug that granted it
}

export interface UserAccess {
  userId: number;
  permissions: EffectivePermission[];
  grantedPermissions: string[];
  deniedPermissions: string[];
  roles: string[]; // role slugs
  accountType?: string; // account type slug
  scopes: { type: ScopeType; id: number | null; label?: string }[];
  isSuperadmin: boolean;
}

const ALL_PERMISSION_KEYS = PERMISSION_REGISTRY.map((p) => p.key);

/** Cache account-type + role lookups per request cycle (cleared by the caller). */
let cache: Record<string, any> | null = null;
export function clearAuthorizationCache() {
  cache = null;
}

async function getCache() {
  if (cache) return cache;
  const [roles, rolePerms, userTypes] = await Promise.all([
    db.select().from(rolesTable),
    db.select().from(rolePermissionsTable),
    db.select().from(userTypesTable),
  ]);
  cache = { roles, rolePerms, userTypes };
  return cache;
}

/** Legacy static roles (no DB row yet) keep their old permission sets. */
import { ROLE_PERMISSIONS } from './permissions.js';

/**
 * Resolve a user's effective access. `userLike` may be a DB user row or the
 * minimal auth payload from the JWT ({ id, role, isAdmin }).
 */
export async function resolveUserAccess(userLike: {
  id: number;
  role?: string;
  isAdmin?: boolean;
  userType?: string | null;
}): Promise<UserAccess> {
  const userId = Number(userLike.id);
  const { roles, rolePerms } = await getCache();
  const allRoles: any[] = roles as any[];

  const [userRoles, directPerms, userScopes, typeRows] = await Promise.all([
    db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId)),
    db.select().from(userPermissionsTable).where(eq(userPermissionsTable.userId, userId)),
    db.select().from(userScopesTable).where(eq(userScopesTable.userId, userId)),
    userLike.userType
      ? db.select().from(userTypesTable).where(eq(userTypesTable.slug, userLike.userType))
      : Promise.resolve([]),
  ]);

  const roleById = new Map(allRoles.map((r: any) => [Number(r.id), r]));
  const roleSlugs = new Set<string>();
  const roleIds = new Set<number>();

  for (const ur of userRoles) {
    const role: any = roleById.get(Number(ur.roleId));
    if (role && String(role.status) === 'active') {
      roleIds.add(Number(ur.roleId));
      roleSlugs.add(String(role.slug));
    }
  }

  // Legacy: the user's `role` string may reference a static role not in the DB.
  const legacyRole = userLike.role || 'user';
  if (!roleSlugs.has(legacyRole) && ROLE_PERMISSIONS[legacyRole] !== undefined) {
    roleSlugs.add(legacyRole);
  }
  // Account-type default role also contributes.
  const accountType: any = typeRows[0];
  let accountTypeSlug: string | undefined;
  if (accountType?.defaultRole && typeof accountType.defaultRole === 'string') {
    accountTypeSlug = String(accountType.defaultRole);
    if (ROLE_PERMISSIONS[accountTypeSlug] !== undefined) roleSlugs.add(accountTypeSlug);
    const row = allRoles.find((r: any) => String(r.slug) === accountTypeSlug);
    if (row) roleIds.add(Number(row.id));
  }

  // ── Gather permission grants ─────────────────────────────────────────────
  const grants = new Map<string, EffectivePermission>();

  // Roles (DB rows)
  const rolePermsByRole = new Map<number, { key: string; slug: string }[]>();
  for (const rp of rolePerms) {
    const roleId = Number(rp.roleId);
    if (!rolePermsByRole.has(roleId)) rolePermsByRole.set(roleId, []);
    const role: any = roleById.get(roleId);
    rolePermsByRole.get(roleId)!.push({ key: String(rp.permissionKey), slug: role ? String(role.slug) : `role-${roleId}` });
  }
  for (const roleId of roleIds) {
    for (const p of rolePermsByRole.get(roleId) ?? []) {
      const existing = grants.get(p.key);
      if (!existing) grants.set(p.key, { key: p.key, allowed: true, source: 'role', viaRole: p.slug });
    }
  }

  // Legacy role permission map
  for (const slug of roleSlugs) {
    if (ROLE_PERMISSIONS[slug]?.includes('*')) {
      for (const key of ALL_PERMISSION_KEYS) {
        if (!grants.has(key)) grants.set(key, { key, allowed: true, source: 'role', viaRole: slug });
      }
    } else {
      for (const key of ROLE_PERMISSIONS[slug] ?? []) {
        // Map legacy keys to granular ones when possible.
        const granular = LEGACY_PERMISSION_MAP[key] ?? [key];
        for (const g of granular) {
          if (!grants.has(g)) grants.set(g, { key: g, allowed: true, source: 'role', viaRole: slug });
        }
      }
    }
  }

  // Direct grants + denials
  for (const dp of directPerms) {
    const key = String(dp.permissionKey);
    if (dp.allowed) {
      if (!grants.has(key)) grants.set(key, { key, allowed: true, source: 'direct' });
    } else {
      grants.set(key, { key, allowed: false, source: 'denied' });
    }
  }

  const isSuperadmin = roleSlugs.has('superadmin') || userLike.isAdmin === true || legacyRole === 'superadmin';

  // ── Scopes ───────────────────────────────────────────────────────────────
  const scopes: { type: ScopeType; id: number | null; label?: string }[] = userScopes.map((s: any) => ({
    type: String(s.scopeType) as ScopeType,
    id: s.scopeId != null ? Number(s.scopeId) : null,
    label: s.label ?? undefined,
  }));
  // Role scopes apply when the user holds that role.
  if (roleIds.size > 0) {
    const roleScopeRows = await db.select().from(roleScopesTable);
    for (const rs of roleScopeRows) {
      if (roleIds.has(Number(rs.roleId))) {
        scopes.push({ type: String(rs.scopeType) as ScopeType, id: rs.scopeId != null ? Number(rs.scopeId) : null, label: rs.label ?? undefined });
      }
    }
  }

  const grantedPermissions = new Set<string>();
  const deniedPermissions = new Set<string>();
  for (const p of grants.values()) {
    if (p.allowed) grantedPermissions.add(p.key);
    else deniedPermissions.add(p.key);
  }

  return {
    userId,
    permissions: [...grants.values()],
    grantedPermissions: [...grantedPermissions],
    deniedPermissions: [...deniedPermissions],
    roles: [...roleSlugs],
    accountType: userLike.userType ?? accountType?.slug,
    scopes,
    isSuperadmin,
  };
}

/** Quick async check: does this user hold the permission? */
export async function userCan(userId: number, permission: string): Promise<boolean> {
  const access = await resolveUserAccess({ id: userId });
  return can(access, permission);
}

/** Synchronous check against a resolved UserAccess. */
export function can(access: UserAccess, permission: string): boolean {
  if (access.isSuperadmin) return true;
  if (access.deniedPermissions.includes(permission)) return false;
  return access.grantedPermissions.includes(permission);
}

/**
 * Express middleware: requires the authenticated user to hold `permission`.
 * Runs after `authenticate`. Attaches `req.access` for downstream scope checks.
 */
export function requireCan(permission: string) {
  return async (req: any, res: any, next: any): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const access = await resolveUserAccess(req.user);
    req.access = access;
    if (!can(access, permission)) {
      res.status(403).json({ error: `Forbidden — requires the "${permission}" permission` });
      return;
    }
    next();
  };
}

/**
 * Scope check: does the user's access include (or exceed) the given scope?
 * A global scope covers everything; a country scope covers its exams/programs,
 * etc. For v1 the check is exact-match (type+id) or global; taxonomy-parent
 * traversal is a documented follow-up.
 */
export function hasScope(access: UserAccess, type: ScopeType, id?: number | null): boolean {
  if (access.isSuperadmin) return true;
  for (const s of access.scopes) {
    if (s.type === 'global') return true;
    if (s.type === type && (id == null || s.id == null || Number(s.id) === Number(id))) return true;
  }
  return false;
}

export { ALL_PERMISSION_KEYS };
