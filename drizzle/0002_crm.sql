CREATE TABLE IF NOT EXISTS `crm_digest_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`error` text,
	`attempts` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_crm_digest_date_status` ON `crm_digest_deliveries` (`date`,`status`);
