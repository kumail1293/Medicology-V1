CREATE TABLE "announcement_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'custom' NOT NULL,
	"type" text DEFAULT 'banner' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"button_text" text,
	"button_url" text,
	"theme" text DEFAULT 'info' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"target_roles" text DEFAULT 'all',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "theme" text DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "dismissible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "frequency" text DEFAULT 'every_visit' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "target_route" text;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;