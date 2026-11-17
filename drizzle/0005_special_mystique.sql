PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_colles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscription_id` integer NOT NULL,
	`date` text,
	`motif` text DEFAULT '' NOT NULL,
	`statut` text DEFAULT 'a_faire' NOT NULL,
	`posee_pronote` integer DEFAULT false NOT NULL,
	`parents_prevenus` integer DEFAULT false NOT NULL,
	`eleve_prevenu` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_colles`("id", "inscription_id", "date", "motif", "statut", "posee_pronote", "parents_prevenus", "eleve_prevenu", "created_at") SELECT "id", "inscription_id", "date", "motif", "statut", "posee_pronote", "parents_prevenus", "eleve_prevenu", "created_at" FROM `colles`;--> statement-breakpoint
DROP TABLE `colles`;--> statement-breakpoint
ALTER TABLE `__new_colles` RENAME TO `colles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_colles_inscription` ON `colles` (`inscription_id`);--> statement-breakpoint
CREATE INDEX `idx_colles_date` ON `colles` (`date`);