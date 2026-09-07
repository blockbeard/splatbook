CREATE TABLE `card_table_seats` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`claim_secret` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_gm` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `card_tables`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `card_table_seats_table_idx` ON `card_table_seats` (`table_id`);--> statement-breakpoint
CREATE TABLE `card_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`owner_id` text NOT NULL,
	`room_token` text NOT NULL,
	`state` text DEFAULT '{}' NOT NULL,
	`state_version` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`command_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_active_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_tables_room_token_unique` ON `card_tables` (`room_token`);--> statement-breakpoint
CREATE INDEX `card_tables_owner_idx` ON `card_tables` (`owner_id`);--> statement-breakpoint
CREATE INDEX `card_tables_active_idx` ON `card_tables` (`last_active_at`);