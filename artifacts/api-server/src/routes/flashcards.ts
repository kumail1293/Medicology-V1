import { Router } from 'express';
import { db } from '../db.js';
import { flashcardDecksTable, flashcardsTable } from '@workspace/db';
import { eq, and, sql } from '../utils/drizzle.js';
import { authenticate, requireContentEditor } from '../middleware/auth.js';
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

export const flashcardsRouter = Router();

const actorOf = (req: any) => ({ id: req.user?.id, name: req.user?.name, email: req.user?.email });

// ---------------------------------------------------------------------------
// Admin / content-editor deck management.
// ---------------------------------------------------------------------------

// List decks with live card counts (all statuses for editors).
flashcardsRouter.get('/admin/decks', authenticate, requireContentEditor, async (req: any, res: any) => {
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
flashcardsRouter.post('/admin/decks', authenticate, requireContentEditor, validateBody(createFlashcardDeckSchema), async (req: any, res: any) => {
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
flashcardsRouter.put('/admin/decks/:id', authenticate, requireContentEditor, validateParams(questionIdParamSchema), validateBody(updateFlashcardDeckSchema), async (req: any, res: any) => {
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
flashcardsRouter.delete('/admin/decks/:id', authenticate, requireContentEditor, validateParams(questionIdParamSchema), async (req: any, res: any) => {
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
// Cards within a deck.
// ---------------------------------------------------------------------------

flashcardsRouter.get('/admin/decks/:id/cards', authenticate, requireContentEditor, validateParams(questionIdParamSchema), async (req: any, res: any) => {
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
flashcardsRouter.post('/admin/decks/:id/cards', authenticate, requireContentEditor, validateParams(questionIdParamSchema), validateBody(createFlashcardSchema), async (req: any, res: any) => {
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
flashcardsRouter.post('/admin/decks/:id/cards/bulk', authenticate, requireContentEditor, validateParams(questionIdParamSchema), validateBody(bulkFlashcardsSchema), async (req: any, res: any) => {
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
flashcardsRouter.put('/admin/cards/:id', authenticate, requireContentEditor, validateParams(questionIdParamSchema), validateBody(updateFlashcardSchema), async (req: any, res: any) => {
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
flashcardsRouter.delete('/admin/cards/:id', authenticate, requireContentEditor, validateParams(questionIdParamSchema), async (req: any, res: any) => {
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
