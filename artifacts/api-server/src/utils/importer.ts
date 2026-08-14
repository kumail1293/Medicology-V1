import XLSX from 'xlsx';
import { db } from '../db.js';
import {
  questionsTable,
  subjectsTable,
  systemsTable,
  topicsTable,
  subtopicsTable,
  examsTable,
  programsTable,
  academicYearsTable,
  countriesTable,
} from '@workspace/db';
import { ilike } from './drizzle.js';
import { generateQid, isValidQid } from './qid.js';
import { QUESTION_STATUSES } from '@workspace/db';

// ============================================================================
// Bulk question import engine.
//
// Pipeline:  Excel/CSV → parse → column mapping → validation → duplicate
// detection → taxonomy mapping → QID generation → preview → execute.
// ============================================================================

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

// ---------------------------------------------------------------------------
// Column mapping — the spreadsheet headers (case/space/punctuation-insensitive)
// that are accepted for each field. "Option A" style headers come first.
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<string, string[]> = {
  qid: ['qid', 'questionid', 'question id'],
  questionText: ['question', 'questiontext', 'question text', 'stem', 'questionstem', 'question stem', 'mcq'],
  optionA: ['optiona', 'option a', 'answera', 'answer a', 'choicea', 'choice a', 'option1', 'option 1'],
  optionB: ['optionb', 'option b', 'answerb', 'answer b', 'choiceb', 'choice b', 'option2', 'option 2'],
  optionC: ['optionc', 'option c', 'answerc', 'answer c', 'choicec', 'choice c', 'option3', 'option 3'],
  optionD: ['optiond', 'option d', 'answerd', 'answer d', 'choiced', 'choice d', 'option4', 'option 4'],
  optionE: ['optione', 'option e', 'answere', 'answer e', 'choicee', 'choice e', 'option5', 'option 5'],
  correctAnswer: ['correctanswer', 'correct answer', 'answerkey', 'answer key', 'correctkey', 'correct key', 'answer'],
  explanation: ['explanation', 'explanationtext', 'explanation text', 'reason', 'why'],
  wrongAnswerExplanations: ['wronganswerexplanations', 'wrong answer explanations', 'distractorsexplanations', 'distractor explanations'],
  references: ['reference', 'references', 'source', 'book'],
  subject: ['subject', 'subjectname', 'subject name'],
  system: ['system', 'bodysystem', 'body system', 'organ system'],
  topic: ['topic', 'topicname', 'topic name'],
  subtopic: ['subtopic', 'subtopicname', 'sub topic', 'sub-topic'],
  universityTag: ['university', 'universitytag', 'university tag', 'institute', 'board'],
  examType: ['examtype', 'exam type', 'questiontype', 'question type', 'qtype', 'qbanktype', 'qbank type'],
  program: ['program', 'programme', 'degree', 'course', 'mbbsbds'],
  year: ['year', 'academicyear', 'academic year', 'mbbsyear', 'mbbs year', 'class'],
  difficulty: ['difficulty', 'difficultylevel', 'difficulty level', 'level'],
  tags: ['tags', 'tag', 'keywords', 'keyword'],
  imageUrl: ['image', 'imageurl', 'image url', 'picture'],
  status: ['status', 'questionstatus', 'question status'],
};

export interface ParsedRow {
  rowNumber: number; // 1-based (including header row)
  raw: Record<string, any>;
  data: Record<string, any>; // mapped field -> value
  unmappedColumns: string[];
}

export interface ImportRowResult extends ParsedRow {
  status: 'valid' | 'similar' | 'duplicate' | 'error';
  messages: string[];
  qid?: string;
  existingId?: number;
  similarity?: number;
  // Resolved taxonomy IDs (names matched against the taxonomy tables).
  countryId?: number;
  examId?: number;
  programId?: number;
  yearId?: number;
  subjectId?: number;
  systemId?: number;
  topicId?: number;
  subtopicId?: number;
}

export interface ImportPreview {
  fileName: string;
  totalRows: number;
  columnMapping: Record<string, string>;
  rows: ImportRowResult[];
  stats: {
    valid: number;
    similar: number;
    duplicate: number;
    error: number;
  };
}

