import { Router } from 'express';
import { db } from '../db.js';
import { bookmarksTable, questionsTable } from '@workspace/db';
import { eq, and } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const bookmarksRouter = Router();

// Get bookmarks
bookmarksRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const bookmarks = await db.select().from(bookmarksTable)
      .where(eq(bookmarksTable.userId, req.user!.id));
    const questions = await Promise.all(
      bookmarks.map((b: any) => db.select().from(questionsTable)
        .where(eq(questionsTable.id, b.questionId)).then((r: any[]) => r[0]))
    );
    res.json({ bookmarks: questions.filter(Boolean) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Add bookmark
bookmarksRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { questionId } = req.body;
    await db.insert(bookmarksTable).values({ userId: req.user!.id, questionId }).onConflictDoNothing();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Remove bookmark
bookmarksRouter.delete('/:questionId', authenticate, async (req: AuthRequest, res) => {
  try {
    await db.delete(bookmarksTable).where(and(
      eq(bookmarksTable.userId, req.user!.id),
      eq(bookmarksTable.questionId, Number(req.params.questionId))
    ));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});