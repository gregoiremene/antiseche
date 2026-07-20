import { eq } from 'drizzle-orm';

import type { EleveImporte } from '@/lib/import-eleves';
import { db } from './index';
import { eleves, inscriptions } from './schema';

export type ResultatImport = { ajoutes: number; ignores: number };

/**
 * Inscrit une liste d'élèves dans une classe.
 *
 * Un élève déjà présent dans CETTE classe (même nom + prénom) est ignoré, ce
 * qui rend l'import rejouable sans créer de doublons.
 *
 * En revanche on ne réutilise pas automatiquement un élève homonyme d'une autre
 * classe : deux "Martin Léa" dans deux classes sont bien deux personnes
 * différentes. Le rattachement d'un élève d'une année sur l'autre se fera
 * explicitement, à la main.
 */
export async function ajouterEleves(
  classeId: number,
  liste: EleveImporte[],
): Promise<ResultatImport> {
  const dejaLa = await db
    .select({ nom: eleves.nom, prenom: eleves.prenom })
    .from(inscriptions)
    .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
    .where(eq(inscriptions.classeId, classeId));

  const cles = new Set(
    dejaLa.map((e) => `${e.nom}|${e.prenom}`.toLocaleLowerCase('fr-FR')),
  );

  let ajoutes = 0;
  let ignores = 0;

  await db.transaction(async (tx) => {
    for (const e of liste) {
      const cle = `${e.nom}|${e.prenom}`.toLocaleLowerCase('fr-FR');
      if (cles.has(cle)) {
        ignores++;
        continue;
      }
      cles.add(cle);

      const [cree] = await tx
        .insert(eleves)
        .values({ nom: e.nom, prenom: e.prenom })
        .returning({ id: eleves.id });
      await tx.insert(inscriptions).values({ eleveId: cree.id, classeId });
      ajoutes++;
    }
  });

  return { ajoutes, ignores };
}

/** Met à jour le dossier : aménagements et notes libres. */
export async function mettreAJourDossier(
  eleveId: number,
  amenagements: string[],
  infos: string,
) {
  const propre = infos.trim();
  await db
    .update(eleves)
    .set({ amenagements, infos: propre.length > 0 ? propre : null })
    .where(eq(eleves.id, eleveId));
}

/** Retire l'élève de la classe ET supprime sa fiche (notes, observations). */
export async function supprimerEleve(eleveId: number) {
  await db.delete(eleves).where(eq(eleves.id, eleveId));
}
