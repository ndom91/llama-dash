CREATE TABLE `mcp_relays` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`target_url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`credential_bindings_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_relays_slug_unique` ON `mcp_relays` (`slug`);
