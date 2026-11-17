CREATE TABLE `matieres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`couleur` text DEFAULT '#208AEF' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matieres_nom_unique` ON `matieres` (`nom`);--> statement-breakpoint
ALTER TABLE `emplois_du_temps` ADD `matiere_id` integer REFERENCES matieres(id);