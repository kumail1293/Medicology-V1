import { Router } from 'express';
import { db } from '../db.js';
import {
  qbanksTable,
  qbankQuestionsTable,
  qbankUserSettingsTable,
  waitlistTable,
  entitlementsTable,
  countriesTable,
  examsTable,
  programsTable,
  academicYearsTable,
  examSystemsTable,
} from '@workspace/db';
import { eq, and } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  getEntitlementsForUser,
  hasActiveEntitlement,
  findQbankBySlug,
} from '../utils/entitlements.js';

export const qbanksRouter = Router();

const isEntitledStatus = (status: string) => ['active', 'beta', 'complimentary', 'scholarship', 'institutional'].includes(status);

// ---------------------------------------------------------------------------
// Catalogue helpers
// ---------------------------------------------------------------------------

async function loadTaxonomyLookups() {
  const [countries, exams, programs, years, examSystems] = await Promise.all([
    db.select().from(countriesTable),
    db.select().from(examsTable),
    db.select().from(programsTable),
    db.select().from(academicYearsTable),
    db.select().from(examSystemsTable),
  ]);
  const byId = (rows: any[]) => new Map(rows.map((r) => [Number(r.id), r]));
  return { countries: byId(countries), exams: byId(exams), programs: byId(programs), years: byId(years), examSystems: byId(examSystems) };
}

function describeQbank(qb: any, lookups: Awaited<ReturnType<typeof loadTaxonomyLookups>>) {
  const country = qb.countryId ? lookups.countries.get(Number(qb.countryId)) : undefined;
  const exam = qb.examId ? lookups.exams.get(Number(qb.examId)) : undefined;
  const program = qb.programId ? lookups.programs.get(Number(qb.programId)) : undefined;
  const year = qb.academicYearId ? lookups.years.get(Number(qb.academicYearId)) : undefined;
  const examSystem = qb.examSystemId ? lookups.examSystems.get(Number(qb.examSystemId)) : undefined;

  const parts = [program?.name, year?.name].filter(Boolean);
  const subtitle = parts.length > 0 ? parts.join(' · ') : (exam?.name ?? qb.name);

  return {
    id: qb.slug,
    slug: qb.slug,
    label: qb.name,
    subtitle,
    description: qb.description ?? '',
    price: qb.price ?? 0,
    currency: qb.currency,
    durationDays: qb.durationDays,
    accessType: qb.accessType,
    status: qb.status,
    questionCount: qb.questionCount,
    flag: country?.flag ?? null,
    country: country?.name ?? null,
    countryCode: country?.code ?? null,
    exam: exam?.name ?? null,
    examCode: exam?.code ?? null,
    examSystem: examSystem?.name ?? null,
    program: program?.name ?? null,
    year: year?.name ?? null,
  };
}

async function buildCatalogue(userId: number) {
  const [qbanks, entitlements, waitlist, lookups] = await Promise.all([
    db.select().from(qbanksTable),
    getEntitlementsForUser(userId),
    db.select().from(waitlistTable).where(eq(waitlistTable.userId, userId)),
    loadTaxonomyLookups(),
  ]);

  const now = Date.now();
  const entitled = new Set(
    entitlements
      .filter((e: any) => isEntitledStatus(e.status) && (!e.expiresAt || new Date(e.expiresAt).getTime() > now))
      .map((e: any) => Number(e.qbankId))
  );
  const waiting = new Set(waitlist.map((w: any) => Number(w.qbankId)));

  return qbanks
    .filter((qb: any) => qb.active && qb.status !== 'archived')
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    .map((qb: any) => ({
      ...describeQbank(qb, lookups),
      purchased: entitled.has(Number(qb.id)),
      notifyRegistered: waiting.has(Number(qb.id)),
    }));
}

// ---------------------------------------------------------------------------
// Catalogue / store endpoints
// ---------------------------------------------------------------------------

