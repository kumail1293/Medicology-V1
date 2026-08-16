import { pgTable, serial, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

// ============================================================================
// Study Notes Library.
//
// Admin/faculty-curated high-yield study notes shown on the student Notes
// Library page (/notes). Each note belongs to a subject, can carry tags, and
// students can bookmark notes for quick access. Distinct from the per-question
// personal `notes` table (user notes attached to a specific question).
// ============================================================================

export const studyNotesTable = pgTable(
  "study_notes",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    subject: text("subject").notNull(),
    content: text("content").notNull(), // markdown / rich text body
    tags: text("tags").notNull().default("[]"), // JSON string array
    status: text("status").notNull().default("published"), // draft | published | archived
    featured: boolean("featured").notNull().default(false),
    createdById: integer("created_by_id").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("study_notes_subject_idx").on(table.subject),
    index("study_notes_status_idx").on(table.status),
  ]
);

export const studyNoteBookmarksTable = pgTable(
  "study_note_bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    noteId: integer("note_id")
      .notNull()
      .references(() => studyNotesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("study_note_bookmarks_user_idx").on(table.userId)]
);

export const insertStudyNoteSchema = createInsertSchema(studyNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStudyNote = z.infer<typeof insertStudyNoteSchema>;
export type StudyNote = typeof studyNotesTable.$inferSelect;
export type StudyNoteBookmark = typeof studyNoteBookmarksTable.$inferSelect;
