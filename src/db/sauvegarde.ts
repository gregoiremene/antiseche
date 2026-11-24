import { type InferSelectModel } from 'drizzle-orm';

import { db } from './index';
import {
  anneesScolaires,
  classes,
  colles,
  eleves,
  emploisDuTemps,
  evaluations,
  inscriptions,
  matieres,
  notes,
  observations,
  parametresEdt,
  places,
  suivis,
} from './schema';
import { ecrirePhotoBase64, lirePhotoBase64, viderPhotosEleves } from '@/lib/photos';

/**
 * Sauvegarde / restauration de TOUTE la base en JSON.
 *
 * Pourquoi du JSON logique plutôt qu'une copie du fichier `.db` : on réinsère
 * les données dans une base déjà migrée par l'appli en cours, ce qui rend la
 * sauvegarde robuste aux changements de schéma (une table ajoutée plus tard
 * sera simplement absente d'une vieille sauvegarde, sans casser l'import).
 */

const FORMAT = 'antiseche-sauvegarde' as const;

/**
 * Version du FORMAT de sauvegarde, indépendante des migrations SQLite. On
 * refuse d'importer une sauvegarde d'une version plus récente que celle qu'on
 * sait relire ; on accepte les plus anciennes (les tables manquantes → vides).
 */
export const VERSION_SAUVEGARDE = 5;

/**
 * Tables dans l'ordre PARENT → ENFANT. C'est l'ordre d'insertion (une ligne
 * enfant référence une ligne parent déjà présente) ; la suppression se fait
 * dans l'ordre inverse. Ajouter ici toute nouvelle table à sauvegarder.
 */
const TABLES = {
  anneesScolaires,
  matieres,
  eleves,
  classes,
  inscriptions,
  places,
  observations,
  suivis,
  evaluations,
  notes,
  colles,
  emploisDuTemps,
  parametresEdt,
} as const;

const ORDRE = Object.keys(TABLES) as (keyof typeof TABLES)[];

export type Sauvegarde = {
  format: typeof FORMAT;
  version: number;
  exporteLe: string;
  tables: {
    anneesScolaires: InferSelectModel<typeof anneesScolaires>[];
    matieres: InferSelectModel<typeof matieres>[];
    eleves: InferSelectModel<typeof eleves>[];
    classes: InferSelectModel<typeof classes>[];
    inscriptions: InferSelectModel<typeof inscriptions>[];
    places: InferSelectModel<typeof places>[];
    observations: InferSelectModel<typeof observations>[];
    suivis: InferSelectModel<typeof suivis>[];
    evaluations: InferSelectModel<typeof evaluations>[];
    notes: InferSelectModel<typeof notes>[];
    colles: InferSelectModel<typeof colles>[];
    emploisDuTemps: InferSelectModel<typeof emploisDuTemps>[];
    parametresEdt: InferSelectModel<typeof parametresEdt>[];
  };
  /**
   * Photos des élèves embarquées : nom de fichier → contenu base64 (JPEG). Elles
   * ne vivent pas dans la base mais dans le sandbox ; on les inclut ici pour
   * qu'elles survivent à un transfert entre installations (Expo Go → APK, etc.).
   */
  photos: Record<string, string>;
};

/** Lit toutes les tables et assemble l'objet de sauvegarde. */
export async function construireSauvegarde(): Promise<Sauvegarde> {
  const tables = {} as Sauvegarde['tables'];
  for (const nom of ORDRE) {
    // le select renvoie déjà les booléens/JSON décodés par Drizzle ; on les
    // repasse tels quels à l'insert, qui les ré-encode — aller-retour propre.
    (tables as Record<string, unknown[]>)[nom] = await db.select().from(TABLES[nom]);
  }

  // photos référencées par les élèves, lues depuis le sandbox
  const photos: Record<string, string> = {};
  for (const nom of new Set(tables.eleves.map((e) => e.photoUri).filter((p): p is string => !!p))) {
    const base64 = lirePhotoBase64(nom);
    if (base64) photos[nom] = base64;
  }

  return { format: FORMAT, version: VERSION_SAUVEGARDE, exporteLe: new Date().toISOString(), tables, photos };
}

/** Sérialise une sauvegarde en texte JSON prêt à écrire dans un fichier. */
export function serialiserSauvegarde(sauvegarde: Sauvegarde): string {
  return JSON.stringify(sauvegarde);
}

/** Erreur « métier » d'une sauvegarde illisible, avec un message pour l'UI. */
export class SauvegardeInvalide extends Error {}

/**
 * Parse et valide un fichier de sauvegarde. Lève une `SauvegardeInvalide` avec
 * un message affichable si le contenu n'est pas exploitable. Les tables
 * manquantes (sauvegarde d'une version plus ancienne) sont ramenées à `[]`.
 */
