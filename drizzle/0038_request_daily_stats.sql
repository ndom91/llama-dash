CREATE TABLE `request_daily_stats` (
	`day` text NOT NULL,
	`model` text,
	`client_name` text,
	`key_id` text,
	`requests` integer NOT NULL,
	`errors` integer NOT NULL,
	`prompt_tokens` integer NOT NULL,
	`completion_tokens` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`duration_ms_sum` integer NOT NULL,
	`cost_usd_sum` real,
	`gen_completion_tokens` integer NOT NULL,
	`gen_duration_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_request_daily_stats_day` ON `request_daily_stats` (`day`);