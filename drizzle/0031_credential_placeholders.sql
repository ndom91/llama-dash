ALTER TABLE `upstream_credentials` ADD `slug` text;
--> statement-breakpoint
UPDATE `upstream_credentials`
SET `slug` = lower(replace(`name`, ' ', '-')) || '-' || substr(`id`, length(`id`) - 5, 6)
WHERE `slug` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `upstream_credentials_slug_unique` ON `upstream_credentials` (`slug`);
--> statement-breakpoint
ALTER TABLE `upstream_credentials` ADD `placeholder_enabled` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `routing_rules` ADD `credential_bindings_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `requests` ADD `credential_injection_json` text;
