import { Router } from 'express';
import { db } from '../db.js';
import { testSessionsTable, questionsTable } from '@workspace/db';
import { eq, and, inArray, sql } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const sessionsRouter = Router();

// Create session
sessionsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      mode = 'tutor', subject, topic, difficulty,
      universityTag, examType, limit = 20,
      questionIds
    } = req.body;

    let finalQuestionIds = questionIds;

    if (!finalQuestionIds) {
      const conditions: any[] = [];
      if (subject) conditions.push(eq(questionsTable.subject, subject));
      if (topic) conditions.push(eq(questionsTable.topic, topic));
      if (difficulty) conditions.push(eq(questionsTable.difficulty, difficulty));
      if (universityTag) conditions.push(eq(questionsTable.universityTag, universityTag));
      if (examType) conditions.push(eq(questionsTable.examType, examType));

      const questions = await db.select({ id: questionsTable.id })
        .from(questionsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`RANDOM()`)
        .limit(Number(limit));

      finalQuestionIds = questions.map((q: any) => q.id);
    }

    const [session] = await db.insert(testSessionsTable).values({
      userId: req.user!.id,
      mode,
      questionIds: finalQuestionIds,
      currentIndex: 0,
      answers: {},
      status: 'active',
    }).returning();

    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get session by ID
sessionsRouter.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const [session] = await db.select().from(testSessionsTable)
      .where(and(
        eq(testSessionsTable.id, Number(req.params.id)),
        eq(testSessionsTable.userId, req.user!.id)
      ));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const questions = await db.select().from(questionsTable)
      .where(inArray(questionsTable.id, session.questionIds as number[]));

    const orderedQuestions = (session.questionIds as number[]).map((id: number) =>
      questions.find((q: any) => q.id === id)
    ).filter(Boolean);

    return res.json({ session, questions: orderedQuestions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update session (save progress)
sessionsRouter.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { answers, currentIndex, status, totalCorrect } = req.body;
    const [session] = await db.update(testSessionsTable)
      .set({ answers, currentIndex, status, totalCorrect })
      .where(and(
        eq(testSessionsTable.id, Number(req.params.id)),
        eq(testSessionsTable.userId, req.user!.id)
      ))
      .returning();
    return res.json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// List user sessions
sessionsRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const sessions = await db.select().from(testSessionsTable)
      .where(eq(testSessionsTable.userId, req.user!.id))
      .orderBy(testSessionsTable.createdAt);
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create session (alternative endpoint)
sessionsRouter.post('/create', authenticate, async (req: AuthRequest, res) => {
  try {
    const { questionIds, mode = 'tutor' } = req.body;
    const [session] = await db.insert(testSessionsTable).values({
      userId: req.user!.id,
      mode,
      questionIds: questionIds || [],
      currentIndex: 0,
      answers: {},
      status: 'active',
    }).returning();
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});