import { Router } from 'express';
import { db } from '../db.js';
import { questionsTable } from '@workspace/db';
import { eq, and, ilike, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

export const questionsRouter = Router();

// Get questions with filters
questionsRouter.get('/', authenticate, async (req, res) => {
  try {
    const {
      subject, topic, system, subtopic, difficulty,
      universityTag, examType, limit = '20', offset = '0',
      random, search
    } = req.query as Record<string, string>;

    const conditions = [];

    if (subject) conditions.push(eq(questionsTable.subject, subject));
    if (topic) conditions.push(eq(questionsTable.topic, topic));
    if (system) conditions.push(eq(questionsTable.system, system));
    if (subtopic) conditions.push(eq(questionsTable.subtopic, subtopic));
    if (difficulty) conditions.push(eq(questionsTable.difficulty, difficulty));
    if (universityTag) conditions.push(eq(questionsTable.universityTag, universityTag));
    if (examType) conditions.push(eq(questionsTable.examType, examType));
    if (search) conditions.push(ilike(questionsTable.questionText, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const questions = await db.select().from(questionsTable)
      .where(where)
      .limit(Number(limit))
      .offset(Number(offset))
      .orderBy(random ? sql`RANDOM()` : questionsTable.id);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(questionsTable).where(where);

    return res.json({ questions, total: Number(count) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get single question
questionsRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const [question] = await db.select().from(questionsTable)
      .where(eq(questionsTable.id, Number(req.params.id)));
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    return res.json(question);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get available filters
questionsRouter.get('/meta/filters', authenticate, async (req, res) => {
  try {
    const subjects = await db.selectDistinct({ subject: questionsTable.subject }).from(questionsTable);
    const topics = await db.selectDistinct({ topic: questionsTable.topic }).from(questionsTable);
    const systems = await db.selectDistinct({ system: questionsTable.system }).from(questionsTable);
    const universities = await db.selectDistinct({ universityTag: questionsTable.universityTag }).from(questionsTable);
    res.json({
      subjects: subjects.map(s => s.subject).filter(Boolean),
      topics: topics.map(t => t.topic).filter(Boolean),
      systems: systems.map(s => s.system).filter(Boolean),
      universities: universities.map(u => u.universityTag).filter(Boolean),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});