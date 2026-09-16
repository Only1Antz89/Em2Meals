ALTER TABLE "rate_limits" ADD COLUMN "expires_at" text;--> statement-breakpoint
UPDATE "rate_limits" SET "expires_at" = '1970-01-01T00:00:00.000Z' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "rate_limits" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "enquiry_imports" ADD CONSTRAINT "enquiry_imports_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_send_locks" ADD CONSTRAINT "workspace_send_locks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_deliveries_status_updated" ON "email_deliveries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_enquiry_imports_status_updated" ON "enquiry_imports" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_expires" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_research_cache_expires" ON "research_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_workspace_send_locks_expires" ON "workspace_send_locks" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "crm_digest_deliveries" ADD CONSTRAINT "crm_digest_deliveries_status_valid" CHECK ("crm_digest_deliveries"."status" in ('sending', 'uncertain', 'failed', 'sent'));--> statement-breakpoint
ALTER TABLE "crm_digest_deliveries" ADD CONSTRAINT "crm_digest_deliveries_attempts_positive" CHECK ("crm_digest_deliveries"."attempts" > 0);--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_status_valid" CHECK ("email_deliveries"."status" in ('sending', 'uncertain', 'failed', 'sent'));--> statement-breakpoint
ALTER TABLE "enquiry_imports" ADD CONSTRAINT "enquiry_imports_status_valid" CHECK ("enquiry_imports"."status" in ('pending', 'imported'));--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_count_positive" CHECK ("rate_limits"."count" > 0);
