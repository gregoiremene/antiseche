import { and, between, desc, eq, inArray } from 'drizzle-orm';

import { db } from './index';
import { classes, colles, eleves, inscriptions, observations, type StatutColle, type Surveillance } from './schema';

/**
 * Observations « collables » (exos non faits / oublis) d'un élève sur une
 * période, pour pré-cocher le motif d'une colle.
 */
export function selectObservationsCollables(inscriptionId: number, debut: string, fin: string) {
  return db
    .select({
      id: observations.id,
      type: observations.type,
      date: observations.date,
      commentaire: observations.commentaire,
    })
    .from(observations)
    .where(
      and(
        eq(observations.inscriptionId, inscriptionId),
        between(observations.date, debut, fin),
        inArray(observations.type, ['exo_non_fait', 'materiel_oublie']),
      ),
    )
    .orderBy(observations.date);
}

export async function creerColle(inscriptionId: number, date: string | null, motif: string) {
  const [creee] = await db
    .insert(colles)
    .values({ inscriptionId, date, motif })
    .returning({ id: colles.id });
  return creee.id;
}

type ChampsColle = {
  motif: string;
  date: string | null;
  statut: StatutColle;
  poseePronote: boolean;
  parentsPrevenus: boolean;
  elevePrevenu: boolean;
  heureDebut: string | null;
  heureFin: string | null;
  surveillance: Surveillance | null;
  surveillanceClasse: string | null;
};

export async function majColle(id: number, champs: Partial<ChampsColle>) {
  await db.update(colles).set(champs).where(eq(colles.id, id));
}

export async function supprimerColle(id: number) {
  await db.delete(colles).where(eq(colles.id, id));
}

/**
 * Toutes les colles avec l'élève et sa classe, triées par date. Sert à l'écran
 * transversal ; le filtrage par section (à poser / à prévenir / à vérifier) se
 * fait ensuite en mémoire, c'est peu de lignes.
 */
export function selectCollesDetaillees() {
  return db
    .select({
      id: colles.id,
      inscriptionId: colles.inscriptionId,
      date: colles.date,
      motif: colles.motif,
      statut: colles.statut,
      poseePronote: colles.poseePronote,
      parentsPrevenus: colles.parentsPrevenus,
      elevePrevenu: colles.elevePrevenu,
      heureDebut: colles.heureDebut,
      heureFin: colles.heureFin,
      surveillance: colles.surveillance,
      surveillanceClasse: colles.surveillanceClasse,
      createdAt: colles.createdAt,
      prenom: eleves.prenom,
      nom: eleves.nom,
      mailsParents: eleves.mailsParents,
      classeId: classes.id,
      classe: classes.nom,
      couleur: classes.couleur,
    })
    .from(colles)
    .innerJoin(inscriptions, eq(inscriptions.id, colles.inscriptionId))
    .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
    .innerJoin(classes, eq(classes.id, inscriptions.classeId))
    .orderBy(desc(colles.date));
}

/** Colles d'un élève précis (pour sa fiche). */
export function selectCollesEleve(inscriptionId: number) {
  return db
    .select()
    .from(colles)
    .where(eq(colles.inscriptionId, inscriptionId))
    .orderBy(desc(colles.date));
}
