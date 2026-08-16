import { Router } from 'express';
import { db } from '../db.js';
import {
  questionsTable,
  usersTable,
  userProgressTable,
  waitlistTable,
  qbanksTable,
  qbankQuestionsTable,
  countriesTable,
  examsTable,
  programsTable,
  academicYearsTable,
  examSystemsTable,
} from '@workspace/db';
import { eq, ilike, and, or, sql, inArray } from '../utils/drizzle.js';
import { authenticate, requireAdmin, requirePermission, AuthRequest, ASSIGNABLE_ROLES as ALLOWED_ROLES, ADMIN_ROLES } from '../middleware/auth.js';
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
  reviewQuestionSchema,
  createQbankSchema,
  updateQbankSchema,
  qbankMappingSchema,
} from './schemas.js';
import type {
  CreateQuestion,
  UpdateQuestion,
  GetQuestionsQuery,
  ReviewQuestion,
  CreateQbank,
  UpdateQbank,
  QbankMapping,
} from './schemas.js';
import { generateQid, isValidQid } from '../utils/qid.js';
import { resolveTaxonomyFields } from '../utils/taxonomy.js';
import {
  recordAudit,
  recordQuestionVersion,
  diffValues,
  classifyChange,
  summarizeDiff,
  getQuestionVersions,
  getAuditLogs,
} from '../utils/audit.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

