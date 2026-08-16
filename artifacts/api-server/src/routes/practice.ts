import { Router } from 'express';
import { db } from '../db.js';
import { userProgressTable, questionsTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const practiceRouter = Router();

// Questions the user answered wrong (most recent attempt per question), for
// the Review Hub "Wrong Qs" tab. Supports subject/topic/limit filters.
practiceRouter.get('/wrong', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const { subject, topic, limit } = req.query as { subject?: string; topic?: string; limit?: string };
    const progress = await db.select().from(userProgressTable).where(eq(userProgressTable.userId, userId));

    // Keep the most recent attempt per question. The mock DB may not stamp
    // createdAt, so when timestamps are missing we rely on array order
    // (progress is insertion-ordered — later rows are newer attempts).
    const latestByQuestion = new Map<number, any>();
    for (const p of progress) {
      const prev = latestByQuestion.get(p.questionId);
      if (!prev) {
        latestByQuestion.set(p.questionId, p);
        continue;
      }
      const pTime = p.createdAt ? new Date(p.createdAt).getTime() : NaN;
      const prevTime = prev.createdAt ? new Date(prev.createdAt).getTime() : NaN;
      const pNewer = !Number.isNaN(pTime) && !Number.isNaN(prevTime) ? pTime >= prevTime : true;
      if (pNewer) latestByQuestion.set(p.questionId, p);
    }
    const wrongQuestionIds = Array.from(latestByQuestion.values())
      .filter((p: any) => !p.isCorrect)
      .map((p: any) => p.questionId);

    if (wrongQuestionIds.length === 0) {
      return res.json({ questions: [], total: 0, limit: limit ? Number(limit) : undefined });
    }

    let questions = await db.select().from(questionsTable).where(
      eq(questionsTable.id, wrongQuestionIds[0])
    );
    // Mock DB lacks inArray; fetch one by one (fine for a review list).
    for (let i = 1; i < wrongQuestionIds.length; i++) {
      const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, wrongQuestionIds[i]));
      if (q) questions = [...questions, q];
    }

    if (subject) questions = questions.filter((q: any) => q.subject === subject);
    if (topic) questions = questions.filter((q: any) => q.topic === topic);
    const total = questions.length;
    const lim = limit ? Number(limit) : undefined;
    if (lim && lim > 0) questions = questions.slice(0, lim);

    res.json({ questions, total, limit: lim });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

practiceRouter.post('/submit', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { questionId, selectedAnswer, timeTaken, mode } = req.body;
    if (!questionId || !selectedAnswer) {
      return res.status(400).json({ error: 'questionId and selectedAnswer required' });
    }
    const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, Number(questionId)));
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const isCorrect = question.correctAnswer === selectedAnswer;
    await db.insert(userProgressTable).values({
      userId: req.user!.id,
      questionId: Number(questionId),
      selectedAnswer,
      isCorrect,
      timeTaken: Number(timeTaken) || 0,
      mode: mode || 'practice',
    });
    return res.json({ isCorrect, correctAnswer: question.correctAnswer, explanation: question.explanation });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
