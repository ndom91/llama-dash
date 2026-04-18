CREATE TABLE `model_events` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`event` text NOT NULL,
	`timestamp` integer NOT NULL
);
