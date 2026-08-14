import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  countriesTable,
  examSystemsTable,
  examsTable,
  programsTable,
  academicYearsTable,
} from "./taxonomy.js";

// ============================================================================
// QBank products — database-driven catalogue (no hard-coded products/prices in
// API routes). A QBank is scoped to a country → exam system → exam → program →
// academic year and carries its own status, price and access duration.
// ============================================================================

export type QbankStatus =
  | "planned"
  | "coming_soon"
  | "beta"
  | "available"
  | "paused"
  | "archived";

export const QBANK_STATUSES: QbankStatus[] = [
  "planned",
  "coming_soon",
  "beta",
  "available",
  "paused",
  "archived",
];

export type QbankAccessType = "subscription" | "lifetime" | "institutional";

export const qbanksTable = pgTable("qbanks", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // e.g. "uhs-mbbs-2nd-year"
  name: text("name").notNull(), // e.g. "UHS MBBS 2nd Year"
  description: text("description"),
  // Relational taxonomy scoping (all optional — a QBank can be university
  // specific, program wide, or a standalone professional product).
  countryId: integer("country_id").references(() => countriesTable.id),
  examSystemId: integer("exam_system_id").references(() => examSystemsTable.id),
  examId: integer("exam_id").references(() => examsTable.id),
  programId: integer("program_id").references(() => programsTable.id),
  academicYearId: integer("academic_year_id").references(() => academicYearsTable.id),
  status: text("status").$type<QbankStatus>().notNull().default("planned"),
  // Pricing lives on the product (never in route files). Price in the currency's
  // minor unit; PKR is whole rupees.
  price: integer("price"),
  currency: text("currency").notNull().default("PKR"),
  durationDays: integer("duration_days").notNull().default(365),
  accessType: text("access_type").$type<QbankAccessType>().notNull().default("subscription"),
  // Cached count of mapped questions (kept in sync on mapping changes).
  questionCount: integer("question_count").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQbankSchema = createInsertSchema(qbanksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQbank = z.infer<typeof insertQbankSchema>;
export type Qbank = typeof qbanksTable.$inferSelect;
