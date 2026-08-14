import { pgTable, serial, text, jsonb, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type QuestionStatus =
  | "draft"
  | "pending_review"
  | "under_medical_review"
  | "approved"
  | "published"
  | "flagged"
  | "errata"
  | "archived";

export const QUESTION_STATUSES: QuestionStatus[] = [
  "draft",
  "pending_review",
  "under_medical_review",
  "approved",
  "published",
  "flagged",
  "errata",
  "archived",
];

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  // Immutable public identifier, e.g. "QID-MED-000001245". Never changes,
  // even if the question moves between topics or QBanks.
  qid: text("qid").unique(),
  questionText: text("question_text").notNull(),
  imageUrl: text("image_url"),
  options: jsonb("options").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
  explanationImageUrl: text("explanation_image_url"),
  wrongAnswerExplanations: text("wrong_answer_explanations"),
  references: text("references"),
  // --- Legacy free-text taxonomy (kept in sync with relational IDs below) ---
  subject: text("subject").notNull(),
  system: text("system"),
  topic: text("topic").notNull(),
  subtopic: text("subtopic"),
  qbankType: text("qbank_type"),
  universityTag: text("university_tag"),
  examType: text("exam_type"),
  difficulty: text("difficulty").notNull().default("medium"),
  tags: jsonb("tags").$type<string[]>().default([]),
  isFree: boolean("is_free").notNull().default(false),
  // --- Hybrid relational taxonomy IDs (source of truth when set) ---
  countryId: integer("country_id"),
  examId: integer("exam_id"),
  programId: integer("program_id"),
  yearId: integer("year_id"),
  subjectId: integer("subject_id"),
  systemId: integer("system_id"),
  topicId: integer("topic_id"),
  subtopicId: integer("subtopic_id"),
  // --- Content lifecycle ---
  status: text("status").$type<QuestionStatus>().notNull().default("published"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
