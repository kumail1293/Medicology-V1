import { pgTable, serial, text, integer, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

// ============================================================================
// Admin-authored flashcard decks. Content lives in the database (source of
// truth) and is synced into a user's local spaced-repetition study system.
// Front/back are rich HTML (tables, images, flowcharts) — see the shared
// RichText sanitizer on the client.
// ============================================================================

export const flashcardDecksTable = pgTable(
  "flashcard_decks",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(), // e.g. "usmle-step1-pharmacology"
    name: text("name").notNull(),
    subject: text("subject").notNull().default("Other"),
    description: text("description"),
    // Published decks are visible to students; drafts are hidden until ready.
    status: text("status").notNull().default("draft"), // draft | published | archived
    cardCount: integer("card_count").notNull().default(0),
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("flashcard_decks_status_idx").on(table.status),
  ]
);

export const flashcardsTable = pgTable(
  "flashcards",
  {
    id: serial("id").primaryKey(),
    deckId: integer("deck_id")
      .notNull()
      .references(() => flashcardDecksTable.id),
    // Rich HTML for the question / term (front) and answer / definition (back).
    front: text("front").notNull(),
    back: text("back").notNull().default(""),
    note: text("note"),
    tags: jsonb("tags").$type<string[]>().default([]),
    // Optional standalone image (URL) shown with the front.
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("flashcards_deck_idx").on(table.deckId),
  ]
);

export const insertFlashcardDeckSchema = createInsertSchema(flashcardDecksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertFlashcardSchema = createInsertSchema(flashcardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FlashcardDeck = typeof flashcardDecksTable.$inferSelect;
export type FlashcardRow = typeof flashcardsTable.$inferSelect;
