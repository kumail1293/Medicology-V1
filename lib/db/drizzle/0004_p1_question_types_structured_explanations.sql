ALTER TABLE "questions" ADD COLUMN "question_type" text DEFAULT 'sba' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "why_correct" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "why_wrong" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "exam_pearl" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "common_trap" text;