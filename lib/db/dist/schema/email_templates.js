import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
// ============================================================================
// Email system (settings plan item 6 / P0.15–P0.16).
//
// email_templates — database-driven email templates with a visual block
//   builder. bodyBlocks is a JSON array of blocks (heading, text, image,
//   button, divider, spacer, columns, social, qbank card, result summary,
//   footer, unsubscribe, custom HTML). Each save bumps `version`; the full
//   history is kept in `versions` (JSON array) for restore/diff.
//
// email_logs — every send (transactional or admin test) is recorded here:
//   requestedBy, recipient, subject, status, provider response and error.
// ============================================================================
export const emailTemplatesTable = pgTable("email_templates", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull().default("transactional"), // transactional | marketing | system
    subject: text("subject").notNull(),
    preheader: text("preheader"),
    senderName: text("sender_name"),
    senderEmail: text("sender_email"),
    bodyBlocks: jsonb("body_blocks").$type().notNull().default([]), // block[] from the visual builder
    status: text("status").notNull().default("draft"), // draft | published | archived
    version: integer("version").notNull().default(1),
    versions: jsonb("versions").$type().notNull().default([]), // [{version, subject, bodyBlocks, changedBy, changedAt}]
    variables: jsonb("variables").$type().notNull().default([]), // allowed {{vars}} for validation
    audience: text("audience"), // e.g. "students", "admins", "purchasers"
    language: text("language").notNull().default("en"),
    createdById: integer("created_by_id").references(() => usersTable.id),
    updatedById: integer("updated_by_id").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    uniqueIndex("email_templates_slug_idx").on(table.slug),
    index("email_templates_status_idx").on(table.status),
]);
export const emailLogsTable = pgTable("email_logs", {
    id: serial("id").primaryKey(),
    templateId: integer("template_id").references(() => emailTemplatesTable.id),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("queued"), // queued | sent | failed
    provider: text("provider").notNull().default("log"), // log (dev) | smtp
    error: text("error"),
    requestedById: integer("requested_by_id").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
