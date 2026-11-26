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
  /**
   * Dernier jour du trimestre, `YYYY-MM-DD`. Nullable : quand la date n'est pas
   * encore renseignée, l'appli retombe sur une valeur par défaut calculée à
   * partir du libellé (les dates réelles varient d'un établissement à l'autre).
   */
  finT1: text('fin_t1'),
  finT2: text('fin_t2'),
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
    /**
     * Libellés des deux demi-groupes de la classe. Nommables (ex. « Espagnol »/
     * « Allemand »), mais toujours exactement deux : un élève est dans le groupe
     * 1 ou 2 (cf. `inscriptions.groupe`). Valeurs par défaut neutres.
     */
    groupe1Nom: text('groupe1_nom').notNull().default('Groupe 1'),
    groupe2Nom: text('groupe2_nom').notNull().default('Groupe 2'),
    /**
     * Disposition du plan de classe : une entrée par colonne (de gauche à droite,
     * vue du prof), avec sa largeur (nb de tables collées) et sa hauteur (nb de
     * rangs). `null` = aucun plan créé. Les placements vivent dans `places`.
     */
    planColonnes: text('plan_colonnes', { mode: 'json' }).$type<
      { largeur: number; hauteur: number; espacement?: number }[]
    >(),
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
  /**
   * Mail(s) des parents, séparés par des virgules. Sert à pré-remplir le
   * destinataire d'un mailto pour les billets de colle.
   */
  mailsParents: text('mails_parents'),
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
    /**
     * Rang d'affichage dans la classe. Les élèves suivent l'ordre de saisie,
     * pas l'alphabet, et cet ordre est modifiable à la main.
     */
    ordre: integer('ordre').notNull().default(0),
    /**
     * Demi-groupe de l'élève DANS cette classe : 1 ou 2 (cf. `classes.groupe1Nom`
     * / `groupe2Nom` pour les libellés). Tout le monde est assigné ; par défaut
     * groupe 1, le prof répartit ensuite. Les groupes sont propres à la classe.
     */
    groupe: integer('groupe').notNull().default(1),
  },
  (t) => [unique().on(t.eleveId, t.classeId), index('idx_inscriptions_classe').on(t.classeId)],
);

/**
 * Placement d'un élève sur le plan de classe. `slot` identifie une table dans la
 * disposition (`classes.planColonnes`) au format "colonne:x:y" (x = position dans
 * la largeur de la colonne, y = rang). Un élève occupe au plus une table
 * (`inscriptionId` unique) et une table reçoit au plus un élève
 * (`classeId` + `slot` unique). Les échanges permutent deux `slot`.
 */
