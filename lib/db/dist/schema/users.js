import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    college: text("college").notNull(),
    university: text("university"),
    year: integer("year").notNull(),
    bio: text("bio"),
    phone: text("phone"),
    // Amboss-style study aim: the student's goal for their current subscription.
    // Changing the aim resets progress (fresh start under the new goal).
    studyAim: jsonb("study_aim").$type().default({}),
    isAdmin: boolean("is_admin").notNull().default(false),
    role: text("role").notNull().default("user"),
    customPermissions: jsonb("custom_permissions").$type().default({}),
    rewardPoints: integer("reward_points").notNull().default(0),
    notificationPrefs: jsonb("notification_prefs").$type().default({}),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
