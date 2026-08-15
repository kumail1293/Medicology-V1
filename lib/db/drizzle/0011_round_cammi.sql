ALTER TABLE "entitlements" ADD COLUMN "expiring_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "expired_notified_at" timestamp;