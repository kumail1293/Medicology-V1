import { Router } from 'express';
import { db } from '../db.js';
import { questionFlagsTable, questionsTable, usersTable } from '@workspace/db';
import { eq, desc } from '../utils/drizzle.js';
import { authenticate, requireAdmin, requirePermission, AuthRequest } from '../middleware/auth.js';

export const flagsRouter = Router();

flagsRouter.post('/', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { questionId } = req.body;
    if (!questionId) {
      return res.status(400).json({ error: 'questionId required' });
    }
    const [flag] = await db.insert(questionFlagsTable).values({
      userId: req.user!.id,
      questionId: Number(questionId),
    }).returning();
    return res.status(201).json({ flag });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

flagsRouter.get('/', authenticate, requireAdmin, async (req, res: any) => {
  try {
    const flags = await db.select().from(questionFlagsTable).orderBy(desc(questionFlagsTable.createdAt));
    const flagsWithText = await Promise.all(flags.map(async (f: any) => {
      const [q] = await db.select({ questionText: questionsTable.questionText, subject: questionsTable.subject, topic: questionsTable.topic, qid: questionsTable.qid }).from(questionsTable).where(eq(questionsTable.id, f.questionId));
      const [u] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, f.userId));
      return {
        ...f,
        questionText: q?.questionText,
        questionSubject: q?.subject,
        questionTopic: q?.topic,
        questionQid: q?.qid,
        userName: u?.name ?? `User #${f.userId}`,
        userEmail: u?.email ?? null,
      };
    }));
    res.json({ flags: flagsWithText, total: flagsWithText.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

flagsRouter.delete('/:id', authenticate, requireAdmin, requirePermission('flags.manage'), async (req, res: any) => {
  try {
    await db.delete(questionFlagsTable).where(eq(questionFlagsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
