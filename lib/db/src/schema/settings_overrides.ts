import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ============================================================================
// Scoped settings overrides (admin settings plan items 10–11).
//
// Platform settings in `app_settings` are the defaults. Individual scopes —
// a QBank product, or a taxonomy node (country → exam → program → year →
// subject → system → topic) — can override specific keys. Resolution walks
// the scope chain from least to most specific (see
// api-server/src/utils/scoped-overrides.ts) so the winner is deterministic:
//
//   system safety constraints (never overridable)
//       ↓
//   QBank override
//       ↓
//   topic → system → subject → year → program → exam → country
//       ↓
//   platform default (app_settings / DEFAULT_SETTINGS)
//
// One row = one (scope, scopeId, group, key) override. Value is JSONB so any
// validated setting type (number, boolean, enum, array) can be stored.
// ============================================================================

export const SETTING_SCOPES = [
  "qbank",
  "topic",
  "system",
  "subject",
  "year",
  "program",
  "exam",
  "country",
] as const;
export type SettingScope = (typeof SETTING_SCOPES)[number];

export const settingsOverridesTable = pgTable("settings_overrides", {
  id: serial("id").primaryKey(),
  scope: text("scope").$type<SettingScope>().notNull(),
  scopeId: integer("scope_id").notNull(),
  group: text("group").notNull(), // e.g. "examSettings"
  key: text("key").notNull(), // e.g. "questionCount"
  value: jsonb("value").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // One effective value per (scope, entity, group, key).
  { unique: [t.scope, t.scopeId, t.group, t.key] },
]);

export const insertSettingsOverrideSchema = createInsertSchema(settingsOverridesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSettingsOverride = z.infer<typeof insertSettingsOverrideSchema>;
export type SettingsOverride = typeof settingsOverridesTable.$inferSelect;
