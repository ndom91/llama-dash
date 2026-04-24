ALTER TABLE `requests` ADD `routing_auth_mode` text;
--> statement-breakpoint
ALTER TABLE `requests` ADD `routing_preserve_authorization` integer DEFAULT false NOT NULL;
