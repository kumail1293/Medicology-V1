import { Router } from 'express';
import { db } from '../db.js';
import { clinicalCasesTable, caseCompletionsTable } from '@workspace/db';
import { eq, and } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const casesRouter = Router();

/** Map a stored row into the shape the frontend expects (JSON fields parsed). */
function toCaseDto(row: any) {
  let diagnosisOptions: string[] = [];
  let keyLearningPoints: string[] = [];
  try { diagnosisOptions = JSON.parse(row.diagnosisOptions || '[]'); } catch { diagnosisOptions = []; }
  try { keyLearningPoints = JSON.parse(row.keyLearningPoints || '[]'); } catch { keyLearningPoints = []; }
  return {
    id: row.id,
    title: row.title,
    system: row.system,
    difficulty: row.difficulty,
    examType: row.examType,
    estimatedMinutes: row.estimatedMinutes,
    relatedSubject: row.relatedSubject,
    chiefComplaint: row.chiefComplaint,
    history: row.history,
    examination: row.examination,
    investigations: row.investigations,
    diagnosisOptions,
    correctDiagnosis: row.correctDiagnosis,
    explanation: row.explanation,
    managementPlan: row.managementPlan,
    keyLearningPoints,
  };
}

casesRouter.get('/', authenticate, async (req: AuthRequest, res: any) => {
  try {
    let rows = await db.select().from(clinicalCasesTable).where(eq(clinicalCasesTable.status, 'published'));
    const system = String(req.query.system || '').trim();
    const difficulty = String(req.query.difficulty || '').trim();
    const examType = String(req.query.examType || '').trim();
    if (system) rows = rows.filter((r: any) => r.system === system);
    if (difficulty) rows = rows.filter((r: any) => r.difficulty === difficulty);
    if (examType) rows = rows.filter((r: any) => r.examType === examType);
    res.json({ cases: rows.map(toCaseDto) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

casesRouter.post('/:id/complete', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const caseId = Number(req.params.id);
    const timeSpentSeconds = Number(req.body?.timeSpentSeconds) || 0;
    const [existing] = await db.select().from(caseCompletionsTable)
      .where(and(eq(caseCompletionsTable.userId, req.user!.id), eq(caseCompletionsTable.caseId, caseId)));
    if (existing) {
      return res.json({ ok: true, alreadyCompleted: true });
    }
    await db.insert(caseCompletionsTable).values({
      userId: req.user!.id,
      caseId,
      timeSpentSeconds,
    });
    res.json({ ok: true, alreadyCompleted: false });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
