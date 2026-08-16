import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

/** Author-authored clinical reasoning cases (progressive disclosure). */
export const clinicalCasesTable = pgTable("clinical_cases", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  system: text("system").notNull(),
  difficulty: text("difficulty").notNull().default("Medium"), // Easy | Medium | Hard
  examType: text("exam_type").notNull().default("MBBS"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(10),
  relatedSubject: text("related_subject").notNull(),
  // Progressive disclosure content
  chiefComplaint: text("chief_complaint").notNull(),
  history: text("history").notNull(),
  examination: text("examination").notNull(),
  investigations: text("investigations").notNull(),
  diagnosisOptions: text("diagnosis_options").default("[]"), // JSON array (may be empty = free-text)
  correctDiagnosis: text("correct_diagnosis").notNull(),
  explanation: text("explanation").notNull(),
  managementPlan: text("management_plan").notNull(),
  keyLearningPoints: text("key_learning_points").default("[]"), // JSON array of strings
  status: text("status").notNull().default("published"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Per-user case completion record (server-side, in addition to local state). */
export const caseCompletionsTable = pgTable("case_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  caseId: integer("case_id").notNull().references(() => clinicalCasesTable.id),
  timeSpentSeconds: integer("time_spent_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClinicalCaseSchema = createInsertSchema(clinicalCasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClinicalCase = z.infer<typeof insertClinicalCaseSchema>;
export type ClinicalCase = typeof clinicalCasesTable.$inferSelect;

export const insertCaseCompletionSchema = createInsertSchema(caseCompletionsTable).omit({ id: true, createdAt: true });
export type InsertCaseCompletion = z.infer<typeof insertCaseCompletionSchema>;