qbanksRouter.get('/', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const catalogue = await buildCatalogue(req.user!.id);
    res.json({ catalogue, purchasedCount: catalogue.filter((c) => c.purchased).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

qbanksRouter.get('/catalogue', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const catalogue = await buildCatalogue(req.user!.id);
    res.json({ catalogue, purchasedCount: catalogue.filter((c) => c.purchased).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pricing config (now database-driven; kept for backwards compatibility).
qbanksRouter.get('/pricing', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const qbanks = await db.select().from(qbanksTable).where(eq(qbanksTable.active, true));
    res.json({ plans: qbanks.map((qb) => ({ id: qb.slug, ...qb })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// My entitlements (raw).
qbanksRouter.get('/my', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const entitlements = await getEntitlementsForUser(req.user!.id);
    res.json({ entitlements });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Subscription page: active + expired entitlements enriched with QBank labels.
qbanksRouter.get('/subscription', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const [entitlements, qbanks, lookups] = await Promise.all([
      getEntitlementsForUser(req.user!.id),
      db.select().from(qbanksTable),
      loadTaxonomyLookups(),
    ]);
    const byId = new Map<number, any>(qbanks.map((qb: any) => [Number(qb.id), qb]));
    const now = new Date();

    const toItem = (e: any) => {
      const qb: any = byId.get(Number(e.qbankId));
      const desc = qb ? describeQbank(qb, lookups) : { label: `QBank #${e.qbankId}`, subtitle: '', price: 0, currency: 'PKR', accessType: 'subscription' };
      const expiresAt = e.expiresAt ? new Date(e.expiresAt) : null;
      const isExpired = !!expiresAt && expiresAt <= now;
      const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000)) : null;
      return {
        id: e.id,
        qbankType: qb?.slug ?? `qbank-${e.qbankId}`,
        label: desc.label,
        subtitle: desc.subtitle,
        qbankKind: desc.accessType ?? 'subscription',
        isUniversity: !!qb?.programId,
        status: e.status,
        purchasedAt: e.startAt,
        expiresAt: e.expiresAt,
        isExpired,
        daysLeft,
        price: qb?.price != null ? String(qb.price) : null,
      };
    };

    const active = entitlements.filter((e: any) => isEntitledStatus(e.status) && (!e.expiresAt || new Date(e.expiresAt) > now));
    const expired = entitlements.filter((e: any) => !active.includes(e));
    res.json({
      active: active.map(toItem),
      expired: expired.map(toItem),
      total: entitlements.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Per-QBank year setting used by the subscription page.
qbanksRouter.get('/my/settings/:qbankType', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { qbankType } = req.params;
    const [setting] = await db
      .select()
      .from(qbankUserSettingsTable)
      .where(and(eq(qbankUserSettingsTable.userId, req.user!.id), eq(qbankUserSettingsTable.qbankType, qbankType)));
    res.json({ setting: setting ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

qbanksRouter.put('/my/settings/:qbankType', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { qbankType } = req.params;
    const { selectedYear } = req.body ?? {};
    const [existing] = await db
      .select()
      .from(qbankUserSettingsTable)
      .where(and(eq(qbankUserSettingsTable.userId, req.user!.id), eq(qbankUserSettingsTable.qbankType, qbankType)));
    if (existing) {
      const [updated] = await db
        .update(qbankUserSettingsTable)
        .set({ selectedYear: selectedYear ?? null, updatedAt: new Date() })
        .where(eq(qbankUserSettingsTable.id, existing.id))
        .returning();
      return res.json({ setting: updated });
    }
    const [created] = await db
      .insert(qbankUserSettingsTable)
      .values({ userId: req.user!.id, qbankType, selectedYear: selectedYear ?? null })
      .returning();
    res.status(201).json({ setting: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Per-QBank endpoints (slug-scoped)
// ---------------------------------------------------------------------------

// Access check — server-side entitlement verification.
qbanksRouter.get('/:slug/access', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const qbank = await findQbankBySlug(req.params.slug);
    if (!qbank) return res.status(404).json({ error: 'QBank not found' });
    const hasAccess = await hasActiveEntitlement(req.user!.id, qbank.id);
    const [entitlement] = await db
      .select()
      .from(entitlementsTable)
      .where(and(eq(entitlementsTable.userId, req.user!.id), eq(entitlementsTable.qbankId, qbank.id)));
    res.json({ hasAccess, entitlement: hasAccess ? entitlement ?? null : null, status: qbank.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Protected operation: question IDs scoped to a QBank (requires entitlement).
qbanksRouter.get('/:slug/questions', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const qbank = await findQbankBySlug(req.params.slug);
    if (!qbank) return res.status(404).json({ error: 'QBank not found' });

    const hasAccess = await hasActiveEntitlement(req.user!.id, qbank.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'This QBank requires an active subscription' });
    }

    const mappings = await db
      .select({ questionId: qbankQuestionsTable.questionId })
      .from(qbankQuestionsTable)
      .where(eq(qbankQuestionsTable.qbankId, qbank.id));
    res.json({ qbank: { slug: qbank.slug, name: qbank.name, questionCount: qbank.questionCount }, questionIds: mappings.map((m) => m.questionId) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Coming Soon / Notify Me — idempotent waitlist registration.
qbanksRouter.post('/:slug/notify', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const qbank = await findQbankBySlug(req.params.slug);
    if (!qbank) return res.status(404).json({ error: 'QBank not found' });

    const [existing] = await db
      .select()
      .from(waitlistTable)
      .where(and(eq(waitlistTable.userId, req.user!.id), eq(waitlistTable.qbankId, qbank.id)));
    if (existing) {
      return res.json({ registered: true, created: false, status: existing.status });
    }

    const [entry] = await db
      .insert(waitlistTable)
      .values({ userId: req.user!.id, qbankId: qbank.id, status: 'waiting' })
      .returning();
    res.status(201).json({ registered: true, created: true, status: entry.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// QBank detail.
qbanksRouter.get('/:slug', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const qbank = await findQbankBySlug(req.params.slug);
    if (!qbank) return res.status(404).json({ error: 'QBank not found' });
    const hasAccess = await hasActiveEntitlement(req.user!.id, qbank.id);
    const lookups = await loadTaxonomyLookups();
    res.json({ qbank: { ...describeQbank(qbank, lookups), purchased: hasAccess } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
