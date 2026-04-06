import { Router } from 'express';
import { db } from '../db.js';
import { notesTable } from '@workspace/db';
import { eq, and } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const notesRouter = Router();

notesRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const notes = await db.select().from(notesTable).where(eq(notesTable.userId, req.user!.id));
    res.json({ notes });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

notesRouter.get('/:questionId', authenticate, async (req: AuthRequest, res) => {
  try {
    const [note] = await db.select().from(notesTable).where(and(eq(notesTable.userId, req.user!.id), eq(notesTable.questionId, Number(req.params.questionId))));
    res.json({ note: note || null });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

notesRouter.put('/:questionId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body;
    const existing = await db.select().from(notesTable).where(and(eq(notesTable.userId, req.user!.id), eq(notesTable.questionId, Number(req.params.questionId))));
    if (existing.length > 0) {
      const [note] = await db.update(notesTable).set({ noteText: text }).where(and(eq(notesTable.userId, req.user!.id), eq(notesTable.questionId, Number(req.params.questionId)))).returning();
      res.json({ note });
    } else {
      const [note] = await db.insert(notesTable).values({ userId: req.user!.id, questionId: Number(req.params.questionId), noteText: text }).returning();
      res.json({ note });
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});