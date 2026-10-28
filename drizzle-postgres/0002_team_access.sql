CREATE TABLE IF NOT EXISTS "access_events" (
	"id" text PRIMARY KEY NOT NULL,
	"at" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
	"email" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"last_seen_at" text,
	CONSTRAINT "team_members_role_valid" CHECK ("team_members"."role" in ('owner', 'manager', 'kitchen', 'viewer')),
	CONSTRAINT "team_members_status_valid" CHECK ("team_members"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_events_at" ON "access_events" USING btree ("at");