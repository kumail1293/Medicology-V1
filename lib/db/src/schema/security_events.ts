import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const securityEventsTable = pgTable("security_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  userId: integer("user_id"),
  type: text("type").notNull(),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SecurityEvent = typeof securityEventsTable.$inferSelect;
export type NewSecurityEvent = typeof securityEventsTable.$inferInsert;

