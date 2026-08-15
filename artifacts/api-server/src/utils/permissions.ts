// ============================================================================
// Granular admin roles (settings plan item 20).
//
// Every admin-level role maps to a set of permission keys. requirePermission
// is the server-side gate for every sensitive mutation — a role may pass
// requireAdmin (enter the admin panel) but still be blocked from operations
// outside its scope.
// ============================================================================

export type PermissionKey =
  | 'users.view'
  | 'users.manage'
  | 'settings.manage'
  | 'media.manage'
  | 'import.run'
  | 'questions.manage'
  | 'taxonomy.manage'
  | 'flashcards.manage'
  | 'review.manage'
  | 'announcements.manage'
  | 'coming_soon.manage'
  | 'payments.manage'
  | 'entitlements.manage'
  | 'flags.manage'
  | 'errata.manage'
  | 'overrides.manage'
  | 'qbanks.manage'
  | 'exam_settings.manage'
  | 'email.manage'
  | 'audit.view';

const ALL = ['*'] as const;

// Roles: existing (user/editor/teacher/reviewer/admin/superadmin) plus the
// plan's granular admin roles. '*' grants every permission.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: [...ALL],
  admin: [...ALL], // legacy full admin keeps every capability
  platform_admin: [
    'users.view', 'users.manage', 'settings.manage', 'media.manage',
    'audit.view', 'announcements.manage', 'coming_soon.manage', 'import.run',
    'taxonomy.manage', 'flags.manage', 'errata.manage', 'payments.manage',
    'entitlements.manage', 'overrides.manage', 'qbanks.manage', 'review.manage',
    'email.manage',
  ],
  content_admin: [
    'questions.manage', 'taxonomy.manage', 'flashcards.manage', 'review.manage',
    'import.run', 'media.manage', 'announcements.manage',
  ],
  exam_admin: [
    'exam_settings.manage', 'overrides.manage', 'qbanks.manage',
    'review.manage', 'questions.manage', 'taxonomy.manage', 'flashcards.manage',
  ],
  finance_admin: ['payments.manage', 'entitlements.manage', 'users.view', 'audit.view'],
  marketing_admin: ['announcements.manage', 'coming_soon.manage', 'media.manage', 'flags.manage', 'email.manage'],
  support_admin: ['users.view', 'flags.manage', 'errata.manage', 'audit.view'],
  editor: ['questions.manage', 'flashcards.manage'],
  teacher: ['questions.manage', 'flashcards.manage'],
  reviewer: ['review.manage', 'questions.manage'],
  user: [],
};

/** Whether a role holds a permission (or the '*' wildcard). */
export function roleHasPermission(role: string | undefined, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role ?? 'user'] ?? [];
  return perms.includes('*') || perms.includes(permission);
}

/** Roles that are considered administrators (may enter the admin panel). */
export const ADMIN_ROLES: string[] = [
  'admin', 'superadmin', 'platform_admin', 'content_admin', 'exam_admin',
  'finance_admin', 'marketing_admin', 'support_admin',
];

/** Assignable roles from the admin Users page. */
export const ASSIGNABLE_ROLES: string[] = [
  'user', 'editor', 'teacher', 'reviewer',
  'content_admin', 'exam_admin', 'finance_admin', 'marketing_admin', 'support_admin',
  'platform_admin', 'admin', 'superadmin',
];

export const ROLE_LABELS: Record<string, string> = {
  user: 'Student',
  editor: 'Editor',
  teacher: 'Teacher',
  reviewer: 'Reviewer',
  content_admin: 'Content Admin',
  exam_admin: 'Exam Admin',
  finance_admin: 'Finance Admin',
  marketing_admin: 'Marketing Admin',
  support_admin: 'Support Admin',
  platform_admin: 'Platform Admin',
  admin: 'Admin',
  superadmin: 'Super Admin',
};

/**
 * Express middleware: requires the request user's role to hold `permission`.
 * Must run after `authenticate` (and typically after `requireAdmin`).
 */
export function requirePermission(permission: PermissionKey) {
  return (req: any, res: any, next: any): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roleHasPermission(req.user.role, permission)) {
      res.status(403).json({ error: `Forbidden — requires the "${permission}" permission` });
      return;
    }
    next();
  };
}
