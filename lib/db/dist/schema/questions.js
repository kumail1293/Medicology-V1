import { pgTable, serial, text, jsonb, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const QUESTION_TYPES = [
    "sba",
    "best_of_five",
    "true_false",
    "assertion_reason",
    "emq",
    "image_based",
    "clinical_vignette",
    "case_based",
];
export const QUESTION_STATUSES = [
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
    questionType: text("question_type").$type().notNull().default("sba"),
    imageUrl: text("image_url"),
    options: jsonb("options").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    explanation: text("explanation").notNull(),
    explanationImageUrl: text("explanation_image_url"),
    // --- Structured explanations (P1 exam engine) ---
    whyCorrect: text("why_correct"),
    whyWrong: text("why_wrong"),
    examPearl: text("exam_pearl"),
    commonTrap: text("common_trap"),
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
    tags: jsonb("tags").$type().default([]),
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
    status: text("status").$type().notNull().default("published"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    // Review queue and admin filtering run per status (draft/pending_review/…).
    index("questions_status_idx").on(table.status),
]);
export const insertQuestionSchema = createInsertSchema(questionsTable).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