// Get stats
adminRouter.get('/stats', async (req: AuthRequest, res: any) => {
  try {
    // Counts via the aggregate helper (mock-DB compatible; raw `sql` count
    // templates are not evaluable against the in-memory store).
    const [{ count: totalQuestions }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questionsTable);
    const [{ count: totalUsers }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ count: answersToday }] = await db
      .select({ count: sql<number>`count(*)` })
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
        // Exact QID match takes priority; otherwise fall back to text search.
        const search = query.search.trim();
        if (isValidQid(search)) {
          conditions.push(eq(questionsTable.qid, search));
        } else {
          conditions.push(
            or(
              ilike(questionsTable.questionText, `%${search}%`),
              ilike(questionsTable.subject, `%${search}%`),
              ilike(questionsTable.topic, `%${search}%`)
            )
          );
        }
      }

      if (query.difficulty) {
        conditions.push(eq(questionsTable.difficulty, query.difficulty));
      }

      if (query.status) {
        conditions.push(eq(questionsTable.status, query.status as any));
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

// Create question — auto-generates the immutable QID and keeps the legacy
// free-text taxonomy columns in sync with the relational IDs. New questions
// enter the review pipeline as drafts rather than publishing immediately.
adminRouter.post(
  '/questions',
  requirePermission('questions.manage'),
  validateBody(createQuestionSchema),
  async (req: any, res: any) => {
    try {
      const data = req.validatedBody as CreateQuestion;

      const values: any = { ...data };
      if (!values.qid) values.qid = await generateQid(db);
      if (!values.status) values.status = 'draft';
      if (values.status === 'published' && !values.publishedAt) values.publishedAt = new Date();

      // Resolve taxonomy names from relational IDs (hybrid mode).
      const taxonomy = await resolveTaxonomyFields(values);
      Object.assign(values, taxonomy);

      const [question] = await db.insert(questionsTable).values(values).returning();

      // Version 1 + audit trail for the create.
      const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
      await recordQuestionVersion({
        questionId: question.id,
        qid: question.qid,
        changeType: 'create',
        summary: 'Question created',
        newValues: question,
        actor,
        reviewStatus: 'approved',
      });
      await recordAudit({
        actor,
        action: 'question.create',
        entityType: 'question',
        entityId: question.id,
        entityLabel: question.qid,
        summary: 'Question created',
        newValues: question,
        ip: req.ip,
      });

      res.status(201).json(question);
    } catch (err: any) {
      console.error('Error in admin create question:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Update question — the QID is immutable and never changes on edits.
adminRouter.put(
  '/questions/:id',
  requirePermission('questions.manage'),
  validateParams(questionIdParamSchema),
  validateBody(updateQuestionSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const data = req.validatedBody as UpdateQuestion;

      // Never allow the QID to change after a question exists.
      delete (data as any).qid;

      // Resolve taxonomy names from relational IDs (hybrid mode).
      const taxonomy = await resolveTaxonomyFields(data);
      Object.assign(data, taxonomy);

      const values: any = { ...data, updatedAt: new Date() };

      // Load the current row first so we can diff what actually changed.
      const [existing] = await db.select().from(questionsTable).where(eq(questionsTable.id, id));
      if (!existing) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // Moving a question to published stamps its first-published date.
      if (values.status === 'published' && !existing.publishedAt) {
        values.publishedAt = new Date();
      }

      const [question] = await db
        .update(questionsTable)
        .set(values)
        .where(eq(questionsTable.id, id))
        .returning();

      // Version + audit trail for the edit (skip if nothing meaningful changed).
      const diff = diffValues(existing, question);
      if (Object.keys(diff).length > 0) {
        const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
        const changeType = classifyChange(diff);
        const summary = summarizeDiff(diff);
        await recordQuestionVersion({
          questionId: id,
          qid: question.qid,
          changeType,
          summary,
          oldValues: existing,
          newValues: question,
          actor,
        });
        await recordAudit({
          actor,
          action: `question.${changeType}`,
          entityType: 'question',
          entityId: id,
          entityLabel: question.qid,
          summary,
          oldValues: diff,
          newValues: question,
          ip: req.ip,
        });
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
  requirePermission('questions.manage'),
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const [existing] = await db.select().from(questionsTable).where(eq(questionsTable.id, id));

      await db.delete(questionsTable).where(eq(questionsTable.id, id));

      const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
      await recordAudit({
        actor,
        action: 'question.delete',
        entityType: 'question',
        entityId: id,
        entityLabel: existing?.qid ?? `#${id}`,
        summary: 'Question deleted',
        oldValues: existing,
        ip: req.ip,
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error in admin delete question:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Get version history for a question
adminRouter.get(
  '/questions/:id/versions',
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const versions = await getQuestionVersions(id, Number(req.query.limit) || 50);
      res.json({ versions });
    } catch (err: any) {
      console.error('Error in admin get question versions:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ---------------------------------------------------------------------------
// QBank management — database-driven products: create/edit/archive, set
// status/price, and map questions (many-to-many).
// ---------------------------------------------------------------------------

// List QBanks enriched with taxonomy names + live question counts.
adminRouter.get('/qbanks', async (req: any, res: any) => {
  try {
    const [qbanks, counts, countries, exams, programs, years, examSystems] = await Promise.all([
      db.select().from(qbanksTable),
      db
        .select({ qbankId: qbankQuestionsTable.qbankId, count: sql<number>`count(*)` })
        .from(qbankQuestionsTable)
        .groupBy(qbankQuestionsTable.qbankId),
      db.select().from(countriesTable),
      db.select().from(examsTable),
      db.select().from(programsTable),
      db.select().from(academicYearsTable),
      db.select().from(examSystemsTable),
    ]);

    const byId = (rows: any[]) => new Map(rows.map((r) => [Number(r.id), r]));
    const countryMap = byId(countries);
    const examMap = byId(exams);
    const programMap = byId(programs);
    const yearMap = byId(years);
    const examSystemMap = byId(examSystems);
    const countMap = new Map(counts.map((c: any) => [Number(c.qbankId), Number(c.count)]));

    const rows = qbanks.map((qb: any) => {
      const program = qb.programId ? programMap.get(Number(qb.programId)) : undefined;
      const year = qb.academicYearId ? yearMap.get(Number(qb.academicYearId)) : undefined;
      const exam = qb.examId ? examMap.get(Number(qb.examId)) : undefined;
      const examSystem = qb.examSystemId ? examSystemMap.get(Number(qb.examSystemId)) : undefined;
      const country = qb.countryId ? countryMap.get(Number(qb.countryId)) : undefined;
      return {
        ...qb,
        questionCount: countMap.get(Number(qb.id)) ?? 0,
        countryName: country?.name ?? null,
        countryFlag: country?.flag ?? null,
        examSystemName: examSystem?.name ?? null,
        examName: exam?.name ?? null,
        examCode: exam?.code ?? null,
        programName: program?.name ?? null,
        yearName: year?.name ?? null,
      };
    });
    rows.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    res.json({ qbanks: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create QBank
adminRouter.post('/qbanks', requirePermission('qbanks.manage'), validateBody(createQbankSchema), async (req: any, res: any) => {
  try {
    const data = req.validatedBody as CreateQbank;
    const existing = await db.select().from(qbanksTable).where(eq(qbanksTable.slug, data.slug));
    if (existing.length > 0) {
      return res.status(409).json({ error: `Slug "${data.slug}" is already in use` });
    }
    const [qbank] = await db.insert(qbanksTable).values(data).returning();
    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    await recordAudit({
      actor,
      action: 'qbank.create',
      entityType: 'qbank',
      entityId: qbank.id,
      entityLabel: qbank.slug,
      summary: `Created QBank "${qbank.name}"`,
      newValues: qbank,
      ip: req.ip,
    });
    res.status(201).json(qbank);
  } catch (err: any) {
    console.error('Error in admin create qbank:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update QBank
adminRouter.put('/qbanks/:id', requirePermission('qbanks.manage'), validateParams(questionIdParamSchema), validateBody(updateQbankSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const data = req.validatedBody as UpdateQbank;

    if (data.slug) {
      const slugMatches = await db.select().from(qbanksTable).where(eq(qbanksTable.slug, data.slug));
      if (slugMatches.some((q: any) => Number(q.id) !== Number(id))) {
        return res.status(409).json({ error: `Slug "${data.slug}" is already in use` });
      }
    }

    const [existing] = await db.select().from(qbanksTable).where(eq(qbanksTable.id, id));
    if (!existing) return res.status(404).json({ error: 'QBank not found' });

    const [qbank] = await db
      .update(qbanksTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(qbanksTable.id, id))
      .returning();

    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    const diff = diffValues(existing, qbank);
    await recordAudit({
      actor,
      action: 'qbank.update',
      entityType: 'qbank',
      entityId: id,
      entityLabel: qbank.slug,
      summary: diff.status ? `QBank status changed from ${diff.status.old} to ${diff.status.new}` : `Updated QBank "${qbank.name}"`,
      oldValues: diff,
      newValues: qbank,
      ip: req.ip,
    });
    res.json(qbank);
  } catch (err: any) {
    console.error('Error in admin update qbank:', err);
    res.status(500).json({ error: err.message });
  }
});

// Archive QBank (soft delete — keeps entitlement/reference integrity).
adminRouter.delete('/qbanks/:id', requirePermission('qbanks.manage'), validateParams(questionIdParamSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const [existing] = await db.select().from(qbanksTable).where(eq(qbanksTable.id, id));
    if (!existing) return res.status(404).json({ error: 'QBank not found' });
    const [qbank] = await db
      .update(qbanksTable)
      .set({ status: 'archived', active: false, updatedAt: new Date() })
      .where(eq(qbanksTable.id, id))
      .returning();
    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    await recordAudit({
      actor,
      action: 'qbank.archive',
      entityType: 'qbank',
      entityId: id,
      entityLabel: qbank.slug,
      summary: `Archived QBank "${qbank.name}"`,
      oldValues: existing,
      newValues: qbank,
      ip: req.ip,
    });
    res.json({ success: true, qbank });
  } catch (err: any) {
    console.error('Error in admin archive qbank:', err);
    res.status(500).json({ error: err.message });
  }
});

// Currently mapped questions for a QBank.
adminRouter.get('/qbanks/:id/questions', validateParams(questionIdParamSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const [qbank] = await db.select().from(qbanksTable).where(eq(qbanksTable.id, id));
    if (!qbank) return res.status(404).json({ error: 'QBank not found' });

    const mappings = await db
      .select({ questionId: qbankQuestionsTable.questionId })
      .from(qbankQuestionsTable)
      .where(eq(qbankQuestionsTable.qbankId, id));
    const questionIds = mappings.map((m) => Number(m.questionId));

    const questions = questionIds.length > 0
      ? await db
          .select({ id: questionsTable.id, qid: questionsTable.qid, questionText: questionsTable.questionText, subject: questionsTable.subject, topic: questionsTable.topic })
          .from(questionsTable)
          .where(inArray(questionsTable.id, questionIds))
      : [];

    res.json({ qbank: { id: qbank.id, slug: qbank.slug, name: qbank.name }, questionIds, questions });
  } catch (err: any) {
    console.error('Error in admin get qbank questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Replace the question↔qbank mapping (adds + removes to match the target set).
adminRouter.post('/qbanks/:id/questions', requirePermission('qbanks.manage'), validateParams(questionIdParamSchema), validateBody(qbankMappingSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const { questionIds } = req.validatedBody as QbankMapping;
    const [qbank] = await db.select().from(qbanksTable).where(eq(qbanksTable.id, id));
    if (!qbank) return res.status(404).json({ error: 'QBank not found' });

    const existing = await db
      .select({ questionId: qbankQuestionsTable.questionId })
      .from(qbankQuestionsTable)
      .where(eq(qbankQuestionsTable.qbankId, id));
    const current = new Set<number>(existing.map((m: any) => Number(m.questionId)));
    const target = new Set<number>(questionIds.map((n) => Number(n)));

    for (const qid of target) {
      if (!current.has(qid)) {
        await db.insert(qbankQuestionsTable).values({ qbankId: id, questionId: qid });
      }
    }
    for (const qid of current) {
      if (!target.has(qid)) {
        await db.delete(qbankQuestionsTable).where(
          and(eq(qbankQuestionsTable.qbankId, id), eq(qbankQuestionsTable.questionId, qid))
        );
      }
    }

    await db
      .update(qbanksTable)
      .set({ questionCount: target.size, updatedAt: new Date() })
      .where(eq(qbanksTable.id, id));

    const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
    await recordAudit({
      actor,
      action: 'qbank.questions_mapped',
      entityType: 'qbank',
      entityId: id,
      entityLabel: qbank.slug,
      summary: `Set ${target.size} question(s) on "${qbank.name}"`,
      oldValues: { questionIds: Array.from(current) },
      newValues: { questionIds: Array.from(target) },
      ip: req.ip,
    });
    res.json({ questionCount: target.size });
  } catch (err: any) {
    console.error('Error in admin map qbank questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Coming Soon demand — who is waiting for which QBank ("Notify Me" registrations).
adminRouter.get('/waitlist', async (req: any, res: any) => {
  try {
    const [entries, qbanks] = await Promise.all([
      db.select().from(waitlistTable),
      db.select().from(qbanksTable),
    ]);
    const byId = new Map<number, any>(qbanks.map((qb: any) => [Number(qb.id), qb]));
    const counts = new Map<number, { qbankId: number; slug: string; name: string; count: number }>();
    for (const entry of entries) {
      const qb = byId.get(Number(entry.qbankId));
      if (!qb) continue;
      const key = Number(entry.qbankId);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { qbankId: key, slug: qb.slug, name: qb.name, count: 1 });
      }
    }
    const demand = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    res.json({ demand, total: entries.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Review queue summary — counts per pipeline status (for nav badge + page chips).
adminRouter.get('/review/summary', async (req: any, res: any) => {
  try {
    const rows = await db
      .select({ status: questionsTable.status, count: sql<number>`count(*)` })
      .from(questionsTable)
      .groupBy(questionsTable.status);

    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = Number(row.count);
    res.json({ counts });
  } catch (err: any) {
    console.error('Error in admin review summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Review pipeline — move a question through draft → pending_review →
// under_medical_review → approved → published (or reject/archive/flag).
// Every transition appends a version row with reviewer metadata + an audit
// entry, so the QID stays immutable while the decision is fully traceable.
// ---------------------------------------------------------------------------
const REVIEW_TRANSITIONS: Record<
  string,
  { from: string[]; to: string; label: string; needsNote?: boolean }
> = {
  submit: { from: ['draft'], to: 'pending_review', label: 'Submitted for review' },
  start_review: { from: ['pending_review'], to: 'under_medical_review', label: 'Moved to medical review' },
  approve: { from: ['pending_review', 'under_medical_review'], to: 'approved', label: 'Approved' },
  publish: {
    from: ['approved', 'pending_review', 'under_medical_review', 'errata'],
    to: 'published',
    label: 'Published',
  },
  reject: {
    from: ['pending_review', 'under_medical_review', 'approved'],
    to: 'draft',
    label: 'Rejected — back to draft',
    needsNote: true,
  },
  archive: {
    from: ['draft', 'pending_review', 'under_medical_review', 'approved', 'published', 'flagged', 'errata'],
    to: 'archived',
    label: 'Archived',
  },
  restore: { from: ['archived'], to: 'pending_review', label: 'Restored to review queue' },
  flag: { from: ['published', 'approved'], to: 'flagged', label: 'Flagged for review' },
  unflag: { from: ['flagged'], to: 'pending_review', label: 'Unflagged — back to review' },
};

adminRouter.post(
  '/questions/:id/review',
  requirePermission('review.manage'),
  validateParams(questionIdParamSchema),
  validateBody(reviewQuestionSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const { action, note } = req.validatedBody as ReviewQuestion;

      const transition = REVIEW_TRANSITIONS[action];
      if (!transition) {
        return res.status(400).json({ error: `Unknown review action "${action}"` });
      }

      const [existing] = await db.select().from(questionsTable).where(eq(questionsTable.id, id));
      if (!existing) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // Scope enforcement: users carrying access scopes (e.g. an institutional
      // content team scoped to UHS) may only review questions inside their
      // taxonomy scope — including inherited parents (country → exam → program
      // → year / subject → system → topic). Users without scopes are
      // unrestricted (legacy).
      if (req.access) {
        const { questionInScope } = await import('../utils/authorization.js');
        const inScope = await questionInScope(req.access, existing);
        if (!inScope) {
          return res.status(403).json({ error: 'Forbidden — question is outside your access scope' });
        }
      }

      if (!transition.from.includes(existing.status)) {
        return res.status(409).json({
          error: `Cannot ${action} a question in status "${existing.status}"`,
          currentStatus: existing.status,
        });
      }

      if (transition.needsNote && !note?.trim()) {
        return res.status(400).json({ error: 'A note explaining the rejection is required' });
      }

      const now = new Date();
      // Snapshot the pre-transition status before the update mutates the row
      // (the mock DB returns live row references, so read it first).
      const oldStatus = existing.status;
      const values: any = { status: transition.to, updatedAt: now };
      if (transition.to === 'published' && !existing.publishedAt) {
        values.publishedAt = now;
      }

      const [question] = await db
        .update(questionsTable)
        .set(values)
        .where(eq(questionsTable.id, id))
        .returning();

      // The JWT payload carries no display name — resolve it from the users
      // table so the reviewer metadata on the version row is useful.
      let actorName = req.user?.name;
      if (!actorName && req.user?.id) {
        const [reviewer] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, req.user.id));
        actorName = reviewer?.name;
      }
      const actor = { id: req.user?.id, name: actorName, email: req.user?.email };
      const trimmedNote = note?.trim();
      const summary = trimmedNote
        ? `${transition.label} (${oldStatus} → ${transition.to}) — ${trimmedNote}`
        : `${transition.label} (${oldStatus} → ${transition.to})`;

      await recordQuestionVersion({
        questionId: id,
        qid: question.qid,
        changeType: 'status_change',
        summary,
        oldValues: { status: oldStatus },
        newValues: { status: question.status, note: trimmedNote ?? undefined },
        actor,
        ...(action === 'approve' || action === 'publish'
          ? { reviewStatus: 'approved' as const }
          : action === 'reject'
            ? { reviewStatus: 'rejected' as const }
            : {}),
        reviewerId: actor.id,
        reviewerName: actor.name,
        reviewedAt: now,
      });
      await recordAudit({
        actor,
        action: 'question.review',
        entityType: 'question',
        entityId: id,
        entityLabel: question.qid,
        summary,
        oldValues: { status: oldStatus },
        newValues: { status: question.status, note: trimmedNote ?? undefined },
        ip: req.ip,
      });

      res.json({ question, summary });
    } catch (err: any) {
      console.error('Error in admin review question:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Get audit logs (permission-gated — audit.view; router-level auth already applied)
adminRouter.get('/audit-logs', requirePermission('audit.view'), async (req: any, res: any) => {
  try {
    const { entityType, action, limit, offset } = req.query;
      const result = await getAuditLogs({
        entityType: entityType as string | undefined,
        action: action as string | undefined,
        limit: limit ? Number(limit) : 100,
        offset: offset ? Number(offset) : 0,
      });
      res.json(result);
    } catch (err: any) {
      console.error('Error in admin get audit logs:', err);
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
  requirePermission('users.manage'),
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
  requirePermission('users.manage'),
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

// Assignable roles (settings plan item 20 — granular admin roles). Only a
// superadmin may grant/revoke admin-level roles; admins manage
// user/editor/teacher/reviewer.
function normalizeRole(role: unknown): string | null {
  if (role === undefined || role === null || role === '') return 'user';
  const r = String(role);
  return ALLOWED_ROLES.includes(r) ? r : null;
}

// Create user
adminRouter.post('/users', requirePermission('users.manage'), async (req: any, res: any) => {
  try {
    const bcrypt = await import('bcryptjs');
    const { name, email, password, college, university, year, role } = req.body;

    if (!name || !email || !password || !college || !year) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedRole = normalizeRole(role);
    if (normalizedRole === null) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` });
    }
    // Only a superadmin can create admin/superadmin accounts.
    if (ADMIN_ROLES.includes(normalizedRole) && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only a superadmin can create admin accounts' });
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
        role: normalizedRole,
        isAdmin: ADMIN_ROLES.includes(normalizedRole),
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
  requirePermission('users.manage'),
  validateParams(questionIdParamSchema),
  async (req: any, res: any) => {
    try {
      const { id } = req.validatedParams as { id: number };
      const { name, email, college, university, year, role } = req.body;

      // Role guards run before any write:
      // 1. Whitelist — reject unknown roles outright.
      // 2. Superadmin-only — only a superadmin may grant/revoke admin roles
      //    (both promoting someone to admin AND demoting an existing admin).
      // 3. Self-demotion — an admin cannot demote themselves out of admin.
      // 4. Last-admin — never leave the platform without an admin.
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      let normalizedRole: string | null = null;
      if (role !== undefined) {
        normalizedRole = normalizeRole(role);
        if (normalizedRole === null) {
          return res.status(400).json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` });
        }
        const touchesAdminRole =
          ADMIN_ROLES.includes(normalizedRole) || ADMIN_ROLES.includes(existing.role);
        if (touchesAdminRole && req.user?.role !== 'superadmin') {
          return res.status(403).json({ error: 'Only a superadmin can assign or change admin roles' });
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (college !== undefined) updateData.college = college;
      if (university !== undefined) updateData.university = university;
      if (year !== undefined) updateData.year = year;

      let roleChanged = false;
      // Snapshot primitives BEFORE the update — the mock DB mutates rows in
      // place, so reading `existing.role` after updating would see the new role.
      const oldRole = existing.role;
      const oldIsAdmin = existing.isAdmin;
      if (normalizedRole !== null && normalizedRole !== oldRole) {
        // Self-demotion guard: don't let the last admin lock everyone out.
        if (Number(existing.id) === Number(req.user?.id) && ADMIN_ROLES.includes(oldRole) && !ADMIN_ROLES.includes(normalizedRole)) {
          return res.status(400).json({ error: 'You cannot remove your own admin role' });
        }
        // Last-admin guard: the final superadmin cannot be demoted or deleted.
        if (ADMIN_ROLES.includes(oldRole)) {
          const admins = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(inArray(usersTable.role, ADMIN_ROLES));
          if (admins.length <= 1) {
            return res.status(400).json({ error: 'Cannot demote the last admin account' });
          }
        }
        updateData.role = normalizedRole;
        updateData.isAdmin = ADMIN_ROLES.includes(normalizedRole);
        roleChanged = true;
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

      // Audit role changes (and general profile edits) for the admin trail.
      const actor = { id: req.user?.id, name: req.user?.name, email: req.user?.email };
      if (roleChanged) {
        await recordAudit({
          actor,
          action: 'user.role_change',
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.email,
          summary: `Role changed: ${oldRole} → ${user.role}`,
          oldValues: { role: oldRole, isAdmin: oldIsAdmin },
          newValues: { role: user.role, isAdmin: user.isAdmin },
          ip: req.ip,
        });
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

