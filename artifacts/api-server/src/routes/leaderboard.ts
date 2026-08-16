import { Router } from 'express';
import { db } from '../db.js';
import { usersTable, userProgressTable, questionsTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const filter = String(req.query.filter || 'all');
    const university = String(req.query.university || '').trim();
    const subject = String(req.query.subject || '').trim();

    const allUsers = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      college: usersTable.college,
      university: usersTable.university,
      rewardPoints: usersTable.rewardPoints,
    }).from(usersTable);

    // Aggregate progress per user, optionally filtered by subject.
    const allProgress = await db.select({
      userId: userProgressTable.userId,
      questionId: userProgressTable.questionId,
      isCorrect: userProgressTable.isCorrect,
    }).from(userProgressTable);

    const subjectQids = new Set<number>();
    if (filter === 'subject' && subject) {
      const qs = await db.select({ id: questionsTable.id }).from(questionsTable)
        .where(eq(questionsTable.subject, subject));
      for (const q of qs) subjectQids.add(q.id);
    }

    const perUser = new Map<number, { solved: number; correct: number }>();
    for (const p of allProgress) {
      if (filter === 'subject' && subject && !subjectQids.has(p.questionId)) continue;
      if (filter === 'university' && university) {
        const u = allUsers.find((x: any) => x.id === p.userId);
        if (!u || (u.university || '') !== university) continue;
      }
      const entry = perUser.get(p.userId) || { solved: 0, correct: 0 };
      entry.solved++;
      if (p.isCorrect) entry.correct++;
      perUser.set(p.userId, entry);
    }

    const entries = allUsers
      .filter((u: any) => {
        const agg = perUser.get(u.id);
        if (!agg || agg.solved === 0) return false;
        if (filter === 'university' && university && (u.university || '') !== university) return false;
        return true;
      })
      .map((u: any) => {
        const agg = perUser.get(u.id)!;
        return {
          userId: u.id,
          name: u.name,
          college: u.college,
          university: u.university,
          accuracy: Math.round((agg.correct / agg.solved) * 1000) / 10,
          questionsSolved: agg.solved,
          rewardPoints: u.rewardPoints,
        };
      })
      .sort((a: any, b: any) => b.accuracy - a.accuracy || b.questionsSolved - a.questionsSolved || b.rewardPoints - a.rewardPoints)
      .slice(0, 50)
      .map((e: any, i: number) => ({ rank: i + 1, ...e }));

    res.json({ entries });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
