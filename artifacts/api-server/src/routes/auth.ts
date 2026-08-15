import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { usersTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { checkRegistrationPolicy } from '../utils/registration-policy.js';
import { createSession, listSessions, revokeSession, revokeAllSessions, loginHistory } from '../utils/sessions.js';
import { queueTransactional } from '../utils/transactional-email.js';
import { securityEventsTable, passwordResetTokensTable, userProgressTable, testSessionsTable, dailyChallengeTable } from '@workspace/db';

export const authRouter = Router();

// Register
authRouter.post('/register', async (req, res: any) => {
  try {
    const { name, email, password, college, university, year } = req.body;
    if (!name || !email || !password || !college || !year) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    let parsedYear = year;
    if (typeof year === 'string' && year.startsWith('Year ')) {
      parsedYear = Number(year.split(' ')[1]);
    } else {
      parsedYear = Number(year);
    }
    if (isNaN(parsedYear)) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    console.log('Register attempt:', { name, email: normalizedEmail, college, university, year: parsedYear });

    // Server-side registration policy (P0.20) — never trust the frontend.
    const policy = await checkRegistrationPolicy({ email: normalizedEmail, password, inviteCode: req.body.inviteCode });
    if (!policy.ok) {
      return res.status(policy.status).json({ error: policy.error });
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      college: String(college).trim(),
      university: university ? String(university).trim() : null,
      year: parsedYear,
      isAdmin: false,
      role: 'user',
    }).returning();
    console.log('User created:', user);
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role, userType: (user as any).userType ?? 'student' });
    await createSession({ userId: user.id, token, userAgent: req.headers['user-agent'], ip: req.ip });

    // Welcome email (transactional, best-effort) + verification email when
    // the platform requires email verification.
    queueTransactional({
      to: user.email,
      slug: 'welcome',
      userId: user.id,
      data: {
        'user.firstName': String(user.name).split(' ')[0],
        'user.name': user.name,
        'platform.name': 'Medicology',
        'platform.siteUrl': process.env.APP_BASE_URL || 'https://medicology.net',
        'platform.supportEmail': 'support@medicology.net',
        'currentDate': new Date().toLocaleDateString(),
      },
    });
    if (policy.verificationRequired) {
      queueTransactional({
        to: user.email,
        slug: 'email_verification',
        userId: user.id,
        data: {
          'user.firstName': String(user.name).split(' ')[0],
          'user.email': user.email,
          'verificationUrl': `${process.env.APP_BASE_URL || 'https://medicology.net'}/verify-email?userId=${user.id}`,
          'platform.name': 'Medicology',
        },
      });
    }

    return res.status(201).json({ token, user: { ...user, passwordHash: undefined } });
  } catch (err: any) {
    console.error('Error in register:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Login
authRouter.post('/login', async (req, res: any) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log('Login attempt for:', normalizedEmail, 'user found:', !!user, 'password valid:', valid);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role, userType: (user as any).userType ?? 'student' });
    await createSession({ userId: user.id, token, userAgent: req.headers['user-agent'], ip: req.ip });
    return res.json({ token, user: { ...user, passwordHash: undefined } });
  } catch (err: any) {
    console.error('Error in login:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get current user
authRouter.get('/me', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ ...user, passwordHash: undefined });
  } catch (err: any) {
    console.error('Error in get me:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update profile
authRouter.put('/me', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { name, email, college, university, year, bio, phone } = req.body;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;
    const [user] = await db.update(usersTable)
      .set({
        name: name ? String(name).trim() : undefined,
        email: normalizedEmail,
        college: college ? String(college).trim() : undefined,
        university: university !== undefined ? (university ? String(university).trim() : null) : undefined,
        year: year !== undefined ? Number(year) : undefined,
        bio: bio !== undefined ? (bio ? String(bio).trim() : null) : undefined,
        phone: phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
      })
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role, userType: (user as any).userType ?? 'student' });
    return res.json({ token, user: { ...user, passwordHash: undefined } });
  } catch (err: any) {
    console.error('Error in update profile:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Change password
authRouter.put('/me/password', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password incorrect' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.user!.id));
    // Changing the password is a security event; keep other devices signed in.
    try {
      await db.insert(securityEventsTable).values({ userId: req.user!.id, type: 'password_change', userAgent: req.headers['user-agent'] ?? null, metadata: { ip: req.ip ?? null } });
    } catch { /* best-effort */ }
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Error in change password:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Password reset — implements the endpoints the frontend already calls.
// The reset link is emailed via the password_reset template.
// ---------------------------------------------------------------------------

// POST /api/auth/forgot-password
async function generateResetToken(userId: number): Promise<string> {
  const { randomBytes } = await import('node:crypto');
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
  await db.insert(passwordResetTokensTable).values({ userId, token, expiresAt });
  return token;
}

authRouter.post('/forgot-password', async (req: any, res: any) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      // Never reveal whether an account exists.
      return res.json({ success: true });
    }
    const token = await generateResetToken(user.id);
    const baseUrl = process.env.APP_BASE_URL || 'https://medicology.net';
    queueTransactional({
      to: user.email,
      slug: 'password_reset',
      userId: user.id,
      data: {
        'user.firstName': String(user.name).split(' ')[0],
        'user.email': user.email,
        'resetUrl': `${baseUrl}/reset-password?token=${token}`,
        'platform.name': 'Medicology',
        'platform.supportEmail': 'support@medicology.net',
      },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password
async function resetPassword(req: any, res: any) {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
  if (String(newPassword).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const [row] = await db.select().from(passwordResetTokensTable).where(eq(passwordResetTokensTable.token, token));
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });
  const rt = row as typeof passwordResetTokensTable.$inferSelect;
  if (rt.used) return res.status(400).json({ error: 'This reset link has already been used' });
  if (new Date(rt.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'This reset link has expired — please request a new one' });
  }
  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, rt.userId));
  await db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, rt.id));
  // Revoke every session so old tokens die.
  const { revokeAllSessions: revokeAll } = await import('../utils/sessions.js');
  await revokeAll(rt.userId);
  try {
    await db.insert(securityEventsTable).values({ userId: rt.userId, type: 'password_reset', userAgent: req.headers['user-agent'] ?? null, metadata: { ip: req.ip ?? null } });
  } catch { /* best-effort */ }
  res.json({ success: true });
}

