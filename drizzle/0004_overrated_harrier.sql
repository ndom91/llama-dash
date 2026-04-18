CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_at` integer NOT NULL,
	`disabled_at` integer,
	`allowed_models` text DEFAULT '[]' NOT NULL,
	`rate_limit_rpm` integer,
	`rate_limit_tpm` integer,
	`monthly_token_quota` integer
);
--> statement-breakpoint
ALTER TABLE `requests` ADD `key_id` text;