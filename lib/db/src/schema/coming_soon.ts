import { pgTable, serial, text, boolean, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

// ============================================================================
// Coming Soon catalogue (settings plan item 17).
//
// Admin-created "future" entries — exams, QBanks, features, programs and
// resources that are not live yet (e.g. FCPS → Coming Soon → Notify Me).
// Public consumers see the active entries and can register interest
// ("Notify Me"), which lands in coming_soon_interests for demand counts.
// ============================================================================

export const comingSoonTable = pgTable("coming_soon", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("feature"), // exam | qbank | feature | program | resource
  icon: text("icon"), // emoji or icon name
  imageUrl: text("image_url"), // media-library URL or full https URL
  expectedRelease: timestamp("expected_release"), // optional target date
  status: text("status").notNull().default("planned"), // planned | in_progress | launching
  notifyMe: boolean("notify_me").notNull().default(true), // whether Notify Me is offered
  audience: text("audience"), // e.g. "FCPS candidates"
  ctaLabel: text("cta_label").notNull().default("Notify Me"),
  ctaUrl: text("cta_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const comingSoonInterestsTable = pgTable(
  "coming_soon_interests",
  {
    id: serial("id").primaryKey(),
    comingSoonId: integer("coming_soon_id")
      .notNull()
      .references(() => comingSoonTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => usersTable.id),
    email: text("email"), // used when the visitor is anonymous
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // One interest per (entry, user) — anonymous entries keyed by email.
    index("coming_soon_interests_entry_idx").on(table.comingSoonId),
  ]
);

export type ComingSoonEntry = typeof comingSoonTable.$inferSelect;
export type ComingSoonInterest = typeof comingSoonInterestsTable.$inferSelect;
