DROP INDEX `idx_requests_class_started_at`;--> statement-breakpoint
CREATE INDEX `idx_requests_class_duration_id` ON `requests` (`request_class`,`duration_ms`,`id`);--> statement-breakpoint
CREATE INDEX `idx_requests_class_status_id` ON `requests` (`request_class`,`status_code`,`id`);--> statement-breakpoint
CREATE INDEX `idx_requests_class_tokens_id` ON `requests` (`request_class`,coalesce("total_tokens", 0),`id`);--> statement-breakpoint
CREATE INDEX `idx_requests_client_host` ON `requests` (`client_host`);--> statement-breakpoint
CREATE INDEX `idx_requests_class_started_at` ON `requests` (`request_class`,`started_at`,`id`,`status_code`);