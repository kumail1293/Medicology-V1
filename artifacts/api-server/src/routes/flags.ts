import { Router } from 'express';
import { db } from '../db.js';
import { questionFlagsTable, questionsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const flagsRouter = Router();

flagsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
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

flagsRouter.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const flags = await db.select().from(questionFlagsTable).orderBy(questionFlagsTable.createdAt);
    const flagsWithText = await Promise.all(flags.map(async f => {
      const [q] = await db.select({ questionText: questionsTable.questionText }).from(questionsTable).where(eq(questionsTable.id, f.questionId));
      return { ...f, questionText: q?.questionText, userName: `User #${f.userId}` };
    }));
    res.json({ flags: flagsWithText, total: flagsWithText.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

flagsRouter.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.delete(questionFlagsTable).where(eq(questionFlagsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});