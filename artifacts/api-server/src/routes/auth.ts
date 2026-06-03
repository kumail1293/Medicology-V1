import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { usersTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';

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
    return res.status(201).json({ token, user: { ...user, passwordHash: undefined } });
  } catch (err: any) {
    console.error('Error in register:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Login
authRouter.post('/login', async (req, res: any) => {
  console.log('Login route called with:', req.body);
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
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Error in change password:', err);
    return res.status(500).json({ error: err.message });
  }
});
