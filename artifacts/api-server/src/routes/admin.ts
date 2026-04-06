import { Router, Response } from 'express';
import { db } from '../db.js';
import { questionsTable, usersTable, userProgressTable } from '@workspace/db';
import { eq, ilike, and, or, sql } from 'drizzle-orm';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import {
  createQuestionSchema,
  updateQuestionSchema,
  getQuestionsQuerySchema,
  questionIdParamSchema,
} from './schemas.js';
import type { CreateQuestion, UpdateQuestion, GetQuestionsQuery } from './schemas.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

// Get stats
adminRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [{ totalQuestions }] = await db
      .select({ totalQuestions: sql<number>`count(*)` })
      .from(questionsTable);
    const [{ totalUsers }] = await db
      .select({ totalUsers: sql<number>`count(*)` })
      .from(usersTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ answersToday }] = await db
      .select({ answersToday: sql<number>`count(*)` })
      .from(userProgressTable)
      .where(sql`created_at >= ${today}`);

    res.json({
      totalQuestions: Number(totalQuestions),
      totalUsers: Number(totalUsers),
      answersToday: Number(answersToday),
      pendingFlags: 0,
      pendingErrata: 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get questions
adminRouter.get(
  '/questions',
  validateQuery(getQuestionsQuerySchema),
  async (req: any, res: Response) => {
    try {
      const query = req.validatedQuery as GetQuestionsQuery;
      const conditions: any[] = [];

      if (query.search) {
        conditions.push(
          or(
            ilike(questionsTable.questionText, `%${query.search}%`),
            ilike(questionsTable.subject, `%${query.search}%`)
          )
        );
      }

      if (query.difficulty) {
        conditions.push(eq(questionsTable.difficulty, query.difficulty));
      }

      const questions = await db
        .select()
        .from(questionsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(questionsTable.id);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(questionsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      res.json({ questions, total: Number(count) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Create question
adminRouter.post(
  '/questions',
  validateBody(createQuestionSchema),
  async (req: any, res: Response) => {
    try {
      const data = req.validatedBody as CreateQuestion;
      const [question] = await db.insert(questionsTable).values(data).returning();
      res.status(201).json(question);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Update question
adminRouter.put(
  '/questions/:id',
  validateParams(questionIdParamSchema),
  validateBody(updateQuestionSchema),
  async (req: any, res: Response) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const data = req.validatedBody as UpdateQuestion;

      const [question] = await db
        .update(questionsTable)
        .set(data)
        .where(eq(questionsTable.id, id))
        .returning();

      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      return res.json(question);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// Delete question
adminRouter.delete(
  '/questions/:id',
  validateParams(questionIdParamSchema),
  async (req: any, res: Response) => {
    try {
      const { id } = req.validatedParams as { id: number };
      await db.delete(questionsTable).where(eq(questionsTable.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Check duplicates
adminRouter.get('/questions/duplicates', async (req: AuthRequest, res: Response) => {
  try {
    const questions = await db
      .select()
      .from(questionsTable)
      .orderBy(questionsTable.questionText);

    const seen = new Map<string, typeof questions>();

    for (const q of questions) {
      const key = (q as any).questionText?.trim().toLowerCase().slice(0, 100) || '';
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key)!.push(q);
    }

    const groups = Array.from(seen.values())
      .filter((group) => group.length > 1)
      .map((questions) => ({ questions }));

    res.json({ groups });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
adminRouter.delete(
  '/users/:id',
  validateParams(questionIdParamSchema),
  async (req: any, res: Response) => {
    try {
      const { id } = req.validatedParams as { id: number };
      await db.delete(usersTable).where(eq(usersTable.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Reset user password
adminRouter.post(
  '/users/:id/reset-password',
  validateParams(questionIdParamSchema),
  async (req: any, res: Response) => {
    try {
      const bcrypt = await import('bcryptjs');
      const { newPassword } = req.body;
      const { id } = req.validatedParams as { id: number };
      const passwordHash = await bcrypt.default.hash(newPassword, 10);
      await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);