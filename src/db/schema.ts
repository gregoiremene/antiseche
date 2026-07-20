import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

/**
 * Les dates sont stockées en texte ISO court (`YYYY-MM-DD`) : c'est trié
 * correctement par SQLite en comparaison de chaînes, et ça reste lisible si on
 * ouvre la base à la main.
 */

export const anneesScolaires = sqliteTable('annees_scolaires', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** "2026-2027" */
  libelle: text('libelle').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
});

export const classes = sqliteTable(
  'classes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anneeId: integer('annee_id')
      .notNull()
      .references(() => anneesScolaires.id, { onDelete: 'cascade' }),
    /** "4eB", "2nde 3", "TG1" */
    nom: text('nom').notNull(),
    niveau: text('niveau'),
    /** couleur hex, pour repérer la classe d'un coup d'œil */
    couleur: text('couleur').notNull().default('#208AEF'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [unique().on(t.anneeId, t.nom)],
);

/**
 * L'élève existe indépendamment de sa classe : on le suit d'une année sur
 * l'autre (dossier, historique) même s'il change de classe.
 */
export const eleves = sqliteTable('eleves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nom: text('nom').notNull(),
  prenom: text('prenom').notNull(),
  photoUri: text('photo_uri'),
  /** tags libres : PAP, PAI, PPS, tiers-temps, dys… */
  amenagements: text('amenagements', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default([]),
  /** notes de dossier, texte libre */
  infos: text('infos'),
});

/** L'élève DANS une classe, pour une année donnée. */
export const inscriptions = sqliteTable(
  'inscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eleveId: integer('eleve_id')
      .notNull()
      .references(() => eleves.id, { onDelete: 'cascade' }),
    classeId: integer('classe_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.eleveId, t.classeId), index('idx_inscriptions_classe').on(t.classeId)],
);

export const TYPES_OBSERVATION = [
  'exo_non_fait',
  'materiel_oublie',
  'retard',
  'comportement',
  'positif',
] as const;

export type TypeObservation = (typeof TYPES_OBSERVATION)[number];

export const observations = sqliteTable(
  'observations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    inscriptionId: integer('inscription_id')
      .notNull()
      .references(() => inscriptions.id, { onDelete: 'cascade' }),
    type: text('type').$type<TypeObservation>().notNull(),
    date: text('date').notNull(),
    commentaire: text('commentaire'),
  },
  (t) => [
    index('idx_observations_inscription').on(t.inscriptionId, t.date),
    // Un seul tag de chaque type par élève et par jour. La règle vivait
    // uniquement dans le code (SELECT puis INSERT, non atomique), ce qui
    // laissait passer des doublons sur deux taps rapprochés.
    unique().on(t.inscriptionId, t.type, t.date),
  ],
);

export const evaluations = sqliteTable(
  'evaluations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classeId: integer('classe_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    titre: text('titre').notNull(),
    date: text('date').notNull(),
    trimestre: integer('trimestre').notNull().default(1),
    bareme: real('bareme').notNull().default(20),
    coef: real('coef').notNull().default(1),
  },
  (t) => [index('idx_evaluations_classe').on(t.classeId, t.trimestre)],
);

/**
 * `valeur` est nullable ET distincte de `absent` : sans ça, impossible de
 * différencier un 0 mérité d'une absence à ne pas compter dans la moyenne.
 */
export const notes = sqliteTable(
  'notes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    evaluationId: integer('evaluation_id')
      .notNull()
      .references(() => evaluations.id, { onDelete: 'cascade' }),
    inscriptionId: integer('inscription_id')
      .notNull()
      .references(() => inscriptions.id, { onDelete: 'cascade' }),
    valeur: real('valeur'),
    absent: integer('absent', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [unique().on(t.evaluationId, t.inscriptionId)],
);