authRouter.post('/reset-password', resetPassword);

// ---------------------------------------------------------------------------
// Account settings (P0.19) — sessions, security history, prefs, data export,
// account deletion. All endpoints require authentication and only ever touch
// the caller's own account.
// ---------------------------------------------------------------------------

// GET /api/auth/me/sessions — active sessions on this account
authRouter.get('/me/sessions', authenticate, async (req: any, res: any) => {
  try {
    const sessions = await listSessions(req.user!.id);
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/me/sessions/:id — revoke one device
authRouter.delete('/me/sessions/:id', authenticate, async (req: any, res: any) => {
  try {
    const ok = await revokeSession(req.user!.id, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/me/sessions — revoke all devices
authRouter.delete('/me/sessions', authenticate, async (req: any, res: any) => {
  try {
    const { tokenHash } = await import('../utils/sessions.js');
    const header = req.headers.authorization ?? '';
    const current = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
    const count = await revokeAllSessions(req.user!.id, current ? tokenHash(current) : undefined);
    res.json({ success: true, revoked: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me/security-events — login history
authRouter.get('/me/security-events', authenticate, async (req: any, res: any) => {
  try {
    const events = await loginHistory(req.user!.id);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/me/notification-prefs
authRouter.put('/me/notification-prefs', authenticate, async (req: any, res: any) => {
  try {
    const prefs = req.body?.prefs ?? req.body;
    if (!prefs || typeof prefs !== 'object') {
      return res.status(400).json({ error: 'prefs object required' });
    }
    await db.update(usersTable).set({ notificationPrefs: prefs }).where(eq(usersTable.id, req.user!.id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    res.json({ prefs: user.notificationPrefs ?? {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me/aim — the student's current study aim (Amboss-style goal
// for the active subscription).
authRouter.get('/me/aim', authenticate, async (req: any, res: any) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ aim: user.studyAim ?? {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/me/aim — set a new study aim. Changing the aim resets all
// progress (sessions, per-question progress, daily challenges) so the student
// starts fresh under the new goal — like AMBOSS switching your target exam.
authRouter.put('/me/aim', authenticate, async (req: any, res: any) => {
  try {
    const { targetExam, targetQbankId, targetDate, dailyQuestions, weeklyGoal } = req.body ?? {};
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const prev = user.studyAim ?? {};
    const next = {
      targetExam: targetExam !== undefined ? String(targetExam) : prev.targetExam,
      targetQbankId: targetQbankId !== undefined ? Number(targetQbankId) || undefined : prev.targetQbankId,
      targetDate: targetDate !== undefined ? String(targetDate) : prev.targetDate,
      dailyQuestions: dailyQuestions !== undefined ? Number(dailyQuestions) || undefined : prev.dailyQuestions,
      weeklyGoal: weeklyGoal !== undefined ? Number(weeklyGoal) || undefined : prev.weeklyGoal,
      setAt: new Date().toISOString(),
    };

    const changed =
      next.targetExam !== prev.targetExam ||
      next.targetQbankId !== prev.targetQbankId ||
      next.targetDate !== prev.targetDate ||
      next.dailyQuestions !== prev.dailyQuestions ||
      next.weeklyGoal !== prev.weeklyGoal;

    await db.update(usersTable).set({ studyAim: next }).where(eq(usersTable.id, req.user!.id));

    // Fresh start: clear progress when the aim actually changes.
    let progressReset = false;
    if (changed && Object.keys(prev).length > 0) {
      await db.delete(userProgressTable).where(eq(userProgressTable.userId, user.id));
      await db.delete(testSessionsTable).where(eq(testSessionsTable.userId, user.id));
      await db.delete(dailyChallengeTable).where(eq(dailyChallengeTable.userId, user.id));
      progressReset = true;
    }

    res.json({ aim: next, progressReset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me/data — personal data export (JSON). No secrets included.
authRouter.get('/me/data', authenticate, async (req: any, res: any) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const safe = {
      profile: { name: user.name, email: user.email, college: user.college, university: user.university, year: user.year, createdAt: user.createdAt },
      preferences: user.notificationPrefs ?? {},
      sessions: await listSessions(user.id),
      loginHistory: await loginHistory(user.id, 50),
    };
    res.setHeader('Content-Disposition', `attachment; filename="medicology-data-${user.id}.json"`);
    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/me — delete account (anonymizes, never leaks PII to new
// registrations, and revokes every session).
authRouter.delete('/me', authenticate, async (req: any, res: any) => {
  try {
    const userId = req.user!.id;
    await revokeAllSessions(userId);
    const deletedEmail = `deleted-${userId}-${Date.now()}@deleted.medicology.local`;
    await db.update(usersTable).set({
      name: 'Deleted User',
      email: deletedEmail,
      college: 'Deleted',
      university: null,
      notificationPrefs: {},
      deletedAt: new Date(),
    }).where(eq(usersTable.id, userId));
    try {
      await db.insert(securityEventsTable).values({ userId, type: 'account_deleted', userAgent: req.headers['user-agent'] ?? null, metadata: { ip: req.ip ?? null } });
    } catch { /* best-effort */ }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
