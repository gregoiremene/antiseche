import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from './index';
import { evaluations, inscriptions, notes } from './schema';

export type NouvelleEvaluation = {
  classeId: number;
  titre: string;
  date: string;
  trimestre: number;
  bareme: number;
  coef: number;
};

export async function creerEvaluation(e: NouvelleEvaluation) {
  const [creee] = await db.insert(evaluations).values(e).returning({ id: evaluations.id });
  return creee.id;
}

/** Supprime l'évaluation et, en cascade, toutes ses notes. */
export async function supprimerEvaluation(id: number) {
  await db.delete(evaluations).where(eq(evaluations.id, id));
}

/**
 * Enregistre la note d'un élève pour une évaluation.
 *
 * `valeur === null` avec `absent === false` signifie « pas encore saisie » :
 * la ligne est alors supprimée plutôt que conservée vide, pour que la base
 * reflète exactement ce qui a été saisi.
 */
/**
 * DS / interros à rattraper pour une classe : élèves marqués `absent` sans
 * valeur et non dispensés (`rattrapageAbandonne`). Dérivé des notes — pas de
 * table de suivi : saisir la note de rattrapage fait disparaître l'item tout
 * seul. Le filtrage par demi-groupe se fait côté écran.
 */
export function selectRattrapagesClasse(classeId: number) {
  return db
    .select({
      inscriptionId: notes.inscriptionId,
      evaluationId: notes.evaluationId,
      titre: evaluations.titre,
      date: evaluations.date,
    })
    .from(notes)
    .innerJoin(evaluations, eq(evaluations.id, notes.evaluationId))
    .innerJoin(inscriptions, eq(inscriptions.id, notes.inscriptionId))
    .where(
      and(
        eq(evaluations.classeId, classeId),
        eq(notes.absent, true),
        isNull(notes.valeur),
        eq(notes.rattrapageAbandonne, false),
      ),
    )
    .orderBy(asc(evaluations.date));
}

/** Évaluations d'une classe (id, titre, date), de la plus récente à la plus ancienne. */
export function selectEvaluationsClasse(classeId: number) {
  return db
    .select({ id: evaluations.id, titre: evaluations.titre, date: evaluations.date })
    .from(evaluations)
    .where(eq(evaluations.classeId, classeId))
    .orderBy(desc(evaluations.date));
}

/**
 * Marque des élèves absents à un DS (note `absent`, sans valeur) pour qu'il
 * remonte en « DS à rattraper », même si aucune note n'avait été saisie.
 * `onConflictDoNothing` : on ne touche jamais une note déjà saisie (on
 * n'écrase pas une vraie note).
 */
export async function marquerAbsentsRattrapage(evaluationId: number, inscriptionIds: number[]) {
  if (inscriptionIds.length === 0) return;
  await db
    .insert(notes)
    .values(inscriptionIds.map((inscriptionId) => ({ evaluationId, inscriptionId, valeur: null, absent: true })))
    .onConflictDoNothing();
}

/** Dispense (ou réactive) le rattrapage d'un DS pour un élève absent. */
export async function definirRattrapageAbandonne(
  evaluationId: number,
  inscriptionId: number,
  abandonne: boolean,
) {
  await db
    .update(notes)
    .set({ rattrapageAbandonne: abandonne })
    .where(and(eq(notes.evaluationId, evaluationId), eq(notes.inscriptionId, inscriptionId)));
}

export async function saisirNote(
  evaluationId: number,
  inscriptionId: number,
  valeur: number | null,
  absent: boolean,
) {
  if (valeur === null && !absent) {
    await db
      .delete(notes)
      .where(
        and(eq(notes.evaluationId, evaluationId), eq(notes.inscriptionId, inscriptionId)),
      );
    return;
  }

  await db
    .insert(notes)
    .values({ evaluationId, inscriptionId, valeur, absent })
    .onConflictDoUpdate({
      target: [notes.evaluationId, notes.inscriptionId],
      set: { valeur, absent },
    });
}
