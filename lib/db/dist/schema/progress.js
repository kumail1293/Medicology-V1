import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users.js";
import { questionsTable } from "./questions.js";
export const userProgressTable = pgTable("user_progress", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    questionId: integer("question_id").notNull().references(() => questionsTable.id),
    selectedAnswer: text("selected_answer").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    timeTaken: integer("time_taken"),
    mode: text("mode").notNull().default("practice"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertProgressSchema = createInsertSchema(userProgressTable).omit({ id: true, createdAt: true });
