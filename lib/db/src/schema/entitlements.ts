import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { qbanksTable } from "./qbanks.js";

// ============================================================================
// Entitlements — the access-control model. A purchase/payment row is NOT the
// entitlement; this table is. It supports subscription, lifetime, complimentary,
// scholarship, beta and institutional grants, all verified server-side.
// ============================================================================

export type EntitlementStatus =
  | "active"
  | "expired"
  | "revoked"
  | "complimentary"
  | "scholarship"
  | "beta"
  | "institutional";

export const ENTITLEMENT_STATUSES: EntitlementStatus[] = [
  "active",
  "expired",
  "revoked",
  "complimentary",
  "scholarship",
  "beta",
  "institutional",
];

export type EntitlementSource =
  | "payment"
  | "complimentary"
  | "scholarship"
  | "beta"
  | "institutional"
  | "coupon";

export const entitlementsTable = pgTable(
  "entitlements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    qbankId: integer("qbank_id")
      .notNull()
      .references(() => qbanksTable.id),
    source: text("source").$type<EntitlementSource>().notNull().default("payment"),
    status: text("status").$type<EntitlementStatus>().notNull().default("active"),
    startAt: timestamp("start_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"), // null = lifetime/never expires
    // Payment order that produced this grant (idempotency anchor — one grant per order).
    orderRef: text("order_ref"),
    grantedBy: integer("granted_by").references(() => usersTable.id),
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    // Expiry-notification bookkeeping: the sweeper marks these so each user
    // receives at most one expiring-reminder and one expired notice per grant.
    expiringNotifiedAt: timestamp("expiring_notified_at"),
    expiredNotifiedAt: timestamp("expired_notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Access checks run per protected operation — (user, qbank) is the hot path.
    index("entitlements_user_qbank_idx").on(table.userId, table.qbankId),
    // "My QBanks" / entitlements list for a user.
    index("entitlements_user_idx").on(table.userId),
  ]
);

export type Entitlement = typeof entitlementsTable.$inferSelect;
