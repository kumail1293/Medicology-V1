import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { qbanksTable } from "./qbanks.js";
// ============================================================================
// Coming Soon / Notify Me waitlist. One row per (user, qbank) — duplicate
// registrations are prevented by the unique index. Admins see demand counts
// (e.g. "UHS Final Year — 1,240 interested") to decide what to build next.
// ============================================================================
export const waitlistTable = pgTable("waitlist", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => usersTable.id),
    qbankId: integer("qbank_id")
        .notNull()
        .references(() => qbanksTable.id),
    status: text("status").notNull().default("waiting"), // waiting | notified | removed
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    uniqueIndex("waitlist_user_qbank_uq").on(table.userId, table.qbankId),
    // Admin "demand per QBank" counts group by qbank.
    index("waitlist_qbank_idx").on(table.qbankId),
]);
