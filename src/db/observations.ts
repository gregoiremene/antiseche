import { and, between, count, eq, inArray } from 'drizzle-orm';

import { aujourdhui } from '@/constants/observations';
import { db } from './index';
import { inscriptions, observations, type TypeObservation } from './schema';
import { ouvrirSuivisExo } from './suivis';

/**
 * Compte, par élève et par type, les faits « collables » (exo non fait +
 * matériel oublié) d'une classe sur une période (un trimestre). Sert au
 * compteur de récurrence de la page séance (« 3ᵉ fois → colle »).
 */
export function selectCompteursCollables(classeId: number, debut: string, fin: string) {
  return db
    .select({ inscriptionId: observations.inscriptionId, type: observations.type, n: count() })
    .from(observations)
    .innerJoin(inscriptions, eq(inscriptions.id, observations.inscriptionId))
    .where(
      and(
        eq(inscriptions.classeId, classeId),
        between(observations.date, debut, fin),
        inArray(observations.type, ['exo_non_fait', 'materiel_oublie']),
      ),
    )
    .groupBy(observations.inscriptionId, observations.type);
}

/**
 * Enregistre une observation du même type pour plusieurs élèves d'un coup.
 *
 * Rejouable : si l'élève a déjà cette observation ce jour-là, on ne la
 * duplique pas. En classe on rouvre facilement la saisie deux fois de suite,
 * et compter deux fois le même oubli fausserait les bilans de trimestre.
 */
export async function supprimerObservation(id: number) {
  await db.delete(observations).where(eq(observations.id, id));
}

/** Ajoute ou retire un commentaire libre ("54 p.23"). */
export async function annoterObservation(id: number, commentaire: string) {
  const propre = commentaire.trim();
  await db
    .update(observations)
    .set({ commentaire: propre.length > 0 ? propre : null })
    .where(eq(observations.id, id));
}

/**
 * Pose l'observation si elle n'existe pas, la retire si elle existe déjà.
 *
 * Un tap qui ajoute et un second qui annule : c'est le même geste dans les deux
 * sens, sans message d'erreur à lire. Ça remplace l'ancien refus « déjà noté »,
 * qui obligeait à passer par la liste pour corriger une faute de frappe.
 */
export async function basculerObservation(
  inscriptionId: number,
  type: TypeObservation,
  date = aujourdhui(),
): Promise<'ajoutee' | 'supprimee'> {
  const [existante] = await db
    .select({ id: observations.id })
    .from(observations)
    .where(
      and(
        eq(observations.inscriptionId, inscriptionId),
        eq(observations.type, type),
        eq(observations.date, date),
      ),
    )
    .limit(1);

  if (existante) {
    await db.delete(observations).where(eq(observations.id, existante.id));
    return 'supprimee';
  }

  // onConflictDoNothing : filet contre deux taps simultanés, qui passeraient
  // tous deux le SELECT ci-dessus avant que l'un ait inséré.
  await db.insert(observations).values({ inscriptionId, type, date }).onConflictDoNothing();
  return 'ajoutee';
}

export async function enregistrerObservations(
  inscriptionIds: number[],
  type: TypeObservation,
  date = aujourdhui(),
) {
  if (inscriptionIds.length === 0) return { ajoutees: 0 };

  const dejaLa = await db
    .select({ inscriptionId: observations.inscriptionId })
    .from(observations)
    .where(
      and(
        eq(observations.type, type),
        eq(observations.date, date),
        inArray(observations.inscriptionId, inscriptionIds),
      ),
    );

  const existants = new Set(dejaLa.map((o) => o.inscriptionId));
  const aInserer = inscriptionIds.filter((id) => !existants.has(id));
  if (aInserer.length === 0) return { ajoutees: 0 };

  const inserees = await db
    .insert(observations)
    .values(aInserer.map((inscriptionId) => ({ inscriptionId, type, date })))
    .onConflictDoNothing()
    .returning({ id: observations.id, inscriptionId: observations.inscriptionId });

  // un « exo non fait » ouvre automatiquement un « à vérifier » (exo à rattraper)
  // pour la séance suivante, en gardant le lien vers l'observation d'origine.
  if (type === 'exo_non_fait') {
    await ouvrirSuivisExo(
      inserees.map((o) => ({ inscriptionId: o.inscriptionId, observationId: o.id })),
    );
  }

  return { ajoutees: inserees.length };
}
