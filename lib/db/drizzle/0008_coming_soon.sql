CREATE TABLE "coming_soon_interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"coming_soon_id" integer NOT NULL,
	"user_id" integer,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coming_soon" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'feature' NOT NULL,
	"icon" text,
	"image_url" text,
	"expected_release" timestamp,
	"status" text DEFAULT 'planned' NOT NULL,
	"notify_me" boolean DEFAULT true NOT NULL,
	"audience" text,
	"cta_label" text DEFAULT 'Notify Me' NOT NULL,
	"cta_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coming_soon_interests" ADD CONSTRAINT "coming_soon_interests_coming_soon_id_coming_soon_id_fk" FOREIGN KEY ("coming_soon_id") REFERENCES "public"."coming_soon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coming_soon_interests" ADD CONSTRAINT "coming_soon_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coming_soon" ADD CONSTRAINT "coming_soon_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coming_soon_interests_entry_idx" ON "coming_soon_interests" USING btree ("coming_soon_id");