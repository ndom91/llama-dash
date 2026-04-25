CREATE INDEX IF NOT EXISTS `idx_requests_started_at` ON `requests` (`started_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requests_key_id_id` ON `requests` (`key_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requests_model_id` ON `requests` (`model`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_model_events_timestamp` ON `model_events` (`timestamp`);
