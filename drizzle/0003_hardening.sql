ALTER TABLE `rate_limits` ADD `expires_at` text NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expires` ON `rate_limits` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_email_deliveries_status_updated` ON `email_deliveries` (`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_enquiry_imports_status_updated` ON `enquiry_imports` (`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_research_cache_expires` ON `research_cache` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_send_locks_expires` ON `workspace_send_locks` (`expires_at`);
