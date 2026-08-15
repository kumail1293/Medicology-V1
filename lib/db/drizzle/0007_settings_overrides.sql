CREATE TABLE "settings_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"scope_id" integer NOT NULL,
	"group" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
