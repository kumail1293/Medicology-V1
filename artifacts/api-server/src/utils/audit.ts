import { db } from '../db.js';
import {
  questionVersionsTable,
  auditLogsTable,
} from '@workspace/db';
import type { VersionChangeType } from '@workspace/db';

// ============================================================================
// Version + audit helpers.
//
// - recordQuestionVersion: appends a row to question_versions with an
//   incremented version number and an old/new snapshot of the tracked fields.
// - recordAudit: appends a row to audit_logs (actor, action, object, diff, IP).
// - diffValues: which tracked fields actually changed, with old → new values.
// ============================================================================

// Fields worth tracking across versions. Noise fields (ids, timestamps) are
// intentionally excluded so the history shows content changes only.
const TRACKED_FIELDS = [
  'questionText',
  'options',
  'correctAnswer',
  'explanation',
  'imageUrl',
  'explanationImageUrl',
  'wrongAnswerExplanations',
  'references',
  'subject',
  'system',
  'topic',
  'subtopic',
  'universityTag',
  'examType',
  'difficulty',
  'tags',
  'isFree',
  'status',
  'countryId',
  'examId',
  'programId',
  'yearId',
  'subjectId',
  'systemId',
  'topicId',
  'subtopicId',
] as const;

const pick = (row: Record<string, any> | undefined): Record<string, any> => {
  if (!row) return {};
  const out: Record<string, any> = {};
  for (const field of TRACKED_FIELDS) {
    if (row[field] !== undefined) out[field] = row[field];
  }
  return out;
};

const eqValues = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Which of the tracked fields differ between the old and new question rows.
 * Returns a map of field → { old, new }.
 */
export function diffValues(oldRow: Record<string, any>, newRow: Record<string, any>): Record<string, { old: any; new: any }> {
  const oldPick = pick(oldRow);
  const newPick = pick(newRow);
  const diff: Record<string, { old: any; new: any }> = {};
  for (const field of TRACKED_FIELDS) {
    const before = oldPick[field];
    const after = newPick[field];
    if (!eqValues(before, after)) {
      diff[field] = { old: before, new: after };
    }
  }
  return diff;
}

export interface Actor {
  id?: number;
  name?: string;
  email?: string;
}

const FIELD_LABELS: Record<string, string> = {
  questionText: 'Question text',
  options: 'Options',
  correctAnswer: 'Correct answer',
  explanation: 'Explanation',
  imageUrl: 'Image',
  wrongAnswerExplanations: 'Wrong-answer explanations',
  references: 'References',
  subject: 'Subject',
  system: 'System',
  topic: 'Topic',
  subtopic: 'Subtopic',
  universityTag: 'University',
  examType: 'Exam type',
  difficulty: 'Difficulty',
  tags: 'Tags',
  isFree: 'Free status',
  status: 'Status',
  countryId: 'Country',
  examId: 'Exam',
  programId: 'Program',
  yearId: 'Year',
  subjectId: 'Subject',
  systemId: 'System',
  topicId: 'Topic',
  subtopicId: 'Subtopic',
};

const short = (value: any): string => {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value).slice(0, 60);
    } catch {
      return '[object]';
    }
  }
  const text = String(value ?? '');
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};

/** Classify a content change into the most specific version change type. */
export function classifyChange(diff: Record<string, { old: any; new: any }>): VersionChangeType {
  if (diff.correctAnswer) return 'answer_change';
  if (diff.explanation) return 'explanation_change';
  if (diff.status) return 'status_change';
  if (diff.subject || diff.system || diff.topic || diff.subtopic || diff.universityTag || diff.examId || diff.subjectId) {
    return 'taxonomy_change';
  }
  return 'update';
}

/** Build a human-readable summary from a diff, e.g. "Correct answer changed from C to B". */
export function summarizeDiff(diff: Record<string, { old: any; new: any }>): string {
  const parts = Object.entries(diff).map(([field, { old, new: next }]) => {
    const label = FIELD_LABELS[field] ?? field;
    if (field === 'correctAnswer') return `Correct answer changed from ${short(old)} to ${short(next)}`;
    if (field === 'status') return `Status changed from ${short(old)} to ${short(next)}`;
    return `${label} updated (${short(old)} → ${short(next)})`;
  });
  if (parts.length === 0) return 'No content changes';
  return parts.join('; ');
}

/**
 * Append a new version row for a question. Version numbers are sequential per
 * question (1, 2, 3, …).
 */
export async function recordQuestionVersion(params: {
  questionId: number;
  qid?: string | null;
  changeType: VersionChangeType;
  summary: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  actor?: Actor;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}): Promise<void> {
  // Query the highest version number for this question.
  const rows = await db
    .select({ versionNumber: questionVersionsTable.versionNumber })
    .from(questionVersionsTable);

  const maxVersion = rows
    .filter((r: any) => Number(r.questionId) === Number(params.questionId))
    .reduce((max: number, r: any) => Math.max(max, Number(r.versionNumber)), 0);

  await db.insert(questionVersionsTable).values({
    questionId: params.questionId,
    qid: params.qid ?? null,
    versionNumber: maxVersion + 1,
    changeType: params.changeType,
    summary: params.summary,
    oldValues: params.oldValues ?? {},
    newValues: params.newValues ?? {},
    changedBy: params.actor?.id ?? null,
    changedByName: params.actor?.name ?? null,
    reviewStatus: params.reviewStatus ?? 'pending',
  });
}

/**
 * Append an audit log entry.
 */
export async function recordAudit(params: {
  actor?: Actor;
  action: string;
  entityType: string;
  entityId?: number;
  entityLabel?: string;
  summary?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ip?: string;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    actorId: params.actor?.id ?? null,
    actorName: params.actor?.name ?? null,
    actorEmail: params.actor?.email ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    entityLabel: params.entityLabel ?? null,
    summary: params.summary ?? null,
    oldValues: params.oldValues ?? {},
    newValues: params.newValues ?? {},
    ipAddress: params.ip ?? null,
  });
}

/** Load the latest N versions for a question (newest first). */
export async function getQuestionVersions(questionId: number, limit = 50): Promise<any[]> {
  const rows = await db
    .select()
    .from(questionVersionsTable);

  return rows
    .filter((r: any) => Number(r.questionId) === Number(questionId))
    .sort((a: any, b: any) => Number(b.versionNumber) - Number(a.versionNumber))
    .slice(0, limit);
}

/** Load recent audit logs (newest first) with optional entity filter. */
export async function getAuditLogs(options: { entityType?: string; action?: string; limit?: number; offset?: number } = {}): Promise<{ logs: any[]; total: number }> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  let rows = await db
    .select()
    .from(auditLogsTable);

  if (options.entityType) rows = rows.filter((r: any) => r.entityType === options.entityType);
  if (options.action) rows = rows.filter((r: any) => r.action === options.action);

  rows = rows.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    logs: rows.slice(offset, offset + limit),
    total: rows.length,
  };
}
