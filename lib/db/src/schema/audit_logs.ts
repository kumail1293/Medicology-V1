import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

// ============================================================================
// Audit log — one row per important admin/content action:
//
//   Actor | Action | Object | Old value | New value | IP | Timestamp
//
// e.g. "Admin changed QID-MED-000231 answer from C → B".
// ============================================================================

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => usersTable.id),
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  action: text("action").notNull(), // e.g. "question.create", "taxonomy.exams.update"
  entityType: text("entity_type").notNull(), // e.g. "question", "country", "exam", "user"
  entityId: integer("entity_id"),
  entityLabel: text("entity_label"), // human-readable object reference, e.g. a QID
  summary: text("summary"),
  oldValues: jsonb("old_values").$type<Record<string, any>>(),
  newValues: jsonb("new_values").$type<Record<string, any>>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
