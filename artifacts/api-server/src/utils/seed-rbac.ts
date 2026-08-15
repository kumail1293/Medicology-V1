// ============================================================================
// RBAC seed for the real (PostgreSQL) database.
//
// Idempotent: if the `permissions` table already has rows, seeding is skipped.
// Inserts the permission registry, account types, roles with their permission
// matrices, and the default organizations/teams. The mock DB seeds the same
// data from db.ts so both modes behave alike.
// ============================================================================

import { db } from '../db.js';
import {
  permissionsTable,
  userTypesTable,
  rolesTable,
  rolePermissionsTable,
  organizationsTable,
  teamsTable,
} from '@workspace/db';
import { PERMISSION_REGISTRY } from './permission-registry.js';
import { SEED_ACCOUNT_TYPES, SEED_ROLES, SEED_ORGANIZATIONS, SEED_TEAMS } from './rbac-seed.js';

export async function seedRbac(): Promise<number> {
  try {
    const existing = await db.select().from(permissionsTable).limit(1);
    if (existing.length > 0) return 0;

    const now = new Date();
    const inserted: any[] = [];

    // Permissions
    for (const p of PERMISSION_REGISTRY) {
      inserted.push(await db.insert(permissionsTable).values({ ...p, id: undefined as any, createdAt: now }).returning());
    }

    // Account types
    for (const t of SEED_ACCOUNT_TYPES) {
      await db.insert(userTypesTable).values({
        name: t.name, slug: t.slug, description: t.description, icon: t.icon, color: t.color,
        status: 'active', registrationAllowed: t.registrationAllowed, requiresApproval: t.requiresApproval,
        invitationOnly: t.invitationOnly, defaultRole: t.defaultRole, canAccessAdmin: t.canAccessAdmin,
        sortOrder: t.sortOrder, metadata: {}, createdAt: now, updatedAt: now,
      });
    }

    // Roles + role→permission matrices
    for (const r of SEED_ROLES) {
      const [role] = await db.insert(rolesTable).values({
        name: r.name, slug: r.slug, description: r.description,
        status: 'active', systemRole: r.systemRole ?? false, template: r.template ?? false,
        createdBy: null, createdAt: now, updatedAt: now,
      }).returning();
      const keys = r.permissions.includes('*') ? PERMISSION_REGISTRY.map((p) => p.key) : r.permissions;
      for (const key of keys) {
        await db.insert(rolePermissionsTable).values({ roleId: role.id, permissionKey: key, grantedBy: null, createdAt: now });
      }
    }

    // Organizations + teams
    for (const o of SEED_ORGANIZATIONS) {
      const [org] = await db.insert(organizationsTable).values({
        name: o.name, slug: o.slug, description: o.description,
        organizationType: o.organizationType, status: 'active', metadata: {}, createdAt: now, updatedAt: now,
      }).returning();
      for (const t of SEED_TEAMS.filter((x) => x.organizationSlug === o.slug)) {
        await db.insert(teamsTable).values({
          name: t.name, slug: t.slug, organizationId: org.id, description: t.description,
          createdAt: now, updatedAt: now,
        });
      }
    }

    return inserted.length;
  } catch (err: any) {
    // Best-effort — the mock DB and dev flows must never break on seed issues.
    console.warn('RBAC seeding skipped:', err.message);
    return 0;
  }
}
