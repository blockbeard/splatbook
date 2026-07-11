ALTER TABLE `entities` ADD `campaign_id` text REFERENCES campaigns(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `entities_campaign_idx` ON `entities` (`campaign_id`);
