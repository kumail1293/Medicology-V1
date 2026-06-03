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
    isAdmin: boolean("is_admin").notNull().default(false),
    role: text("role").notNull().default("user"),
    customPermissions: jsonb("custom_permissions").$type().default({}),
    rewardPoints: integer("reward_points").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
