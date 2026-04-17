PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`method` text NOT NULL,
	`endpoint` text NOT NULL,
	`model` text,
	`status_code` integer NOT NULL,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`total_tokens` integer,
	`streamed` integer DEFAULT false NOT NULL,
	`error` text,
	`request_headers` text,
	`request_body` text,
	`response_headers` text,
	`response_body` text
);
--> statement-breakpoint
INSERT INTO `__new_requests`("id", "started_at", "duration_ms", "method", "endpoint", "model", "status_code", "prompt_tokens", "completion_tokens", "total_tokens", "streamed", "error", "request_headers", "request_body", "response_headers", "response_body") SELECT "id", "started_at", "duration_ms", "method", "endpoint", "model", "status_code", "prompt_tokens", "completion_tokens", "total_tokens", "streamed", "error", "request_headers", "request_body", "response_headers", "response_body" FROM `requests`;--> statement-breakpoint
DROP TABLE `requests`;--> statement-breakpoint
ALTER TABLE `__new_requests` RENAME TO `requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;