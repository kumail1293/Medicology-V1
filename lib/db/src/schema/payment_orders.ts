import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const paymentOrdersTable = pgTable(
  "payment_orders",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id").notNull().unique(),
    userId: integer("user_id").notNull(),
    qbankType: text("qbank_type").notNull(),
    provider: text("provider").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("PKR"),
    status: text("status").notNull().default("pending"),
    transactionRef: text("transaction_ref"),
    // Client-supplied or server-derived key that makes order creation idempotent
    // (repeat initiate calls reuse the same pending order instead of charging twice).
    idempotencyKey: text("idempotency_key"),
    gatewayResponse: jsonb("gateway_response"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Idempotent initiate: "reuse a pending order for (user, key)".
    index("payment_orders_user_idem_idx").on(table.userId, table.idempotencyKey),
    // "My orders" and webhook/verify status lookups.
    index("payment_orders_user_idx").on(table.userId),
    index("payment_orders_status_idx").on(table.status),
  ]
);

export type PaymentOrder = typeof paymentOrdersTable.$inferSelect;
export type NewPaymentOrder = typeof paymentOrdersTable.$inferInsert;

