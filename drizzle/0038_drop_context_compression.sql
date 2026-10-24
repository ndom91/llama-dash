DROP TABLE `context_compression_policies`;--> statement-breakpoint
ALTER TABLE `requests` DROP COLUMN `compression_policy_id`;--> statement-breakpoint
ALTER TABLE `requests` DROP COLUMN `compression_policy_name`;--> statement-breakpoint
ALTER TABLE `requests` DROP COLUMN `compression_status`;--> statement-breakpoint
ALTER TABLE `requests` DROP COLUMN `compression_input_tokens`;--> statement-breakpoint
ALTER TABLE `requests` DROP COLUMN `compression_output_tokens`;--> statement-breakpoint
ALTER TABLE `requests` DROP COLUMN `compression_elapsed_ms`;