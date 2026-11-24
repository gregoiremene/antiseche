CREATE TABLE `places` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`classe_id` integer NOT NULL,
	`inscription_id` integer NOT NULL,
	`slot` text NOT NULL,
	FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_inscription_id_unique` ON `places` (`inscription_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `places_classe_id_slot_unique` ON `places` (`classe_id`,`slot`);--> statement-breakpoint
ALTER TABLE `classes` ADD `plan_colonnes` text;