export function analyserSauvegarde(texte: string): Sauvegarde {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new SauvegardeInvalide("Ce fichier n'est pas un JSON valide.");
  }

  if (!brut || typeof brut !== 'object') {
    throw new SauvegardeInvalide('Fichier de sauvegarde non reconnu.');
  }
  const obj = brut as Record<string, unknown>;

  if (obj.format !== FORMAT) {
    throw new SauvegardeInvalide("Ce fichier n'est pas une sauvegarde Antisèche.");
  }
  if (typeof obj.version !== 'number' || obj.version > VERSION_SAUVEGARDE) {
    throw new SauvegardeInvalide(
      'Cette sauvegarde a été créée par une version plus récente de l’appli. Mets l’appli à jour puis réessaie.',
    );
  }
  if (!obj.tables || typeof obj.tables !== 'object') {
    throw new SauvegardeInvalide('Sauvegarde incomplète : aucune donnée trouvée.');
  }

  const tablesBrutes = obj.tables as Record<string, unknown>;
  const tables = {} as Sauvegarde['tables'];
  for (const nom of ORDRE) {
    const valeur = tablesBrutes[nom];
    if (valeur !== undefined && !Array.isArray(valeur)) {
      throw new SauvegardeInvalide(`Sauvegarde corrompue (table « ${nom} »).`);
    }
    (tables as Record<string, unknown[]>)[nom] = Array.isArray(valeur) ? valeur : [];
  }

  // photos : optionnelles (absentes des sauvegardes v1). On ne garde que les
  // entrées nom → base64 valides, sans faire échouer l'import pour autant.
  const photos: Record<string, string> = {};
  if (obj.photos && typeof obj.photos === 'object') {
    for (const [nom, valeur] of Object.entries(obj.photos as Record<string, unknown>)) {
      if (typeof valeur === 'string') photos[nom] = valeur;
    }
  }

  return { format: FORMAT, version: obj.version, exporteLe: String(obj.exporteLe ?? ''), tables, photos };
}

/** Découpe un tableau en paquets, pour ne pas dépasser les limites de SQLite. */
function parPaquets<T>(lignes: T[], taille: number): T[][] {
  const paquets: T[][] = [];
  for (let i = 0; i < lignes.length; i += taille) paquets.push(lignes.slice(i, i + taille));
  return paquets;
}

/**
 * REMPLACE toute la base par le contenu de la sauvegarde. Tout se joue dans une
 * seule transaction : en cas d'erreur, rien n'est modifié (l'ancien état est
 * conservé). On vide enfants → parents, puis on réinsère parents → enfants en
 * préservant les identifiants (les références entre tables restent valides).
 *
 * IMPORTANT : le callback est SYNCHRONE et utilise `.run()`. Le driver
 * `expo-sqlite` de Drizzle exécute les requêtes en synchrone et émet `commit`
 * dès que le callback retourne ; un callback `async` validerait la transaction
 * avant la fin des opérations (au premier `await`) et casserait l'atomicité.
 *
 * Les photos (fichiers) sont écrites APRÈS la transaction : le système de
 * fichiers n'est pas transactionnel, et on ne veut pas toucher au disque si la
 * réinsertion échoue. On repart d'un dossier vidé (restauration = remplacement).
 */
export function restaurerSauvegarde(sauvegarde: Sauvegarde): void {
  db.transaction((tx) => {
    for (const nom of [...ORDRE].reverse()) {
      tx.delete(TABLES[nom]).run();
    }
    for (const nom of ORDRE) {
      const lignes = sauvegarde.tables[nom] as unknown[];
      for (const paquet of parPaquets(lignes, 200)) {
        // `never` assumé : la boucle est générique sur 11 tables aux types de
        // lignes différents ; l'ordre PARENT → ENFANT garantit la cohérence.
        tx.insert(TABLES[nom]).values(paquet as never).run();
      }
    }
  });

  viderPhotosEleves();
  for (const [nom, base64] of Object.entries(sauvegarde.photos ?? {})) {
    ecrirePhotoBase64(nom, base64);
  }
}

/** Petit récapitulatif pour l'écran de confirmation avant restauration. */
export function resumerSauvegarde(sauvegarde: Sauvegarde) {
  return {
    annees: sauvegarde.tables.anneesScolaires.length,
    classes: sauvegarde.tables.classes.length,
    eleves: sauvegarde.tables.eleves.length,
    evaluations: sauvegarde.tables.evaluations.length,
    notes: sauvegarde.tables.notes.length,
    colles: sauvegarde.tables.colles.length,
  };
}
