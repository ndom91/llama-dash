ALTER TABLE `requests` ADD `routing_rule_id` text;
ALTER TABLE `requests` ADD `routing_rule_name` text;
ALTER TABLE `requests` ADD `routing_action_type` text;
ALTER TABLE `requests` ADD `routing_requested_model` text;
ALTER TABLE `requests` ADD `routing_routed_model` text;
ALTER TABLE `requests` ADD `routing_reject_reason` text;
