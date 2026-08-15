import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users.js";
// Media library (admin settings plan item 18) — reusable media for logos,
// icons, announcement images, QBank covers, flashcard images, rich-content
// images and SEO images. Tracks metadata + uploader; files live on disk (or
// the configured backend) under /uploads.
export const MEDIA_CATEGORIES = [
    "logo",
    "icon",
    "announcement",
    "qbank_cover",
    "flashcard",
    "rich_content",
    "seo",
    "other",
];
export const mediaTable = pgTable("media", {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    url: text("url").notNull(),
    altText: text("alt_text"),
    category: text("category").$type().notNull().default("other"),
    uploadedBy: integer("uploaded_by").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertMediaSchema = createInsertSchema(mediaTable).omit({ id: true, createdAt: true, updatedAt: true });
