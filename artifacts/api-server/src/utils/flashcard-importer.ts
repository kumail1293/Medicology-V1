// ============================================================================
// Bulk flashcard deck import engine.
//
// Pipeline:  file → parse → column mapping → validation → taxonomy mapping →
// preview → execute (create deck + insert cards).
//
// Supported formats:
//   • .xlsx / .xls  — spreadsheet. Sheet 1 can carry a deck-metadata block
//     (Deck Name, Deck Slug, Exam, Program, Year, Subject, ...) plus a card
//     table (Front, Back, Note, Tags, Image). A single sheet with only card
//     columns creates the deck from the provided deck metadata fields.
//   • .csv / .tsv   — same columns, one row per card.
//   • Anki text     — tab-separated "front<TAB>back" lines (with optional
//     # comment lines), the classic Anki export format.
//
// Taxonomy is resolved against the shared taxonomy tables and — when enabled —
// missing subjects/systems/topics/subtopics are auto-created, exactly like the
// question importer. Decks and cards can be organized per exam/program/year
// without touching the MCQ taxonomy.
// ============================================================================

import XLSX from 'xlsx';
import { db } from '../db.js';
import {
  flashcardDecksTable,
  flashcardsTable,
} from '@workspace/db';
import { eq } from './drizzle.js';
import { resolveTaxonomy } from './importer.js';

// ---------------------------------------------------------------------------
// Column mapping — spreadsheet headers accepted for each field.
// ---------------------------------------------------------------------------

const CARD_HEADER_ALIASES: Record<string, string[]> = {
  front: ['front', 'fronttext', 'question', 'term', 'cardfront'],
  back: ['back', 'backtext', 'answer', 'definition', 'cardback'],
  note: ['note', 'notes', 'extra', 'hint'],
  tags: ['tags', 'tag'],
  image: ['image', 'imageurl', 'image url', 'picture', 'img'],
  subject: ['subject', 'subjectname', 'subject name'],
  system: ['system', 'bodysystem', 'body system', 'organ system'],
  topic: ['topic', 'topicname', 'topic name'],
  subtopic: ['subtopic', 'subtopicname', 'sub topic', 'sub-topic'],
  exam: ['exam', 'university', 'universitytag', 'university tag', 'board', 'examcode'],
  program: ['program', 'programme', 'degree', 'course'],
  year: ['year', 'academicyear', 'academic year'],
  country: ['country', 'countryname'],
  deckName: ['deckname', 'deck name', 'deck'],
  deckSlug: ['deckslug', 'deck slug', 'slug'],
  deckDescription: ['deckdescription', 'deck description', 'description'],
};

const normalizeHeader = (header: string) =>
  header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

export interface FlashcardImportRow {
  rowNumber: number; // 1-based (including header row)
  data: Record<string, any>;
  status: 'valid' | 'error';
  messages: string[];
  // Resolved taxonomy ids (from the shared taxonomy).
  countryId?: number;
  examId?: number;
  programId?: number;
  yearId?: number;
  subjectId?: number;
  systemId?: number;
  topicId?: number;
  subtopicId?: number;
}

export interface FlashcardImportPreview {
  fileName: string;
  format: string;
  totalRows: number;
  deck: {
    name: string;
    slug: string;
    description?: string | null;
    subject?: string;
    status: string;
  };
  rows: FlashcardImportRow[];
  stats: { valid: number; error: number };
  taxonomyNotes: string[];
}

export interface FlashcardImportExecuteRequest {
  rows: FlashcardImportRow[];
  createMissingTaxonomy?: boolean;
  userId?: number | null;
  deck?: {
    name?: string;
    slug?: string;
    description?: string | null;
    subject?: string;
    status?: string;
    country?: string;
    exam?: string;
    program?: string;
    year?: string;
    system?: string;
    topic?: string;
    subtopic?: string;
  };
}

