import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Announcement display types (plan: banner, modal, toast, notification,
// homepage, dashboard card, full announcement, exam alert, promotion).
export const ANNOUNCEMENT_TYPES = [
  "popup",
  "banner",
  "ticker",
  "modal",
  "toast",
  "exam_alert",
  "promotion",
] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const ANNOUNCEMENT_THEMES = ["info", "success", "warning", "error", "primary"] as const;
export type AnnouncementTheme = (typeof ANNOUNCEMENT_THEMES)[number];

export const ANNOUNCEMENT_PRIORITIES = ["low", "normal", "high"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

// How often a dismissible announcement is shown to the same user.
export const ANNOUNCEMENT_FREQUENCIES = ["once", "daily", "every_visit"] as const;
export type AnnouncementFrequency = (typeof ANNOUNCEMENT_FREQUENCIES)[number];

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  type: text("type").$type<AnnouncementType>().notNull().default("banner"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  targetRoles: text("target_roles").default("all"),
  // --- Scheduling + presentation (admin settings plan items 13-14) ---
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  priority: text("priority").$type<AnnouncementPriority>().notNull().default("normal"),
  theme: text("theme").$type<AnnouncementTheme>().notNull().default("info"),
  dismissible: boolean("dismissible").notNull().default(true),
  frequency: text("frequency").$type<AnnouncementFrequency>().notNull().default("every_visit"),
  targetRoute: text("target_route"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcementsTable.$inferSelect;

// ---------------------------------------------------------------------------
// Reusable announcement templates (plan item 14) - admin-authored skeletons for
// exam alerts, QBank launches, promotions, system/maintenance notices, and new
// feature announcements. An admin creates an announcement "from template" to
// prefill title, rich body, CTA, theme and targeting.
// ---------------------------------------------------------------------------

export const ANNOUNCEMENT_TEMPLATE_CATEGORIES = [
  "exam_alert",
  "qbank_launch",
  "promotion",
  "system_notice",
  "maintenance",
  "feature",
  "custom",
] as const;
export type AnnouncementTemplateCategory = (typeof ANNOUNCEMENT_TEMPLATE_CATEGORIES)[number];

export const announcementTemplatesTable = pgTable("announcement_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").$type<AnnouncementTemplateCategory>().notNull().default("custom"),
  type: text("type").$type<AnnouncementType>().notNull().default("banner"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  theme: text("theme").$type<AnnouncementTheme>().notNull().default("info"),
  priority: text("priority").$type<AnnouncementPriority>().notNull().default("normal"),
  targetRoles: text("target_roles").default("all"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnnouncementTemplateSchema = createInsertSchema(announcementTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnnouncementTemplate = z.infer<typeof insertAnnouncementTemplateSchema>;
export type AnnouncementTemplate = typeof announcementTemplatesTable.$inferSelect;
