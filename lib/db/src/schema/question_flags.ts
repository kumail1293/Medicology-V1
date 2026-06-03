import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { questionsTable } from "./questions.js";

export const questionFlagsTable = pgTable("question_flags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  questionId: integer("question_id").notNull().references(() => questionsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QuestionFlag = typeof questionFlagsTable.$inferSelect;

