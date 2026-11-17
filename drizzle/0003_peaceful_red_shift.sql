ALTER TABLE `inscriptions` ADD `ordre` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Rétablit l'ordre d'insertion des élèves déjà présents : rang par classe
-- selon l'id (qui suit l'ordre d'import). Sans ça, tous à 0 = ordre indéfini.
UPDATE `inscriptions` SET `ordre` = (
  SELECT COUNT(*) FROM `inscriptions` AS `i2`
  WHERE `i2`.`classe_id` = `inscriptions`.`classe_id` AND `i2`.`id` <= `inscriptions`.`id`
);
