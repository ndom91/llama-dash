CREATE TABLE `model_specs` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`size_bytes` integer,
	`param_count` integer,
	`quantization` text,
	`captured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_specs_model_id_unique` ON `model_specs` (`model_id`);