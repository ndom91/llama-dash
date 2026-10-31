CREATE TABLE `provider_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`routing_rule_ids_json` text DEFAULT '[]' NOT NULL,
	`models_json` text DEFAULT '[]' NOT NULL,
	`models_discovered_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_connections_target_id_unique` ON `provider_connections` (`target_id`);