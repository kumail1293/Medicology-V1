import { Router } from 'express';
import { db } from '../db.js';
import {
  countriesTable,
  examSystemsTable,
  examsTable,
  programsTable,
  academicYearsTable,
  subjectsTable,
  systemsTable,
  topicsTable,
  subtopicsTable,
  questionsTable,
} from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { recordAudit } from '../utils/audit.js';

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });

export const taxonomyRouter = Router();

type Table = any;

// ---------------------------------------------------------------------------
// Public tree — the full exam hierarchy assembled without SQL joins so it works
// on both PostgreSQL and the in-memory mock DB.
// ---------------------------------------------------------------------------

taxonomyRouter.get('/tree', authenticate, async (_req: AuthRequest, res: any) => {
  try {
    const [countries, examSystems, exams, programs, years, subjects, systems, topics, subtopics] =
      await Promise.all([
        db.select().from(countriesTable),
        db.select().from(examSystemsTable),
        db.select().from(examsTable),
        db.select().from(programsTable),
        db.select().from(academicYearsTable),
        db.select().from(subjectsTable),
        db.select().from(systemsTable),
        db.select().from(topicsTable),
        db.select().from(subtopicsTable),
      ]);

    const tree = {
      countries: countries.map((c: Table) => ({
        ...c,
        examSystems: examSystems
          .filter((es: Table) => es.countryId === c.id)
          .map((es: Table) => ({
            ...es,
            exams: exams
              .filter((e: Table) => e.examSystemId === es.id)
              .map((e: Table) => ({
                ...e,
                programs: programs
                  .filter((p: Table) => p.examId === e.id)
                  .map((p: Table) => ({
                    ...p,
                    years: years
                      .filter((y: Table) => y.programId === p.id)
                      .map((y: Table) => ({ ...y })),
                  })),
              })),
          })),
      })),
      subjects: subjects.map((s: Table) => ({
        ...s,
        systems: systems
          .filter((sys: Table) => sys.subjectId === s.id)
          .map((sys: Table) => ({
            ...sys,
            topics: topics
              .filter((t: Table) => t.systemId === sys.id)
              .map((t: Table) => ({
                ...t,
                subtopics: subtopics
                  .filter((st: Table) => st.topicId === t.id)
                  .map((st: Table) => ({ ...st })),
              })),
          })),
      })),
    };

    res.json(tree);
  } catch (err: any) {
    console.error('Error in taxonomy tree:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Browse catalogue — university → program → year with live question counts.
// Taxonomy provides the structure (exams/programs/years); the questions table
// provides counts. Program codes are collapsed on their first token so
// taxonomy programs (USMLE-S1) and question-derived programs ("USMLE") merge.
// ---------------------------------------------------------------------------

taxonomyRouter.get('/browse', authenticate, async (_req: AuthRequest, res: any) => {
  try {
    const [countries, exams, programs, years, questions] = await Promise.all([
      db.select().from(countriesTable),
      db.select().from(examsTable),
      db.select().from(programsTable),
      db.select().from(academicYearsTable),
      db.select({
        id: questionsTable.id,
        universityTag: questionsTable.universityTag,
        examType: questionsTable.examType,
      }).from(questionsTable),
    ]);

    const countryOf = (countryId: number) => countries.find((c: Table) => c.id === countryId);

    // ── Question-derived counts: university → program → level ───────────────
    const counts = new Map<string, Map<string, Map<string, number>>>();
    const bump = (university: string, program: string, level: string) => {
      if (!university) return;
      if (!counts.has(university)) counts.set(university, new Map());
      const pm = counts.get(university)!;
      if (!pm.has(program)) pm.set(program, new Map());
      const ym = pm.get(program)!;
      ym.set(level, (ym.get(level) || 0) + 1);
    };
    for (const q of questions) {
      const examType: string = q.examType || '';
      const parts = examType.split(' ').filter(Boolean);
      const program = parts.length >= 2 ? parts[0] : examType;
      const level = parts.length >= 2 ? parts.slice(1).join(' ') : '';
      bump(q.universityTag || '', program, level);
    }

    // Program key: collapse taxonomy codes on their first token (USMLE-S1 → USMLE)
    const programKey = (code: string) => code.split('-')[0].toUpperCase();

    // ── Merge taxonomy structure + question counts ──────────────────────────
    interface ProgramNode { code: string; name: string; years: Map<string, { name: string; questionCount: number }>; }
    interface UniversityNode { code: string; name: string; flag: string; countryCode: string; programs: Map<string, ProgramNode>; }
    const universities = new Map<string, UniversityNode>();

    const ensureUniversity = (code: string, name: string, flag: string, countryCode: string): UniversityNode => {
      if (!universities.has(code)) {
        universities.set(code, { code, name, flag, countryCode, programs: new Map() });
      }
      return universities.get(code)!;
    };
    const ensureProgram = (u: UniversityNode, code: string, name: string): ProgramNode => {
      if (!u.programs.has(code)) {
        u.programs.set(code, { code, name, years: new Map() });
      }
      return u.programs.get(code)!;
    };

    // Taxonomy structure first (only exams that have programs)
    for (const exam of exams) {
      const country = countryOf(exam.countryId);
      const related = programs.filter((p: Table) => p.examId === exam.id);
      if (related.length === 0) continue;
      const u = ensureUniversity(exam.code, exam.name, country?.flag || '🇵🇰', country?.code || '');
      for (const prog of related) {
        const key = programKey(prog.code);
        const p = ensureProgram(u, key, key);
        for (const year of years.filter((y: Table) => y.programId === prog.id)) {
          if (!p.years.has(year.name)) p.years.set(year.name, { name: year.name, questionCount: 0 });
        }
      }
    }

    // Question structure + counts on top
    for (const [university, pm] of counts) {
      const u = ensureUniversity(university, university, '🇵🇰', 'PK');
      for (const [program, ym] of pm) {
        const p = ensureProgram(u, program, program);
        for (const [level, count] of ym) {
          if (!p.years.has(level)) p.years.set(level, { name: level, questionCount: 0 });
          p.years.get(level)!.questionCount += count;
        }
      }
    }

    const result = Array.from(universities.values())
      .map((u) => ({
        code: u.code,
        name: u.name,
        flag: u.flag,
        countryCode: u.countryCode,
        programs: Array.from(u.programs.values())
          .map((p) => ({
            code: p.code,
            name: p.name,
            years: Array.from(p.years.values()).map((y) => ({ name: y.name, questionCount: y.questionCount })),
            questionCount: Array.from(p.years.values()).reduce((sum, y) => sum + y.questionCount, 0),
          }))
          .sort((a: Table, b: Table) => b.questionCount - a.questionCount),
        questionCount: Array.from(u.programs.values()).reduce(
          (sum, p) => sum + Array.from(p.years.values()).reduce((s, y) => s + y.questionCount, 0),
          0
        ),
      }))
      .sort((a: Table, b: Table) => b.questionCount - a.questionCount);

    res.json({ universities: result });
  } catch (err: any) {
    console.error('Error in taxonomy browse:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Admin CRUD — generic over the nine taxonomy entities.
// ---------------------------------------------------------------------------

const ENTITY_TABLES: Record<string, any> = {
  countries: countriesTable,
  'exam-systems': examSystemsTable,
  exams: examsTable,
  programs: programsTable,
  years: academicYearsTable,
  subjects: subjectsTable,
  systems: systemsTable,
  topics: topicsTable,
  subtopics: subtopicsTable,
};

const ALLOWED_FIELDS: Record<string, string[]> = {
  countries: ['code', 'name', 'flag', 'active'],
  'exam-systems': ['name', 'countryId', 'sortOrder', 'active'],
  exams: ['code', 'name', 'examSystemId', 'countryId', 'status', 'sortOrder', 'active'],
  programs: ['code', 'name', 'examId', 'sortOrder', 'active'],
  years: ['programId', 'name', 'sortOrder', 'active'],
  subjects: ['code', 'name', 'shortName', 'icon', 'color', 'description', 'active'],
  systems: ['name', 'subjectId', 'sortOrder', 'active'],
  topics: ['name', 'systemId', 'sortOrder', 'active'],
  subtopics: ['name', 'topicId', 'sortOrder', 'active'],
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  countries: ['code', 'name'],
  'exam-systems': ['name', 'countryId'],
  exams: ['code', 'name', 'examSystemId', 'countryId'],
  programs: ['code', 'name', 'examId'],
  years: ['name', 'programId'],
  subjects: ['code', 'name'],
  systems: ['name', 'subjectId'],
  topics: ['name', 'systemId'],
  subtopics: ['name', 'topicId'],
};

function pickFields(body: any, entity: string): Record<string, any> {
  const allowed = ALLOWED_FIELDS[entity] ?? [];
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function validateRequired(data: Record<string, any>, entity: string): string | null {
  for (const field of REQUIRED_FIELDS[entity] ?? []) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// List all rows for an entity
taxonomyRouter.get('/:entity', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const table = ENTITY_TABLES[req.params.entity];
    if (!table) return res.status(404).json({ error: `Unknown taxonomy entity: ${req.params.entity}` });
    const rows = await db.select().from(table);
    res.json({ [req.params.entity]: rows });
  } catch (err: any) {
    console.error('Error listing taxonomy:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a row in an entity
taxonomyRouter.post('/:entity', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const entity = req.params.entity;
    const table = ENTITY_TABLES[entity];
    if (!table) return res.status(404).json({ error: `Unknown taxonomy entity: ${entity}` });

    const data = pickFields(req.body, entity);
    const missing = validateRequired(data, entity);
    if (missing) return res.status(400).json({ error: missing });

    const [row] = await db.insert(table).values(data).returning();

    await recordAudit({
      actor: actorOf(req),
      action: `taxonomy.${entity}.create`,
      entityType: entity,
      entityId: row.id,
      entityLabel: row.name ?? row.code,
      summary: `Created ${entity.replace('-', ' ')} "${row.name ?? row.code}"`,
      newValues: row,
      ip: req.ip,
    });

    res.status(201).json(row);
  } catch (err: any) {
    console.error('Error creating taxonomy:', err);
    if (String(err.message).includes('unique')) {
      return res.status(400).json({ error: 'A row with this code/name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update a row in an entity
taxonomyRouter.put('/:entity/:id', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const entity = req.params.entity;
    const table = ENTITY_TABLES[entity];
    if (!table) return res.status(404).json({ error: `Unknown taxonomy entity: ${entity}` });

    const id = Number(req.params.id);
    const data = pickFields(req.body, entity);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const [existing] = await db.select().from(table).where(eq(table.id, id));
    if (!existing) return res.status(404).json({ error: 'Taxonomy row not found' });

    const [row] = await db.update(table).set(data).where(eq(table.id, id)).returning();
    if (!row) return res.status(404).json({ error: 'Taxonomy row not found' });

    const changed = Object.keys(data).filter((key) => JSON.stringify(data[key]) !== JSON.stringify(existing[key]));
    await recordAudit({
      actor: actorOf(req),
      action: `taxonomy.${entity}.update`,
      entityType: entity,
      entityId: id,
      entityLabel: row.name ?? row.code,
      summary: changed.length > 0
        ? `Updated ${entity.replace('-', ' ')} "${row.name ?? row.code}" (${changed.join(', ')})`
        : `Updated ${entity.replace('-', ' ')} "${row.name ?? row.code}"`,
      oldValues: existing,
      newValues: row,
      ip: req.ip,
    });

    res.json(row);
  } catch (err: any) {
    console.error('Error updating taxonomy:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a row from an entity
taxonomyRouter.delete('/:entity/:id', authenticate, requireAdmin, async (req: any, res: any) => {
  try {
    const entity = req.params.entity;
    const table = ENTITY_TABLES[entity];
    if (!table) return res.status(404).json({ error: `Unknown taxonomy entity: ${entity}` });

    const id = Number(req.params.id);
    const [existing] = await db.select().from(table).where(eq(table.id, id));
    await db.delete(table).where(eq(table.id, id));

    await recordAudit({
      actor: actorOf(req),
      action: `taxonomy.${entity}.delete`,
      entityType: entity,
      entityId: id,
      entityLabel: existing?.name ?? existing?.code ?? `#${id}`,
      summary: `Deleted ${entity.replace('-', ' ')} "${existing?.name ?? existing?.code ?? id}"`,
      oldValues: existing,
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting taxonomy:', err);
    res.status(500).json({ error: err.message });
  }
});
