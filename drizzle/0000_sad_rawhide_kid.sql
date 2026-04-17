CREATE TABLE `requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
	`error` text
);