const stringValue = (v: any) => (v === undefined || v === null ? '' : String(v)).trim();

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface ParsedCards {
  rows: FlashcardImportRow[];
  deckMeta: Record<string, any>;
}

function parseSpreadsheetCards(buffer: Buffer, fileName: string): ParsedCards {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The file contains no sheets');

  // Read as raw rows (header:1) so a deck-metadata block of key/value pairs at
  // the top doesn't get mistaken for column headers.
  const sheet = workbook.Sheets[sheetName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
  if (aoa.length === 0) throw new Error('The file contains no data rows');

  const deckMeta: Record<string, any> = {};

  // Scan the top block for key/value metadata rows (e.g. ["Deck Name", "X"]).
  const META_KEYS: Record<string, string> = {
    'deckname': 'deckName',
    'deck slug': 'deckSlug',
    'deckdescription': 'deckDescription',
    'deck description': 'deckDescription',
    'description': 'deckDescription',
    'deckexam': 'exam',
    'deck exam': 'exam',
    'deckprogram': 'program',
    'deck program': 'program',
    'deckyear': 'year',
    'deck year': 'year',
    'decksubject': 'subject',
    'deck subject': 'subject',
    'deckcountry': 'country',
    'deck country': 'country',
    'decksystem': 'system',
    'deck system': 'system',
    'decktopic': 'topic',
    'deck topic': 'topic',
    'decksubtopic': 'subtopic',
    'deck subtopic': 'subtopic',
  };

  // Find the first row that looks like a card header (contains Front/Back).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const row = aoa[i].map((v) => normalizeHeader(String(v ?? '')));
    if (row.includes('front') || row.includes('fronttext') || row.includes('question')) {
      // It's a header row only if it has at least 2 recognizable columns.
      const recognized = row.filter((h) =>
        h && Object.values(CARD_HEADER_ALIASES).some((aliases) => aliases.includes(h))
      ).length;
      if (recognized >= 2) {
        headerIdx = i;
        break;
      }
    }
    // Otherwise, treat [key, value] pairs as deck metadata.
    const key = normalizeHeader(String(row[0] ?? ''));
    const field = META_KEYS[key] ?? META_KEYS[row[0]?.toLowerCase() ?? ''];
    if (field && String(aoa[i][1] ?? '') !== '') {
      deckMeta[field] = String(aoa[i][1]).trim();
    }
  }

  if (headerIdx === -1) throw new Error('Could not find a card header row (Front/Back columns) in the file');

  // Map the header row to field names, then read card rows below it.
  // headerMap maps the column index → canonical field key (front/back/...).
  const headers = aoa[headerIdx].map((h) => String(h ?? '').trim());
  const headerMap: Record<string, string> = {};
  for (const [col, header] of headers.entries()) {
    const normalized = normalizeHeader(header);
    let field: string | undefined;
    for (const [candidate, aliases] of Object.entries(CARD_HEADER_ALIASES)) {
      if (aliases.includes(normalized)) {
        field = candidate;
        break;
      }
    }
    if (field && headerMap[col] === undefined) headerMap[col] = field;
  }

  const rows: FlashcardImportRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const rawRow = aoa[i];
    if (rawRow.every((v: any) => stringValue(v) === '')) continue; // skip blank rows
    const data: Record<string, any> = {};
    for (const [col, field] of Object.entries(headerMap)) {
      const value = rawRow[Number(col)];
      if (value !== undefined && value !== null && stringValue(value) !== '') {
        data[field] = typeof value === 'string' ? value.trim() : value;
      }
    }
    const row: FlashcardImportRow = {
      rowNumber: i + 2,
      data,
      status: 'valid',
      messages: [],
    };
    if (!stringValue(data.front)) {
      row.status = 'error';
      row.messages.push('No front text');
    }
    rows.push(row);
  }

  if (rows.length === 0) throw new Error('No card rows found below the header row');
  return { rows, deckMeta };
}

