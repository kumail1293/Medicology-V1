import { Router } from 'express';
import { db } from '../db.js';
import { dailyChallengeTable, questionsTable } from '@workspace/db';
import { eq, sql, and, desc } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireFeature } from '../utils/feature-flags.js';

export const dailyRouter = Router();

dailyRouter.use(requireFeature('dailyChallenge'));

/** Compute the current streak from the user's challenge history. */
async function computeStreak(userId: number): Promise<number> {
  const history = await db
    .select({ date: dailyChallengeTable.date, isCompleted: dailyChallengeTable.isCompleted })
    .from(dailyChallengeTable)
    .where(eq(dailyChallengeTable.userId, userId))
    .orderBy(desc(dailyChallengeTable.date));
  const completedDates = new Set(
    history.filter((c: any) => c.isCompleted).map((c: any) => c.date)
  );
  let streak = 0;
  const cursor = new Date();
  // If today isn't completed yet, start counting from yesterday so an active
  // streak isn't broken by not having played today yet.
  const today = cursor.toISOString().split('T')[0];
  if (!completedDates.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (!completedDates.has(dateStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

dailyRouter.get('/', authenticate, async (req: AuthRequest, res: any) => {
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

/**
 * Client-facing daily challenge — the shape the app's generated client
 * expects (DailyChallengeResponse): `{ questions, date, isCompleted, streak }`.
 */
dailyRouter.get('/challenge', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await db.select().from(dailyChallengeTable).where(and(eq(dailyChallengeTable.userId, req.user!.id), eq(dailyChallengeTable.date, today)));
    const questions = await db.select().from(questionsTable).orderBy(sql`RANDOM()`).limit(10);
    let challenge = existing[0];
    if (!challenge) {
      [challenge] = await db.insert(dailyChallengeTable).values({
        userId: req.user!.id,
        date: today,
        isCompleted: false,
        streak: 0,
      }).returning();
    }
    const streak = await computeStreak(req.user!.id);
    return res.json({
      questions,
      date: today,
      isCompleted: challenge.isCompleted,
      streak,
    });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

dailyRouter.get('/status', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [challenge] = await db.select().from(dailyChallengeTable).where(and(eq(dailyChallengeTable.userId, req.user!.id), eq(dailyChallengeTable.date, today)));
    res.json({ completed: challenge?.isCompleted || false, date: today });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
