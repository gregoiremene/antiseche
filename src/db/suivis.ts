import { and, asc, desc, eq } from 'drizzle-orm';

import { aujourdhui } from '@/constants/observations';
import { db } from './index';
import { inscriptions, suivis, type TypeSuivi } from './schema';

/**
 * « À vérifier » : CRUD et lectures pour la page séance et la fiche élève. Les
 * rattrapages de DS ne passent PAS par ici (ils se déduisent des notes).
 */

export async function creerSuivi(params: {
  inscriptionId: number;
  type: TypeSuivi;
  libelle?: string | null;
  observationId?: number | null;
}) {
  const libelle = params.libelle?.trim();
  const [cree] = await db
    .insert(suivis)
    .values({
      inscriptionId: params.inscriptionId,
      type: params.type,
      libelle: libelle && libelle.length > 0 ? libelle : null,
      observationId: params.observationId ?? null,
      ouvertLe: aujourdhui(),
    })
    .returning({ id: suivis.id });
  return cree.id;
}

/** Ouvre le même suivi pour plusieurs élèves d'un coup (saisie groupée). */
export async function creerSuivisEnMasse(
  inscriptionIds: number[],
  type: TypeSuivi,
  libelle?: string | null,
) {
  if (inscriptionIds.length === 0) return;
  const propre = libelle?.trim();
  const ouvertLe = aujourdhui();
  await db.insert(suivis).values(
    inscriptionIds.map((inscriptionId) => ({
      inscriptionId,
      type,
      libelle: propre && propre.length > 0 ? propre : null,
      ouvertLe,
    })),
  );
}

/** Clôture un suivi (réglé) ; `ouvrir` inverse (undo rapide). */
export async function reglerSuivi(id: number) {
  await db
    .update(suivis)
    .set({ statut: 'regle', regleLe: aujourdhui() })
    .where(eq(suivis.id, id));
}

export async function rouvrirSuivi(id: number) {
  await db.update(suivis).set({ statut: 'a_verifier', regleLe: null }).where(eq(suivis.id, id));
}

/** Pose / retire le cran « dernier avertissement » sur un suivi. */
export async function definirDernierAvertissement(id: number, valeur: boolean) {
  await db.update(suivis).set({ dernierAvertissement: valeur }).where(eq(suivis.id, id));
}

export async function supprimerSuivi(id: number) {
  await db.delete(suivis).where(eq(suivis.id, id));
}

/**
 * Suivis OUVERTS de tous les élèves d'une classe (le filtrage par demi-groupe se
 * fait côté écran, à partir de la liste d'élèves déjà filtrée). Triés du plus
 * ancien au plus récent : ce qui traîne remonte en premier.
 */
export function selectSuivisOuvertsClasse(classeId: number) {
  return db
    .select({
      id: suivis.id,
      inscriptionId: suivis.inscriptionId,
      type: suivis.type,
      libelle: suivis.libelle,
      dernierAvertissement: suivis.dernierAvertissement,
      ouvertLe: suivis.ouvertLe,
    })
    .from(suivis)
    .innerJoin(inscriptions, eq(inscriptions.id, suivis.inscriptionId))
    .where(and(eq(inscriptions.classeId, classeId), eq(suivis.statut, 'a_verifier')))
    // ⚠ dernier avertissement en tête, puis du plus ancien au plus récent
    .orderBy(desc(suivis.dernierAvertissement), asc(suivis.ouvertLe));
}

/** Suivis ouverts d'un élève précis (pour sa fiche). */
export function selectSuivisEleve(inscriptionId: number) {
  return db
    .select({
      id: suivis.id,
      type: suivis.type,
      libelle: suivis.libelle,
      dernierAvertissement: suivis.dernierAvertissement,
      ouvertLe: suivis.ouvertLe,
    })
    .from(suivis)
    .where(and(eq(suivis.inscriptionId, inscriptionId), eq(suivis.statut, 'a_verifier')))
    .orderBy(desc(suivis.dernierAvertissement), asc(suivis.ouvertLe));
}

/**
 * Ouvre un suivi `exo` pour chaque élève venant de recevoir un « exo non fait »
 * en saisie rapide, en liant l'observation d'origine. Appelé uniquement avec les
 * observations RÉELLEMENT insérées (pas les doublons ignorés), donc un seul
 * suivi par nouvel incident, sans risque de doublon.
 */
export async function ouvrirSuivisExo(
  liens: { inscriptionId: number; observationId: number }[],
) {
  if (liens.length === 0) return;
  await db.insert(suivis).values(
    liens.map((l) => ({
      inscriptionId: l.inscriptionId,
      type: 'exo' as const,
      observationId: l.observationId,
      ouvertLe: aujourdhui(),
    })),
  );
}
