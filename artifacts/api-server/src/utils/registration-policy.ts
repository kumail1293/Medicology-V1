// ============================================================================
// Registration policy (P0.20) — server-side enforcement of the registration
// settings group. The register route consults this module; the frontend is
// never trusted to decide whether registration is allowed.
// ============================================================================

import { db } from '../db.js';
import { appSettingsTable } from '@workspace/db';
import { mergeSettings } from './settings-defaults.js';

/** Load the effective platform settings (defaults merged over stored). */
async function loadStoredSettings(): Promise<any> {
  const rows = await db.select().from(appSettingsTable);
  const stored: Record<string, any> = {};
  for (const row of rows) stored[row.key] = row.value;
  return mergeSettings(stored);
}

export interface RegistrationPolicyResult {
  ok: boolean;
  error?: string;
  status: number;
  verificationRequired?: boolean;
}

export interface RegisterAttempt {
  email: string;
  password: string;
  inviteCode?: string;
}

/**
 * Evaluate a registration attempt against the platform policy.
 * Returns { ok: true } or a { ok: false, status, error } rejection.
 */
export async function checkRegistrationPolicy(attempt: RegisterAttempt): Promise<RegistrationPolicyResult> {
  const settings = await loadStoredSettings();
  const reg = settings.registration ?? {};
  const sec = settings.security ?? {};

  if (reg.openRegistration === false) {
    return { ok: false, status: 403, error: 'Registration is currently closed. Please contact support.' };
  }

  const email = String(attempt.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, status: 400, error: 'A valid email is required' };
  }

  // Allowed email domains (empty list = any domain).
  const domains: string[] = Array.isArray(reg.allowedDomains) ? reg.allowedDomains : [];
  if (domains.length > 0) {
    const domain = email.split('@')[1] ?? '';
    if (!domains.some((d) => d.toLowerCase() === domain.toLowerCase())) {
      return {
        ok: false,
        status: 403,
        error: `Registration is limited to ${domains.join(', ')} email addresses`,
      };
    }
  }

  // Password policy (from the security group).
  const minLength = Number(sec.passwordMinLength) || 8;
  const password = String(attempt.password ?? '');
  if (password.length < minLength) {
    return { ok: false, status: 400, error: `Password must be at least ${minLength} characters` };
  }
  if (sec.passwordRequireComplexity) {
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { ok: false, status: 400, error: 'Password must contain upper and lower case letters and a number' };
    }
  }

  // Invite-only mode: an invite code must be present and valid. The default
  // dev invite code is empty when inviteOnly is off; when on, the configured
  // code must match (placeholder until invites are per-user).
  if (reg.inviteOnly) {
    const code = String(attempt.inviteCode ?? '').trim();
    const expected = String(reg.inviteCode ?? process.env.INVITE_CODE ?? 'medicology').trim();
    if (!code || code !== expected) {
      return { ok: false, status: 403, error: 'An invite code is required to register' };
    }
  }

  return { ok: true, status: 200, verificationRequired: Boolean(settings.registration.requireEmailVerification) };
}
