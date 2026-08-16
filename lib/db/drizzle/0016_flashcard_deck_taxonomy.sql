ALTER TABLE "flashcard_decks" ADD COLUMN "country_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "exam_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "program_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "year_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "subject_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "system_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "subtopic_id" integer;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "exam" text;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "program" text;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "year" text;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "system" text;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD COLUMN "subtopic" text;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_year_id_academic_years_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcard_decks_exam_idx" ON "flashcard_decks" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "flashcard_decks_topic_idx" ON "flashcard_decks" USING btree ("topic_id");