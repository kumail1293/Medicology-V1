import { Router } from 'express';
import { db } from '../db.js';
import { userProgressTable, questionsTable } from '@workspace/db';
import { eq, sql, and, desc } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const progressRouter = Router();

progressRouter.get('/analytics', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const allProgress = await db.select().from(userProgressTable).where(eq(userProgressTable.userId, userId));
    const totalAttempted = allProgress.length;
    const totalCorrect = allProgress.filter(p => p.isCorrect).length;
    const totalIncorrect = totalAttempted - totalCorrect;
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const avgTimeSeconds = totalAttempted > 0
      ? Math.round(allProgress.reduce((sum, p) => sum + (p.timeTaken || 0), 0) / totalAttempted) : 0;
    const [{ count: totalQuestions }] = await db.select({ count: sql<number>`count(*)` }).from(questionsTable);
    const usedQuestionIds = [...new Set(allProgress.map(p => p.questionId))];
    const usedQuestions = usedQuestionIds.length;
    const unusedQuestions = Number(totalQuestions) - usedQuestions;
    const percentUsed = Number(totalQuestions) > 0 ? Math.round((usedQuestions / Number(totalQuestions)) * 100) : 0;
    const subjectMap: Record<string, { total: number; correct: number }> = {};
    for (const p of allProgress) {
      const [q] = await db.select({ subject: questionsTable.subject }).from(questionsTable).where(eq(questionsTable.id, p.questionId));
      if (!q) continue;
      if (!subjectMap[q.subject]) subjectMap[q.subject] = { total: 0, correct: 0 };
      subjectMap[q.subject].total++;
      if (p.isCorrect) subjectMap[q.subject].correct++;
    }
    const subjectPerformance = Object.entries(subjectMap).map(([subject, data]) => ({
      subject, total: data.total, correct: data.correct,
      accuracy: Math.round((data.correct / data.total) * 100),
    }));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentProgress = allProgress.filter(p => new Date(p.createdAt) >= thirtyDaysAgo);
    const activityMap: Record<string, { count: number; correct: number }> = {};
    for (const p of recentProgress) {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      if (!activityMap[date]) activityMap[date] = { count: 0, correct: 0 };
      activityMap[date].count++;
      if (p.isCorrect) activityMap[date].correct++;
    }
    const recentActivity = Object.entries(activityMap).map(([date, data]) => ({ date, count: data.count, correct: data.correct })).sort((a, b) => a.date.localeCompare(b.date));
    let streakDays = 0;
    const checkDate = new Date();
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (activityMap[dateStr]) { streakDays++; checkDate.setDate(checkDate.getDate() - 1); } else break;
    }
    res.json({ totalAttempted, totalCorrect, totalIncorrect, accuracy, streakDays, totalQuestions: Number(totalQuestions), usedQuestions, unusedQuestions, percentUsed, avgTimeSeconds, testStats: { created: 0, completed: 0, suspended: 0 }, subjectPerformance, recentActivity });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

progressRouter.get('/wrong', authenticate, async (req: AuthRequest, res) => {
  try {
    const wrong = await db.select().from(userProgressTable).where(and(eq(userProgressTable.userId, req.user!.id), eq(userProgressTable.isCorrect, false))).orderBy(desc(userProgressTable.createdAt));
    res.json({ questions: wrong });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});