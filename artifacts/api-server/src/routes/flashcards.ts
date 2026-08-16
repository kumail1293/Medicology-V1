import { Router } from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { flashcardDecksTable, flashcardsTable } from '@workspace/db';
import { eq, and, sql } from '../utils/drizzle.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import {
  questionIdParamSchema,
  createFlashcardDeckSchema,
  updateFlashcardDeckSchema,
  createFlashcardSchema,
  updateFlashcardSchema,
  bulkFlashcardsSchema,
} from './schemas.js';
import type {
  CreateFlashcardDeck,
  UpdateFlashcardDeck,
  CreateFlashcard,
  UpdateFlashcard,
  BulkFlashcards,
} from './schemas.js';
import { recordAudit } from '../utils/audit.js';
import { requireFeature } from '../utils/feature-flags.js';
import {
  buildFlashcardImportPreview,
  executeFlashcardImport,
} from '../utils/flashcard-importer.js';
import { buildFlashcardTemplateWorkbook } from '../utils/flashcard-templates.js';

import { randomBytes } from 'crypto';

export const flashcardsRouter = Router();

// ---------------------------------------------------------------------------
// In-memory preview store.
//
// The deck-import execute step used to re-send every parsed card (full HTML)
// back to the server as JSON — a real AnKing deck is tens of thousands of
// cards, which blew past any reasonable body limit. Instead, the preview step
// now stores the parsed result here keyed by a random ID, and execute sends
// only a small delta (row edits + skipped indices). Entries expire after an
// hour to avoid unbounded growth.
// ---------------------------------------------------------------------------

interface StoredPreview {
  rows: any[];
  deck: any;
  noteTypes?: any[];
  createdAt: number;
}

const previewStore = new Map<string, StoredPreview>();
const PREVIEW_TTL = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, p] of previewStore) {
    if (now - p.createdAt > PREVIEW_TTL) previewStore.delete(id);
  }
}, 10 * 60 * 1000).unref?.();

function newPreviewId(): string {
  return randomBytes(12).toString('hex');
}

// Flashcards are a protected capability — enforced server-side.
flashcardsRouter.use(requireFeature('flashcards'));

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });

// ---------------------------------------------------------------------------
// Admin / content-editor deck management.
// ---------------------------------------------------------------------------