function parseAnkiTextCards(text: string): ParsedCards {
  const lines = text.split(/\r?\n/);
  const rows: FlashcardImportRow[] = [];
  let index = 1;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [front, ...rest] = line.split('\t');
    const back = rest.join('\t');
    const row: FlashcardImportRow = {
      rowNumber: index + 1,
      data: { front: (front ?? '').trim(), back: back?.trim() ?? '' },
      status: 'valid',
      messages: [],
    };
    if (!row.data.front) {
      row.status = 'error';
      row.messages.push('No front text');
    }
    rows.push(row);
    index++;
  }
  return { rows, deckMeta: {} };
}

export function parseFlashcardFile(buffer: Buffer, fileName: string): { rows: FlashcardImportRow[]; deckMeta: Record<string, any>; format: string } {
  const lower = fileName.toLowerCase();
  let parsed: ParsedCards;
  let format: string;
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    parsed = parseSpreadsheetCards(buffer, fileName);
    format = 'spreadsheet';
  } else if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    parsed = parseSpreadsheetCards(buffer, fileName);
    format = 'csv';
  } else if (lower.endsWith('.txt')) {
    parsed = parseAnkiTextCards(buffer.toString('utf8'));
    format = 'anki-text';
  } else if (lower.endsWith('.apkg')) {
    throw new Error('Anki .apkg files must be parsed through parseApkgFile (async — media extraction)');
  } else {
    throw new Error('Unsupported file — use .xlsx, .xls, .csv, .tsv, .txt (Anki text) or .apkg (Anki package)');
  }
  return { rows: parsed.rows, deckMeta: parsed.deckMeta, format };
}

/**
 * Parse an Anki .apkg package into import rows. The primary field of each
 * note type becomes the card front, the remaining fields form the back, and
 * embedded media is extracted into the shared media library with `<img>`
 * references rewritten to the served URLs.
 */
export async function parseApkgFile(
  buffer: Buffer,
  fileName: string,
  userId: number | null = null,
): Promise<{ rows: FlashcardImportRow[]; deckMeta: Record<string, any>; format: string; mediaImported: number }> {
  const { parseApkg, importApkgMedia, rewriteCardImages } = await import('./flashcard-apkg.js');
  const { db } = await import('../db.js');
  const { mediaTable } = await import('@workspace/db');

  const { notes, models, media, deckNameHint } = await parseApkg(buffer);
  const urlMap = await importApkgMedia(media, userId, db, mediaTable);

  const rows: FlashcardImportRow[] = [];
  let rowNumber = 1;
  for (const note of notes) {
    rowNumber++;
    const model = models.get(note.mid);
    const fields = note.fields;

    // Pick the front field: the note type's first field, or a conventionally
    // named front field (Text / Front / Question / FrontSide) when present.
    let frontIdx = 0;
    if (model && model.fieldNames.length > 0) {
      const named = model.fieldNames.findIndex((f) => /^(text|front|question|frontside)$/i.test(f.trim()));
      if (named >= 0) frontIdx = named;
    }

    const front = stringValue(fields[frontIdx]);
    // Everything else becomes the back (AnKing note types carry lecture notes,
    // missed questions and resource tags after the main front/extra fields).
    const backParts = fields
      .filter((_, i) => i !== frontIdx)
      .map((f) => stringValue(f))
      .filter(Boolean);
    const back = backParts.join('<br>');

    const row: FlashcardImportRow = {
      rowNumber,
      data: {
        front: rewriteCardImages(front, urlMap),
        back: rewriteCardImages(back, urlMap),
        tags: note.tags,
      },
      status: front ? 'valid' : 'error',
      messages: front ? [] : ['Missing front text'],
    };
    rows.push(row);
  }

  const hint = stringValue(deckNameHint) || fileName.replace(/\.apkg$/i, '');
  return {
    rows,
    deckMeta: { deckName: hint, deckSlug: slugify(hint) },
    format: 'apkg',
    mediaImported: urlMap.size,
  };
}

// ---------------------------------------------------------------------------
// Validation + taxonomy mapping
// ---------------------------------------------------------------------------

