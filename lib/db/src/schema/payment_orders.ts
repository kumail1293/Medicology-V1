import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const paymentOrdersTable = pgTable("payment_orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  qbankType: text("qbank_type").notNull(),
  provider: text("provider").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("PKR"),
  status: text("status").notNull().default("pending"),
  transactionRef: text("transaction_ref"),
  gatewayResponse: jsonb("gateway_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PaymentOrder = typeof paymentOrdersTable.$inferSelect;
export type NewPaymentOrder = typeof paymentOrdersTable.$inferInsert;
