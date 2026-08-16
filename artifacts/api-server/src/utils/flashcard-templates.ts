// ============================================================================
// Bulk flashcard deck templates.
//
// Generates a downloadable .xlsx workbook (or plain .csv) for creating a deck
// per exam. Sheet 1 carries a deck-metadata block + a card table with example
// rows; the Guide sheet explains every column. The CSV variant includes the
// same card columns so it can be opened in Excel/Google Sheets directly.
// ============================================================================

import XLSX from 'xlsx';

// Card columns (order matters — matches CARD_HEADER_ALIASES in the importer).
export const FLASHCARD_COLUMNS: { header: string; required: boolean; example: string; note: string }[] = [
  { header: 'Front', required: true, example: 'Most common cause of community-acquired pneumonia?', note: 'The question / term. Rich text allowed.' },
  { header: 'Back', required: true, example: 'Streptococcus pneumoniae', note: 'The answer / definition. Rich text allowed.' },
  { header: 'Note', required: false, example: 'Capsule polysaccharide is the key virulence factor.', note: 'Mnemonic or extra context.' },
  { header: 'Tags', required: false, example: 'respiratory, microbiology', note: 'Comma or semicolon separated.' },
  { header: 'Image URL', required: false, example: '/api/storage/uploads/cxr.png', note: 'Optional image shown with the front.' },
  { header: 'Subject', required: false, example: 'Medicine', note: 'Content taxonomy (auto-created if missing when enabled).' },
  { header: 'System', required: false, example: 'Respiratory', note: 'Body system (taxonomy).' },
  { header: 'Topic', required: false, example: 'Pneumonia', note: 'Topic (taxonomy).' },
  { header: 'Subtopic', required: false, example: 'Community-Acquired Pneumonia', note: 'Subtopic (taxonomy).' },
  { header: 'Exam', required: false, example: 'UHS', note: 'Exam body / university code (UHS, KMU, FCPS, USMLE…).' },
  { header: 'Program', required: false, example: 'MBBS', note: 'Program (taxonomy).' },
  { header: 'Year', required: false, example: 'Final Year', note: 'Academic year (taxonomy).' },
  { header: 'Country', required: false, example: 'Pakistan', note: 'Country (taxonomy).' },
];

// Deck-metadata block rows placed above the card table.
const DECK_META_ROWS: [string, string][] = [
  ['DECK METADATA — fill these in (one per sheet)', ''],
  ['Deck Name', 'UHS MBBS Final Year – Respiratory'],
  ['Deck Slug', 'uhs-mbbs-final-respiratory'],
  ['Deck Description', 'High-yield respiratory flashcards for UHS final year.'],
  ['Deck Exam', 'UHS'],
  ['Deck Program', 'MBBS'],
  ['Deck Year', 'Final Year'],
  ['Deck Subject', 'Medicine'],
  ['', ''],
  ['CARDS — one row per card from here down', ''],
];

const GUIDE_ROWS: [string, string][] = [
  ['Medicology — Flashcard Deck Template', ''],
  ['', ''],
  ['1. How to use this template', 'Fill the deck-metadata block at the top (name, slug, exam, program, year, subject). Then fill one row per card starting at the "Front" header row. The importer maps columns by header name (case/punctuation-insensitive).'],
  ['', ''],
  ['2. Required columns', 'Front and Back. Everything else is optional — Subject/Exam/Program/Year come from the deck block when the card rows are blank.'],
  ['', ''],
  ['3. Taxonomy', 'Decks and cards are organized in their own taxonomy (exam → program → year / subject → system → topic → subtopic) — separate from the MCQ taxonomy. Missing subjects/systems/topics are auto-created when "create missing taxonomy" is enabled.'],
  ['', ''],
  ['4. Images', 'Put the image URL in the Image URL column (e.g. /api/storage/uploads/xxx.png or a full https URL). Markdown image links (![alt](url)) inside Front/Back also render.'],
  ['', ''],
  ['5. Anki text alternative', 'You can also paste Anki "export notes" text (front<TAB>back per line) into a .txt file and import that directly — deck metadata is derived from the first card\'s taxonomy columns.'],
  ['', ''],
  ['6. After importing', 'The deck is created as a draft — open Admin → Flashcards, review the cards, and publish when ready. Cards can be edited individually with the rich-text editor.'],
];

export function buildFlashcardTemplateWorkbook(format: 'xlsx' | 'csv'): Buffer | string {
  const headerRow = FLASHCARD_COLUMNS.map((c) => c.header);
  const exampleRow = FLASHCARD_COLUMNS.map((c) => c.example);

  const sheetRows: any[][] = [
    ...DECK_META_ROWS.map(([a, b]) => [a, b]),
    ['', ''],
    headerRow,
    exampleRow,
    FLASHCARD_COLUMNS.map(() => ''),
    FLASHCARD_COLUMNS.map(() => ''),
  ];

  if (format === 'csv') {
    // Plain CSV — deck metadata block + card rows. Commas/newlines escaped by xlsx.
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Cards');
    return XLSX.write(wb, { type: 'buffer', bookType: 'csv' }) as unknown as Buffer;
  }

  const wb = XLSX.utils.book_new();
  const templateSheet = XLSX.utils.aoa_to_sheet(sheetRows);
  templateSheet['!cols'] = FLASHCARD_COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));

  const guideSheet = XLSX.utils.aoa_to_sheet(GUIDE_ROWS);
  guideSheet['!cols'] = [{ wch: 45 }, { wch: 110 }];

  XLSX.utils.book_append_sheet(wb, templateSheet, 'Template');
  XLSX.utils.book_append_sheet(wb, guideSheet, 'Guide');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
