CREATE TABLE `upstream_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
ALTER TABLE `requests` ADD `routing_target_credential_id` text;
