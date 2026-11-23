ALTER TABLE `classes` ADD `groupe1_nom` text DEFAULT 'Groupe 1' NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `groupe2_nom` text DEFAULT 'Groupe 2' NOT NULL;--> statement-breakpoint
ALTER TABLE `emplois_du_temps` ADD `groupe` text DEFAULT 'classe' NOT NULL;--> statement-breakpoint
ALTER TABLE `inscriptions` ADD `groupe` integer DEFAULT 1 NOT NULL;