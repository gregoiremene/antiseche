import { and, eq } from 'drizzle-orm';

import { db } from './index';
import { evaluations, notes } from './schema';

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
