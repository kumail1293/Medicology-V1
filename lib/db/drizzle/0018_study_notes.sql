CREATE TABLE "study_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_note_bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"note_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_notes" ADD CONSTRAINT "study_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_note_bookmarks" ADD CONSTRAINT "study_note_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_note_bookmarks" ADD CONSTRAINT "study_note_bookmarks_note_id_study_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."study_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_notes_subject_idx" ON "study_notes" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "study_notes_status_idx" ON "study_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "study_note_bookmarks_user_idx" ON "study_note_bookmarks" USING btree ("user_id");