const normalizeHeader = (header: string) =>
  header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE'] as const;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseSpreadsheet(buffer: Buffer, fileName: string): { rows: ParsedRow[]; columnMapping: Record<string, string> } {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The file contains no sheets');

  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) throw new Error('The file contains no data rows');

  // Discover the column mapping from the headers of the first row.
  const headers = Object.keys(rawRows[0]);
  const columnMapping: Record<string, string> = {};
  const mappedHeaders = new Set<string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let field: string | undefined;
    for (const [candidate, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized)) {
        field = candidate;
        break;
      }
    }
    if (field && !columnMapping[field]) {
      columnMapping[field] = header;
      mappedHeaders.add(header);
    }
  }

  // Only "Option A" style headers produce option values; also accept A..E alone.
  for (const [index, letter] of OPTION_LETTERS.entries()) {
    const header = headers.find((h) => normalizeHeader(h) === `option${letter}`) ?? headers.find((h) => normalizeHeader(h) === letter);
    if (header && !columnMapping[OPTION_KEYS[index]]) {
      columnMapping[OPTION_KEYS[index]] = header;
      mappedHeaders.add(header);
    }
  }

  const rows: ParsedRow[] = rawRows.map((raw, index) => {
    const data: Record<string, any> = {};
    const unmappedColumns: string[] = [];

    for (const [header, value] of Object.entries(raw)) {
      const normalized = normalizeHeader(header);
      // Prefer the discovered mapping; fall back to direct alias match.
      let field: string | undefined;
      for (const [candidate, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(normalized)) {
          field = candidate;
          break;
        }
      }
      if (field) {
        data[field] = typeof value === 'string' ? value.trim() : value;
      } else if (!mappedHeaders.has(header)) {
        unmappedColumns.push(header);
      }
    }

    return {
      rowNumber: index + 2, // +1 for the 0-based index, +1 for the header row
      raw,
      data,
      unmappedColumns,
    };
  });

  return { rows, columnMapping };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const stringValue = (v: any) => (v === undefined || v === null ? '' : String(v));

export function validateRow(parsed: ParsedRow): { messages: string[]; data: Record<string, any> } {
  const messages: string[] = [];
  const data: Record<string, any> = { ...parsed.data };

  // Required: question text
  const questionText = stringValue(data.questionText);
  if (!questionText) {
    messages.push('Missing question text');
  } else {
    data.questionText = questionText;
  }

  // Options: at least 4 non-empty; map into the {A,B,C,D,E} shape.
  const options: Record<string, string> = {};
  let optionCount = 0;
  for (const key of OPTION_KEYS) {
    const value = stringValue(data[key]);
    if (value) {
      options[key.replace('option', '')] = value;
      optionCount++;
    }
  }
  if (optionCount < 4) {
    messages.push(`Only ${optionCount} option(s) provided — at least 4 required`);
  }
  if (optionCount > 0) {
    data.options = options;
  }

  // Correct answer: must be a letter referencing a non-empty option.
  const correctAnswer = stringValue(data.correctAnswer).trim().toUpperCase();
  if (correctAnswer) {
    if (!OPTION_LETTERS.includes(correctAnswer)) {
      messages.push(`Correct answer "${data.correctAnswer}" must be one of A–E`);
    } else if (!options[correctAnswer]) {
      messages.push(`Correct answer is ${correctAnswer} but option ${correctAnswer} is empty`);
    } else {
      data.correctAnswer = correctAnswer;
    }
  } else {
    messages.push('Missing correct answer');
  }

  // Explanation — recommended but not required.
  if (!stringValue(data.explanation)) {
    messages.push('No explanation provided (recommended)');
  } else {
    data.explanation = stringValue(data.explanation);
  }

  // Difficulty
  const difficulty = stringValue(data.difficulty).toLowerCase();
  if (difficulty) {
    if (!DIFFICULTIES.includes(difficulty)) {
      messages.push(`Difficulty "${data.difficulty}" must be easy, medium or hard`);
    } else {
      data.difficulty = difficulty;
    }
  }

  // Status
  const status = stringValue(data.status).toLowerCase().replace(/[^a-z_]/g, '');
  if (status && !QUESTION_STATUSES.includes(status as any)) {
    messages.push(`Status "${data.status}" is not a valid status`);
  } else if (status) {
    data.status = status;
  }

  // QID format
  const qid = stringValue(data.qid);
  if (qid && !isValidQid(qid)) {
    messages.push(`QID "${qid}" has an invalid format (expected QID-MED-###########)`);
  }

  // Tags: comma/semicolon separated
  const tags = stringValue(data.tags);
  if (tags) {
    data.tags = tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  }

  return { messages, data };
}