// List decks with live card counts (all statuses for editors).
flashcardsRouter.get('/admin/decks', authenticate, requirePermission('flashcards.manage'), async (req: any, res: any) => {
  try {
    const [decks, counts] = await Promise.all([
      db.select().from(flashcardDecksTable),
      db
        .select({ deckId: flashcardsTable.deckId, count: sql<number>`count(*)` })
        .from(flashcardsTable)
        .groupBy(flashcardsTable.deckId),
    ]);
    const countMap = new Map(counts.map((c: any) => [Number(c.deckId), Number(c.count)]));
    const rows = decks.map((d: any) => ({ ...d, cardCount: countMap.get(Number(d.id)) ?? 0 }));
    rows.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    res.json({ decks: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a deck.
flashcardsRouter.post('/admin/decks', authenticate, requirePermission('flashcards.manage'), validateBody(createFlashcardDeckSchema), async (req: any, res: any) => {
  try {
    const data = req.validatedBody as CreateFlashcardDeck;
    const existing = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.slug, data.slug));
    if (existing.length > 0) {
      return res.status(409).json({ error: `Slug \"${data.slug}\" is already in use` });
    }
    const [deck] = await db
      .insert(flashcardDecksTable)
      .values({ ...data, createdBy: req.user?.id ?? null })
      .returning();
    await recordAudit({
      actor: actorOf(req),
      action: 'flashcard.deck.create',
      entityType: 'flashcard_deck',
      entityId: deck.id,
      entityLabel: deck.slug,
      summary: `Created flashcard deck \"${deck.name}\"`,
      newValues: deck,
      ip: req.ip,
    });
    res.status(201).json(deck);
  } catch (err: any) {
    console.error('Error in admin create flashcard deck:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a deck.
flashcardsRouter.put('/admin/decks/:id', authenticate, requirePermission('flashcards.manage'), validateParams(questionIdParamSchema), validateBody(updateFlashcardDeckSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const data = req.validatedBody as UpdateFlashcardDeck;
    if (data.slug) {
      const matches = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.slug, data.slug));
      if (matches.some((d: any) => Number(d.id) !== Number(id))) {
        return res.status(409).json({ error: `Slug \"${data.slug}\" is already in use` });
      }
    }
    const [existing] = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Deck not found' });
    const [deck] = await db
      .update(flashcardDecksTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(flashcardDecksTable.id, id))
      .returning();
    await recordAudit({
      actor: actorOf(req),
      action: 'flashcard.deck.update',
      entityType: 'flashcard_deck',
      entityId: id,
      entityLabel: deck.slug,
      summary: `Updated flashcard deck \"${deck.name}\"`,
      oldValues: existing,
      newValues: deck,
      ip: req.ip,
    });
    res.json(deck);
  } catch (err: any) {
    console.error('Error in admin update flashcard deck:', err);
    res.status(500).json({ error: err.message });
  }
});

// Archive a deck (soft delete — keeps card history).
flashcardsRouter.delete('/admin/decks/:id', authenticate, requirePermission('flashcards.manage'), validateParams(questionIdParamSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const [existing] = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Deck not found' });
    const [deck] = await db
      .update(flashcardDecksTable)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(flashcardDecksTable.id, id))
      .returning();
    await recordAudit({
      actor: actorOf(req),
      action: 'flashcard.deck.archive',
      entityType: 'flashcard_deck',
      entityId: id,
      entityLabel: deck.slug,
      summary: `Archived flashcard deck \"${deck.name}\"`,
      oldValues: existing,
      newValues: deck,
      ip: req.ip,
    });
    res.json({ success: true, deck });
  } catch (err: any) {
    console.error('Error in admin archive flashcard deck:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Bulk deck import (admin) — template download + preview + execute.
// ---------------------------------------------------------------------------

// Downloadable deck template (.xlsx or .csv) with deck-metadata block, example
// card row and a Guide sheet. Cards map onto the flashcard taxonomy.
flashcardsRouter.get('/admin/decks/template', authenticate, requirePermission('flashcards.manage'), async (req: any, res: any) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const buffer = buildFlashcardTemplateWorkbook(format);
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="medicology-flashcard-deck-template.${ext}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const deckUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // AnKing-style .apkg decks with media can be multi-GB
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok = /(\.xlsx|\.xls|\.csv|\.tsv|\.txt|\.apkg)$/.test(name);
    if (ok) cb(null, true);
    else cb(new Error('Only .xlsx, .xls, .csv, .tsv, .txt (Anki text) or .apkg (Anki package) files are supported'));
  },
});

// Step 1: upload + parse + validate + resolve taxonomy.
flashcardsRouter.post('/admin/decks/import/preview', authenticate, requirePermission('flashcards.manage'), (req: any, res: any) => {
  deckUpload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      // Optional fieldMap (JSON) overrides the auto front/back split per
      // note type — sent by the admin field picker on re-preview.
      let fieldMap: Record<string, { front?: string | number; back?: Array<string | number> }> | undefined;
      if (req.body?.fieldMap) {
        try { fieldMap = JSON.parse(String(req.body.fieldMap)); } catch { /* ignore malformed */ }
      }
      const preview = await buildFlashcardImportPreview(req.file.buffer, req.file.originalname, req.user?.id ?? null, fieldMap);
      // Store the parsed result server-side so execute only needs a small
      // delta (edits + skips) instead of re-sending the entire deck.
      const previewId = newPreviewId();
      previewStore.set(previewId, {
        rows: preview.rows,
        deck: preview.deck,
        noteTypes: preview.noteTypes,
        createdAt: Date.now(),
      });
      res.json({ ...preview, previewId });
    } catch (parseErr: any) {
      res.status(400).json({ error: parseErr.message });
    }
  });
});

// Step 2: create the deck + insert the validated cards. The body is small:
// a previewId referencing the server-side parsed preview plus the admin's
// per-row edits/skips (indices + patches), NOT the full deck payload.
flashcardsRouter.post('/admin/decks/import/execute', authenticate, requirePermission('flashcards.manage'), async (req: any, res: any) => {
  try {
    const { previewId, rows, deck, createMissingTaxonomy, edits, skipped } = req.body ?? {};
    let finalRows = rows;
    if (previewId) {
      const stored = previewStore.get(previewId);
      if (!stored) {
        return res.status(400).json({ error: 'Preview expired — re-validate the file before importing' });
      }
      // Start from the server-side parsed rows (never trust client rows).
      finalRows = stored.rows.map((r: any) => ({ ...r, data: { ...r.data } }));
      // Apply the admin's per-row edits (index → {front, back, note, tags}).
      for (const [idxStr, patch] of Object.entries(edits ?? {})) {
        const i = Number(idxStr);
        const row = finalRows[i];
        if (!row) continue;
        row.data = { ...row.data, ...(patch as object) };
        row.status = row.data.front ? 'valid' : 'error';
        row.messages = row.data.front ? [] : ['Missing front text'];
      }
      // Apply skips (indices to exclude from the import).
      for (const i of (skipped ?? []) as number[]) {
        if (finalRows[i]) finalRows[i].status = 'skipped';
      }
      previewStore.delete(previewId);
    }
    if (!Array.isArray(finalRows) || finalRows.length === 0) {
      return res.status(400).json({ error: 'No card rows provided to import' });
    }
    const result = await executeFlashcardImport({
      rows: finalRows,
      deck: deck ?? undefined,
      createMissingTaxonomy: Boolean(createMissingTaxonomy),
      userId: req.user?.id,
    });
    await recordAudit({
      actor: { id: req.user?.id, name: req.user?.name, email: req.user?.email },
      action: 'flashcard.decks.bulk_import',
      entityType: 'flashcard_deck',
      entityId: result.deckId,
      entityLabel: result.deck.slug,
      summary: `Bulk deck import: ${result.inserted} card(s) inserted into "${result.deck.name}"`,
      newValues: result,
      ip: req.ip,
    });
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Error in flashcard deck import execute:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Cards within a deck.
// ---------------------------------------------------------------------------

flashcardsRouter.get('/admin/decks/:id/cards', authenticate, requirePermission('flashcards.manage'), validateParams(questionIdParamSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const cards = await db
      .select()
      .from(flashcardsTable)
      .where(eq(flashcardsTable.deckId, id))
      .orderBy(flashcardsTable.sortOrder, flashcardsTable.id);
    res.json({ deckId: id, cards });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a card (rich HTML front/back).
flashcardsRouter.post('/admin/decks/:id/cards', authenticate, requirePermission('flashcards.manage'), validateParams(questionIdParamSchema), validateBody(createFlashcardSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const data = req.validatedBody as CreateFlashcard;
    const [deck] = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.id, id));
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    const [card] = await db
      .insert(flashcardsTable)
      .values({
        deckId: id,
        front: data.front,
        back: data.back ?? '',
        note: data.note ?? null,
        tags: data.tags ?? [],
        image: data.image ?? null,
        sortOrder: data.sortOrder ?? 0,
        createdBy: req.user?.id ?? null,
      })
      .returning();
    await db
      .update(flashcardDecksTable)
      .set({ cardCount: Number(deck.cardCount ?? 0) + 1, updatedAt: new Date() })
      .where(eq(flashcardDecksTable.id, id));
    await recordAudit({
      actor: actorOf(req),
      action: 'flashcard.card.create',
      entityType: 'flashcard',
      entityId: card.id,
      entityLabel: deck.slug,
      summary: `Added card to deck \"${deck.name}\"`,
      newValues: { deckId: id, front: data.front.slice(0, 120) },
      ip: req.ip,
    });
    res.status(201).json(card);
  } catch (err: any) {
    console.error('Error in admin create flashcard:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk-add a whole deck of cards in one call.
flashcardsRouter.post('/admin/decks/:id/cards/bulk', authenticate, requirePermission('flashcards.manage'), validateParams(questionIdParamSchema), validateBody(bulkFlashcardsSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const { cards } = req.validatedBody as BulkFlashcards;
    const [deck] = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.id, id));
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    let inserted = 0;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      await db.insert(flashcardsTable).values({
        deckId: id,
        front: card.front,
        back: card.back ?? '',
        note: card.note ?? null,
        tags: card.tags ?? [],
        image: card.image ?? null,
        sortOrder: card.sortOrder ?? i,
        createdBy: req.user?.id ?? null,
      });
      inserted++;
    }
    await db
      .update(flashcardDecksTable)
      .set({ cardCount: Number(deck.cardCount ?? 0) + inserted, updatedAt: new Date() })
      .where(eq(flashcardDecksTable.id, id));
    await recordAudit({
      actor: actorOf(req),
      action: 'flashcard.cards.bulk_add',
      entityType: 'flashcard_deck',
      entityId: id,
      entityLabel: deck.slug,
      summary: `Bulk-added ${inserted} card(s) to deck \"${deck.name}\"`,
      newValues: { count: inserted },
      ip: req.ip,
    });
    res.status(201).json({ inserted });
  } catch (err: any) {
    console.error('Error in admin bulk add flashcards:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a card.
flashcardsRouter.put('/admin/cards/:id', authenticate, requirePermission('flashcards.manage'), validateParams(questionIdParamSchema), validateBody(updateFlashcardSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const data = req.validatedBody as UpdateFlashcard;
    const [existing] = await db.select().from(flashcardsTable).where(eq(flashcardsTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Card not found' });
    const [card] = await db
      .update(flashcardsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(flashcardsTable.id, id))
      .returning();
    await recordAudit({
      actor: actorOf(req),
      action: 'flashcard.card.update',
      entityType: 'flashcard',
      entityId: id,
      entityLabel: `deck#${existing.deckId}`,
      summary: 'Updated flashcard',
      oldValues: existing,
      newValues: card,
      ip: req.ip,
    });
    res.json(card);
  } catch (err: any) {
    console.error('Error in admin update flashcard:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a card.
flashcardsRouter.delete('/admin/cards/:id', authenticate, requirePermission('flashcards.manage'), validateParams(questionIdParamSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const [existing] = await db.select().from(flashcardsTable).where(eq(flashcardsTable.id, id));
    if (!existing) return res.status(404).json({ error: 'Card not found' });
    await db.delete(flashcardsTable).where(eq(flashcardsTable.id, id));
    const [deckRow] = await db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.id, existing.deckId));
    await db
      .update(flashcardDecksTable)
      .set({ cardCount: Math.max(0, Number(deckRow?.cardCount ?? 0) - 1), updatedAt: new Date() })
      .where(eq(flashcardDecksTable.id, existing.deckId));
    await recordAudit({
      actor: actorOf(req),
      action: 'flashcard.card.delete',
      entityType: 'flashcard',
      entityId: id,
      entityLabel: `deck#${existing.deckId}`,
      summary: 'Deleted flashcard',
      oldValues: { front: existing.front.slice(0, 120) },
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in admin delete flashcard:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Public — published decks and their cards, for syncing into a user's local
// spaced-repetition study system.
// ---------------------------------------------------------------------------

flashcardsRouter.get('/decks', authenticate, async (req: any, res: any) => {
  try {
    const decks = await db
      .select()
      .from(flashcardDecksTable)
      .where(eq(flashcardDecksTable.status, 'published'))
      .orderBy(flashcardDecksTable.name);
    res.json({ decks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

flashcardsRouter.get('/decks/:id/cards', authenticate, validateParams(questionIdParamSchema), async (req: any, res: any) => {
  try {
    const { id } = req.validatedParams as { id: number };
    const [deck] = await db
      .select()
      .from(flashcardDecksTable)
      .where(and(eq(flashcardDecksTable.id, id), eq(flashcardDecksTable.status, 'published')));
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    const cards = await db
      .select()
      .from(flashcardsTable)
      .where(eq(flashcardsTable.deckId, id))
      .orderBy(flashcardsTable.sortOrder, flashcardsTable.id);
    res.json({ deck, cards });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
