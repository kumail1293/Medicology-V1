import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
export const qbankUserSettingsTable = pgTable("qbank_user_settings", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    qbankType: text("qbank_type").notNull(),
    selectedYear: text("selected_year"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
