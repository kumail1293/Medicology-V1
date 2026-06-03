import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
export const qbankPurchasesTable = pgTable("qbank_purchases", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    qbankType: text("qbank_type").notNull(),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    status: text("status").notNull().default("active"),
    price: text("price"),
    transactionId: text("transaction_id"),
});
