import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";
import { questionsTable } from "./questions.js";

export const bookmarksTable = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  questionId: integer("question_id").notNull().references(() => questionsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.userId, t.questionId)]);

export const insertBookmarkSchema = createInsertSchema(bookmarksTable).omit({ id: true, createdAt: true });
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Bookmark = typeof bookmarksTable.$inferSelect;

