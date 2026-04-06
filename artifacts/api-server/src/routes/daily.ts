import { Router } from 'express';
import { db } from '../db.js';
import { dailyChallengeTable, questionsTable } from '@workspace/db';
import { eq, sql, and } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const dailyRouter = Router();

dailyRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await db.select().from(dailyChallengeTable).where(and(eq(dailyChallengeTable.userId, req.user!.id), eq(dailyChallengeTable.date, today)));
    const questions = await db.select().from(questionsTable).orderBy(sql`RANDOM()`).limit(10);
    if (existing.length > 0) {
      return res.json({ challenge: existing[0], questions });
    }
    const [challenge] = await db.insert(dailyChallengeTable).values({
      userId: req.user!.id,
      date: today,
      isCompleted: false,
      streak: 0,
    }).returning();
    return res.json({ challenge, questions });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

dailyRouter.get('/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [challenge] = await db.select().from(dailyChallengeTable).where(and(eq(dailyChallengeTable.userId, req.user!.id), eq(dailyChallengeTable.date, today)));
    res.json({ completed: challenge?.isCompleted || false, date: today });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});