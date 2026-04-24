ALTER TABLE `routing_rules` ADD `auth_mode` text DEFAULT 'require_key' NOT NULL;
--> statement-breakpoint
ALTER TABLE `routing_rules` ADD `preserve_authorization` integer DEFAULT false NOT NULL;