function validateCard(row: FlashcardImportRow): void {
  const data = row.data;
  const front = stringValue(data.front);
  if (!front) {
    row.messages.push('Missing front text');
  } else {
    data.front = front;
  }
  const back = stringValue(data.back);
  if (back) data.back = back;
  else if (data.back === undefined) data.back = '';
  const tags = stringValue(data.tags);
  if (tags) data.tags = tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  if (stringValue(data.image)) data.image = stringValue(data.image);
  if (stringValue(data.note)) data.note = stringValue(data.note);
  if (row.messages.some((m) => m.startsWith('Missing front'))) {
    row.status = 'error';
  }
}

export interface FlashcardImportPreviewWithMedia extends FlashcardImportPreview {
  mediaImported?: number;
}

export async function buildFlashcardImportPreview(
  buffer: Buffer,
  fileName: string,
  userId: number | null = null,
): Promise<FlashcardImportPreviewWithMedia> {
  const { rows, deckMeta, format, mediaImported } = fileName.toLowerCase().endsWith('.apkg')
    ? await parseApkgFile(buffer, fileName, userId)
    : { ...parseFlashcardFile(buffer, fileName), mediaImported: 0 };
  const taxonomyNotes: string[] = [];

  for (const row of rows) {
    validateCard(row);
    if (row.status !== 'valid') continue;
    const taxonomy = await resolveTaxonomy({ ...row.data, universityTag: row.data.exam });
    Object.assign(row, {
      countryId: taxonomy.countryId,
      examId: taxonomy.examId,
      programId: taxonomy.programId,
      yearId: taxonomy.yearId,
      subjectId: taxonomy.subjectId,
      systemId: taxonomy.systemId,
      topicId: taxonomy.topicId,
      subtopicId: taxonomy.subtopicId,
    });
    taxonomyNotes.push(...taxonomy.messages);
  }

  const stats = { valid: 0, error: 0 };
  for (const row of rows) stats[row.status]++;

  // Deck metadata — derive a name/slug from the file or the first row's
  // taxonomy labels when the sheet didn't carry explicit deck columns.
  const first = rows.find((r) => r.status === 'valid');
  const exam = stringValue(deckMeta.exam ?? first?.data.exam);
  const program = stringValue(deckMeta.program ?? first?.data.program);
  const year = stringValue(deckMeta.year ?? first?.data.year);
  const subject = stringValue(deckMeta.subject ?? first?.data.subject);
  const autoName = [exam, program, year, subject].filter(Boolean).join(' – ') || fileName.replace(/\.[^.]+$/, '');
  const deckName = stringValue(deckMeta.deckName) || autoName;
  const slug = stringValue(deckMeta.deckSlug) || slugify(deckName);

  return {
    fileName,
    format,
    totalRows: rows.length,
    deck: {
      name: deckName,
      slug,
      description: stringValue(deckMeta.deckDescription) || null,
      subject: subject || first?.data.subject || 'Other',
      status: 'draft',
    },
    rows,
    stats,
    taxonomyNotes: [...new Set(taxonomyNotes)].slice(0, 25),
    mediaImported,
  };
}

// ---------------------------------------------------------------------------
// Execute: create the deck (if needed) + insert cards.
// ---------------------------------------------------------------------------

