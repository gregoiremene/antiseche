-- Nettoyage préalable : l'index unique ci-dessous échouerait si des doublons
-- existent déjà (c'est le cas des bases créées avant cette migration).
-- Parmi les doublons on conserve en priorité la ligne qui porte un
-- commentaire, sinon la plus ancienne, pour ne perdre aucune annotation.
DELETE FROM `observations`
WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`, ROW_NUMBER() OVER (
      PARTITION BY `inscription_id`, `type`, `date`
      ORDER BY (`commentaire` IS NULL), `id`
    ) AS rang
    FROM `observations`
  ) WHERE rang = 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `observations_inscription_id_type_date_unique` ON `observations` (`inscription_id`,`type`,`date`);
