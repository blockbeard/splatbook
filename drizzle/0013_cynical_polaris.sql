CREATE TABLE `card_table_pictures` (
	`table_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`mime` text NOT NULL,
	`data_url` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `card_tables`(`id`) ON UPDATE no action ON DELETE cascade
);
