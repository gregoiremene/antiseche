import { asc, eq } from 'drizzle-orm';

import { db } from './index';
import { classes, eleves, inscriptions, type GroupeEdt } from './schema';

/**
 * Gestion des deux demi-groupes d'une classe : leurs libellés (sur la classe)
 * et l'appartenance de chaque élève (sur son inscription). Les groupes sont
 * propres à la classe ; un élève est toujours dans le groupe 1 ou 2.
 */

export type Groupe = 1 | 2;

/** Libellés des deux groupes d'une classe (défauts neutres si non renseignés). */
export function selectLibellesGroupes(classeId: number) {
  return db
    .select({ groupe1Nom: classes.groupe1Nom, groupe2Nom: classes.groupe2Nom })
    .from(classes)
    .where(eq(classes.id, classeId));
}

/**
 * Libellé COMPACT d'un cours ciblé groupe, pour l'affichage dans la grille :
 * le nom donné par le prof s'il a renommé le groupe, sinon la forme courte
 * « G1 »/« G2 ». `null` pour un cours de classe entière.
 */
export function libelleGroupeCompact(groupe: GroupeEdt, g1Nom: string, g2Nom: string): string | null {
  if (groupe === 'g1') return g1Nom === 'Groupe 1' ? 'G1' : g1Nom;
  if (groupe === 'g2') return g2Nom === 'Groupe 2' ? 'G2' : g2Nom;
  return null;
}

/** Nom d'un groupe (1 ou 2) à partir des libellés de la classe. */
export function nomGroupe(
  libelles: { groupe1Nom: string; groupe2Nom: string } | undefined,
  groupe: Groupe,
): string {
  if (!libelles) return `Groupe ${groupe}`;
  return groupe === 1 ? libelles.groupe1Nom : libelles.groupe2Nom;
}

/** Renomme les deux groupes de la classe (libellés vides → défauts neutres). */
export async function renommerGroupes(classeId: number, g1: string, g2: string) {
  await db
    .update(classes)
    .set({
      groupe1Nom: g1.trim() || 'Groupe 1',
      groupe2Nom: g2.trim() || 'Groupe 2',
    })
    .where(eq(classes.id, classeId));
}

/** Change le groupe d'un élève (par son inscription). */
export async function definirGroupeEleve(inscriptionId: number, groupe: Groupe) {
  await db.update(inscriptions).set({ groupe }).where(eq(inscriptions.id, inscriptionId));
}

/**
 * Répartit TOUS les élèves de la classe d'un coup, selon une stratégie basée sur
 * l'ordre d'affichage défini par le prof :
 *   moitie   : la 1ʳᵉ moitié en groupe 1, la 2ᵉ en groupe 2
 *   alternance : un sur deux (rang pair → 1, impair → 2)
 * Tout se joue dans une transaction synchrone (contrainte du driver expo-sqlite,
 * cf. sauvegarde.ts) : un callback async validerait trop tôt.
 */
export async function repartirGroupes(
  classeId: number,
  strategie: 'moitie' | 'alternance',
) {
  const liste = await db
    .select({ id: inscriptions.id })
    .from(inscriptions)
    .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
    .where(eq(inscriptions.classeId, classeId))
    .orderBy(asc(inscriptions.ordre));

  const bascule = Math.ceil(liste.length / 2);
  db.transaction((tx) => {
    liste.forEach((insc, i) => {
      const groupe: Groupe =
        strategie === 'moitie' ? (i < bascule ? 1 : 2) : i % 2 === 0 ? 1 : 2;
      tx.update(inscriptions).set({ groupe }).where(eq(inscriptions.id, insc.id)).run();
    });
  });
}
