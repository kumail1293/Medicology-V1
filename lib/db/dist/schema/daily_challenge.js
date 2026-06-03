import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users.js";
export const dailyChallengeTable = pgTable("daily_challenge", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    date: text("date").notNull(),
    score: integer("score"),
    total: integer("total"),
    isCompleted: boolean("is_completed").notNull().default(false),
    streak: integer("streak").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertDailyChallengeSchema = createInsertSchema(dailyChallengeTable).omit({ id: true, createdAt: true });
