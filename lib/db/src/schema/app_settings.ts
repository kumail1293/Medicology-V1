import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

/** Platform-wide settings, stored as JSONB values keyed by name
 * (WordPress options style). Admin-only writes; a whitelisted subset is
 * exposed publicly for branding/design tokens. */
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: integer("updated_by").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
