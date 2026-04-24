ALTER TABLE `routing_rules` ADD `target_json` text DEFAULT '{"type":"llama_swap"}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `requests` ADD `routing_target_type` text;
--> statement-breakpoint
ALTER TABLE `requests` ADD `routing_target_base_url` text;
