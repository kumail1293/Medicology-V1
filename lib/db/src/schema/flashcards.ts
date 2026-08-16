import { pgTable, serial, text, integer, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";
import {
  countriesTable,
  examsTable,
  programsTable,
  academicYearsTable,
  subjectsTable,
  systemsTable,
  topicsTable,
  subtopicsTable,
} from "./taxonomy.js";

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
    // Flashcard taxonomy — decks (and their cards) live in the exam/content
    // hierarchy just like questions, so a deck can be targeted per exam,
    // program, year, subject, system or topic.
    countryId: integer("country_id").references(() => countriesTable.id),
    examId: integer("exam_id").references(() => examsTable.id),
    programId: integer("program_id").references(() => programsTable.id),
    yearId: integer("year_id").references(() => academicYearsTable.id),
    subjectId: integer("subject_id").references(() => subjectsTable.id),
    systemId: integer("system_id").references(() => systemsTable.id),
    topicId: integer("topic_id").references(() => topicsTable.id),
    subtopicId: integer("subtopic_id").references(() => subtopicsTable.id),
    // Denormalized taxonomy labels (kept in sync with the ids) so deck lists
    // and templates read cleanly without joins.
    country: text("country"),
    exam: text("exam"),
    program: text("program"),
    year: text("year"),
    system: text("system"),
    topic: text("topic"),
    subtopic: text("subtopic"),
  },
  (table) => [
    index("flashcard_decks_status_idx").on(table.status),
    index("flashcard_decks_exam_idx").on(table.examId),
    index("flashcard_decks_topic_idx").on(table.topicId),
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