// ---------------------------------------------------------------------------
// Duplicate detection — normalized text + bigram similarity.
// ---------------------------------------------------------------------------

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const bigrams = (text: string): Set<string> => {
  const out = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) out.add(text.slice(i, i + 2));
  return out;
};

export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let intersection = 0;
  for (const gram of ba) if (bb.has(gram)) intersection++;
  const union = ba.size + bb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const DUPLICATE_THRESHOLD = 0.85;
export const SIMILAR_THRESHOLD = 0.6;

export interface ExistingQuestionIndex {
  id: number;
  qid: string | null;
  questionText: string;
  normalized: string;
  bigramSet: Set<string>;
}

/** Load existing questions once and index them for duplicate detection. */
export async function loadQuestionIndex(): Promise<ExistingQuestionIndex[]> {
  const rows = await db.select().from(questionsTable);
  return rows
    .map((q: any) => {
      const text = stringValue(q.questionText);
      return {
        id: q.id,
        qid: q.qid ?? null,
        questionText: text,
        normalized: normalizeText(text),
        bigramSet: bigrams(normalizeText(text)),
      };
    })
    .filter((q) => q.normalized.length > 0);
}

/** Find the closest existing question for a candidate stem. */
export function findDuplicate(candidate: string, index: ExistingQuestionIndex[]): { existing: ExistingQuestionIndex; score: number } | null {
  const normalized = normalizeText(candidate);
  if (!normalized) return null;
  const candidateBigrams = bigrams(normalized);

  let best: { existing: ExistingQuestionIndex; score: number } | null = null;
  for (const existing of index) {
    let score: number;
    if (existing.normalized === normalized) {
      score = 1;
    } else {
      let intersection = 0;
      for (const gram of candidateBigrams) if (existing.bigramSet.has(gram)) intersection++;
      const union = candidateBigrams.size + existing.bigramSet.size - intersection;
      score = union === 0 ? 0 : intersection / union;
    }
    if (!best || score > best.score) best = { existing, score };
    if (score === 1) break;
  }
  return best && best.score >= SIMILAR_THRESHOLD ? best : null;
}

// ---------------------------------------------------------------------------
// Taxonomy mapping — match names (subject, system, topic, subtopic, exam,
// program, year, country) to relational IDs.
// ---------------------------------------------------------------------------

export interface TaxonomyMap {
  countryId?: number;
  examId?: number;
  programId?: number;
  yearId?: number;
  subjectId?: number;
  systemId?: number;
  topicId?: number;
  subtopicId?: number;
  messages: string[];
}

const firstRow = (rows: any[]) => (rows.length > 0 ? rows[0] : undefined);

/** Case-insensitive exact-name match (ilike is substring-based on the mock DB,
 * so filter to exact matches after fetching). */
async function findByName(table: any, nameColumn: string, value: string) {
  const rows = await db.select().from(table).where(ilike(table[nameColumn], value));
  const needle = value.toLowerCase();
  const exact = rows.find((r: any) => String(r[nameColumn] ?? '').toLowerCase() === needle);
  return exact ?? firstRow(rows);
}

