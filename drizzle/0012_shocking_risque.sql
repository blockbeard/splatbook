CREATE TABLE `card_table_events` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`version` integer NOT NULL,
	`actor_seat_id` text,
	`kind` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`request_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `card_tables`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_seat_id`) REFERENCES `card_table_seats`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `card_table_events_table_idx` ON `card_table_events` (`table_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_table_events_request_uq` ON `card_table_events` (`table_id`,`request_hash`);