export const places = sqliteTable(
  'places',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classeId: integer('classe_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    inscriptionId: integer('inscription_id')
      .notNull()
      .references(() => inscriptions.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
  },
  (t) => [unique().on(t.inscriptionId), unique().on(t.classeId, t.slot)],
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

/**
 * « À vérifier » : les boucles ouvertes que le prof doit clôturer à la séance
 * suivante (rattrapage de cours, cahier au propre, exo à refaire, divers). À
 * distinguer des observations, qui sont des FAITS datés et comptent au bilan ;
 * un suivi, lui, a un cycle de vie `a_verifier` → `regle`. Un suivi `exo` peut
 * naître d'une observation (`observationId`), mais clôturer le suivi ne touche
 * jamais l'observation : le fait reste dans l'historique et les bilans.
 *
 * Les rattrapages de DS/interro ne sont PAS stockés ici : ils se déduisent des
 * notes (`absent` sans valeur), cf. `src/db/evaluations.ts`.
 */
export const TYPES_SUIVI = ['exo', 'cahier', 'rattrapage_cours', 'autre'] as const;
export type TypeSuivi = (typeof TYPES_SUIVI)[number];

export const STATUTS_SUIVI = ['a_verifier', 'regle'] as const;
export type StatutSuivi = (typeof STATUTS_SUIVI)[number];

export const suivis = sqliteTable(
  'suivis',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    inscriptionId: integer('inscription_id')
      .notNull()
      .references(() => inscriptions.id, { onDelete: 'cascade' }),
    type: text('type').$type<TypeSuivi>().notNull(),
    /** précision libre (« 54 p.23 », « cours du 12/11 ») ; null = aucune */
    libelle: text('libelle'),
    /** fait d'origine quand le suivi naît d'une observation ; null sinon */
    observationId: integer('observation_id').references(() => observations.id, {
      onDelete: 'set null',
    }),
    statut: text('statut').$type<StatutSuivi>().notNull().default('a_verifier'),
    /**
     * Cran d'escalade : « dernier avertissement » avant la colle. Le suivi reste
     * ouvert (`a_verifier`) mais est signalé ⚠ et remonté en tête de sa catégorie.
     */
    dernierAvertissement: integer('dernier_avertissement', { mode: 'boolean' })
      .notNull()
      .default(false),
    /** date d'ouverture `YYYY-MM-DD` (contexte « ça traîne depuis le… ») */
    ouvertLe: text('ouvert_le').notNull(),
    regleLe: text('regle_le'),
  },
  (t) => [index('idx_suivis_inscription').on(t.inscriptionId, t.statut)],
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
    /**
     * Élève absent qui ne rattrapera pas (dispensé / incapacité). La note reste
     * `absent` et hors moyenne, mais on cesse de rappeler le rattrapage sur la
     * page séance. Réversible.
     */
    rattrapageAbandonne: integer('rattrapage_abandonne', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (t) => [unique().on(t.evaluationId, t.inscriptionId)],
);

/**
 * Statut d'une colle (retenue). L'app ne planifie pas (c'est Pronote), elle
 * suit le cycle de vie et rappelle les étapes.
 *   a_faire  : décidée, en attente de vérification à la date prévue
 *   faite    : l'élève l'a effectuée
 *   non_faite: l'élève ne s'est pas présenté → à reprogrammer
 */
export const STATUTS_COLLE = ['a_faire', 'faite', 'non_faite'] as const;
export type StatutColle = (typeof STATUTS_COLLE)[number];

/**
 * Où se déroule la colle, déterminé par la recherche de créneau :
 *   vie_scolaire : l'élève et le prof sont libres → permanence surveillée
 *   ma_salle     : le prof fait cours à une autre classe → l'élève vient dans sa salle
 */
export const SURVEILLANCES = ['vie_scolaire', 'ma_salle'] as const;
export type Surveillance = (typeof SURVEILLANCES)[number];

export const colles = sqliteTable(
  'colles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    inscriptionId: integer('inscription_id')
      .notNull()
      .references(() => inscriptions.id, { onDelete: 'cascade' }),
    /**
     * Date prévue de la retenue. Nullable : en classe on crée la colle vite,
     * sans connaître le créneau libre de l'élève ; la date se met plus tard.
     */
    date: text('date'),
    /** motif, pré-rempli depuis les observations mais éditable */
    motif: text('motif').notNull().default(''),
    statut: text('statut').$type<StatutColle>().notNull().default('a_faire'),
    /** étapes de la chaîne, cochées au fur et à mesure */
    poseePronote: integer('posee_pronote', { mode: 'boolean' }).notNull().default(false),
    parentsPrevenus: integer('parents_prevenus', { mode: 'boolean' }).notNull().default(false),
    elevePrevenu: integer('eleve_prevenu', { mode: 'boolean' }).notNull().default(false),
    /** créneau retenu (« HH:MM »), rempli via « Trouver un créneau » ; nullable */
    heureDebut: text('heure_debut'),
    heureFin: text('heure_fin'),
    surveillance: text('surveillance').$type<Surveillance>(),
    /** pour 'ma_salle' : la classe avec qui le prof est à ce moment */
    surveillanceClasse: text('surveillance_classe'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index('idx_colles_inscription').on(t.inscriptionId), index('idx_colles_date').on(t.date)],
);

/**
 * Semaine à laquelle s'applique un cours récurrent :
 *   toutes : chaque semaine (cas le plus courant)
 *   A / B  : uniquement la semaine A ou B (le prof a une alternance A/B)
 */
export const SEMAINES_EDT = ['toutes', 'A', 'B'] as const;
export type SemaineEdt = (typeof SEMAINES_EDT)[number];

/**
 * Demi-groupe concerné par un cours, INDÉPENDANT de la semaine A/B :
 *   classe : toute la classe (cas par défaut)
 *   g1 / g2 : seulement le groupe 1 ou 2 (cf. `inscriptions.groupe`)
 * Le cas « A je prends g1, B je prends g2 au même créneau » se modélise par
 * deux cours : (semaine A, g1) et (semaine B, g2).
 */
export const GROUPES_EDT = ['classe', 'g1', 'g2'] as const;
export type GroupeEdt = (typeof GROUPES_EDT)[number];

/**
 * Matières du prof, avec une couleur pour repérer les cours d'un coup d'œil
 * dans la grille d'emploi du temps (comme un vrai EDT de carnet). Partagées
 * entre les classes et les années : ce sont des étiquettes génériques.
 */
export const matieres = sqliteTable('matieres', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nom: text('nom').notNull().unique(),
  couleur: text('couleur').notNull().default('#208AEF'),
});

/**
 * Emploi du temps : les cours récurrents d'une classe, semaine type. On saisit
 * l'EDT COMPLET de chaque classe (toutes matières, pas seulement les miennes)
 * pour savoir quand un élève est réellement libre. `estMonCours` marque les
 * heures que le prof assure lui-même : elles définissent sa disponibilité pour
 * recevoir un collé, les autres ne servent qu'à savoir que la classe est prise.
 *
 * Horaires en texte "HH:MM" 24 h zéro-paddé : comparables comme des chaînes,
 * comme les dates ISO ailleurs dans le schéma.
 */
export const emploisDuTemps = sqliteTable(
  'emplois_du_temps',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classeId: integer('classe_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    /** jour de la semaine, 1 = lundi … 6 = samedi (pas de dimanche) */
    jour: integer('jour').notNull(),
    heureDebut: text('heure_debut').notNull(),
    heureFin: text('heure_fin').notNull(),
    semaine: text('semaine').$type<SemaineEdt>().notNull().default('toutes'),
    /** demi-groupe concerné, orthogonal à la semaine (cf. GROUPES_EDT) */
    groupe: text('groupe').$type<GroupeEdt>().notNull().default('classe'),
    estMonCours: integer('est_mon_cours', { mode: 'boolean' }).notNull().default(false),
    /** matière gérée (couleur + nom) choisie dans une liste ; null = non renseignée */
    matiereId: integer('matiere_id').references(() => matieres.id, { onDelete: 'set null' }),
    /** ancien libellé texte libre, conservé pour compat ; l'UI passe par matiereId */
    matiere: text('matiere'),
    salle: text('salle'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index('idx_edt_classe').on(t.classeId, t.jour)],
);

/**
 * Réglages de l'emploi du temps, ligne unique (id = 1). Ancre l'alternance des
 * semaines A/B : on connaît un lundi et son type, la parité du nombre de
 * semaines écoulées donne le type de n'importe quelle date. `ancreLundi` est
 * toujours un lundi (`YYYY-MM-DD`).
 */
export const parametresEdt = sqliteTable('parametres_edt', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ancreLundi: text('ancre_lundi').notNull(),
  ancreType: text('ancre_type').$type<'A' | 'B'>().notNull().default('A'),
});
