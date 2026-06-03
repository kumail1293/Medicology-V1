import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
export const testSessionsTable = pgTable("test_sessions", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    title: text("title"),
    mode: text("mode").notNull().default("tutor"),
    questionIds: jsonb("question_ids").notNull().$type().default([]),
    answers: jsonb("answers").notNull().$type().default({}),
    flaggedQuestions: jsonb("flagged_questions").$type().default([]),
    subjectFilter: jsonb("subject_filter").$type().default([]),
    questionFilter: text("question_filter").notNull().default("all"),
    difficulty: text("difficulty"),
    status: text("status").notNull().default("in_progress"),
    currentIndex: integer("current_index").notNull().default(0),
    totalCorrect: integer("total_correct"),
    totalTime: integer("total_time"),
    examType: text("exam_type"),
    universityTag: text("university_tag"),
    mbbsYear: integer("mbbs_year"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
});
