CREATE TABLE `model_footprints` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`footprint_mib` integer NOT NULL,
	`measured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_footprints_model_id_unique` ON `model_footprints` (`model_id`);