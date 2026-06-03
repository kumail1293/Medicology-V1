import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const studyBuddiesTable = pgTable("study_buddies", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull(),
  recipientId: integer("recipient_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudyBuddy = typeof studyBuddiesTable.$inferSelect;

