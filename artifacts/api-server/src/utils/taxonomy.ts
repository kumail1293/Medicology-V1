import { db } from '../db.js';
import {
  subjectsTable,
  systemsTable,
  topicsTable,
  subtopicsTable,
  examsTable,
  countriesTable,
} from '@workspace/db';
import { eq } from './drizzle.js';

const first = (rows: any[]) => (rows.length > 0 ? rows[0] : undefined);

/**
 * Fill the legacy free-text taxonomy columns (subject, system, topic, subtopic,
 * universityTag) from the relational taxonomy IDs on a question payload.
 *
 * Hybrid mode: relational IDs are the source of truth, but existing UI/APIs
 * read the text columns, so we keep both in sync. Only fields whose ID is
 * present in `data` are resolved — partial updates leave other columns alone.
 */
export async function resolveTaxonomyFields(data: Record<string, any>): Promise<Record<string, any>> {
  const resolved: Record<string, any> = {};

  if (data.subjectId !== undefined && data.subjectId !== null) {
    const row = first(await db.select().from(subjectsTable).where(eq(subjectsTable.id, Number(data.subjectId))));
    if (row) {
      resolved.subject = row.name;
      resolved.subjectId = row.id;
    }
  }

  if (data.systemId !== undefined && data.systemId !== null) {
    const row = first(await db.select().from(systemsTable).where(eq(systemsTable.id, Number(data.systemId))));
    if (row) {
      resolved.system = row.name;
      resolved.systemId = row.id;
    }
  }

  if (data.topicId !== undefined && data.topicId !== null) {
    const row = first(await db.select().from(topicsTable).where(eq(topicsTable.id, Number(data.topicId))));
    if (row) {
      resolved.topic = row.name;
      resolved.topicId = row.id;
    }
  }

  if (data.subtopicId !== undefined && data.subtopicId !== null) {
    const row = first(await db.select().from(subtopicsTable).where(eq(subtopicsTable.id, Number(data.subtopicId))));
    if (row) {
      resolved.subtopic = row.name;
      resolved.subtopicId = row.id;
    }
  }

  if (data.examId !== undefined && data.examId !== null) {
    const row = first(await db.select().from(examsTable).where(eq(examsTable.id, Number(data.examId))));
    if (row) {
      resolved.universityTag = row.code;
      resolved.examId = row.id;
    }
  }

  if (data.countryId !== undefined && data.countryId !== null) {
    const row = first(await db.select().from(countriesTable).where(eq(countriesTable.id, Number(data.countryId))));
    if (row) resolved.countryId = row.id;
  }

  // Normalize numeric IDs (they may arrive as strings from a form).
  for (const key of ['countryId', 'examId', 'programId', 'yearId', 'subjectId', 'systemId', 'topicId', 'subtopicId']) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      resolved[key] = Number(data[key]);
    }
  }

  return resolved;
}
