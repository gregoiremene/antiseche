CREATE TABLE `annees_scolaires` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`libelle` text NOT NULL,
	`active` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `annees_scolaires_libelle_unique` ON `annees_scolaires` (`libelle`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`annee_id` integer NOT NULL,
	`nom` text NOT NULL,
	`niveau` text,
	`couleur` text DEFAULT '#208AEF' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`annee_id`) REFERENCES `annees_scolaires`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_annee_id_nom_unique` ON `classes` (`annee_id`,`nom`);--> statement-breakpoint
CREATE TABLE `eleves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`prenom` text NOT NULL,
	`photo_uri` text,
	`amenagements` text DEFAULT '[]' NOT NULL,
	`infos` text
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`classe_id` integer NOT NULL,
	`titre` text NOT NULL,
	`date` text NOT NULL,
	`trimestre` integer DEFAULT 1 NOT NULL,
	`bareme` real DEFAULT 20 NOT NULL,
	`coef` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_evaluations_classe` ON `evaluations` (`classe_id`,`trimestre`);--> statement-breakpoint
CREATE TABLE `inscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eleve_id` integer NOT NULL,
	`classe_id` integer NOT NULL,
	FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_inscriptions_classe` ON `inscriptions` (`classe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inscriptions_eleve_id_classe_id_unique` ON `inscriptions` (`eleve_id`,`classe_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evaluation_id` integer NOT NULL,
	`inscription_id` integer NOT NULL,
	`valeur` real,
	`absent` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notes_evaluation_id_inscription_id_unique` ON `notes` (`evaluation_id`,`inscription_id`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscription_id` integer NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`commentaire` text,
	FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_observations_inscription` ON `observations` (`inscription_id`,`date`);