export async function resolveTaxonomy(data: Record<string, any>): Promise<TaxonomyMap> {
  const map: TaxonomyMap = { messages: [] };
  const name = (v: any) => stringValue(v).trim();
  const subject = name(data.subject);
  const system = name(data.system);
  const topic = name(data.topic);
  const subtopic = name(data.subtopic);
  // The "University/Exam" column maps to universityTag; also accept an explicit "exam".
  const exam = name(data.exam ?? data.universityTag);
  const program = name(data.program);
  const year = name(data.year);
  const country = name(data.country);

  if (subject) {
    const row = await findByName(subjectsTable, 'name', subject);
    if (row) map.subjectId = row.id;
    else map.messages.push(`Subject "${subject}" not found in taxonomy`);
  }
  if (system) {
    const row = await findByName(systemsTable, 'name', system);
    if (row) map.systemId = row.id;
    else map.messages.push(`System "${system}" not found in taxonomy`);
  }
  if (topic) {
    const row = await findByName(topicsTable, 'name', topic);
    if (row) map.topicId = row.id;
    else map.messages.push(`Topic "${topic}" not found in taxonomy`);
  }
  if (subtopic) {
    const row = await findByName(subtopicsTable, 'name', subtopic);
    if (row) map.subtopicId = row.id;
    else map.messages.push(`Subtopic "${subtopic}" not found in taxonomy`);
  }

  if (exam) {
    const row = await findByName(examsTable, 'code', exam);
    if (row) map.examId = row.id;
    else map.messages.push(`University/Exam "${exam}" not found in taxonomy`);
  }
  if (program) {
    const row = await findByName(programsTable, 'name', program);
    if (row) map.programId = row.id;
    else map.messages.push(`Program "${program}" not found in taxonomy`);
  }
  if (year) {
    const row = await findByName(academicYearsTable, 'name', year);
    if (row) map.yearId = row.id;
    else map.messages.push(`Year "${year}" not found in taxonomy`);
  }
  if (country) {
    const row = await findByName(countriesTable, 'name', country);
    if (row) map.countryId = row.id;
    else map.messages.push(`Country "${country}" not found in taxonomy`);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Full pipeline: parse → validate → dedupe → map → QID.
// ---------------------------------------------------------------------------

export async function buildImportPreview(buffer: Buffer, fileName: string): Promise<ImportPreview> {
  const { rows, columnMapping } = parseSpreadsheet(buffer, fileName);
  const index = await loadQuestionIndex();

  // Sequential QIDs for the preview: starts at the next free number and
  // increments per new row so every row shows the QID it would receive.
  const baseNumber = Number((await generateQid(db)).replace('QID-MED-', ''));
  let qidCounter = baseNumber;

  const results: ImportRowResult[] = [];

  for (const parsed of rows) {
    const { messages, data } = validateRow(parsed);
    const result: ImportRowResult = {
      ...parsed,
      data,
      status: 'valid',
      messages: [...messages],
    };

    // Duplicate detection
    if (data.questionText) {
      const duplicate = findDuplicate(data.questionText, index);
      if (duplicate && duplicate.score >= DUPLICATE_THRESHOLD) {
        result.status = 'duplicate';
        result.existingId = duplicate.existing.id;
        result.similarity = Math.round(duplicate.score * 100);
        result.messages.push(`Possible duplicate of QID ${duplicate.existing.qid ?? '#' + duplicate.existing.id} (${result.similarity}% similar)`);
      } else if (duplicate) {
        result.status = 'similar';
        result.existingId = duplicate.existing.id;
        result.similarity = Math.round(duplicate.score * 100);
        result.messages.push(`Very similar to QID ${duplicate.existing.qid ?? '#' + duplicate.existing.id} (${result.similarity}% similar)`);
      }
    }

    // Hard validation errors trump similarity flags (soft messages like
    // "No explanation provided" stay as warnings on otherwise valid rows).
    const hasHardError = messages.some((m) =>
      m.startsWith('Missing question') ||
      m.startsWith('Missing correct') ||
      m.startsWith('Only ') ||
      m.startsWith('Correct answer') ||
      m.startsWith('Difficulty') ||
      m.startsWith('Status') ||
      m.includes('invalid format')
    );
    if (hasHardError) {
      result.status = 'error';
    }

    // Taxonomy mapping (best-effort, only for valid rows)
    if (result.status === 'valid' || result.status === 'similar') {
      const taxonomy = await resolveTaxonomy(data);
      Object.assign(result, {
        countryId: taxonomy.countryId,
        examId: taxonomy.examId,
        programId: taxonomy.programId,
        yearId: taxonomy.yearId,
        subjectId: taxonomy.subjectId,
        systemId: taxonomy.systemId,
        topicId: taxonomy.topicId,
        subtopicId: taxonomy.subtopicId,
      });
      result.messages.push(...taxonomy.messages);
    }

    // QID: keep explicit QIDs; generate sequential placeholders for new questions.
    if (data.qid) {
      result.qid = data.qid;
    } else if (result.status !== 'error') {
      result.qid = `QID-MED-${String(qidCounter++).padStart(9, '0')}`;
    }

    results.push(result);
  }

  const stats = { valid: 0, similar: 0, duplicate: 0, error: 0 };
  for (const row of results) stats[row.status]++;

  return { fileName, totalRows: results.length, columnMapping, rows: results, stats };
}

// ---------------------------------------------------------------------------
// Execute: insert the chosen rows (valid + similar, or duplicates when forced).
// ---------------------------------------------------------------------------

export interface ImportExecuteRequest {
  rows: ImportRowResult[];
  includeDuplicates?: boolean;
  createMissingTaxonomy?: boolean;
}

export async function executeImport(req: ImportExecuteRequest): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  const eligible = req.rows.filter((row) => row.status === 'valid' || row.status === 'similar' || (req.includeDuplicates && row.status === 'duplicate'));

  for (const row of eligible) {
    const { data } = row;
    try {
      const values: Record<string, any> = {};

      // Required content
      values.questionText = stringValue(data.questionText);
      values.options = data.options ?? {};
      values.correctAnswer = stringValue(data.correctAnswer);
      values.explanation = stringValue(data.explanation) || '';
      values.difficulty = data.difficulty || 'medium';
      values.tags = data.tags ?? [];

      // Optional passthrough fields
      for (const field of ['imageUrl', 'explanationImageUrl', 'wrongAnswerExplanations', 'references', 'subject', 'system', 'topic', 'subtopic', 'universityTag', 'examType']) {
        if (data[field] !== undefined && data[field] !== '') values[field] = data[field];
      }
      // Legacy text fields fall back to the raw values so the question always
      // carries its taxonomy labels even when IDs can't be resolved.
      if (!values.subject) values.subject = stringValue(data.subject) || 'General';
      if (!values.topic) values.topic = stringValue(data.topic) || 'General';

      // QID: explicit (validated) or freshly generated — never reuse one in the DB.
      if (data.qid && isValidQid(stringValue(data.qid))) {
        values.qid = stringValue(data.qid);
      } else {
        values.qid = await generateQid(db);
      }

      // Taxonomy: resolve again at insert time, creating missing entries when asked.
      const taxonomy = await resolveTaxonomy(data);
      if (req.createMissingTaxonomy) {
        await ensureTaxonomy(data, taxonomy);
      }
      for (const key of ['countryId', 'examId', 'programId', 'yearId', 'subjectId', 'systemId', 'topicId', 'subtopicId'] as const) {
        if (taxonomy[key] !== undefined) values[key] = taxonomy[key];
      }

      // Imported content enters the review pipeline rather than publishing
      // directly — a human/medical reviewer approves it in the admin Review
      // Queue before students see it.
      values.status = data.status || 'pending_review';
      values.publishedAt = values.status === 'published' ? new Date() : null;

      await db.insert(questionsTable).values(values);
      inserted++;
    } catch (err: any) {
      skipped++;
      errors.push(`Row ${row.rowNumber}: ${err.message}`);
    }
  }

  return { inserted, skipped, errors };
}

// ---------------------------------------------------------------------------
// Ensure taxonomy rows exist for a question's labels (content taxonomy only:
// subjects → systems → topics → subtopics). Institutional entities (exams,
// programs, years) are never auto-created.
// ---------------------------------------------------------------------------

async function ensureTaxonomy(data: Record<string, any>, map: TaxonomyMap) {
  const name = (v: any) => stringValue(v).trim();
  const subject = name(data.subject);
  const system = name(data.system);
  const topic = name(data.topic);
  const subtopic = name(data.subtopic);

  if (subject && map.subjectId === undefined) {
    const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'subject';
    const [row] = await db.insert(subjectsTable).values({ code: `S-${slug}-${Date.now().toString(36)}`, name: subject, active: true }).returning();
    map.subjectId = row.id;
  }
  if (system && map.subjectId !== undefined && map.systemId === undefined) {
    const [row] = await db.insert(systemsTable).values({ name: system, subjectId: map.subjectId, active: true }).returning();
    map.systemId = row.id;
  }
  if (topic && map.systemId !== undefined && map.topicId === undefined) {
    const [row] = await db.insert(topicsTable).values({ name: topic, systemId: map.systemId, active: true }).returning();
    map.topicId = row.id;
  }
  if (subtopic && map.topicId !== undefined && map.subtopicId === undefined) {
    const [row] = await db.insert(subtopicsTable).values({ name: subtopic, topicId: map.topicId, active: true }).returning();
    map.subtopicId = row.id;
  }
}
