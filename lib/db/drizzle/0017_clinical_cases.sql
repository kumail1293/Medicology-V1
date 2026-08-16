CREATE TABLE "clinical_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"system" text NOT NULL,
	"difficulty" text DEFAULT 'Medium' NOT NULL,
	"exam_type" text DEFAULT 'MBBS' NOT NULL,
	"estimated_minutes" integer DEFAULT 10 NOT NULL,
	"related_subject" text NOT NULL,
	"chief_complaint" text NOT NULL,
	"history" text NOT NULL,
	"examination" text NOT NULL,
	"investigations" text NOT NULL,
	"diagnosis_options" text DEFAULT '[]',
	"correct_diagnosis" text NOT NULL,
	"explanation" text NOT NULL,
	"management_plan" text NOT NULL,
	"key_learning_points" text DEFAULT '[]',
	"status" text DEFAULT 'published' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"case_id" integer NOT NULL,
	"time_spent_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinical_cases" ADD CONSTRAINT "clinical_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_completions" ADD CONSTRAINT "case_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_completions" ADD CONSTRAINT "case_completions_case_id_clinical_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."clinical_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinical_cases_system_idx" ON "clinical_cases" USING btree ("system");--> statement-breakpoint
CREATE INDEX "clinical_cases_status_idx" ON "clinical_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "case_completions_user_idx" ON "case_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "case_completions_case_idx" ON "case_completions" USING btree ("case_id");
