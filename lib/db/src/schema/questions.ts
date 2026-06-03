import { pgTable, serial, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  questionText: text("question_text").notNull(),
  imageUrl: text("image_url"),
  options: jsonb("options").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
  explanationImageUrl: text("explanation_image_url"),
  wrongAnswerExplanations: text("wrong_answer_explanations"),
  references: text("references"),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, createdAt: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;

