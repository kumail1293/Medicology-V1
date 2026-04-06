import { Router } from 'express';
import { db } from '../db.js';
import { studyBuddiesTable, usersTable } from '@workspace/db';
import { eq, or, and, ilike } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const buddiesRouter = Router();

// Get my buddies
buddiesRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const buddies = await db.select().from(studyBuddiesTable)
      .where(and(
        or(
          eq(studyBuddiesTable.requesterId, req.user!.id),
          eq(studyBuddiesTable.recipientId, req.user!.id)
        ),
        eq(studyBuddiesTable.status, 'accepted')
      ));

    const buddyUsers = await Promise.all(buddies.map(async b => {
      const otherId = b.requesterId === req.user!.id ? b.recipientId : b.requesterId;
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, otherId));
      return { ...user, passwordHash: undefined, buddyId: b.id };
    }));

    res.json({ buddies: buddyUsers });
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

// Search users
buddiesRouter.get('/search', authenticate, async (req: AuthRequest, res) => {
  try {
    const { q } = req.query as { q: string };
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }
    const users = await db.select().from(usersTable)
      .where(or(
        ilike(usersTable.name, `%${q}%`),
        ilike(usersTable.email, `%${q}%`)
      )).limit(10);
    return res.json({ users: users.map(u => ({ ...u, passwordHash: undefined })) });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Get pending requests
buddiesRouter.get('/requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const requests = await db.select().from(studyBuddiesTable)
      .where(and(
        eq(studyBuddiesTable.recipientId, req.user!.id),
        eq(studyBuddiesTable.status, 'pending')
      ));
    const withRequester = await Promise.all(requests.map(async r => {
      const [user] = await db.select().from(usersTable)
        .where(eq(usersTable.id, r.requesterId));
      return { ...r, requester: { ...user, passwordHash: undefined } };
    }));
    res.json({ requests: withRequester });
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

// Send buddy request
buddiesRouter.post('/request', authenticate, async (req: AuthRequest, res) => {
  try {
    const { recipientId } = req.body;
    const [existing] = await db.select().from(studyBuddiesTable)
      .where(or(
        and(eq(studyBuddiesTable.requesterId, req.user!.id), eq(studyBuddiesTable.recipientId, recipientId)),
        and(eq(studyBuddiesTable.requesterId, recipientId), eq(studyBuddiesTable.recipientId, req.user!.id))
      ));
    if (existing) {
      return res.status(400).json({ error: 'Request already exists' });
    }
    const [buddy] = await db.insert(studyBuddiesTable).values({
      requesterId: req.user!.id,
      recipientId: Number(recipientId),
      status: 'pending',
    }).returning();
    return res.status(201).json({ buddy });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// Respond to request
buddiesRouter.put('/:id/respond', authenticate, async (req: AuthRequest, res) => {
  try {
    const { action } = req.body;
    const status = action === 'accept' ? 'accepted' : 'rejected';
    const [buddy] = await db.update(studyBuddiesTable)
      .set({ status })
      .where(eq(studyBuddiesTable.id, Number(req.params.id)))
      .returning();
    res.json({ buddy });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Remove buddy
buddiesRouter.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await db.delete(studyBuddiesTable)
      .where(eq(studyBuddiesTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});