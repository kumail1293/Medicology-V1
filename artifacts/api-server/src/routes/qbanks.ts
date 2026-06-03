import { Router } from 'express';
import { db } from '../db.js';
import { qbankPurchasesTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const qbanksRouter = Router();

const QBANKS = [
  { id: 'mbbs', label: 'MBBS', flag: '🇵🇰', subtitle: 'Any University · Any Year', prices: { oneMonth: 299, sixMonths: 1299, oneYear: 1999, twoYears: 2999 }, currency: 'PKR', currencySymbol: 'Rs.' },
  { id: 'usmle', label: 'USMLE', flag: '🇺🇸', subtitle: 'Step 1 · Step 2 CK · Step 3', prices: { oneMonth: 499, sixMonths: 1999, oneYear: 2999, twoYears: 4999 }, currency: 'PKR', currencySymbol: 'Rs.' },
  { id: 'plab', label: 'PLAB', flag: '🇬🇧', subtitle: 'PLAB 1 · PLAB 2', prices: { oneMonth: 499, sixMonths: 1999, oneYear: 2999, twoYears: 4999 }, currency: 'PKR', currencySymbol: 'Rs.' },
  { id: 'amc', label: 'AMC', flag: '🇦🇺', subtitle: 'CAT · Clinical Exam', prices: { oneMonth: 499, sixMonths: 1999, oneYear: 2999, twoYears: 4999 }, currency: 'PKR', currencySymbol: 'Rs.' },
  { id: 'fcps', label: 'FCPS', flag: '🇵🇰', subtitle: 'Part 1 · Part 2 · Fellowship', prices: { oneMonth: 399, sixMonths: 1499, oneYear: 2499, twoYears: 3999 }, currency: 'PKR', currencySymbol: 'Rs.' },
  { id: 'nle', label: 'NLE', flag: '🇵🇰', subtitle: 'NLE-1 · NLE-2', prices: { oneMonth: 299, sixMonths: 1299, oneYear: 1999, twoYears: 2999 }, currency: 'PKR', currencySymbol: 'Rs.' },
];

// Get all qbanks with purchase status
qbanksRouter.get('/', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const purchases = await db.select().from(qbankPurchasesTable)
      .where(eq(qbankPurchasesTable.userId, req.user!.id));
    const now = new Date();
    const catalogue = QBANKS.map(qb => {
      const purchase = purchases.find((p: any) =>
        p.qbankType === qb.id &&
        p.status === 'active' &&
        (!p.expiresAt || new Date(p.expiresAt) > now)
      );
      return { ...qb, purchased: !!purchase, expiresAt: purchase?.expiresAt || null };
    });
    res.json({ catalogue, purchasedCount: purchases.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Get pricing config
qbanksRouter.get('/pricing', async (req, res: any) => {
  try {
    res.json({ plans: QBANKS });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Get my purchases
qbanksRouter.get('/my', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const purchases = await db.select().from(qbankPurchasesTable)
      .where(eq(qbankPurchasesTable.userId, req.user!.id));
    res.json({ purchases });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Purchase qbank
qbanksRouter.post('/purchase', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { qbankId, duration } = req.body;
    const durationMap: Record<string, number> = {
      '1month': 30, '6months': 180, '1year': 365, '2years': 730,
    };
    const days = durationMap[duration] || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    const [purchase] = await db.insert(qbankPurchasesTable).values({
      userId: req.user!.id,
      qbankType: qbankId,
      expiresAt,
      status: 'active',
    }).returning();
    res.status(201).json({ purchase });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
