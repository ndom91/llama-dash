CREATE TABLE `model_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`alias` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_aliases_alias_unique` ON `model_aliases` (`alias`);