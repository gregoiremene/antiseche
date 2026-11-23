import { eq, max } from 'drizzle-orm';

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

  // les nouveaux élèves se rangent après les existants, dans l'ordre de collage
  const [{ maxOrdre } = { maxOrdre: 0 }] = await db
    .select({ maxOrdre: max(inscriptions.ordre) })
    .from(inscriptions)
    .where(eq(inscriptions.classeId, classeId));
  let ordre = maxOrdre ?? 0;

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
      ordre += 1;
      await tx.insert(inscriptions).values({ eleveId: cree.id, classeId, ordre });
      ajoutes++;
    }
  });

  return { ajoutes, ignores };
}

/** Élèves d'une classe, dans l'ordre défini par le prof. */
export function selectElevesOrdonnes(classeId: number) {
  return db
    .select({
      inscriptionId: inscriptions.id,
      eleveId: eleves.id,
      nom: eleves.nom,
      prenom: eleves.prenom,
      amenagements: eleves.amenagements,
      photoUri: eleves.photoUri,
      ordre: inscriptions.ordre,
      groupe: inscriptions.groupe,
    })
    .from(inscriptions)
    .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
    .where(eq(inscriptions.classeId, classeId))
    .orderBy(inscriptions.ordre);
}

/**
 * Déplace un élève d'un cran vers le haut ou le bas en échangeant son `ordre`
 * avec celui de son voisin. Robuste : on relit les rangs réels plutôt que de
 * supposer une numérotation contiguë.
 */
export async function deplacerEleve(
  classeId: number,
  inscriptionId: number,
  sens: 'haut' | 'bas',
) {
  const liste = await db
    .select({ id: inscriptions.id, ordre: inscriptions.ordre })
    .from(inscriptions)
    .where(eq(inscriptions.classeId, classeId))
    .orderBy(inscriptions.ordre);

  const i = liste.findIndex((x) => x.id === inscriptionId);
  const j = sens === 'haut' ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= liste.length) return;

  const a = liste[i];
  const b = liste[j];
  await db.transaction(async (tx) => {
    await tx.update(inscriptions).set({ ordre: b.ordre }).where(eq(inscriptions.id, a.id));
    await tx.update(inscriptions).set({ ordre: a.ordre }).where(eq(inscriptions.id, b.id));
  });
}

/** Met à jour le dossier : aménagements, notes libres et mails parents. */
export async function mettreAJourDossier(
  eleveId: number,
  amenagements: string[],
  infos: string,
  mailsParents: string,
) {
  const propre = infos.trim();
  const mails = mailsParents.trim();
  await db
    .update(eleves)
    .set({
      amenagements,
      infos: propre.length > 0 ? propre : null,
      mailsParents: mails.length > 0 ? mails : null,
    })
    .where(eq(eleves.id, eleveId));
}

/**
 * Enregistre (ou efface) la photo d'un élève. On ne stocke que le NOM DE
 * FICHIER relatif ; la copie/suppression du binaire dans le sandbox est gérée
 * par `@/lib/photos` côté écran. `null` = pas de photo.
 */
export async function definirPhotoEleve(eleveId: number, photoUri: string | null) {
  await db.update(eleves).set({ photoUri }).where(eq(eleves.id, eleveId));
}

/** Retire l'élève de la classe ET supprime sa fiche (notes, observations). */
export async function supprimerEleve(eleveId: number) {
  await db.delete(eleves).where(eq(eleves.id, eleveId));
}
