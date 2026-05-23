ALTER TABLE `requests` ADD `request_class` text DEFAULT 'inference' NOT NULL;--> statement-breakpoint
UPDATE `requests` SET `request_class` = 'mcp_relay' WHERE `endpoint` LIKE '/mcp-relays/%';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requests_class_started_at` ON `requests` (`request_class`, `started_at`);
