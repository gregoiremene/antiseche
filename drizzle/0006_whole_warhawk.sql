CREATE TABLE `emplois_du_temps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`classe_id` integer NOT NULL,
	`jour` integer NOT NULL,
	`heure_debut` text NOT NULL,
	`heure_fin` text NOT NULL,
	`semaine` text DEFAULT 'toutes' NOT NULL,
	`est_mon_cours` integer DEFAULT false NOT NULL,
	`matiere` text,
	`salle` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_edt_classe` ON `emplois_du_temps` (`classe_id`,`jour`);--> statement-breakpoint
CREATE TABLE `parametres_edt` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ancre_lundi` text NOT NULL,
	`ancre_type` text DEFAULT 'A' NOT NULL
);
