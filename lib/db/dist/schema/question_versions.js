import { pgTable, serial, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { questionsTable } from "./questions.js";
import { usersTable } from "./users.js";
export const VERSION_CHANGE_TYPES = [
    "create",
    "update",
    "answer_change",
    "explanation_change",
    "status_change",
    "taxonomy_change",
    "delete",
];
export const questionVersionsTable = pgTable("question_versions", {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
        .notNull()
        .references(() => questionsTable.id),
    // Snapshot of the public QID (survives even if the question row is removed).
    qid: text("qid"),
    versionNumber: integer("version_number").notNull().default(1),
    changeType: text("change_type").$type().notNull().default("update"),
    // Human-readable summary, e.g. "Correct answer changed from C to B".
    summary: text("summary"),
    // Full snapshot of the tracked fields before / after the change.
    oldValues: jsonb("old_values").$type(),
    newValues: jsonb("new_values").$type(),
    // Who made the change.
    changedBy: integer("changed_by").references(() => usersTable.id),
    changedByName: text("changed_by_name"),
    // Medical review workflow fields (populated by the review pipeline).
    reviewerId: integer("reviewer_id").references(() => usersTable.id),
    reviewerName: text("reviewer_name"),
    reviewStatus: text("review_status").$type().notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    // Version history is read per question.
    index("question_versions_question_idx").on(table.questionId),
]);
export const insertQuestionVersionSchema = createInsertSchema(questionVersionsTable).omit({
    id: true,
    createdAt: true,
});
