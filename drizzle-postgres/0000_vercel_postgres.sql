CREATE TABLE "crm_digest_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"recipient" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"request_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "enquiries_request_key_unique" UNIQUE("request_key")
);
--> statement-breakpoint
CREATE TABLE "enquiry_imports" (
	"enquiry_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_backups" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_send_locks" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_crm_digest_date_status" ON "crm_digest_deliveries" USING btree ("date","status");--> statement-breakpoint
CREATE INDEX "idx_enquiries_created" ON "enquiries" USING btree ("created_at");