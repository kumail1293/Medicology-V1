import { Router } from 'express';
import { db } from '../db.js';
import { errataTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const errataRouter = Router();

// Submit errata
errataRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { questionId, errorType, description, correction, referenceUrl } = req.body;
    if (!questionId || !description) {
      return res.status(400).json({ error: 'questionId and description required' });
    }
    const [errata] = await db.insert(errataTable).values({
      userId: req.user!.id,
      questionId: Number(questionId),
      errorType: errorType || 'other',
      description,
      correction,
      referenceUrl,
      status: 'pending',
    }).returning();
    return res.status(201).json({ errata });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Get my errata
errataRouter.get('/my', authenticate, async (req: AuthRequest, res) => {
  try {
    const errata = await db.select().from(errataTable)
      .where(eq(errataTable.userId, req.user!.id));
    res.json({ errata });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Get all errata (admin)
errataRouter.get('/admin', authenticate, requireAdmin, async (req, res) => {
  try {
    const errata = await db.select().from(errataTable)
      .orderBy(errataTable.createdAt);
    res.json({ errata });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Review errata (admin)
errataRouter.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, adminNotes, rewardPoints } = req.body;
    const [errata] = await db.update(errataTable)
      .set({ status, adminNotes, rewardPoints })
      .where(eq(errataTable.id, Number(req.params.id)))
      .returning();
    res.json({ errata });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});