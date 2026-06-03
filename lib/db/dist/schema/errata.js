import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { questionsTable } from "./questions.js";
export const errataTable = pgTable("errata", {
    id: serial("id").primaryKey(),
    questionId: integer("question_id").notNull().references(() => questionsTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    errorType: text("error_type").notNull(),
    description: text("description").notNull(),
    correction: text("correction").notNull(),
    referenceUrl: text("reference_url"),
    status: text("status").notNull().default("pending"),
    adminNotes: text("admin_notes"),
    rewardPoints: integer("reward_points").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at"),
});
