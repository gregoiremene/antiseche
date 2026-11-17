CREATE TABLE `colles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscription_id` integer NOT NULL,
	`date` text NOT NULL,
	`motif` text DEFAULT '' NOT NULL,
	`statut` text DEFAULT 'a_faire' NOT NULL,
	`posee_pronote` integer DEFAULT false NOT NULL,
	`parents_prevenus` integer DEFAULT false NOT NULL,
	`eleve_prevenu` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_colles_inscription` ON `colles` (`inscription_id`);--> statement-breakpoint
CREATE INDEX `idx_colles_date` ON `colles` (`date`);--> statement-breakpoint
ALTER TABLE `eleves` ADD `mails_parents` text;