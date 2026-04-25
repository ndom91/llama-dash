CREATE INDEX `idx_requests_started_at` ON `requests` (`started_at`);
CREATE INDEX `idx_requests_key_id_id` ON `requests` (`key_id`, `id`);
CREATE INDEX `idx_requests_model_id` ON `requests` (`model`, `id`);
CREATE INDEX `idx_model_events_timestamp` ON `model_events` (`timestamp`);