export async function executeFlashcardImport(req: FlashcardImportExecuteRequest): Promise<{
  deckId: number;
  deck: any;
  inserted: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;
  const createMissing = req.createMissingTaxonomy ?? true;

  const eligible = req.rows.filter((row) => row.status === 'valid');

  // Resolve taxonomy per row up front, auto-creating content entries when asked.
  for (const row of eligible) {
    const taxonomy = await resolveTaxonomy({ ...row.data, universityTag: row.data.exam });
    if (createMissing) {
      await ensureFlashcardTaxonomy(row.data, taxonomy);
    }
    Object.assign(row, {
      countryId: taxonomy.countryId,
      examId: taxonomy.examId,
      programId: taxonomy.programId,
      yearId: taxonomy.yearId,
      subjectId: taxonomy.subjectId,
      systemId: taxonomy.systemId,
      topicId: taxonomy.topicId,
      subtopicId: taxonomy.subtopicId,
    });
  }

  // Determine deck identity — explicit deck block or derived from first row.
  const deck = req.deck ?? {};
  const first = eligible[0];
  const examLabel = stringValue(deck.exam ?? first?.data.exam);
  const programLabel = stringValue(deck.program ?? first?.data.program);
  const yearLabel = stringValue(deck.year ?? first?.data.year);
  const subjectLabel = stringValue(deck.subject ?? first?.data.subject);
  const countryLabel = stringValue(deck.country ?? first?.data.country);

  const name = stringValue(deck.name) ||
    [examLabel, programLabel, yearLabel, subjectLabel].filter(Boolean).join(' – ') ||
    'Imported Deck';
  const slug = stringValue(deck.slug) || slugify(name);
  const status = (deck.status as string) || 'draft';

  let deckRow: any;
  const existing = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.slug, slug));
  if (existing.length > 0) {
    deckRow = existing[0];
    errors.push(`Deck slug "${slug}" already exists — cards were added to the existing deck instead.`);
  } else {
    const [created] = await db
      .insert(flashcardDecksTable)
      .values({
        slug,
        name,
        subject: subjectLabel || 'Other',
        description: stringValue(deck.description) || null,
        status,
        cardCount: eligible.length,
        countryId: first?.countryId,
        examId: first?.examId,
        programId: first?.programId,
        yearId: first?.yearId,
        subjectId: first?.subjectId,
        systemId: first?.systemId,
        topicId: first?.topicId,
        subtopicId: first?.subtopicId,
        country: countryLabel || null,
        exam: examLabel || null,
        program: programLabel || null,
        year: yearLabel || null,
        system: stringValue(deck.system ?? first?.data.system) || null,
        topic: stringValue(deck.topic ?? first?.data.topic) || null,
        subtopic: stringValue(deck.subtopic ?? first?.data.subtopic) || null,
      })
      .returning();
    deckRow = created;
  }

  // Insert cards (skip rows that fail mid-insert).
  let sortOrder = 0;
  for (const row of eligible) {
    try {
      await db.insert(flashcardsTable).values({
        deckId: deckRow.id,
        front: stringValue(row.data.front),
        back: stringValue(row.data.back),
        note: stringValue(row.data.note) || null,
        tags: Array.isArray(row.data.tags) ? row.data.tags : [],
        image: stringValue(row.data.image) || null,
        sortOrder,
        createdBy: (req as any).userId ?? null,
      });
      sortOrder++;
      inserted++;
    } catch (err: any) {
      skipped++;
      errors.push(`Row ${row.rowNumber}: ${err.message}`);
    }
  }

  if (existing.length === 0) {
    await db
      .update(flashcardDecksTable)
      .set({ cardCount: inserted, updatedAt: new Date() })
      .where(eq(flashcardDecksTable.id, deckRow.id));
  } else {
    await db
      .update(flashcardDecksTable)
      .set({ cardCount: Number(deckRow.cardCount ?? 0) + inserted, updatedAt: new Date() })
      .where(eq(flashcardDecksTable.id, deckRow.id));
  }

  return { deckId: deckRow.id, deck: deckRow, inserted, skipped, errors: [...new Set(errors)].slice(0, 50) };
}

// ---------------------------------------------------------------------------
// Auto-create missing content-taxonomy rows (subjects → systems → topics →
// subtopics), mirroring the question importer.
// ---------------------------------------------------------------------------

async function ensureFlashcardTaxonomy(data: Record<string, any>, map: Record<string, any>) {
  const { subjectsTable, systemsTable, topicsTable, subtopicsTable } = await import('@workspace/db');
  const name = (v: any) => stringValue(v);
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
