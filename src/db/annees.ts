import { eq } from 'drizzle-orm';

import { db } from './index';
import { anneesScolaires } from './schema';

/**
 * Libellé de l'année scolaire pour une date donnée.
 * Bascule en juillet : en juillet/août on prépare déjà la rentrée suivante.
 */
export function libelleAnneeScolaire(date = new Date()): string {
  const annee = date.getFullYear();
  const debut = date.getMonth() >= 6 ? annee : annee - 1;
  return `${debut}-${debut + 1}`;
}

/** Récupère l'année active, en la créant au premier lancement. */
export async function getOuCreerAnneeActive() {
  const [active] = await db
    .select()
    .from(anneesScolaires)
    .where(eq(anneesScolaires.active, true))
    .limit(1);
  if (active) return active;

  const libelle = libelleAnneeScolaire();
  const [existante] = await db
    .select()
    .from(anneesScolaires)
    .where(eq(anneesScolaires.libelle, libelle))
    .limit(1);

  if (existante) {
    await db
      .update(anneesScolaires)
      .set({ active: true })
      .where(eq(anneesScolaires.id, existante.id));
    return { ...existante, active: true };
  }

  const [creee] = await db
    .insert(anneesScolaires)
    .values({ libelle, active: true })
    .returning();
  return creee;
}
