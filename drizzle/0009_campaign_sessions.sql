CREATE TABLE `campaign_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`number` integer NOT NULL,
	`date` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`triggers` text DEFAULT '{}' NOT NULL,
	`awards` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `campaign_sessions_campaign_idx` ON `campaign_sessions` (`campaign_id`,`number`);