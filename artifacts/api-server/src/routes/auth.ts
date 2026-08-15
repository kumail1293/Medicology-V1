import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { usersTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { checkRegistrationPolicy } from '../utils/registration-policy.js';
import { createSession, listSessions, revokeSession, revokeAllSessions, loginHistory } from '../utils/sessions.js';
import { securityEventsTable } from '@workspace/db';

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
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role });
    await createSession({ userId: user.id, token, userAgent: req.headers['user-agent'], ip: req.ip });
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
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role });
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
    const { name, email, college, university, year } = req.body;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;
    const [user] = await db.update(usersTable)
      .set({
        name: name ? String(name).trim() : undefined,
        email: normalizedEmail,
        college: college ? String(college).trim() : undefined,
        university: university !== undefined ? (university ? String(university).trim() : null) : undefined,
        year: year !== undefined ? Number(year) : undefined,
      })
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role });
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
