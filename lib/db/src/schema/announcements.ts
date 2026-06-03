import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("banner"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  targetRoles: text("target_roles").default("all"),
  isActive: boolean("is_active").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcementsTable).omit({ id: true, createdAt: true });
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcementsTable.$inferSelect;

