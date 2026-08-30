ALTER TABLE `api_keys` ADD `model_access_mode` text DEFAULT 'all' NOT NULL;
--> statement-breakpoint
UPDATE `api_keys`
SET `model_access_mode` = CASE WHEN json_array_length(`allowed_models`) = 0 THEN 'all' ELSE 'restricted' END;
