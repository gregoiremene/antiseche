CREATE TABLE `suivis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscription_id` integer NOT NULL,
	`type` text NOT NULL,
	`libelle` text,
	`observation_id` integer,
	`statut` text DEFAULT 'a_verifier' NOT NULL,
	`ouvert_le` text NOT NULL,
	`regle_le` text,
	FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_suivis_inscription` ON `suivis` (`inscription_id`,`statut`);--> statement-breakpoint
ALTER TABLE `notes` ADD `rattrapage_abandonne` integer DEFAULT false NOT NULL;