CREATE TABLE `context_compression_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`order` integer NOT NULL,
	`match_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `requests` ADD `compression_policy_id` text;--> statement-breakpoint
ALTER TABLE `requests` ADD `compression_policy_name` text;--> statement-breakpoint
ALTER TABLE `requests` ADD `compression_status` text;--> statement-breakpoint
ALTER TABLE `requests` ADD `compression_input_tokens` integer;--> statement-breakpoint
ALTER TABLE `requests` ADD `compression_output_tokens` integer;--> statement-breakpoint
ALTER TABLE `requests` ADD `compression_elapsed_ms` integer;