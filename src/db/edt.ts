import { asc, eq } from 'drizzle-orm';

import { db } from './index';
import { classes, emploisDuTemps, matieres, parametresEdt, type SemaineEdt } from './schema';
import { aujourdhuiISO } from '@/lib/calendrier';
import type { CoursPourCreneau } from '@/lib/creneaux-colle';
import { lundiDeLaSemaine, type TypeSemaine } from '@/lib/semaine-ab';

/** Ligne de cours enrichie du nom/couleur de sa matière (jointure). */
export type CoursEdt = Awaited<ReturnType<typeof selectEdtClasse>>[number];

/** Champs modifiables d'un cours (l'id, la classe et createdAt ne bougent pas). */
export type ChampsCours = {
  jour: number;
  heureDebut: string;
  heureFin: string;
  semaine: SemaineEdt;
  estMonCours: boolean;
  matiereId: number | null;
  salle: string | null;
};

/** Cours d'une classe, triés par jour puis heure — pour l'éditeur d'EDT. */
export function selectEdtClasse(classeId: number) {
  return db
    .select({
      id: emploisDuTemps.id,
      classeId: emploisDuTemps.classeId,
      jour: emploisDuTemps.jour,
      heureDebut: emploisDuTemps.heureDebut,
      heureFin: emploisDuTemps.heureFin,
      semaine: emploisDuTemps.semaine,
      estMonCours: emploisDuTemps.estMonCours,
      matiereId: emploisDuTemps.matiereId,
      salle: emploisDuTemps.salle,
      // texte libre d'avant le gestionnaire de matières, en repli d'affichage
      matiereLibre: emploisDuTemps.matiere,
      matiereNom: matieres.nom,
      matiereCouleur: matieres.couleur,
    })
    .from(emploisDuTemps)
    .leftJoin(matieres, eq(matieres.id, emploisDuTemps.matiereId))
    .where(eq(emploisDuTemps.classeId, classeId))
    .orderBy(asc(emploisDuTemps.jour), asc(emploisDuTemps.heureDebut));
}

/**
 * Crée un cours, éventuellement répété sur plusieurs jours (même horaire,
 * même matière) — c'est le cas courant d'une classe qui a la même heure
 * plusieurs fois dans la semaine, et ça évite de resaisir.
 */
export async function ajouterCours(
  classeId: number,
  jours: number[],
  champs: Omit<ChampsCours, 'jour'>,
) {
  const lignes = jours.map((jour) => ({ classeId, jour, ...champs }));
  if (lignes.length === 0) return;
  await db.insert(emploisDuTemps).values(lignes);
}

export async function majCours(id: number, champs: ChampsCours) {
  await db.update(emploisDuTemps).set(champs).where(eq(emploisDuTemps.id, id));
}

export async function supprimerCours(id: number) {
  await db.delete(emploisDuTemps).where(eq(emploisDuTemps.id, id));
}

/**
 * Paramètres EDT (ligne unique). Créés au premier accès : l'ancre A/B part du
 * lundi de la semaine courante, type A par défaut — le prof corrige d'un tap
 * si cette semaine est en réalité une B.
 */
export async function getOuCreerParametresEdt() {
  const [existant] = await db.select().from(parametresEdt).limit(1);
  if (existant) return existant;

  const ancreLundi = lundiDeLaSemaine(aujourdhuiISO());
  const [creee] = await db
    .insert(parametresEdt)
    .values({ ancreLundi, ancreType: 'A' })
    .returning();
  return creee;
}

/** Fixe l'ancre A/B (le lundi et son type) sur la ligne de paramètres. */
export async function majAncreEdt(id: number, ancreLundi: string, ancreType: TypeSemaine) {
  await db.update(parametresEdt).set({ ancreLundi, ancreType }).where(eq(parametresEdt.id, id));
}

/**
 * EDT complet de l'année de la classe X (toutes les classes), pour la recherche
 * de créneaux de colle : il faut l'emploi du temps de X (dispo de l'élève) ET
 * mes cours dans les autres classes (pour classer vie scolaire / ma salle).
 */
export async function coursPourCreneaux(classeXId: number): Promise<CoursPourCreneau[]> {
  const [x] = await db
    .select({ anneeId: classes.anneeId })
    .from(classes)
    .where(eq(classes.id, classeXId))
    .limit(1);
  if (!x) return [];
  return db
    .select({
      classeId: emploisDuTemps.classeId,
      classeNom: classes.nom,
      jour: emploisDuTemps.jour,
      heureDebut: emploisDuTemps.heureDebut,
      heureFin: emploisDuTemps.heureFin,
      semaine: emploisDuTemps.semaine,
      estMonCours: emploisDuTemps.estMonCours,
    })
    .from(emploisDuTemps)
    .innerJoin(classes, eq(classes.id, emploisDuTemps.classeId))
    .where(eq(classes.anneeId, x.anneeId));
}
