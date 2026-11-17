import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db';
import { anneesScolaires } from '@/db/schema';
import { bornesEffectives, type BornesTrimestres } from '@/lib/trimestre';

/**
 * Année scolaire active et ses bornes de trimestre, rafraîchies en direct.
 *
 * `bornes` est toujours défini : si l'utilisateur n'a pas renseigné ses dates,
 * on retombe sur les valeurs par défaut, pour que les trimestres fonctionnent
 * dès le premier lancement.
 */
export function useAnneeActive(): {
  annee: { id: number; libelle: string; finT1: string | null; finT2: string | null } | undefined;
  bornes: BornesTrimestres | undefined;
} {
  const { data } = useLiveQuery(
    db
      .select({
        id: anneesScolaires.id,
        libelle: anneesScolaires.libelle,
        finT1: anneesScolaires.finT1,
        finT2: anneesScolaires.finT2,
      })
      .from(anneesScolaires)
      .where(eq(anneesScolaires.active, true))
      .orderBy(desc(anneesScolaires.id))
      .limit(1),
  );

  const annee = data?.[0];
  const bornes = annee
    ? bornesEffectives(annee.libelle, annee.finT1, annee.finT2)
    : undefined;

  return { annee, bornes };
}
