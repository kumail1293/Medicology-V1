import { Router } from 'express';
import { db } from '../db.js';
import { testSessionsTable, questionsTable } from '@workspace/db';
import { eq, and, inArray, sql } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { findQbankBySlug, hasActiveEntitlement } from '../utils/entitlements.js';

export const sessionsRouter = Router();

// Create session
sessionsRouter.post('/', authenticate, async (req: AuthRequest, res: any) => {
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
sessionsRouter.get('/:id', authenticate, async (req: AuthRequest, res: any) => {
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
sessionsRouter.put('/:id', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { answers, currentIndex, status, totalCorrect, flaggedQuestions, totalTime } = req.body;
    const [session] = await db.update(testSessionsTable)
      .set({
        answers,
        currentIndex,
        status,
        totalCorrect,
        flaggedQuestions,
        totalTime,
      })
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
sessionsRouter.get('/', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const sessions = await db.select().from(testSessionsTable)
      .where(eq(testSessionsTable.userId, req.user!.id))
      .orderBy(testSessionsTable.createdAt);
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create session (used by Create Test wizard + Daily Challenge)
// Accepts either explicit questionIds/specificQuestionIds, or filter params
// (subjects/systems/difficulty/universityTag/examType + questionCount) from
// which matching questions are selected server-side.
sessionsRouter.post('/create', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const {
      questionIds, specificQuestionIds,
      subjects, systems, questionCount = 20, mode = 'tutor',
      difficulty, universityTag, examType,
      title, blockSize, durationSeconds, questionFilter, qbankSlug,
    } = req.body;

    // Server-side entitlement gate for QBank-scoped sessions. Learners can only
    // start a paid QBank session with an active entitlement (admins bypass).
    if (qbankSlug) {
      const qbank = await findQbankBySlug(qbankSlug);
      if (!qbank) return res.status(404).json({ error: 'QBank not found' });
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
      if (!isAdmin && (qbank.status === 'available' || qbank.status === 'beta')) {
        const hasAccess = await hasActiveEntitlement(req.user!.id, qbank.id);
        if (!hasAccess) {
          return res.status(403).json({ error: 'This QBank requires an active subscription', code: 'QBANK_LOCKED' });
        }
      }
    }

    let finalQuestionIds: number[] = questionIds || specificQuestionIds || [];

    if (finalQuestionIds.length === 0) {
      const conditions: any[] = [];
      if (Array.isArray(subjects) && subjects.length > 0) {
        conditions.push(inArray(questionsTable.subject, subjects));
      }
      if (Array.isArray(systems) && systems.length > 0) {
        conditions.push(inArray(questionsTable.system, systems));
      }
      if (difficulty) conditions.push(eq(questionsTable.difficulty, difficulty));
      if (universityTag) conditions.push(eq(questionsTable.universityTag, universityTag));
      if (examType) conditions.push(eq(questionsTable.examType, examType));

      const questions = await db.select({ id: questionsTable.id })
        .from(questionsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`RANDOM()`)
        .limit(Number(questionCount));

      finalQuestionIds = questions.map((q: any) => q.id);
    }

    const [session] = await db.insert(testSessionsTable).values({
      userId: req.user!.id,
      mode,
      title: title || null,
      blockSize: blockSize || null,
      durationSeconds: durationSeconds || null,
      questionFilter: questionFilter || 'all',
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
