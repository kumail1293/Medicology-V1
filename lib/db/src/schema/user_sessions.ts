import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

// ============================================================================
// User sessions (account security, P0.19).
//
// Every login creates a row keyed by a SHA-256 hash of the issued JWT (the raw
// token is never stored). The auth middleware rejects revoked sessions, so an
// admin or the user themselves can kill a device from Account → Security.
// ============================================================================

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
    revoked: boolean("revoked").notNull().default(false),
  },
  (table) => [
    index("user_sessions_user_idx").on(table.userId),
    index("user_sessions_token_hash_idx").on(table.tokenHash),
  ]
);

export type UserSession = typeof userSessionsTable.$inferSelect;
