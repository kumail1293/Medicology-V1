import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// Register
authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password, college, university, year } = req.body;
    if (!name || !email || !password || !college || !year) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      name, email, passwordHash, college, university, year: Number(year),
    }).returning();
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role });
    return res.status(201).json({ token, user: { ...user, passwordHash: undefined } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role });
    return res.json({ token, user: { ...user, passwordHash: undefined } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get current user
authRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ ...user, passwordHash: undefined });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update profile
authRouter.put('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, email, college, university, year } = req.body;
    const [user] = await db.update(usersTable)
      .set({ name, email, college, university, year: Number(year) })
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin, role: user.role });
    return res.json({ token, user: { ...user, passwordHash: undefined } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Change password
authRouter.put('/me/password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password incorrect' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.user!.id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});