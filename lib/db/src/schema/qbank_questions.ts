import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { qbanksTable } from "./qbanks.js";
import { questionsTable } from "./questions.js";

// ============================================================================
// Many-to-many mapping: questions ↔ qbank_questions ↔ qbanks.
//
// A single QID can appear in UHS MBBS, KMU MBBS, FCPS Part I and NLE without
// ever duplicating the question row — access is scoped per QBank instead.
// ============================================================================

export const qbankQuestionsTable = pgTable(
  "qbank_questions",
  {
    id: serial("id").primaryKey(),
    qbankId: integer("qbank_id")
      .notNull()
      .references(() => qbanksTable.id),
    questionId: integer("question_id")
      .notNull()
      .references(() => questionsTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("qbank_questions_qbank_question_uq").on(table.qbankId, table.questionId)]
);

export type QbankQuestion = typeof qbankQuestionsTable.$inferSelect;
