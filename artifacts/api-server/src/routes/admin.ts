import { Router } from 'express';
import { db } from '../db.js';
import { questionsTable, usersTable, userProgressTable } from '@workspace/db';
import { eq, ilike, and, or, sql } from '../utils/drizzle.js';
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
adminRouter.get('/stats', async (req: AuthRequest, res: any) => {
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
    console.error('Error in admin stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get questions
adminRouter.get(
  '/questions',
  validateQuery(getQuestionsQuerySchema),
  async (req: any, res: any) => {
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
      console.error('Error in admin get questions:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Create question
adminRouter.post(
  '/questions',
  validateBody(createQuestionSchema),
  async (req: any, res: any) => {
    try {
      const data = req.validatedBody as CreateQuestion;
      const [question] = await db.insert(questionsTable).values(data).returning();
      res.status(201).json(question);
    } catch (err: any) {
      console.error('Error in admin create question:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Update question
adminRouter.put(
  '/questions/:id',
  validateParams(questionIdParamSchema),
  validateBody(updateQuestionSchema),
  async (req: any, res: any) => {
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
      console.error('Error in admin update question:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// Delete question
adminRouter.delete(
  '/questions/:id',
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      await db.delete(questionsTable).where(eq(questionsTable.id, id));
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error in admin delete question:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Check duplicates
adminRouter.get('/questions/duplicates', async (req: AuthRequest, res: any) => {
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
    console.error('Error in admin check duplicates:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete user
adminRouter.delete(
  '/users/:id',
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      await db.delete(usersTable).where(eq(usersTable.id, id));
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error in admin delete user:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Reset user password
adminRouter.post(
  '/users/:id/reset-password',
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const bcrypt = await import('bcryptjs');
      const { newPassword } = req.body;
      const { id } = req.validatedParams as { id: number };
      const passwordHash = await bcrypt.default.hash(newPassword, 10);
      await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error in admin reset password:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Get all users (with pagination and search)
adminRouter.get('/users', async (req: any, res: any) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';

    const conditions: any[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(usersTable.name, `%${search}%`),
          ilike(usersTable.email, `%${search}%`),
          ilike(usersTable.college, `%${search}%`)
        )
      );
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(usersTable.id);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      users: users.map((u) => ({
        ...u,
        passwordHash: undefined, // Don't send password hashes
      })),
      total: Number(count),
    });
  } catch (err: any) {
    console.error('Error in admin get users:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single user
adminRouter.get(
  '/users/:id',
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        ...user,
        passwordHash: undefined,
      });
    } catch (err: any) {
      console.error('Error in admin get user:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// Create user
adminRouter.post('/users', async (req: any, res: any) => {
  try {
    const bcrypt = await import('bcryptjs');
    const { name, email, password, college, university, year, role } = req.body;

    if (!name || !email || !password || !college || !year) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const passwordHash = await bcrypt.default.hash(password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        email,
        passwordHash,
        college,
        university: university || null,
        year,
        role: role || 'user',
        isAdmin: role === 'admin' || role === 'superadmin',
      })
      .returning();

    res.status(201).json({
      ...user,
      passwordHash: undefined,
    });
  } catch (err: any) {
    console.error('Error in admin create user:', err);
    if (err.message.includes('unique')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update user
adminRouter.put(
  '/users/:id',
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const { name, email, college, university, year, role } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (college !== undefined) updateData.college = college;
      if (university !== undefined) updateData.university = university;
      if (year !== undefined) updateData.year = year;
      if (role !== undefined) {
        updateData.role = role;
        updateData.isAdmin = role === 'admin' || role === 'superadmin';
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const [user] = await db
        .update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, id))
        .returning();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        ...user,
        passwordHash: undefined,
      });
    } catch (err: any) {
      console.error('Error in admin update user:', err);
      if (err.message.includes('unique')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
  }
);

